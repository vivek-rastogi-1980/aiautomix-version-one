/**
 * Execution policy shared by the service, the API routes and the UI.
 *
 * A plain module — not `server-only` — because the action controls need the
 * attempt budget to decide whether to offer a Retry button, and it must be the
 * *same* number the service enforces.
 */

/**
 * The entitlement Business Execution gates on.
 *
 * New in Phase 10.1 and seeded across all five plans by migration 0018.
 * Deliberately its own flag: owning Marketing Intelligence means a workspace
 * can PLAN go-to-market work, which says nothing about whether it may reach
 * outside AIAutoMix and change things. Those are different products and, more
 * to the point, different risks.
 */
export const EXECUTION_ENTITLEMENT = "business_execution" as const;

/**
 * The hard ceiling on attempts, enforced by the service and by SQL.
 *
 * A registry entry may ask for fewer. Nothing may ask for more, and no client
 * may ask at all — §17 puts retry counts under server control, because a
 * client-chosen retry count on a publishing action is a client-chosen number of
 * duplicate posts.
 */
export const MAX_ATTEMPTS_CEILING = 5;

/** Wall-clock budget handed to a provider. Beyond it, the attempt is a timeout. */
export const PROVIDER_TIMEOUT_MS = 30_000;

/**
 * An execution held longer than this is treated as abandoned.
 *
 * Phase 10.1 dispatches inline, so this only matters if a process dies
 * mid-execution. It exists now because the row it guards is written now, and
 * because §32 requires the design to permit asynchronous providers later.
 */
export const EXECUTION_LOCK_TIMEOUT_MS = 300_000;

/** Rate-limit scopes. Separate per surface so one cannot exhaust another. */
export const EXECUTION_APPROVE_SCOPE = "execution:approve";
export const EXECUTION_EXECUTE_SCOPE = "execution:execute";
export const EXECUTION_CANCEL_SCOPE = "execution:cancel";

/**
 * Credits charged for execution in Phase 10.1: none.
 *
 * §18 is explicit that planning and drafting should not be charged unless
 * existing product policy requires it, and there is no such policy. Nothing in
 * this phase reaches an external service, so there is no external cost to pass
 * on either — the mock provider costs exactly one function call.
 *
 * The constant exists rather than the concept being absent, so that when a
 * later phase does charge, it changes a number here and the ledger call is
 * already wired, tested and idempotent.
 */
export const EXECUTION_CREDIT_COST = 0;
