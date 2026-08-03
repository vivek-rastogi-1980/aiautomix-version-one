import "server-only";

import { getWorkflowLabel } from "@/features/ai/registry/workflows";
import { createClient } from "@/lib/supabase/server";

/**
 * Usage metrics (USAGE-TRACKING-SPEC.md: "Expose metrics for future billing and
 * analytics").
 *
 * Aggregation happens in application code over a bounded window rather than in
 * SQL. At MVP volumes that is simpler and keeps the RLS story trivial; the
 * natural upgrade is a Postgres view or a materialised rollup once a single
 * user's log count makes the window scan expensive.
 */

export interface UsageTotals {
  runs: number;
  successes: number;
  failures: number;
  totalTokens: number;
  promptTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  /** Mean duration of successful runs, or null when there are none. */
  averageDurationMs: number | null;
}

export interface WorkflowUsage {
  workflow: string;
  label: string;
  runs: number;
  successes: number;
  failures: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface UsageSummary {
  /** Size of the reporting window, in days. */
  windowDays: number;
  totals: UsageTotals;
  byWorkflow: WorkflowUsage[];
}

export const DEFAULT_USAGE_WINDOW_DAYS = 30;
const MAX_ROWS = 1000;

/** `numeric` columns arrive as strings from PostgREST to preserve precision. */
function toNumber(value: string | number | null): number {
  if (value === null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Aggregated usage for one user over the trailing window. */
export async function getUsageSummary(
  userId: string,
  windowDays: number = DEFAULT_USAGE_WINDOW_DAYS,
): Promise<UsageSummary> {
  const supabase = await createClient();
  const since = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data } = await supabase
    .from("ai_usage_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  const rows = data ?? [];

  const totals: UsageTotals = {
    runs: rows.length,
    successes: 0,
    failures: 0,
    totalTokens: 0,
    promptTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    averageDurationMs: null,
  };

  const byWorkflow = new Map<string, WorkflowUsage>();
  let durationSum = 0;
  let durationCount = 0;

  for (const row of rows) {
    const succeeded = row.status === "success";
    const tokens = row.total_tokens ?? 0;
    const cost = toNumber(row.estimated_cost_usd);

    if (succeeded) totals.successes += 1;
    else totals.failures += 1;

    totals.totalTokens += tokens;
    totals.promptTokens += row.prompt_tokens ?? 0;
    totals.outputTokens += row.output_tokens ?? 0;
    totals.estimatedCostUsd += cost;

    if (succeeded && row.duration_ms !== null) {
      durationSum += row.duration_ms;
      durationCount += 1;
    }

    const entry = byWorkflow.get(row.workflow) ?? {
      workflow: row.workflow,
      label: getWorkflowLabel(row.workflow),
      runs: 0,
      successes: 0,
      failures: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    };

    entry.runs += 1;
    if (succeeded) entry.successes += 1;
    else entry.failures += 1;
    entry.totalTokens += tokens;
    entry.estimatedCostUsd += cost;

    byWorkflow.set(row.workflow, entry);
  }

  totals.estimatedCostUsd = round(totals.estimatedCostUsd, 6);
  totals.averageDurationMs =
    durationCount > 0 ? Math.round(durationSum / durationCount) : null;

  return {
    windowDays,
    totals,
    byWorkflow: [...byWorkflow.values()]
      .map((entry) => ({
        ...entry,
        estimatedCostUsd: round(entry.estimatedCostUsd, 6),
      }))
      .sort((a, b) => b.runs - a.runs),
  };
}
