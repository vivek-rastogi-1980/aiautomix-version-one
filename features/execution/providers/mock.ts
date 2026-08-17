import {
  fail,
  succeed,
  type ExecutionContext,
  type ExecutionProvider,
  type ExecutionResult,
} from "@/features/execution/providers/types";

/**
 * The mock provider.
 *
 * Phase 10.1's only working provider. It creates nothing outside AIAutoMix,
 * contacts no network, and returns a deterministic result derived from the
 * idempotency key.
 *
 * ---------------------------------------------------------------------------
 * Why it is deterministic
 * ---------------------------------------------------------------------------
 * A mock that returned a random id would make the idempotency tests
 * unfalsifiable: two executions could differ for the honest reason that a UUID
 * differs, and the test could not tell that from a genuine duplicate. Deriving
 * the external id from the idempotency key means "same key in, same id out" is
 * a property the suite can assert, which is exactly the property a real
 * provider's idempotency guarantee is supposed to have.
 *
 * It also lets the smoke suite exercise the FAILURE paths without a network:
 * an input carrying `simulate` makes the mock return a chosen error code, so
 * retryable and non-retryable handling can both be tested deterministically.
 * That switch is honoured only by this provider and only in the input a
 * developer wrote — it is not a client-controllable flag on a real integration.
 */

/** A small, stable hash. Not cryptographic — this is only for readable ids. */
function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

/** The simulation switch, read only from an action's own stored input. */
function simulatedFailure(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const value = (input as Record<string, unknown>).simulate;
  return typeof value === "string" ? value : null;
}

export const mockProvider: ExecutionProvider = {
  id: "mock",
  displayName: "Mock provider (no external effect)",

  isConfigured(): boolean {
    return true;
  },

  unconfiguredReason(): string | null {
    return null;
  },

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const simulate = simulatedFailure(context.input);

    if (simulate === "network_error") {
      return fail(
        "NETWORK_ERROR",
        "Simulated network error. This is retryable.",
      );
    }
    if (simulate === "timeout") {
      return fail("PROVIDER_TIMEOUT", "Simulated timeout. This is retryable.");
    }
    if (simulate === "invalid") {
      return fail(
        "INVALID_INPUT",
        "Simulated permanent failure. This is not retryable.",
      );
    }
    if (simulate === "authorization") {
      return fail(
        "AUTHORIZATION_FAILED",
        "Simulated authorisation failure. This is not retryable.",
      );
    }

    // The identifier is a pure function of the idempotency key, so replaying
    // the same attempt reproduces the same external id — which is what a real
    // provider's idempotency guarantee looks like from the outside.
    const externalId = `mock_${fingerprint(context.idempotencyKey)}`;

    return succeed(
      {
        mock: true,
        actionType: context.actionType,
        externalId,
        // Echoed so the execution log shows what WOULD have been sent, which is
        // the whole value of a dry run.
        wouldHaveSent: context.input,
      },
      `Simulated ${context.actionType}. Nothing was published or sent.`,
      externalId,
    );
  },
};
