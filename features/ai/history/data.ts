import "server-only";

import { getProviderLabel } from "@/features/ai/providers";
import { getWorkflowLabel } from "@/features/ai/registry/workflows";
import { createClient } from "@/lib/supabase/server";
import type {
  AiRequestLog,
  AiResponseRecord,
  AiRunStatus,
} from "@/types/database";

/**
 * AI History (AI-HISTORY-SPEC.md).
 *
 * Read side of the execution log: which workflow ran, with which prompt version
 * and model, what it cost, and — when the run produced a stored report — a link
 * back to it so the user can reopen previous reports.
 *
 * All queries are owner-scoped in SQL *and* protected by RLS. The explicit
 * `user_id` filter is not redundant: it keeps the index in play and makes the
 * ownership contract visible at the call site.
 */

export interface AiRunSummary {
  id: string;
  workflow: string;
  workflowLabel: string;
  promptVersion: string;
  provider: string;
  providerLabel: string;
  model: string;
  status: AiRunStatus;
  durationMs: number | null;
  totalTokens: number | null;
  attempts: number;
  errorCode: string | null;
  createdAt: string;
  /** Set when this run produced a stored validation report. */
  reportId: string | null;
}

export interface AiRunDetail extends AiRunSummary {
  errorMessage: string | null;
  promptTokens: number | null;
  outputTokens: number | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
}

export interface AiHistoryQuery {
  /** Filter to a single workflow slug. */
  workflow?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Map request ids to the report they produced, for the "reopen" link. */
async function findReportIds(
  userId: string,
  requestIds: string[],
): Promise<Map<string, string>> {
  if (requestIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase
    .from("validation_reports")
    .select("id, ai_request_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("ai_request_id", requestIds);

  const byRequest = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.ai_request_id) byRequest.set(row.ai_request_id, row.id);
  }
  return byRequest;
}

function toSummary(
  row: AiRequestLog,
  reportId: string | null = null,
): AiRunSummary {
  return {
    id: row.id,
    workflow: row.workflow,
    workflowLabel: getWorkflowLabel(row.workflow),
    promptVersion: row.prompt_version,
    provider: row.provider,
    providerLabel: getProviderLabel(row.provider),
    model: row.model,
    status: row.status,
    durationMs: row.duration_ms,
    totalTokens: row.total_tokens,
    attempts: row.attempts,
    errorCode: row.error_code,
    createdAt: row.created_at,
    reportId,
  };
}

/** Execution history for the current user, newest first. */
export async function getAiRuns(
  userId: string,
  query: AiHistoryQuery = {},
): Promise<AiRunSummary[]> {
  const supabase = await createClient();
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  let request = supabase
    .from("ai_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (query.workflow) {
    request = request.eq("workflow", query.workflow);
  }

  const { data } = await request;
  const rows = data ?? [];

  const reportIds = await findReportIds(
    userId,
    rows.map((row) => row.id),
  );

  return rows.map((row) => toSummary(row, reportIds.get(row.id) ?? null));
}

/** A single run with its stored input and validated output. */
export async function getAiRun(
  userId: string,
  runId: string,
): Promise<AiRunDetail | null> {
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("ai_requests")
    .select("*")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!request) return null;

  const [{ data: response }, reportIds] = await Promise.all([
    supabase
      .from("ai_responses")
      .select("*")
      .eq("request_id", runId)
      .eq("user_id", userId)
      .maybeSingle<AiResponseRecord>(),
    findReportIds(userId, [runId]),
  ]);

  return {
    ...toSummary(request, reportIds.get(runId) ?? null),
    errorMessage: request.error_message,
    promptTokens: request.prompt_tokens,
    outputTokens: request.output_tokens,
    input: request.input_json,
    output: response?.output_json ?? null,
  };
}
