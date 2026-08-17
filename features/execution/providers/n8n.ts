import {
  fail,
  type ExecutionContext,
  type ExecutionProvider,
  type ExecutionResult,
} from "@/features/execution/providers/types";

/**
 * The N8N adapter — interface and safe stub.
 *
 * ---------------------------------------------------------------------------
 * What this file deliberately does NOT do
 * ---------------------------------------------------------------------------
 * It does not call N8N. §13 asks for the architecture, not the integration, and
 * a half-built adapter that sometimes reaches a real workflow is worse than
 * none: it would mean the first real publish happens by accident, during a test,
 * from a machine nobody was watching.
 *
 * So `execute` refuses. It refuses with `PROVIDER_NOT_CONFIGURED`, which is a
 * NON-retryable code — retrying an unbuilt integration three times just wastes
 * the attempt budget and buries the real message.
 *
 * ---------------------------------------------------------------------------
 * What it establishes for Phase 10.2
 * ---------------------------------------------------------------------------
 *   CREDENTIALS LIVE IN THE ENVIRONMENT. Read here, on the server, never
 *   returned from any function, never sent to a client, and never written into
 *   an execution row. `isConfigured()` returns a boolean, not the URL, so the
 *   UI can say "not connected" without learning anything about the connection.
 *
 *   THE ENGINE OWNS IDEMPOTENCY. When this is built out, the key from
 *   `context.idempotencyKey` goes into the webhook payload and into an
 *   `Idempotency-Key` header. The adapter does not invent one.
 *
 *   CALLBACKS ARE SIGNED. N8N will call back asynchronously, and
 *   `webhook-security.ts` already implements the verification that endpoint
 *   will use. The endpoint itself does not exist yet, because §14 is right that
 *   an unsecured public callback is worse than no callback.
 */

/**
 * Configuration, read from the environment on the server only.
 *
 * Absent by design in Phase 10.1: no `.env` key is documented or expected yet,
 * so every deployment reports "not configured" and every dispatch refuses.
 */
interface N8nConfig {
  baseUrl: string;
  /** Shared secret used to sign outbound requests and verify callbacks. */
  signingSecret: string;
}

function readConfig(): N8nConfig | null {
  const baseUrl = process.env.N8N_BASE_URL;
  const signingSecret = process.env.N8N_SIGNING_SECRET;

  if (!baseUrl || !signingSecret) return null;

  // A misconfigured base URL is a configuration error, not a runtime one: it is
  // better to report "not configured" than to attempt a request to something
  // that is not a URL.
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:") return null;
  } catch {
    return null;
  }

  return { baseUrl, signingSecret };
}

export const n8nProvider: ExecutionProvider = {
  id: "n8n",
  displayName: "N8N workflow automation",

  isConfigured(): boolean {
    return readConfig() !== null;
  },

  unconfiguredReason(): string | null {
    if (readConfig() !== null) return null;
    return "The N8N integration is not connected yet. Actions that need it can be planned and approved, but cannot run.";
  },

  async execute(_context: ExecutionContext): Promise<ExecutionResult> {
    const config = readConfig();

    if (!config) {
      return fail(
        "PROVIDER_NOT_CONFIGURED",
        "The N8N integration is not connected yet, so this action was not executed. Nothing was sent anywhere.",
      );
    }

    /*
     * Phase 10.2 continues here. The shape is settled; only the transport is
     * missing:
     *
     *   POST `${config.baseUrl}/webhook/aiautomix/${context.actionType}`
     *     X-AIAutoMix-Timestamp:  <unix seconds>
     *     X-AIAutoMix-Nonce:      <random>
     *     X-AIAutoMix-Signature:  <signPayload(...) from webhook-security.ts>
     *     Idempotency-Key:        context.idempotencyKey
     *     body: { actionId, workspaceId, attempt, input }
     *
     * The response is either an immediate result or an acknowledgement, with
     * the real outcome arriving on a signed callback. Nothing about that
     * changes the domain model, which is the point of the abstraction.
     */
    return fail(
      "PROVIDER_NOT_CONFIGURED",
      "The N8N adapter is configured but dispatch is not implemented in this release. Nothing was sent anywhere.",
    );
  },
};
