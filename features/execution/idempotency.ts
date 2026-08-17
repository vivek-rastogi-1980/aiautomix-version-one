/**
 * Idempotency keys.
 *
 * ---------------------------------------------------------------------------
 * What this prevents
 * ---------------------------------------------------------------------------
 * §15 names the failure modes precisely: duplicate posts, duplicate emails,
 * duplicate CRM records, duplicate websites. Each is caused by the same thing —
 * a request that was carried out but whose acknowledgement was lost, retried by
 * a browser, a proxy, an impatient user, or a provider's own retry logic.
 *
 * The defence is a key that is DERIVED, not generated. Two calls that mean the
 * same thing must produce the same key; two calls that mean different things
 * must not. So the key is a pure function of (action, attempt), and the
 * database carries a unique index on it. A duplicate does not race — it
 * collides, and the collision is the answer.
 *
 * ---------------------------------------------------------------------------
 * Why the attempt number is IN the key
 * ---------------------------------------------------------------------------
 * A retry after a genuine failure is a NEW external effect and must be allowed
 * to happen. If the key were only the action id, a retry would collide with the
 * failed attempt and be silently swallowed, and the action would be stuck
 * forever. Keying on the attempt makes "retry once more" and "the same request
 * arriving twice" distinguishable, which they are.
 *
 * This mirrors the ledger keys used by every AI stage engine in the platform
 * (`gtm:`, `financial:`, `competitor:`, `research:`), for the same reason and
 * with the same shape. The `exec:` namespace keeps them from colliding.
 *
 * A plain module: no I/O, no randomness, no clock. Determinism is the feature.
 */

/** The namespace. Distinct from every credit-ledger namespace in the platform. */
export const IDEMPOTENCY_NAMESPACE = "exec";

/**
 * The key for one attempt at one action.
 *
 * Deterministic and server-derived. There is deliberately no parameter through
 * which a caller could supply or influence it: a client-supplied idempotency
 * key is a client-supplied duplicate, or worse, a client-supplied collision
 * with somebody else's action.
 */
export function executionKey(actionId: string, attempt: number): string {
  return `${IDEMPOTENCY_NAMESPACE}:${actionId}:${attempt}`;
}

/**
 * The credit-ledger key, for when a later phase charges for execution.
 *
 * Separate from the execution key so that a refund, a charge and a provider
 * call can never be conflated by a shared string.
 */
export function chargeKey(actionId: string, attempt: number): string {
  return `${IDEMPOTENCY_NAMESPACE}-charge:${actionId}:${attempt}`;
}

export function refundKey(actionId: string, attempt: number): string {
  return `${IDEMPOTENCY_NAMESPACE}-refund:${actionId}:${attempt}`;
}

/** Parse a key back into its parts. Used by the smoke suite and by support. */
export function parseExecutionKey(
  key: string,
): { actionId: string; attempt: number } | null {
  const parts = key.split(":");
  if (parts.length !== 3) return null;
  if (parts[0] !== IDEMPOTENCY_NAMESPACE) return null;

  const attempt = Number(parts[2]);
  if (!Number.isInteger(attempt) || attempt < 1) return null;

  return { actionId: parts[1]!, attempt };
}
