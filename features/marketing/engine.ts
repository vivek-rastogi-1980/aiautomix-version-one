import "server-only";

import { createClient } from "@/lib/supabase/server";
import { runWorkflow } from "@/features/ai/engine/workflow-manager";
import { AiError, toAiError } from "@/features/ai/engine/errors";
import type { AiRetrievedSource } from "@/features/ai/engine/types";
import { canAccess } from "@/features/commerce/entitlements";
import { debitCredits, refundCredits } from "@/features/commerce/credits";
import {
  GTM_RETRIEVAL_STAGES,
  isComputeStage,
  isGtmMotion,
  nextGtmStage,
  type GtmMotion,
  type GtmStage,
} from "@/features/marketing/types";
import { stageCost, chargeKey, refundKey } from "@/features/marketing/cost";
import {
  GTM_ENTITLEMENT,
  GTM_MAX_STAGE_ATTEMPTS,
  GTM_STAGE_LOCK_TIMEOUT_MS,
} from "@/features/marketing/constants";
import { GTM_WORKFLOW_IDS } from "@/features/marketing/stages/workflows";
import {
  buildStageInput,
  mapStageOutput,
  runComputeStage,
  type MappedStageOutput,
} from "@/features/marketing/stages/mapping";

/**
 * The Marketing Intelligence stage engine.
 *
 * Same ordering as research, competitors and financials — claim, entitlement,
 * charge, execute, persist, advance; on failure record then refund — with the
 * same structural difference Phase 8 introduced:
 *
 *   A COMPUTE STAGE NEVER REACHES `runWorkflow`.
 *
 * `acquisition_economics` runs the deterministic engine in process. There is no
 * provider call, no token spend and no charge, and the branch below is the
 * enforcement point. If a compute stage ever reached the workflow manager it
 * would mean a model was producing a budget, which is what §16 forbids.
 *
 * Everything else about the ordering is load-bearing and unchanged:
 *
 *   CLAIM FIRST     The row lock is what serialises two browser tabs. Claiming
 *                   after charging would let both be charged.
 *   CHARGE BEFORE   A stage that runs and then fails to charge is free work.
 *   FAIL WITHOUT    `gtm_fail_stage` does not advance `current_stage`, so a
 *   ADVANCING       retry runs the same stage rather than skipping it.
 *   REFUND BY KEY   Keyed on the attempt, so a retry refunds once, not twice.
 */

export interface GtmStageResult {
  runId: string;
  stage: GtmStage;
  attempt: number;
  status: "succeeded" | "failed";
  nextStage: GtmStage | null;
  currentStage: GtmStage | null;
  completed: boolean;
  /** How the stage did its work. Surfaced so the UI can say "no AI ran". */
  kind: "ai" | "compute";
  creditsCharged: number;
  creditsRefunded: number;
  sourcesAdded: number;
  /** Claims demoted from FACT because no retrieved source backed them. */
  downgradedClaims: string[];
  discardedChannels: string[];
  error?: { code: string; message: string; retryable: boolean };
}

interface ClaimedStage {
  stage: GtmStage;
  attempt: number;
  workspaceId: string;
  projectId: string;
}

/**
 * Execute the next stage of a run.
 *
 * @param runId  The run. Ownership is re-verified inside the database.
 * @param userId The caller, for usage attribution and rate limiting.
 */
