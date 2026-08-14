import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  FINANCIAL_STAGES,
  isComputeStage,
  type FinancialStage,
} from "@/features/financials/types";

/**
 * Financial Intelligence cost policy.
 *
 * The authority is `financial_stage_costs` in the database — the stage engine
 * charges from those rows and the estimator sums the same ones, so a quote and
 * a charge cannot drift apart.
 *
 * The three COMPUTE stages cost ZERO, and that is checkable rather than
 * decorative: they run the deterministic engine in process, with no provider
 * call and no tokens. A non-zero cost on one of them would mean a model had
 * crept into the arithmetic path, which is the one thing this phase must not
 * allow. The test suite asserts the zeros against `isComputeStage`.
 */

/** Mirrors the seed in migration 0016. Asserted by `scripts/financial-smoke.tsx`. */
export const STAGE_COST_MIRROR: Record<FinancialStage, number> = {
  financial_planning: 8,
  cost_modeling: 15,
  revenue_modeling: 15,
  unit_economics: 0,
  scenario_analysis: 0,
  cashflow_break_even: 0,
  funding_analysis: 30,
  financial_recommendations: 12,
};

/** Total credits for a complete run. */
export function estimateRunCost(): number {
  return FINANCIAL_STAGES.reduce(
    (total, stage) => total + STAGE_COST_MIRROR[stage],
    0,
  );
}

/** What a single stage costs — what the engine actually charges. */
export function stageCost(stage: FinancialStage): number {
  return STAGE_COST_MIRROR[stage];
}

/** Credits still to be spent if a run resumes at `stage`. */
export function remainingCost(stage: FinancialStage): number {
  const from = FINANCIAL_STAGES.indexOf(stage);
  return FINANCIAL_STAGES.slice(from).reduce(
    (total, s) => total + STAGE_COST_MIRROR[s],
    0,
  );
}

/** True when every compute stage is free. The invariant, as a function. */
export function computeStagesAreFree(): boolean {
  return FINANCIAL_STAGES.filter(isComputeStage).every(
    (stage) => STAGE_COST_MIRROR[stage] === 0,
  );
}

/**
 * The authoritative estimate, from the database.
 *
 * Falls back to the mirror if the RPC is unavailable — a missing estimate
 * should not block the page, and the fallback is the same arithmetic over the
 * same values.
 */
export async function estimateRunCostFromDb(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("financial_estimate_credits");
  if (error || typeof data !== "number") return estimateRunCost();
  return data;
}

/**
 * Idempotency keys for the credit ledger.
 *
 * Keyed by attempt, not by stage: a retry is a genuinely new charge and the
 * ledger has to be able to say so. The `financial:` prefix keeps these in a
 * different namespace from research and competitor keys, so two features
 * cannot collide on a shared run id.
 */
export function chargeKey(
  runId: string,
  stage: FinancialStage,
  attempt: number,
): string {
  return `financial:${runId}:${stage}:${attempt}`;
}

export function refundKey(
  runId: string,
  stage: FinancialStage,
  attempt: number,
): string {
  return `financial-refund:${runId}:${stage}:${attempt}`;
}
