import "server-only";

import { createClient } from "@/lib/supabase/server";
import { runWorkflow } from "@/features/ai/engine/workflow-manager";
import { AiError, toAiError } from "@/features/ai/engine/errors";
import type { AiRetrievedSource } from "@/features/ai/engine/types";
import { canAccess } from "@/features/commerce/entitlements";
import { debitCredits, refundCredits } from "@/features/commerce/credits";
import {
  COMPETITOR_RETRIEVAL_STAGES,
  nextCompetitorStage,
  type CompetitorStage,
} from "@/features/competitors/types";
import { stageCost, chargeKey, refundKey } from "@/features/competitors/cost";
import {
  COMPETITOR_ENTITLEMENT,
  COMPETITOR_MAX_STAGE_ATTEMPTS,
  COMPETITOR_STAGE_LOCK_TIMEOUT_MS,
} from "@/features/competitors/constants";
import { COMPETITOR_WORKFLOW_IDS } from "@/features/competitors/stages/workflows";
import {
  buildStageInput,
  mapStageOutput,
} from "@/features/competitors/stages/mapping";

/**
 * The Competitor Intelligence stage engine.
 *
 * One call executes exactly ONE stage. The order is:
 *
 *   claim (locks) → entitlement → charge → run → validate → persist+advance
 *
 * and on failure: record failure (no advance) → refund that stage.
 *
 * This is the same sequence as `features/research/engine.ts`, deliberately.
 * The two are separate modules because they claim from different tables and map
 * different outputs, but the *ordering* is the part that matters and it is
 * identical — claim first so concurrent callers serialise, charge before
 * execution because a provider call that crashes has still spent tokens, refund
 * on failure keyed by attempt so a retry is an honest second charge.
 *
 * Everything authoritative is derived server-side. The caller supplies a run id
 * and nothing else: not the stage, not the attempt, not the depth, not the
 * cost. A client that could name its own stage could skip to `recommendations`
 * and pay for advice with no competitors behind it.
 */

export interface CompetitorStageResult {
  runId: string;
  stage: CompetitorStage;
  attempt: number;
  status: "succeeded" | "failed";
  nextStage: CompetitorStage | null;
  currentStage: CompetitorStage | null;
  completed: boolean;
  creditsCharged: number;
  creditsRefunded: number;
  sourcesAdded: number;
  competitorsWritten: number;
  evidenceAdded: number;
  /** Candidates dropped because no citation backed them. Shown to the user. */
  discardedCandidates: string[];
  error?: { code: string; message: string; retryable: boolean };
}

interface ClaimedStage {
  stage: CompetitorStage;
  attempt: number;
  depth: string;
  workspaceId: string;
  projectId: string;
}

/**
 * Execute the next stage of a run.
 *
 * @param runId  The run. Ownership is re-verified inside the database.
 * @param userId The caller, for usage attribution and rate limiting.
 */
