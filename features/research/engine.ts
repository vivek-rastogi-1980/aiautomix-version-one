import "server-only";

import { createClient } from "@/lib/supabase/server";
import { runWorkflow } from "@/features/ai/engine/workflow-manager";
import { AiError, toAiError } from "@/features/ai/engine/errors";
import type { AiRetrievedSource } from "@/features/ai/engine/types";
import { canAccess } from "@/features/commerce/entitlements";
import { debitCredits, refundCredits } from "@/features/commerce/credits";
import {
  RESEARCH_STAGES,
  RETRIEVAL_STAGES,
  nextStage,
  type ResearchStage,
} from "@/features/research/types";
import { stageCost, chargeKey, refundKey } from "@/features/research/cost";
import {
  RESEARCH_MAX_STAGE_ATTEMPTS,
  RESEARCH_STAGE_LOCK_TIMEOUT_MS,
} from "@/features/research/constants";
import { RESEARCH_WORKFLOW_IDS } from "@/features/research/stages/workflows";
import {
  buildStageInput,
  mapStageOutput,
} from "@/features/research/stages/mapping";

/**
 * The Market Research stage engine.
 *
 * One call executes exactly ONE stage. The order is:
 *
 *   entitlement → claim (locks) → charge → run → validate → persist+advance
 *
 * and on failure: record failure (no advance) → refund that stage.
 *
 * Everything authoritative is derived server-side. The caller supplies a run id
 * and nothing else: not the stage, not the attempt, not the depth, not the
 * cost. A client that could name its own stage could skip straight to `report`
 * and pay seven credits for a report with no evidence behind it.
 */

/**
 * Central retry policy, now in `features/research/constants.ts` so the Phase 4
 * pipeline UI can read the same number without importing this `server-only`
 * module. Re-exported here because the engine is where callers expect it.
 */
export {
  RESEARCH_MAX_STAGE_ATTEMPTS,
  RESEARCH_STAGE_LOCK_TIMEOUT_MS,
} from "@/features/research/constants";

export interface StageExecutionResult {
  runId: string;
  stage: ResearchStage;
  attempt: number;
  status: "succeeded" | "failed";
  nextStage: ResearchStage | null;
  currentStage: ResearchStage | null;
  completed: boolean;
  creditsCharged: number;
  creditsRefunded: number;
  sourcesAdded: number;
  evidenceAdded: number;
  error?: { code: string; message: string; retryable: boolean };
}

interface ClaimedStage {
  stage: ResearchStage;
  attempt: number;
  depth: string;
  workspaceId: string;
  requestId: string;
}

/**
 * Execute the next stage of a run.
 *
 * @param runId  The run. Ownership is re-verified inside the database.
 * @param userId The caller, for usage attribution and rate limiting.
 */
export async function runNextStage(
  runId: string,
  userId: string,
): Promise<StageExecutionResult> {
  const supabase = await createClient();

  // --- 1. Claim ------------------------------------------------------------
  // First, because the claim is what serialises concurrent callers. Checking
  // entitlement or cost before taking the lock would let two tabs both pass
  // the checks and then both execute.
  const { data: claimRows, error: claimError } = await supabase.rpc(
    "research_claim_stage",
    {
      p_run_id: runId,
      p_max_attempts: RESEARCH_MAX_STAGE_ATTEMPTS,
      p_lock_timeout_ms: RESEARCH_STAGE_LOCK_TIMEOUT_MS,
    },
  );

  if (claimError || !claimRows?.length) {
    throw new AiError(
      "AI_INVALID_INPUT",
      claimError?.message ?? "This research run has no stage left to execute.",
      false,
    );
  }

  const claim: ClaimedStage = {
    stage: claimRows[0].stage as ResearchStage,
    attempt: claimRows[0].attempt,
    depth: claimRows[0].depth,
    workspaceId: claimRows[0].workspace_id,
    requestId: claimRows[0].request_id,
  };

  return executeClaimedStage(runId, claim, userId);
}

