import type { ZodType } from "zod";

import { AiError } from "@/features/ai/engine/errors";

/**
 * Response Validator (AI-PLATFORM-SPEC.md: "JSON Validator").
 *
 * The single place where raw model text becomes trusted, typed data. Every
 * workflow goes through it, so JSON repair and schema enforcement behave
 * identically for every AI product.
 */

/**
 * Best-effort repair of near-JSON output: strip markdown fences and trim to the
 * outermost object. Providers with a JSON mode make this rare, but a malformed
 * response otherwise costs the user a whole run, so the platform stays
 * defensive.
 */
export function repairJson(raw: string): string {
  let text = raw.trim();

  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) text = fence[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start > 0 || (end !== -1 && end < text.length - 1)) {
    if (start !== -1 && end !== -1 && end > start) {
      text = text.slice(start, end + 1);
    }
  }

  return text;
}

/**
 * Parse and validate a provider response.
 *
 * Throws a **retryable** `AI_VALIDATION_FAILED` on both malformed JSON and
 * schema violations: in either case the same prompt may well succeed on the
 * next attempt, which is exactly what the Workflow Manager retries on.
 */
export function validateResponse<TOutput>(
  raw: string,
  schema: ZodType<TOutput>,
): TOutput {
  let json: unknown;
  try {
    json = JSON.parse(repairJson(raw));
  } catch (error) {
    throw new AiError(
      "AI_VALIDATION_FAILED",
      error instanceof Error ? error.message : "Response was not valid JSON",
      true,
    );
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new AiError(
      "AI_VALIDATION_FAILED",
      parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
      true,
    );
  }

  return parsed.data;
}

/**
 * Validate a workflow's *input*. Distinct from the response path: bad input is
 * the caller's fault and must never be retried against the provider.
 */
export function validateInput<TInput>(
  input: unknown,
  schema: ZodType<TInput>,
): TInput {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AiError(
      "AI_INVALID_INPUT",
      parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
      false,
    );
  }
  return parsed.data;
}
