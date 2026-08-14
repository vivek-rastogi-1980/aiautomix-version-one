/**
 * Execution policy shared by the GTM stage engine and the UI.
 *
 * A plain module — not `server-only` — because the pipeline component needs the
 * attempt budget to decide whether to offer a Retry button, and it must be the
 * *same* number the engine enforces.
 */

/**
 * Attempts allowed per stage, including the first.
 *
 * Mirrors `p_max_attempts` in `gtm_claim_stage` — the SQL is the enforcement
 * point and refuses a fourth attempt regardless of what any caller believes.
 */
export const GTM_MAX_STAGE_ATTEMPTS = 3;

/** A stage held longer than this is treated as abandoned and reclaimable. */
export const GTM_STAGE_LOCK_TIMEOUT_MS = 300_000;

/**
 * The entitlement this feature gates on.
 *
 * New in Phase 9 and seeded across all five plans by migration 0017. §25 is
 * explicit that access must not be granted on the back of an unrelated
 * entitlement — owning `market_research` says nothing about whether a plan
 * includes go-to-market work, and inferring it would hand paid capability to
 * customers who did not buy it.
 *
 * Without the seed, `canAccess` finds no row and fails closed for every
 * customer including enterprise, which is the failure Phase 8 hit and fixed.
 */
export const GTM_ENTITLEMENT = "marketing_intelligence" as const;

/**
 * Rate-limit scopes. Separate per surface so a burst of PDF downloads cannot
 * exhaust the budget for actually running stages.
 */
export const GTM_RUN_SCOPE = "marketing:run-stage";
export const GTM_PDF_SCOPE = "marketing-pdf";