/**
 * Re-run the `report` stage alone, on research that already produced a report.
 *
 * Regeneration exists because a report can be wrong or stale while the evidence
 * behind it is fine. Re-running the whole pipeline to fix the wording would
 * re-charge for two web-search stages and return different sources — a worse
 * report at a higher price.
 *
 * The narrowing lives in SQL (`research_claim_report_regeneration` refuses
 * anything but a `report` stage on a run that already has a successful one), so
 * this cannot be used to skip ahead to a report with no evidence behind it. The
 * `report` workflow reads only stored rows, so nothing here touches the web.
 *
 * Everything after the claim is the same code path as an ordinary stage: same
 * entitlement check, same charge, same persistence, same refund on failure.
 */
export async function regenerateReport(
  requestId: string,
  userId: string,
): Promise<StageExecutionResult> {
  const supabase = await createClient();

  const { data: claimRows, error: claimError } = await supabase.rpc(
    "research_claim_report_regeneration",
    {
      p_request_id: requestId,
      p_lock_timeout_ms: RESEARCH_STAGE_LOCK_TIMEOUT_MS,
    },
  );

  if (claimError || !claimRows?.length) {
    throw new AiError(
      "AI_INVALID_INPUT",
      claimError?.message ??
        "This research has no completed report to regenerate.",
      false,
    );
  }

  const row = claimRows[0];
  return executeClaimedStage(
    row.run_id,
    {
      stage: "report",
      attempt: row.attempt,
      depth: row.depth,
      workspaceId: row.workspace_id,
      requestId: row.request_id,
    },
    userId,
  );
}

/**
 * Everything after a stage has been claimed: entitlement, charge, execute,
 * validate, persist, advance — and on failure, record then refund.
 *
 * Extracted so report regeneration reuses it rather than reimplementing it. A
 * second copy of this sequence would be a second place for the charge/refund
 * ordering to drift, and a stage that charges without refunding is the kind of
 * bug users notice on their invoice rather than in a test.
 */
