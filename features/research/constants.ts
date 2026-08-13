/**
 * Execution policy shared by the stage engine and the UI that draws it.
 *
 * These lived in `features/research/engine.ts` in Phase 3, which was the right
 * home while the engine was the only reader. Phase 4 added a second: the
 * pipeline has to know the attempt budget to decide whether to offer a Retry
 * button, and it must be the *same* number the engine enforces — a UI that
 * offers a fourth attempt the database will refuse is worse than one that
 * offers none.
 *
 * The engine is `server-only`, so a client component cannot import from it.
 * Hoisting the two constants into a plain module both sides can read is what
 * keeps them one number instead of two that agree today.
 */

/**
 * Attempts allowed per stage, including the first.
 *
 * Mirrors `p_max_attempts` in `research_claim_stage` — the SQL is the
 * enforcement point and refuses a fourth attempt regardless of what any caller
 * believes.
 */
export const RESEARCH_MAX_STAGE_ATTEMPTS = 3;

/** A stage held longer than this is treated as abandoned and reclaimable. */
export const RESEARCH_STAGE_LOCK_TIMEOUT_MS = 300_000;
