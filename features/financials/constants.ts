/**
 * Execution policy shared by the financial stage engine and the UI.
 *
 * A plain module — not `server-only` — because the pipeline component needs the
 * attempt budget to decide whether to offer a Retry button, and it must be the
 * *same* number the engine enforces.
 */

/**
 * Attempts allowed per stage, including the first.
 *
 * Mirrors `p_max_attempts` in `financial_claim_stage` — the SQL is the
 * enforcement point and refuses a fourth attempt regardless of what any caller
 * believes.
 */
export const FINANCIAL_MAX_STAGE_ATTEMPTS = 3;

/** A stage held longer than this is treated as abandoned and reclaimable. */
export const FINANCIAL_STAGE_LOCK_TIMEOUT_MS = 300_000;

/**
 * The entitlement this feature gates on.
 *
 * New in Phase 8 and seeded across all five plans by migration 0016. Unlike
 * Phase 7 — where `competitor_analysis` already existed in the plan catalog —
 * there was no financial flag to reuse, so `canAccess` would have found no row
 * and failed closed for every customer including enterprise.
 */
export const FINANCIAL_ENTITLEMENT = "financial_intelligence" as const;
