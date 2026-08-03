import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AiUsage } from "@/features/ai/engine/types";
import type { AiRunStatus } from "@/types/database";

/**
 * Usage Tracking (USAGE-TRACKING-SPEC.md) and AI History (AI-HISTORY-SPEC.md).
 *
 * One call at the end of a run writes all three history tables:
 *   ai_requests    what was asked, by whom, with what prompt and model
 *   ai_responses   the validated JSON that came back (successes only)
 *   ai_usage_logs  tokens, duration and estimated cost, for analytics
 *
 * Tracking must never cost the user their result, so every failure here is
 * swallowed after a console warning. The tables are append-only by policy —
 * a single insert at the end of the run keeps them that way, at the cost of not
 * recording runs whose process dies mid-flight.
 */

export interface WorkflowRunRecord {
  userId: string;
  projectId?: string | null;
  workflow: string;
  promptVersion: string;
  provider: string;
  model: string;
  status: AiRunStatus;
  durationMs: number;
  attempts: number;
  usage: AiUsage;
  estimatedCostUsd: number | null;
  /** Validated workflow input. */
  input: unknown;
  /** Validated workflow output — present on success. */
  output?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

/** Narrow arbitrary data to something a `jsonb` column will accept. */
function toJsonObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Persist a completed run. Returns the `ai_requests.id` so callers can link
 * domain rows (for example a validation report) back to the execution that
 * produced them, or `null` when logging was unavailable.
 */
export async function recordWorkflowRun(
  record: WorkflowRunRecord,
): Promise<string | null> {
  try {
    const supabase = await createClient();

    const { data: request, error } = await supabase
      .from("ai_requests")
      .insert({
        user_id: record.userId,
        project_id: record.projectId ?? null,
        workflow: record.workflow,
        prompt_version: record.promptVersion,
        provider: record.provider,
        model: record.model,
        status: record.status,
        duration_ms: record.durationMs,
        prompt_tokens: record.usage.promptTokens,
        output_tokens: record.usage.outputTokens,
        total_tokens: record.usage.totalTokens,
        attempts: record.attempts,
        input_json: toJsonObject(record.input),
        error_code: record.errorCode ?? null,
        error_message: record.errorMessage?.slice(0, 500) ?? null,
      })
      .select("id")
      .single();

    if (error || !request) {
      console.warn("[ai] failed to log request", error);
      return null;
    }

    const output = toJsonObject(record.output);

    await Promise.all([
      output
        ? supabase.from("ai_responses").insert({
            request_id: request.id,
            user_id: record.userId,
            workflow: record.workflow,
            prompt_version: record.promptVersion,
            model: record.model,
            output_json: output,
          })
        : Promise.resolve(),
      supabase.from("ai_usage_logs").insert({
        user_id: record.userId,
        project_id: record.projectId ?? null,
        request_id: request.id,
        workflow: record.workflow,
        provider: record.provider,
        model: record.model,
        prompt_version: record.promptVersion,
        status: record.status,
        prompt_tokens: record.usage.promptTokens,
        output_tokens: record.usage.outputTokens,
        total_tokens: record.usage.totalTokens,
        duration_ms: record.durationMs,
        estimated_cost_usd: record.estimatedCostUsd,
      }),
    ]);

    return request.id;
  } catch (error) {
    console.warn("[ai] failed to record workflow run", error);
    return null;
  }
}
