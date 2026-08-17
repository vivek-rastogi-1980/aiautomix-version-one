import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Webhook signing and verification.
 *
 * ---------------------------------------------------------------------------
 * There is no public callback endpoint in this phase, and that is the point
 * ---------------------------------------------------------------------------
 * §14 requires that any future callback support authentication, signature
 * verification, replay protection, idempotency and timestamp validation. The
 * safest way to satisfy that today is to build the verification and NOT the
 * endpoint: an unauthenticated public URL that "will be secured later" is the
 * single most reliable way to ship a vulnerability, because the endpoint works
 * long before anyone notices the checks are missing.
 *
 * So this module is a library. Phase 10.2 adds a route that calls
 * `verifySignedRequest` before doing anything else — and the route cannot be
 * written accidentally without it, because there is nothing else here to call.
 *
 * ---------------------------------------------------------------------------
 * The four checks, and why each is not optional
 * ---------------------------------------------------------------------------
 *   SIGNATURE   Proves the sender holds the shared secret. Compared in constant
 *               time, because a byte-by-byte comparison that returns early
 *               leaks the correct prefix to anyone willing to time it.
 *   TIMESTAMP   Bounds how long a captured request stays useful. Without it a
 *               valid signature is valid forever.
 *   NONCE       Stops replay INSIDE the timestamp window, which the timestamp
 *               alone cannot do.
 *   IDEMPOTENCY Stops a legitimate duplicate — a provider retrying because our
 *               200 was lost — from being processed twice. Distinct from the
 *               nonce: one defends against an attacker, the other against the
 *               network.
 */

/** How old a signed request may be. Five minutes is the usual industry choice. */
export const SIGNATURE_WINDOW_SECONDS = 300;

/** Header names, exported so a future route and its tests cannot disagree. */
export const SIGNATURE_HEADER = "x-aiautomix-signature";
export const TIMESTAMP_HEADER = "x-aiautomix-timestamp";
export const NONCE_HEADER = "x-aiautomix-nonce";
export const IDEMPOTENCY_HEADER = "idempotency-key";

/**
 * The signed payload.
 *
 * Timestamp and nonce are inside the signed string, not merely alongside it.
 * Signing only the body would let an attacker replay a captured body with a
 * fresh timestamp and sail through the freshness check.
 */
export function signingString(
  timestamp: number,
  nonce: string,
  body: string,
): string {
  return `${timestamp}.${nonce}.${body}`;
}

export function signPayload(
  secret: string,
  timestamp: number,
  nonce: string,
  body: string,
): string {
  return createHmac("sha256", secret)
    .update(signingString(timestamp, nonce, body))
    .digest("hex");
}

export function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

/** Constant-time compare that tolerates unequal lengths without throwing. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // `timingSafeEqual` throws on a length mismatch, and the throw itself is an
  // early return. Comparing each against a fixed-length digest of itself keeps
  // the work constant regardless of input length.
  const leftDigest = createHmac("sha256", "length-guard").update(left).digest();
  const rightDigest = createHmac("sha256", "length-guard")
    .update(right)
    .digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export type VerificationFailure =
  | "missing_signature"
  | "missing_timestamp"
  | "missing_nonce"
  | "malformed_timestamp"
  | "expired"
  | "future_timestamp"
  | "bad_signature"
  | "replayed";

export interface VerificationResult {
  valid: boolean;
  reason: VerificationFailure | null;
}

const ACCEPTED: VerificationResult = { valid: true, reason: null };

function rejected(reason: VerificationFailure): VerificationResult {
  return { valid: false, reason };
}

export interface SignedRequest {
  signature: string | null;
  timestamp: string | null;
  nonce: string | null;
  body: string;
}

/**
 * A store of nonces already seen.
 *
 * The interface is deliberately tiny so Phase 10.2 can back it with Postgres or
 * Redis without touching the verification logic. Entries only need to outlive
 * `SIGNATURE_WINDOW_SECONDS`; anything older is already refused by the
 * timestamp check.
 */
export interface NonceStore {
  /**
   * True when this nonce is new AND it was recorded. False when already seen.
   *
   * `nowSeconds` is passed in rather than read from the store's own clock. Two
   * clocks in one decision is a bug: a store that prunes by `Date.now()` while
   * verification judges freshness by an injected timestamp can expire an entry
   * the verifier still considers current, and a replay then sails through.
   */
  claim(
    nonce: string,
    expiresAtSeconds: number,
    nowSeconds: number,
  ): Promise<boolean>;
}

/**
 * An in-memory store, for tests and single-process development only.
 *
 * Not suitable for production: several server instances would each accept the
 * same nonce once. Phase 10.2 must swap it for a shared store, and the type
 * above is what makes that a one-line change.
 */
export function createMemoryNonceStore(): NonceStore & { size(): number } {
  const seen = new Map<string, number>();

  return {
    async claim(
      nonce: string,
      expiresAtSeconds: number,
      nowSeconds: number,
    ): Promise<boolean> {
      for (const [key, expiry] of seen) {
        if (expiry <= nowSeconds) seen.delete(key);
      }
      if (seen.has(nonce)) return false;
      seen.set(nonce, expiresAtSeconds);
      return true;
    },
    size(): number {
      return seen.size;
    },
  };
}

/**
 * Verify a signed request.
 *
 * Order matters: cheap structural checks first, then freshness, then the
 * signature, then the replay claim. The nonce is only consumed once the
 * signature has passed — otherwise anyone could exhaust or poison the store
 * with unsigned traffic.
 */
export async function verifySignedRequest(
  request: SignedRequest,
  secret: string,
  nonceStore: NonceStore,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<VerificationResult> {
  if (!request.signature) return rejected("missing_signature");
  if (!request.timestamp) return rejected("missing_timestamp");
  if (!request.nonce) return rejected("missing_nonce");

  const timestamp = Number(request.timestamp);
  if (!Number.isInteger(timestamp) || timestamp <= 0) {
    return rejected("malformed_timestamp");
  }

  const age = nowSeconds - timestamp;
  if (age > SIGNATURE_WINDOW_SECONDS) return rejected("expired");
  // A timestamp meaningfully in the future is either a badly skewed clock or an
  // attempt to mint a request that stays valid for longer than the window.
  if (age < -SIGNATURE_WINDOW_SECONDS) return rejected("future_timestamp");

  const expected = signPayload(secret, timestamp, request.nonce, request.body);
  if (!safeEqual(expected, request.signature)) return rejected("bad_signature");

  const claimed = await nonceStore.claim(
    request.nonce,
    timestamp + SIGNATURE_WINDOW_SECONDS,
    nowSeconds,
  );
  if (!claimed) return rejected("replayed");

  return ACCEPTED;
}

/** Read the four headers from a `Headers` object. Shared by route and tests. */
export function readSignedHeaders(
  headers: Headers,
  body: string,
): SignedRequest {
  return {
    signature: headers.get(SIGNATURE_HEADER),
    timestamp: headers.get(TIMESTAMP_HEADER),
    nonce: headers.get(NONCE_HEADER),
    body,
  };
}
