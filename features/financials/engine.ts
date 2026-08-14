import "server-only";

import { createClient } from "@/lib/supabase/server";
import { runWorkflow } from "@/features/ai/engine/workflow-manager";
import { AiError, toAiError } from "@/features/ai/engine/errors";
import type { AiRetrievedSource } from "@/features/ai/engine/types";
import { canAccess } from "@/features/commerce/entitlements";
import { debitCredits, refundCredits } from "@/features/commerce/credits";
import {
  FINANCIAL_RETRIEVAL_STAGES,
  isComputeStage,
  nextFinancialStage,
  type FinancialStage,
} from "@/features/financials/types";
import { stageCost, chargeKey, refundKey } from "@/features/financials/cost";
import {
  FINANCIAL_ENTITLEMENT,
  FINANCIAL_MAX_STAGE_ATTEMPTS,
  FINANCIAL_STAGE_LOCK_TIMEOUT_MS,
} from "@/features/financials/constants";
import { FINANCIAL_WORKFLOW_IDS } from "@/features/financials/stages/workflows";
import {
  buildStageInput,
  mapStageOutput,
  runComputeStage,
  type MappedStageOutput,
} from "@/features/financials/stages/mapping";

/**
 * The Financial Intelligence stage engine.
 *
 * Same ordering as research and competitors — claim, entitlement, charge,
 * execute, persist, advance; on failure record then refund — with ONE
 * structural difference that is the whole point of this phase:
 *
 *   A COMPUTE STAGE NEVER REACHES `runWorkflow`.
 *
 * `unit_economics`, `scenario_analysis` and `cashflow_break_even` run the
 * deterministic engine in process. There is no provider call, no token spend
 * and no charge, and the branch below is the enforcement point. If a compute
 * stage ever needed a model, the design would be wrong rather than the code.
 */

export interface FinancialStageResult {
  runId: string;
  stage: FinancialStage;
  attempt: number;
  status: "succeeded" | "failed";
  nextStage: FinancialStage | null;
  currentStage: FinancialStage | null;
  completed: boolean;
  /** How the stage did its work. Surfaced so the UI can say "no AI ran". */
  kind: "ai" | "compute";
  creditsCharged: number;
  creditsRefunded: number;
  assumptionsWritten: number;
  costsWritten: number;
  sourcesAdded: number;
  fundingWritten: number;
  /** Funding options dropped because no citation backed them. */
  discardedOptions: string[];
  error?: { code: string; message: string; retryable: boolean };
}

