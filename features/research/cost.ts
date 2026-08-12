import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  RESEARCH_STAGES,
  type ResearchDepth,
  type ResearchStage,
} from "@/features/research/types";

/**
 * Research cost policy.
 *
 * The authority is `research_stage_costs` in the database — the stage engine
 * charges from those rows and the estimator sums the same ones, so a quote and
 * a charge cannot drift apart.
 *
 * `STAGE_COST_MIRROR` exists so the UI can price a run without a round trip and
 * so the test suite can assert the two agree. If they ever disagree, the SQL
 * wins and the mirror is the bug.
 */

/** Mirrors the seed in migration 0009. Asserted by `scripts/research-smoke.tsx`. */
export const STAGE_COST_MIRROR: Record<
  ResearchDepth,
  Record<ResearchStage, number>
> = {
  basic: {
    planning: 5,
    discovery: 10,
    collection: 10,
    evidence: 10,
    analysis: 15,
    synthesis: 5,
    report: 5,
  },
  standard: {
    planning: 8,
    discovery: 25,
    collection: 25,
    evidence: 20,
    analysis: 25,
    synthesis: 10,
    report: 12,
  },
  deep: {
    planning: 10,
    discovery: 60,
    collection: 60,
    evidence: 45,
    analysis: 45,
    synthesis: 20,
    report: 20,
  },
};

/** Total credits for a complete run at this depth. */
export function estimateRunCost(depth: ResearchDepth): number {
  return RESEARCH_STAGES.reduce(
    (total, stage) => total + STAGE_COST_MIRROR[depth][stage],
    0,
  );
}

/** What a single stage costs — what the engine actually charges. */
export function stageCost(depth: ResearchDepth, stage: ResearchStage): number {
  return STAGE_COST_MIRROR[depth][stage];
}

/** Credits still to be spent if a run resumes at `stage`. */
export function remainingCost(
  depth: ResearchDepth,
  stage: ResearchStage,
): number {
  const from = RESEARCH_STAGES.indexOf(stage);
  return RESEARCH_STAGES.slice(from).reduce(
    (total, s) => total + STAGE_COST_MIRROR[depth][s],
    0,
  );
}

/**
 * The authoritative estimate, from the database.
 *
 * Used on `/research/new` where the number is shown to a user before they
 * commit. Falls back to the mirror if the RPC is unavailable, because a
 * missing estimate should not block the page — but the fallback is the same
 * arithmetic over the same values.
 */
export async function estimateRunCostFromDb(
  depth: ResearchDepth,
): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("research_estimate_credits", {
    p_depth: depth,
  });
  if (error || typeof data !== "number") return estimateRunCost(depth);
  return data;
}

/**
 * Idempotency keys for the credit ledger.
 *
 * Keyed by attempt, not by stage: a retry is a genuinely new charge, and the
 * ledger has to be able to say so. Reusing a stage-level key would make the
 * second attempt free and the audit trail wrong.
 */
export function chargeKey(
  runId: string,
  stage: ResearchStage,
  attempt: number,
): string {
  return `research:${runId}:${stage}:${attempt}`;
}

export function refundKey(
  runId: string,
  stage: ResearchStage,
  attempt: number,
): string {
  return `research-refund:${runId}:${stage}:${attempt}`;
}
