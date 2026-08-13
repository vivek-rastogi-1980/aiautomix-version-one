import "server-only";

import { createClient } from "@/lib/supabase/server";
import { paged, type PageParams, type Paged } from "@/features/admin/query";
import {
  RESEARCH_STAGES,
  isResearchStage,
  type ResearchStage,
} from "@/features/research/types";
import type {
  ResearchRequestRow,
  ResearchRunRow,
  ResearchRunStageRow,
} from "@/types/database";

/**
 * Research operations for the admin panel.
 *
 * A sibling of `data.ts` rather than more of it: the research pipeline has its
 * own vocabulary — stages, attempts, evidence — and folding ~200 lines of it
 * into an already-435-line module would make the file a grab bag rather than a
 * data layer.
 *
 * Like everything else in this feature, these queries run as the signed-in
 * admin's own session. There is no service-role client in this application; the
 * cross-workspace reach comes from the `admin_has('ai.read')` SELECT policies
 * that migration 0009 put on every research table. A caller without that grant
 * gets no rows — a blank page, not a breach.
 */

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export interface ResearchOpsFilters {
  status?: string;
  depth?: string;
  stage?: string;
  workspaceId?: string;
  userId?: string;
  since?: string;
  until?: string;
}

export interface ResearchOpsRow {
  runId: string;
  requestId: string;
  title: string;
  workspaceId: string;
  workspaceName: string | null;
  userId: string;
  depth: string;
  status: string;
  currentStage: string | null;
  /** Total stage attempts recorded across the run. */
  attempts: number;
  /** Attempts that failed — the reliability signal. */
  failedAttempts: number;
  sourceCount: number;
  evidenceCount: number;
  creditsCharged: number;
  creditsRefunded: number;
  totalTokens: number;
  estimatedCostUsd: number;
  /** Wall-clock from first stage start to completion, or null while running. */
  durationMs: number | null;
  error: string | null;
  createdAt: string;
}

/** Shape of the joined select below. PostgREST nests the related rows. */
type RunWithRelations = ResearchRunRow & {
  research_requests: Pick<
    ResearchRequestRow,
    "id" | "title" | "user_id" | "depth"
  > | null;
  workspaces: { name: string } | null;
};

/**
 * Research runs, newest first, filtered and paged in the database.
 *
 * Every filter is applied as a predicate on the query rather than to the
 * result: fetching runs and then discarding them in React would page over the
 * wrong set, so a filtered page-two would show rows page-one already displayed.
 */
