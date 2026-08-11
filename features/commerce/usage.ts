import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Usage metering (USAGE-METERING-SPEC.md).
 *
 * Reads the workspace's usage ledger. There is no write path here on purpose:
 * usage rows are written exactly once, by the Workflow Manager's
 * `recordWorkflowRun`, at the end of every AI run. Adding a second writer would
 * create the double-counting the spec's "append-oriented, do not overwrite
 * historical usage" rule exists to prevent.
 *
 * The ledger is `ai_usage_logs`, which migration 0007 extended with
 * `workspace_id`. That table already carried every field the spec lists —
 * see the deviation note at the head of 0007 for why it was extended rather
 * than duplicated into a new `usage_events` table.
 */

export interface UsageEvent {
  id: string;
  workflow: string;
  provider: string;
  model: string;
  status: string;
  prompt_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  duration_ms: number | null;
  /** `numeric` arrives from PostgREST as a string to preserve precision. */
  estimated_cost_usd: string | null;
  created_at: string;
}

export interface UsageSummary {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  totalTokens: number;
  estimatedCostUsd: number;
  /** Runs per workflow slug. */
  byWorkflow: Record<string, number>;
}

/** Recent usage for a workspace, newest first. */
export async function getWorkspaceUsage(
  workspaceId: string,
  limit = 25,
): Promise<UsageEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_usage_logs")
    .select(
      "id, workflow, provider, model, status, prompt_tokens, output_tokens, total_tokens, duration_ms, estimated_cost_usd, created_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as UsageEvent[];
}

/**
 * Aggregate usage over a window.
 *
 * Summed in application code rather than SQL because the row counts here are
 * small (a workspace's runs within a billing period) and doing it here keeps
 * the query a single indexed range scan on `(workspace_id, created_at)`. If a
 * workspace ever generates enough runs for this to matter, it becomes a
 * materialised view — the call site does not change.
 */
export async function getUsageSummary(
  workspaceId: string,
  sinceIso?: string,
): Promise<UsageSummary> {
  const supabase = await createClient();
  let query = supabase
    .from("ai_usage_logs")
    .select("workflow, status, total_tokens, estimated_cost_usd")
    .eq("workspace_id", workspaceId);

  if (sinceIso) query = query.gte("created_at", sinceIso);

  const { data } = await query;
  const rows = data ?? [];

  const summary: UsageSummary = {
    totalRuns: rows.length,
    successfulRuns: 0,
    failedRuns: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    byWorkflow: {},
  };

  for (const row of rows) {
    if (row.status === "success") summary.successfulRuns += 1;
    else summary.failedRuns += 1;

    summary.totalTokens += row.total_tokens ?? 0;
    summary.estimatedCostUsd += Number(row.estimated_cost_usd ?? 0);
    summary.byWorkflow[row.workflow] =
      (summary.byWorkflow[row.workflow] ?? 0) + 1;
  }

  return summary;
}

/** Start of the current calendar month, UTC — the default metering window. */
export function currentPeriodStart(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

/**
 * How many times a workflow has run this period — the input to a quota check.
 * Counts successes only: a failed run the customer did not benefit from should
 * not consume their allowance.
 */
export async function countWorkflowRuns(
  workspaceId: string,
  workflow: string,
  sinceIso: string = currentPeriodStart(),
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("workflow", workflow)
    .eq("status", "success")
    .gte("created_at", sinceIso);
  return count ?? 0;
}