export async function runNextCompetitorStage(
  runId: string,
  userId: string,
): Promise<CompetitorStageResult> {
  const supabase = await createClient();

  // --- 1. Claim ------------------------------------------------------------
  // First, because the claim is what serialises concurrent callers. Checking
  // entitlement or cost before taking the lock would let two tabs both pass the
  // checks and then both execute — and both charge.
  const { data: claimRows, error: claimError } = await supabase.rpc(
    "competitor_claim_stage",
    {
      p_run_id: runId,
      p_max_attempts: COMPETITOR_MAX_STAGE_ATTEMPTS,
      p_lock_timeout_ms: COMPETITOR_STAGE_LOCK_TIMEOUT_MS,
    },
  );

  if (claimError || !claimRows?.length) {
    throw new AiError(
      "AI_INVALID_INPUT",
      claimError?.message ??
        "This competitor run has no stage left to execute.",
      false,
    );
  }

  const claim: ClaimedStage = {
    stage: claimRows[0].stage as CompetitorStage,
    attempt: claimRows[0].attempt,
    depth: claimRows[0].depth,
    workspaceId: claimRows[0].workspace_id,
    projectId: claimRows[0].project_id,
  };

  const cost = stageCost(claim.depth as never, claim.stage);
  let charged = 0;

  try {
    // --- 2. Entitlement --------------------------------------------------
    // After the claim (so it is serialised) but before any spend. Competitor
    // Intelligence has its own entitlement: a plan that includes Market
    // Research does not automatically include this.
    const access = await canAccess(claim.workspaceId, COMPETITOR_ENTITLEMENT);
    if (!access.allowed) {
      throw new AiError(
        "AI_INVALID_INPUT",
        "This workspace's plan does not include Competitor Intelligence.",
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
      reason: `Competitor intelligence — ${claim.stage} (attempt ${claim.attempt})`,
      workflow: COMPETITOR_WORKFLOW_IDS[claim.stage],
      idempotencyKey: chargeKey(runId, claim.stage, claim.attempt),
      createdBy: userId,
    });
    charged = cost;

    // --- 4. Execute one stage through the platform engine ----------------
    const input = await buildStageInput(
      supabase,
      claim.projectId,
      claim.stage,
      claim.depth,
    );

    const started = Date.now();
    const result = await runWorkflow<unknown>({
      workflowId: COMPETITOR_WORKFLOW_IDS[claim.stage],
      userId,
      workspaceId: claim.workspaceId,
      input,
    });
    const durationMs = Date.now() - started;

    // --- 5. Map validated output onto rows -------------------------------
    const providerSources = (result.sources ?? []) as AiRetrievedSource[];

    // A retrieval stage that surfaced nothing has not done its job. Treating it
    // as success would let the run proceed to verification with no candidates,
    // or to analysis with no pricing — producing a comparison table with
    // nothing behind it. Failing here refunds the stage and lets it retry.
    if (
      COMPETITOR_RETRIEVAL_STAGES.includes(claim.stage) &&
      providerSources.length === 0
    ) {
      throw new AiError(
        "AI_VALIDATION_FAILED",
        "The search returned no usable sources for this stage. Retry, or widen the competitor criteria.",
        true,
      );
    }

    const mapped = mapStageOutput(claim.stage, result.data, providerSources);

    // Discovery that produced no citation-backed competitor is a failure, not
    // an empty success: every later stage would have nothing to work on, and
    // the user would pay five more stages to find that out.
    if (claim.stage === "discovery" && mapped.competitors.length === 0) {
      throw new AiError(
        "AI_VALIDATION_FAILED",
        mapped.discardedCandidates.length > 0
          ? `No discovered competitor could be traced to a real search result (${mapped.discardedCandidates.length} discarded). Retry, or widen the criteria.`
          : "No competitors were found. Retry, or widen the competitor criteria.",
        true,
      );
    }

    // --- 6. Persist AND advance, atomically ------------------------------
    const next = nextCompetitorStage(claim.stage);
    const { data: completion, error: completeError } = await supabase.rpc(
      "competitor_complete_stage",
      {
        p_run_id: runId,
        p_stage: claim.stage,
        p_attempt: claim.attempt,
        p_next_stage: next,
        p_results: mapped.results,
        p_sources: mapped.sources,
        p_competitors: mapped.competitors,
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
      competitors_written?: number;
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
      competitorsWritten: summary.competitors_written ?? 0,
      evidenceAdded: summary.evidence_added ?? 0,
      discardedCandidates: mapped.discardedCandidates,
    };
  } catch (error) {
    const aiError = toAiError(error);

    // --- 7. Record the failure. current_stage is NOT advanced. -----------
    const terminal = claim.attempt >= COMPETITOR_MAX_STAGE_ATTEMPTS;
    await supabase.rpc("competitor_fail_stage", {
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
          workflow: COMPETITOR_WORKFLOW_IDS[claim.stage],
          idempotencyKey: refundKey(runId, claim.stage, claim.attempt),
          createdBy: userId,
        });
        refunded = charged;
      } catch (refundError) {
        // A failed refund must not mask the original failure, but it must be
        // visible: the workspace is out of pocket until it is reconciled.
        console.error("[competitors] refund failed", {
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
      competitorsWritten: 0,
      evidenceAdded: 0,
      discardedCandidates: [],
      error: {
        code: aiError.code,
        message: aiError.message,
        retryable: aiError.retryable && !terminal,
      },
    };
  }
}

/** Create (or reuse) the run for a project. Idempotent by design. */
export async function startCompetitorRun(projectId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("competitor_start_run", {
    p_project_id: projectId,
  });
  if (error || typeof data !== "string") {
    throw new AiError(
      "AI_INVALID_INPUT",
      error?.message ?? "Could not start this competitor run.",
      false,
    );
  }
  return data;
}