export async function listResearchRuns(
  params: PageParams,
  filters: ResearchOpsFilters = {},
): Promise<Paged<ResearchOpsRow>> {
  const supabase = await createClient();

  let query = supabase
    .from("research_runs")
    .select(
      "*, research_requests!inner(id, title, user_id, depth), workspaces(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(params.from, params.to);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.depth) query = query.eq("depth", filters.depth);
  if (filters.stage) query = query.eq("current_stage", filters.stage);
  if (filters.workspaceId)
    query = query.eq("workspace_id", filters.workspaceId);
  if (filters.since) query = query.gte("created_at", filters.since);
  if (filters.until) query = query.lte("created_at", filters.until);
  // The user lives on the request, not the run — filtered through the inner
  // join rather than by loading runs and comparing in TypeScript.
  if (filters.userId) {
    query = query.eq("research_requests.user_id", filters.userId);
  }

  const { data, count, error } = await query;
  if (error) return paged<ResearchOpsRow>([], 0, params);

  const runs = (data ?? []) as unknown as RunWithRelations[];
  const attempts = await attemptCounts(runs.map((run) => run.id));

  const rows: ResearchOpsRow[] = runs.map((run) => {
    const counts = attempts.get(run.id) ?? { total: 0, failed: 0 };
    return {
      runId: run.id,
      requestId: run.research_request_id,
      title: run.research_requests?.title ?? "Untitled research",
      workspaceId: run.workspace_id,
      workspaceName: run.workspaces?.name ?? null,
      userId: run.research_requests?.user_id ?? "",
      depth: run.depth,
      status: run.status,
      currentStage: run.current_stage,
      attempts: counts.total,
      failedAttempts: counts.failed,
      sourceCount: run.source_count,
      evidenceCount: run.evidence_count,
      creditsCharged: run.credits_charged,
      creditsRefunded: run.credits_refunded,
      totalTokens: run.total_tokens,
      estimatedCostUsd: Number(run.estimated_cost_usd ?? 0),
      durationMs: runDuration(run),
      error: run.error,
      createdAt: run.created_at,
    };
  });

  return paged<ResearchOpsRow>(rows, count ?? 0, params);
}

/**
 * Attempt counts for the runs on THIS page only.
 *
 * One extra query for at most `pageSize` runs, rather than a correlated
 * subquery per row or a count fetched inside the list loop. The `in` list is
 * bounded by the page size, which `pageParams` caps at 100.
 */
async function attemptCounts(
  runIds: string[],
): Promise<Map<string, { total: number; failed: number }>> {
  const out = new Map<string, { total: number; failed: number }>();
  if (runIds.length === 0) return out;

  const supabase = await createClient();
  const { data } = await supabase
    .from("research_run_stages")
    .select("run_id, status")
    .in("run_id", runIds);

  for (const row of data ?? []) {
    const entry = out.get(row.run_id) ?? { total: 0, failed: 0 };
    entry.total += 1;
    if (row.status === "failed") entry.failed += 1;
    out.set(row.run_id, entry);
  }
  return out;
}

function runDuration(run: ResearchRunRow): number | null {
  if (!run.started_at || !run.completed_at) return null;
  const ms =
    new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

// ---------------------------------------------------------------------------
// Detail — the execution timeline
// ---------------------------------------------------------------------------

export interface StageTimelineEntry {
  stage: ResearchStage;
  /** Every attempt at this stage, oldest first. */
  attempts: {
    attempt: number;
    status: string;
    durationMs: number | null;
    creditsCharged: number;
    creditsRefunded: number;
    totalTokens: number | null;
    errorCode: string | null;
    errorMessage: string | null;
    startedAt: string;
    completedAt: string | null;
  }[];
  /** Rolled up from the attempts, so the row and its history agree. */
  outcome: "pending" | "running" | "succeeded" | "failed";
}

export interface ResearchOpsDetail {
  run: ResearchRunRow;
  request: ResearchRequestRow;
  workspaceName: string | null;
  /** Display name. This application never exposes customer email addresses. */
  ownerName: string | null;
  timeline: StageTimelineEntry[];
  /** The stage that failed and has not since succeeded, if any. */
  failedStage: ResearchStage | null;
  totalCreditsCharged: number;
  totalCreditsRefunded: number;
}

/**
 * One run, with every stage attempt.
 *
 * This is the view whose entire purpose is answering "which stage failed, and
 * why" — so the timeline lists all seven stages including the ones that never
 * ran, rather than only the rows that exist. A pipeline that stopped at
 * `discovery` should visibly stop there, not simply end.
 */
export async function getResearchRunDetail(
  runId: string,
): Promise<ResearchOpsDetail | null> {
  const supabase = await createClient();

  const { data: run } = await supabase
    .from("research_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (!run) return null;

  const [requestRes, workspaceRes, stagesRes] = await Promise.all([
    supabase
      .from("research_requests")
      .select("*")
      .eq("id", run.research_request_id)
      .maybeSingle(),
    supabase
      .from("workspaces")
      .select("name")
      .eq("id", run.workspace_id)
      .maybeSingle(),
    supabase
      .from("research_run_stages")
      .select("*")
      .eq("run_id", runId)
      .order("started_at", { ascending: true }),
  ]);

  if (!requestRes.data) return null;

  const stageRows = (stagesRes.data ?? []) as ResearchRunStageRow[];

  // The owner's name, for display only. `profiles` deliberately carries no
  // email — addresses live in `auth.users` and this application never surfaces
  // them — so the panel identifies a customer by name and id. It is still PII,
  // so the page gates it on `users.read` rather than showing it to every role
  // that can see the run.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", requestRes.data.user_id)
    .maybeSingle();

  const timeline: StageTimelineEntry[] = RESEARCH_STAGES.map((stage) => {
    const attempts = stageRows
      .filter((row) => row.stage === stage)
      .map((row) => ({
        attempt: row.attempt,
        status: row.status,
        durationMs: row.duration_ms,
        creditsCharged: row.credits_charged,
        creditsRefunded: row.credits_refunded,
        totalTokens: row.total_tokens,
        errorCode: row.error_code,
        errorMessage: row.error_message,
        startedAt: row.started_at,
        completedAt: row.completed_at,
      }));

    const outcome: StageTimelineEntry["outcome"] = attempts.some(
      (a) => a.status === "succeeded",
    )
      ? "succeeded"
      : attempts.some((a) => a.status === "running")
        ? "running"
        : attempts.some((a) => a.status === "failed")
          ? "failed"
          : "pending";

    return { stage, attempts, outcome };
  });

  const failed = timeline.find((entry) => entry.outcome === "failed");

  return {
    run,
    request: requestRes.data,
    workspaceName: workspaceRes.data?.name ?? null,
    ownerName: profile?.full_name ?? null,
    timeline,
    failedStage: failed && isResearchStage(failed.stage) ? failed.stage : null,
    totalCreditsCharged: stageRows.reduce(
      (sum, row) => sum + row.credits_charged,
      0,
    ),
    totalCreditsRefunded: stageRows.reduce(
      (sum, row) => sum + row.credits_refunded,
      0,
    ),
  };
}

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

/**
 * Values for the filter dropdowns.
 *
 * Statuses, depths and stages come from the application's own vocabulary, not
 * from a `select distinct` — the lists are fixed by SQL check constraints, so
 * querying for them would be a round trip to rediscover a constant.
 */
export function researchFacets(): {
  statuses: string[];
  depths: string[];
  stages: readonly string[];
} {
  return {
    statuses: ["pending", "running", "completed", "failed", "cancelled"],
    depths: ["basic", "standard", "deep"],
    stages: RESEARCH_STAGES,
  };
}

/** Research/product counters, aggregated in SQL and permission-gated there. */
export async function getResearchStats(
  since?: Date,
): Promise<Record<string, number | string> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_research_stats", {
    p_since: since ? since.toISOString() : null,
  });
  if (error) return null;
  return (data as Record<string, number | string>) ?? null;
}
