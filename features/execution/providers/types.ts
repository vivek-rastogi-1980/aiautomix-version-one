import type { ActionType, ErrorCode } from "@/features/execution/types";

/**
 * The execution provider abstraction.
 *
 * ---------------------------------------------------------------------------
 * Why the domain model does not know what N8N is
 * ---------------------------------------------------------------------------
 * §12 forbids hard-coding N8N into the domain, and the reason is not
 * hypothetical portability. It is that the moment a domain model contains the
 * word "webhook", business rules start being written in terms of that
 * transport: retries become "did the webhook return 500", approval becomes
 * "does the workflow have an approval node", and the rules stop being
 * enforceable when the transport changes.
 *
 * So the contract below is deliberately narrow. A provider receives a context
 * it may not modify and returns a result it may not interpret. It cannot decide
 * whether it is allowed to run, cannot alter the action's state, and cannot
 * change the idempotency key it was given. Those are the engine's job.
 *
 * A provider gets exactly one interesting freedom: it classifies its own
 * failures, because only the provider knows whether a 429 means "try again in
 * a minute" or "you have exceeded your monthly quota". That classification is
 * constrained to the closed `ErrorCode` vocabulary so the engine can act on it
 * without parsing a message.
 */

/** What a provider is told. Everything here is already validated and authorised. */
export interface ExecutionContext {
  /** The action being carried out. */
  actionId: string;
  actionType: ActionType;
  workspaceId: string;
  /**
   * Server-generated and deterministic for this attempt. A provider MUST pass
   * it through to any external system that supports idempotency, and MUST NOT
   * derive its own. §15.
   */
  idempotencyKey: string;
  /** Attempt number, 1-based. Provided for logging, not for retry decisions. */
  attempt: number;
  /** Already parsed by the action's registered input schema. */
  input: unknown;
  /** Wall-clock budget. A provider that exceeds it should return a timeout. */
  timeoutMs: number;
}

export interface ExecutionSuccess {
  ok: true;
  /**
   * The provider's own identifier for what it created, so a later phase can
   * reconcile, update or delete it. Null when the provider has no such concept.
   */
  externalId: string | null;
  /** Shaped by the action's registered output schema. Validated by the engine. */
  output: unknown;
  /** One line for the activity feed. Never a dump of the provider response. */
  summary: string;
}

export interface ExecutionFailure {
  ok: false;
  /** From the closed vocabulary. The engine derives retryability from it. */
  errorCode: ErrorCode;
  /** Safe to show a user. Must not contain credentials or raw provider bodies. */
  message: string;
  /** Set when the provider created something before failing. Rare, important. */
  externalId?: string | null;
}

export type ExecutionResult = ExecutionSuccess | ExecutionFailure;

export interface ExecutionProvider {
  /** Stable identifier stored on every execution row. */
  readonly id: string;
  readonly displayName: string;

  /**
   * Is this provider usable right now?
   *
   * Separate from `execute` so the UI can say "not connected yet" before a user
   * approves something that cannot run. A provider that is not configured must
   * report so here rather than failing at dispatch — an approval spent on an
   * action that was never going to run is a wasted human decision.
   */
  isConfigured(): boolean;

  /** Why it is not usable. Shown to the user. Never contains configuration values. */
  unconfiguredReason(): string | null;

  execute(context: ExecutionContext): Promise<ExecutionResult>;
}

/** A failure any provider can construct without importing the error vocabulary. */
export function fail(
  errorCode: ErrorCode,
  message: string,
  externalId: string | null = null,
): ExecutionFailure {
  return { ok: false, errorCode, message, externalId };
}

export function succeed(
  output: unknown,
  summary: string,
  externalId: string | null = null,
): ExecutionSuccess {
  return { ok: true, output, summary, externalId };
}
