/**
 * Error codes surfaced by the AI Platform. These map 1:1 onto the standard
 * error envelope in JSON-SCHEMAS.md / API-STANDARDS.md.
 */
export type AiErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_INVALID_INPUT"
  | "AI_VALIDATION_FAILED"
  | "AI_TIMEOUT"
  | "AI_RATE_LIMITED"
  | "AI_PROVIDER_ERROR"
  | "AI_PROVIDER_UNSUPPORTED"
  | "AI_PROMPT_NOT_FOUND"
  | "AI_UNKNOWN_WORKFLOW";

/** User-facing copy for each failure mode — never leak provider internals. */
const USER_MESSAGE: Record<AiErrorCode, string> = {
  AI_NOT_CONFIGURED:
    "The AI service is not configured. Add OPENAI_API_KEY to your environment.",
  AI_INVALID_INPUT: "Some of the details you submitted are not valid.",
  AI_VALIDATION_FAILED:
    "The AI returned an unexpected response. Please try again in a moment.",
  AI_TIMEOUT: "The AI took too long to respond. Please try again.",
  AI_RATE_LIMITED:
    "You've made too many requests. Please wait a moment and try again.",
  AI_PROVIDER_ERROR:
    "The AI service is temporarily unavailable. Please try again shortly.",
  AI_PROVIDER_UNSUPPORTED:
    "That AI provider is not available in this deployment.",
  AI_PROMPT_NOT_FOUND:
    "This AI workflow is misconfigured and could not be run. Please contact support.",
  AI_UNKNOWN_WORKFLOW: "That AI workflow does not exist.",
};

/** HTTP status for each code, so every route maps failures the same way. */
const HTTP_STATUS: Record<AiErrorCode, number> = {
  AI_NOT_CONFIGURED: 503,
  AI_INVALID_INPUT: 422,
  AI_VALIDATION_FAILED: 502,
  AI_TIMEOUT: 504,
  AI_RATE_LIMITED: 429,
  AI_PROVIDER_ERROR: 502,
  AI_PROVIDER_UNSUPPORTED: 501,
  AI_PROMPT_NOT_FOUND: 500,
  AI_UNKNOWN_WORKFLOW: 404,
};

export class AiError extends Error {
  readonly code: AiErrorCode;
  /** Whether retrying the same request could plausibly succeed. */
  readonly retryable: boolean;

  constructor(code: AiErrorCode, message?: string, retryable = false) {
    super(message ?? USER_MESSAGE[code]);
    this.name = "AiError";
    this.code = code;
    this.retryable = retryable;
  }

  /** Copy safe to show an end user. */
  get userMessage(): string {
    return USER_MESSAGE[this.code];
  }

  /** Status the REST layer should respond with. */
  get status(): number {
    return HTTP_STATUS[this.code];
  }
}

/** Narrow an unknown thrown value to an `AiError`. */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  return new AiError(
    "AI_PROVIDER_ERROR",
    error instanceof Error ? error.message : "Unknown AI error",
  );
}