export async function runNextGtmStage(
  runId: string,
  userId: string,
): Promise<GtmStageResult> {
  const supabase = await createClient();

  // --- 1. Claim ------------------------------------------------------------
  // First, because the claim is what serialises concurrent callers.
  const { data: claimRows, error: claimError } = await supabase.rpc(
    "gtm_claim_stage",
    {
      p_run_id: runId,
      p_max_attempts: GTM_MAX_STAGE_ATTEMPTS,
      p_lock_timeout_ms: GTM_STAGE_LOCK_TIMEOUT_MS,
    },
  );

  if (claimError || !claimRows?.length) {
    throw new AiError(
      "AI_INVALID_INPUT",
      claimError?.message ?? "This marketing run has no stage left to execute.",
      false,
    );
  }

  const claim: ClaimedStage = {
    stage: claimRows[0].stage as GtmStage,
    attempt: claimRows[0].attempt,
    workspaceId: claimRows[0].workspace_id,
    projectId: claimRows[0].project_id,
  };

  const compute = isComputeStage(claim.stage);
  const cost = stageCost(claim.stage);
  let charged = 0;

  try {
    // --- 2. Entitlement --------------------------------------------------
    // Checked even for a compute stage: running the engine still produces
    // customer-visible output, and a workspace that has lost the feature
    // should not be able to keep advancing a plan.
    const access = await canAccess(claim.workspaceId, GTM_ENTITLEMENT);
    if (!access.allowed) {
      throw new AiError(
        "AI_INVALID_INPUT",
        "This workspace's plan does not include Marketing Intelligence.",
        false,
      );
    }

    // --- 3. Charge -------------------------------------------------------
    // Skipped entirely when the cost is zero. A zero-amount ledger entry would
    // be noise claiming a compute stage cost something.
    if (cost > 0) {
      await debitCredits({
        workspaceId: claim.workspaceId,
        amount: cost,
        reason: `Marketing intelligence — ${claim.stage} (attempt ${claim.attempt})`,
        workflow: GTM_WORKFLOW_IDS[claim.stage] ?? claim.stage,
        // Server-generated. §26: the browser never supplies an idempotency key,
        // because a client-supplied key is a client-supplied refund.
        idempotencyKey: chargeKey(runId, claim.stage, claim.attempt),
        createdBy: userId,
      });
      charged = cost;
    }

    // --- 4. Execute ------------------------------------------------------
    let mapped: MappedStageOutput;
    // A compute stage reports a duration and nothing else — no tokens, no
    // provider cost, because neither exists. The nulls are the record of that.
    let usage: {
      prompt_tokens: number | null;
      output_tokens: number | null;
      total_tokens: number | null;
      duration_ms: number;
      estimated_cost_usd: number | null;
    } = {
      prompt_tokens: null,
      output_tokens: null,
      total_tokens: null,
      duration_ms: 0,
      estimated_cost_usd: 0,
    };

    if (compute) {
      // THE branch that matters. No provider, no tokens, no network — just the
      // deterministic engine over stored rows.
      const started = Date.now();
      mapped = await runComputeStage(supabase, claim.projectId);
      usage = { ...usage, duration_ms: Date.now() - started };
    } else {
      const workflowId = GTM_WORKFLOW_IDS[claim.stage];
      if (!workflowId) {
        throw new AiError(
          "AI_INVALID_INPUT",
          `No workflow is registered for stage ${claim.stage}.`,
          false,
        );
      }

      const { data: project } = await supabase
        .from("gtm_projects")
        .select("*")
        .eq("id", claim.projectId)
        .maybeSingle();

      if (!project) {
        throw new AiError(
          "AI_INVALID_INPUT",
          "Marketing project not found.",
          false,
        );
      }

      const input = await buildStageInput(supabase, project, claim.stage);

      const started = Date.now();
      const result = await runWorkflow<unknown>({
        workflowId,
        userId,
        workspaceId: claim.workspaceId,
        input,
      });
      const durationMs = Date.now() - started;

      const providerSources = (result.sources ?? []) as AiRetrievedSource[];

      // A retrieval stage that surfaced nothing has not done its job. Failing
      // here refunds the stage and lets it retry, rather than advancing to a
      // channel ranking whose evidence dimension is uniformly unsupported while
      // still looking researched.
      if (
        GTM_RETRIEVAL_STAGES.includes(claim.stage) &&
        providerSources.length === 0
      ) {
        throw new AiError(
          "AI_VALIDATION_FAILED",
          "The search returned no usable sources for channel research. Retry, or widen the geography.",
          true,
        );
      }

      const motion: GtmMotion = isGtmMotion(project.motion)
        ? project.motion
        : "INBOUND_SALES";

      mapped = mapStageOutput(
        claim.stage,
        result.data,
        providerSources,
        motion,
      );

      usage = {
        prompt_tokens: result.metadata.promptTokens,
        output_tokens: result.metadata.outputTokens,
        total_tokens: result.metadata.tokens,
        duration_ms: durationMs,
        estimated_cost_usd: result.metadata.estimatedCostUsd,
      };
    }

    // --- 5. Persist AND advance, atomically ------------------------------
    const next = nextGtmStage(claim.stage);
    const { error: completeError } = await supabase.rpc("gtm_complete_stage", {
      p_run_id: runId,
      p_stage: claim.stage,
      p_attempt: claim.attempt,
      p_next_stage: next,
      p_results: mapped.results,
      p_claims: mapped.claims,
      p_personas: mapped.personas,
      p_channels: mapped.channels,
      p_funnel_steps: mapped.funnelSteps,
      p_campaigns: mapped.campaigns,
      p_plan_actions: mapped.planActions,
      p_sources: mapped.sources,
      p_project_patch: mapped.projectPatch,
      p_usage: usage,
      p_credits: charged,
    });

    if (completeError) {
      // Persistence failed after the work was done. The stage is a failure and
      // the pointer must not move — which is what the catch below does.
      throw new AiError("AI_PROVIDER_ERROR", completeError.message, true);
    }

    return {
      runId,
      stage: claim.stage,
      attempt: claim.attempt,
      status: "succeeded",
      nextStage: next,
      currentStage: next,
      completed: next === null,
      kind: compute ? "compute" : "ai",
      creditsCharged: charged,
      creditsRefunded: 0,
      sourcesAdded: mapped.sources.length,
      downgradedClaims: mapped.downgradedClaims,
      discardedChannels: mapped.discardedChannels,
    };
  } catch (error) {
    const aiError = toAiError(error);

    // --- 6. Record the failure. current_stage is NOT advanced. -----------
    const terminal = claim.attempt >= GTM_MAX_STAGE_ATTEMPTS;

    // --- 7. Refund this stage, once. -------------------------------------
    let refunded = 0;
    if (charged > 0) {
      try {
        await refundCredits({
          workspaceId: claim.workspaceId,
          amount: charged,
          reason: `Refund — ${claim.stage} failed (attempt ${claim.attempt})`,
          workflow: GTM_WORKFLOW_IDS[claim.stage] ?? claim.stage,
          idempotencyKey: refundKey(runId, claim.stage, claim.attempt),
          createdBy: userId,
        });
        refunded = charged;
      } catch (refundError) {
        // A failed refund must not mask the original failure, but it must be
        // visible: the workspace is out of pocket until it is reconciled.
        console.error("[marketing] refund failed", {
          runId,
          stage: claim.stage,
          attempt: claim.attempt,
          error:
            refundError instanceof Error ? refundError.message : refundError,
        });
      }
    }

    await supabase.rpc("gtm_fail_stage", {
      p_run_id: runId,
      p_stage: claim.stage,
      p_attempt: claim.attempt,
      p_error_code: aiError.code,
      p_error_message: aiError.message,
      p_credits_refunded: refunded,
      p_usage: {},
    });

    return {
      runId,
      stage: claim.stage,
      attempt: claim.attempt,
      status: "failed",
      nextStage: null,
      currentStage: claim.stage,
      completed: false,
      kind: compute ? "compute" : "ai",
      creditsCharged: charged,
      creditsRefunded: refunded,
      sourcesAdded: 0,
      downgradedClaims: [],
      discardedChannels: [],
      error: {
        code: aiError.code,
        message: aiError.message,
        retryable: aiError.retryable && !terminal,
      },
    };
  }
}

/** Create (or reuse) the run for a project. Idempotent by design. */
export async function startGtmRun(projectId: string): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("gtm_start_run", {
    p_project_id: projectId,
  });

  if (error || typeof data !== "string") {
    throw new AiError(
      "AI_INVALID_INPUT",
      error?.message ?? "Could not start this marketing run.",
      false,
    );
  }

  return data;
}
