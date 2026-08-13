/**
 * Execution policy shared by the competitor stage engine and the UI that draws
 * it.
 *
 * A plain module — not `server-only` — because the pipeline component has to
 * know the attempt budget to decide whether to offer a Retry button, and it
 * must be the *same* number the engine enforces. A UI that offers a fourth
 * attempt the database will refuse is worse than one that offers none.
 */

/**
 * Attempts allowed per stage, including the first.
 *
 * Mirrors `p_max_attempts` in `competitor_claim_stage` — the SQL is the
 * enforcement point and refuses a fourth attempt regardless of what any caller
 * believes.
 */
export const COMPETITOR_MAX_STAGE_ATTEMPTS = 3;

/** A stage held longer than this is treated as abandoned and reclaimable. */
export const COMPETITOR_STAGE_LOCK_TIMEOUT_MS = 300_000;

/**
 * The entitlement this feature gates on.
 *
 * `competitor_analysis` already exists in `features/commerce/types.ts` and is
 * seeded across all five plans by migration 0007. The Phase 7 brief names the
 * capability `competitor_intelligence`, but also says to reuse an entitlement
 * that already exists — and a second key for the same capability would leave
 * two flags to keep in sync and a priced plan catalog that no longer describes
 * what it sells.
 */
export const COMPETITOR_ENTITLEMENT = "competitor_analysis" as const;
