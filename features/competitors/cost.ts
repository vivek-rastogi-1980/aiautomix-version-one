import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  COMPETITOR_STAGES,
  type CompetitorDepth,
  type CompetitorStage,
} from "@/features/competitors/types";

/**
 * Competitor Intelligence cost policy.
 *
 * The authority is `competitor_stage_costs` in the database — the stage engine
 * charges from those rows and the estimator sums the same ones, so a quote and
 * a charge cannot drift apart.
 *
 * `STAGE_COST_MIRROR` exists so the test suite can assert the two agree without
 * a database, and so `remainingCost` can price a resume without a round trip.
 * If they ever disagree, the SQL wins and the mirror is the bug.
 */

/** Mirrors the seed in migration 0014. Asserted by `scripts/competitor-smoke.tsx`. */
export const STAGE_COST_MIRROR: Record<
  CompetitorDepth,
  Record<CompetitorStage, number>
> = {
  basic: {
    planning: 5,
    discovery: 12,
    verification: 10,
    profiling: 10,
    pricing_positioning: 12,
    analysis: 15,
    recommendations: 6,
  },
  standard: {
    planning: 8,
    discovery: 28,
    verification: 22,
    profiling: 20,
    pricing_positioning: 28,
    analysis: 25,
    recommendations: 12,
  },
  deep: {
    planning: 10,
    discovery: 65,
    verification: 50,
    profiling: 45,
    pricing_positioning: 60,
    analysis: 45,
    recommendations: 20,
  },
};

/** Total credits for a complete run at this depth. */
export function estimateRunCost(depth: CompetitorDepth): number {
  return COMPETITOR_STAGES.reduce(
    (total, stage) => total + STAGE_COST_MIRROR[depth][stage],
    0,
  );
}

/** What a single stage costs — what the engine actually charges. */
export function stageCost(
  depth: CompetitorDepth,
  stage: CompetitorStage,
): number {
  return STAGE_COST_MIRROR[depth][stage];
}

/** Credits still to be spent if a run resumes at `stage`. */
export function remainingCost(
  depth: CompetitorDepth,
  stage: CompetitorStage,
): number {
  const from = COMPETITOR_STAGES.indexOf(stage);
  return COMPETITOR_STAGES.slice(from).reduce(
    (total, s) => total + STAGE_COST_MIRROR[depth][s],
    0,
  );
}

/**
 * The authoritative estimate, from the database.
 *
 * Used on `/competitors/new`, where the number is shown before a user commits.
 * Falls back to the mirror if the RPC is unavailable — a missing estimate
 * should not block the page, and the fallback is the same arithmetic over the
 * same values.
 */
export async function estimateRunCostFromDb(
  depth: CompetitorDepth,
): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("competitor_estimate_credits", {
    p_depth: depth,
  });
  if (error || typeof data !== "number") return estimateRunCost(depth);
  return data;
}

/**
 * Idempotency keys for the credit ledger.
 *
 * Keyed by attempt, not by stage: a retry is a genuinely new charge and the
 * ledger has to be able to say so. Reusing a stage-level key would make the
 * second attempt free and the audit trail wrong.
 *
 * The `competitor:` prefix keeps these in a different namespace from the
 * research engine's `research:` keys, so two features cannot collide on a
 * shared run id.
 */
export function chargeKey(
  runId: string,
  stage: CompetitorStage,
  attempt: number,
): string {
  return `competitor:${runId}:${stage}:${attempt}`;
}

export function refundKey(
  runId: string,
  stage: CompetitorStage,
  attempt: number,
): string {
  return `competitor-refund:${runId}:${stage}:${attempt}`;
}