async function executeClaimedStage(
  runId: string,
  claim: ClaimedStage,
  userId: string,
): Promise<StageExecutionResult> {
  const supabase = await createClient();

  const cost = stageCost(claim.depth as never, claim.stage);
  let charged = 0;

  try {
    // --- 2. Entitlement --------------------------------------------------
    // After the claim (so it is serialised) but before any spend.
    const access = await canAccess(claim.workspaceId, "market_research");
    if (!access.allowed) {
      throw new AiError(
        "AI_INVALID_INPUT",
        "This workspace's plan does not include Market Research.",
        false,
      );
    }

    // --- 3. Charge -------------------------------------------------------
    // Before execution: a stage that calls the provider and then crashes has
    // still spent tokens. The refund path covers the case where it failed
    // before doing anything expensive.
    await debitCredits({
      workspaceId: claim.workspaceId,
      amount: cost,
      reason: `Market research — ${claim.stage} (attempt ${claim.attempt})`,
      workflow: RESEARCH_WORKFLOW_IDS[claim.stage],
      idempotencyKey: chargeKey(runId, claim.stage, claim.attempt),
      createdBy: userId,
    });
    charged = cost;

    // --- 4. Execute one stage through the platform engine ----------------
    const input = await buildStageInput(
      supabase,
      claim.requestId,
      claim.stage,
      claim.depth,
    );

    const started = Date.now();
    const result = await runWorkflow<unknown>({
      workflowId: RESEARCH_WORKFLOW_IDS[claim.stage],
      userId,
      workspaceId: claim.workspaceId,
      input,
    });
    const durationMs = Date.now() - started;

    // --- 5. Map validated output onto rows -------------------------------
    const providerSources = (result.sources ?? []) as AiRetrievedSource[];

    // A retrieval stage that surfaced nothing has not done its job. Treating it
    // as success would let the run proceed to evidence extraction with no
    // sources, producing analysis with nothing behind it — the exact outcome
    // the evidence model is built to prevent. Failing here refunds the stage
    // and lets it retry.
    if (
      RETRIEVAL_STAGES.includes(claim.stage) &&
      providerSources.length === 0
    ) {
      throw new AiError(
        "AI_VALIDATION_FAILED",
        "The search returned no usable sources for this stage. Retry, or widen the research scope.",
        true,
      );
    }

    const mapped = mapStageOutput(claim.stage, result.data, providerSources);

    // --- 6. Persist AND advance, atomically ------------------------------
    const next = nextStage(claim.stage);
    const { data: completion, error: completeError } = await supabase.rpc(
      "research_complete_stage",
      {
        p_run_id: runId,
        p_stage: claim.stage,
        p_attempt: claim.attempt,
        p_next_stage: next,
        p_results: mapped.results,
        p_sources: mapped.sources,
        p_evidence: mapped.evidence,
        p_usage: {
          prompt_tokens: result.metadata.promptTokens,
          output_tokens: result.metadata.outputTokens,
          total_tokens: result.metadata.tokens,
          duration_ms: durationMs,
          estimated_cost_usd: result.metadata.estimatedCostUsd,
        },
      },
    );

    if (completeError) {
      // Persistence failed after the model ran. The stage is a failure and the
      // pointer must not move — which is exactly what the catch below does.
      throw new AiError("AI_PROVIDER_ERROR", completeError.message, true);
    }

    const summary = (completion ?? {}) as {
      sources_added?: number;
      evidence_added?: number;
    };

    return {
      runId,
      stage: claim.stage,
      attempt: claim.attempt,
      status: "succeeded",
      nextStage: next,
      currentStage: next,
      completed: next === null,
      creditsCharged: charged,
      creditsRefunded: 0,
      sourcesAdded: summary.sources_added ?? 0,
      evidenceAdded: summary.evidence_added ?? 0,
    };
  } catch (error) {
    const aiError = toAiError(error);

    // --- 7. Record the failure. current_stage is NOT advanced. -----------
    const terminal = claim.attempt >= RESEARCH_MAX_STAGE_ATTEMPTS;
    await supabase.rpc("research_fail_stage", {
      p_run_id: runId,
      p_stage: claim.stage,
      p_attempt: claim.attempt,
      p_error_code: aiError.code,
      p_error_message: aiError.message,
      p_terminal: terminal,
      p_usage: {},
    });

    // --- 8. Refund this stage, once. -------------------------------------
    // Keyed by attempt, so a repeated failure handler cannot double-refund and
    // a retry's charge is a separate, honest entry.
    let refunded = 0;
    if (charged > 0) {
      try {
        await refundCredits({
          workspaceId: claim.workspaceId,
          amount: charged,
          reason: `Refund — ${claim.stage} failed (attempt ${claim.attempt})`,
          workflow: RESEARCH_WORKFLOW_IDS[claim.stage],
          idempotencyKey: refundKey(runId, claim.stage, claim.attempt),
          createdBy: userId,
        });
        refunded = charged;
      } catch (refundError) {
        // A failed refund must not mask the original failure, but it must be
        // visible: the workspace is out of pocket until it is reconciled.
        console.error("[research] refund failed", {
          runId,
          stage: claim.stage,
          attempt: claim.attempt,
          error:
            refundError instanceof Error ? refundError.message : refundError,
        });
      }
    }

    return {
      runId,
      stage: claim.stage,
      attempt: claim.attempt,
      status: "failed",
      nextStage: null,
      currentStage: claim.stage,
      completed: false,
      creditsCharged: charged,
      creditsRefunded: refunded,
      sourcesAdded: 0,
      evidenceAdded: 0,
      error: {
        code: aiError.code,
        message: aiError.message,
        retryable: aiError.retryable && !terminal,
      },
    };
  }
}

/** Create (or reuse) the run for a request. Idempotent by design. */
export async function startRun(requestId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("research_start_run", {
    p_request_id: requestId,
  });
  if (error || typeof data !== "string") {
    throw new AiError(
      "AI_INVALID_INPUT",
      error?.message ?? "Could not start this research run.",
      false,
    );
  }
  return data;
}

export { RESEARCH_STAGES };