interface ClaimedStage {
  stage: FinancialStage;
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
export async function runNextFinancialStage(
  runId: string,
  userId: string,
): Promise<FinancialStageResult> {
  const supabase = await createClient();

  // --- 1. Claim ------------------------------------------------------------
  // First, because the claim is what serialises concurrent callers.
  const { data: claimRows, error: claimError } = await supabase.rpc(
    "financial_claim_stage",
    {
      p_run_id: runId,
      p_max_attempts: FINANCIAL_MAX_STAGE_ATTEMPTS,
      p_lock_timeout_ms: FINANCIAL_STAGE_LOCK_TIMEOUT_MS,
    },
  );

  if (claimError || !claimRows?.length) {
    throw new AiError(
      "AI_INVALID_INPUT",
      claimError?.message ?? "This financial run has no stage left to execute.",
      false,
    );
  }

  const claim: ClaimedStage = {
    stage: claimRows[0].stage as FinancialStage,
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
    // should not be able to keep advancing a model.
    const access = await canAccess(claim.workspaceId, FINANCIAL_ENTITLEMENT);
    if (!access.allowed) {
      throw new AiError(
        "AI_INVALID_INPUT",
        "This workspace's plan does not include Financial Intelligence.",
        false,
      );
    }

    // --- 3. Charge -------------------------------------------------------
    // Skipped entirely when the cost is zero. `debitCredits` documents that
    // amount is "never zero", and a zero-amount ledger entry would be noise
    // claiming a compute stage cost something.
    if (cost > 0) {
      await debitCredits({
        workspaceId: claim.workspaceId,
        amount: cost,
        reason: `Financial intelligence — ${claim.stage} (attempt ${claim.attempt})`,
        workflow: FINANCIAL_WORKFLOW_IDS[claim.stage] ?? claim.stage,
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
      mapped = await runComputeStage(
        supabase,
        claim.projectId,
        claim.stage as
          "unit_economics" | "scenario_analysis" | "cashflow_break_even",
      );
      usage = { ...usage, duration_ms: Date.now() - started };
    } else {
      const workflowId = FINANCIAL_WORKFLOW_IDS[claim.stage];
      if (!workflowId) {
        throw new AiError(
          "AI_INVALID_INPUT",
          `No workflow is registered for stage ${claim.stage}.`,
          false,
        );
      }

      const input = await buildStageInput(
        supabase,
        claim.projectId,
        claim.stage,
      );

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
      // report with an empty funding section that looks researched.
      if (
        FINANCIAL_RETRIEVAL_STAGES.includes(claim.stage) &&
        providerSources.length === 0
      ) {
        throw new AiError(
          "AI_VALIDATION_FAILED",
          "The search returned no usable sources for funding options. Retry, or widen the geography.",
          true,
        );
      }

      mapped = mapStageOutput(claim.stage, result.data, providerSources);

      usage = {
        prompt_tokens: result.metadata.promptTokens,
        output_tokens: result.metadata.outputTokens,
        total_tokens: result.metadata.tokens,
        duration_ms: durationMs,
        estimated_cost_usd: result.metadata.estimatedCostUsd,
      };
    }

    // --- 5. Persist AND advance, atomically ------------------------------
    const next = nextFinancialStage(claim.stage);
    const { data: completion, error: completeError } = await supabase.rpc(
      "financial_complete_stage",
      {
        p_run_id: runId,
        p_stage: claim.stage,
        p_attempt: claim.attempt,
        p_next_stage: next,
        p_results: mapped.results,
        p_assumptions: mapped.assumptions,
        p_costs: mapped.costs,
        p_sources: mapped.sources,
        p_funding: mapped.funding,
        p_usage: usage,
      },
    );

    if (completeError) {
      // Persistence failed after the work was done. The stage is a failure and
      // the pointer must not move — which is what the catch below does.
      throw new AiError("AI_PROVIDER_ERROR", completeError.message, true);
    }

    const summary = (completion ?? {}) as {
      assumptions_written?: number;
      costs_written?: number;
      sources_added?: number;
      funding_written?: number;
    };

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
      assumptionsWritten: summary.assumptions_written ?? 0,
      costsWritten: summary.costs_written ?? 0,
      sourcesAdded: summary.sources_added ?? 0,
      fundingWritten: summary.funding_written ?? 0,
      discardedOptions: mapped.discardedOptions,
    };
  } catch (error) {
    const aiError = toAiError(error);

    // --- 6. Record the failure. current_stage is NOT advanced. -----------
    const terminal = claim.attempt >= FINANCIAL_MAX_STAGE_ATTEMPTS;
    await supabase.rpc("financial_fail_stage", {
      p_run_id: runId,
      p_stage: claim.stage,
      p_attempt: claim.attempt,
      p_error_code: aiError.code,
      p_error_message: aiError.message,
      p_terminal: terminal,
      p_usage: {},
    });

    // --- 7. Refund this stage, once. -------------------------------------
    let refunded = 0;
    if (charged > 0) {
      try {
        await refundCredits({
          workspaceId: claim.workspaceId,
          amount: charged,
          reason: `Refund — ${claim.stage} failed (attempt ${claim.attempt})`,
          workflow: FINANCIAL_WORKFLOW_IDS[claim.stage] ?? claim.stage,
          idempotencyKey: refundKey(runId, claim.stage, claim.attempt),
          createdBy: userId,
        });
        refunded = charged;
      } catch (refundError) {
        // A failed refund must not mask the original failure, but it must be
        // visible: the workspace is out of pocket until it is reconciled.
        console.error("[financials] refund failed", {
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
      kind: compute ? "compute" : "ai",
      creditsCharged: charged,
      creditsRefunded: refunded,
      assumptionsWritten: 0,
      costsWritten: 0,
      sourcesAdded: 0,
      fundingWritten: 0,
      discardedOptions: [],
      error: {
        code: aiError.code,
        message: aiError.message,
        retryable: aiError.retryable && !terminal,
      },
    };
  }
}

/** Create (or reuse) the run for a project. Idempotent by design. */
export async function startFinancialRun(projectId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("financial_start_run", {
    p_project_id: projectId,
  });
  if (error || typeof data !== "string") {
    throw new AiError(
      "AI_INVALID_INPUT",
      error?.message ?? "Could not start this financial run.",
      false,
    );
  }
  return data;
}
