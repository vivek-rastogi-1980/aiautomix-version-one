import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  GTM_STAGES,
  isComputeStage,
  type GtmStage,
} from "@/features/marketing/types";

/**
 * Marketing Intelligence cost policy.
 *
 * The authority is `gtm_stage_costs` in the database — the stage engine charges
 * from those rows and the estimator sums the same ones, so a quote and a charge
 * cannot drift apart.
 *
 * `acquisition_economics` costs ZERO, and that is checkable rather than
 * decorative: it runs `calc/acquisition.ts` in process, with no provider call
 * and no tokens. A non-zero cost on it would mean a model had crept into the
 * arithmetic path, which is the one thing this phase must not allow. The test
 * suite asserts the zero against `isComputeStage`.
 */

/** Mirrors the seed in migration 0017. Asserted by `scripts/gtm-smoke.tsx`. */
export const STAGE_COST_MIRROR: Record<GtmStage, number> = {
  gtm_planning: 8,
  icp_persona: 15,
  positioning_messaging: 15,
  channel_strategy: 30,
  content_campaign_strategy: 15,
  sales_funnel: 10,
  acquisition_economics: 0,
  gtm_90_day_plan: 12,
};

/** Total credits for a complete run. */
export function estimateRunCost(): number {
  return GTM_STAGES.reduce(
    (total, stage) => total + STAGE_COST_MIRROR[stage],
    0,
  );
}

/** What a single stage costs — what the engine actually charges. */
export function stageCost(stage: GtmStage): number {
  return STAGE_COST_MIRROR[stage];
}

/** Credits still to be spent if a run resumes at `stage`. */
export function remainingCost(stage: GtmStage): number {
  const from = GTM_STAGES.indexOf(stage);
  return GTM_STAGES.slice(from).reduce(
    (total, s) => total + STAGE_COST_MIRROR[s],
    0,
  );
}

/** True when every compute stage is free. The invariant, as a function. */
export function computeStagesAreFree(): boolean {
  return GTM_STAGES.filter(isComputeStage).every(
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
  const { data, error } = await supabase.rpc("gtm_estimate_credits");
  if (error || typeof data !== "number") return estimateRunCost();
  return data;
}

/**
 * Idempotency keys for the credit ledger.
 *
 * Keyed by attempt, not by stage: a retry is a genuinely new charge and the
 * ledger has to be able to say so. The `gtm:` prefix keeps these in a different
 * namespace from research, competitor and financial keys, so two features
 * cannot collide on a shared run id.
 *
 * Generated here, on the server. §26 forbids the browser having any say in
 * this — a client-supplied idempotency key is a client-supplied refund.
 */
export function chargeKey(
  runId: string,
  stage: GtmStage,
  attempt: number,
): string {
  return `gtm:${runId}:${stage}:${attempt}`;
}

export function refundKey(
  runId: string,
  stage: GtmStage,
  attempt: number,
): string {
  return `gtm-refund:${runId}:${stage}:${attempt}`;
}
