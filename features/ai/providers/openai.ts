import "server-only";

import OpenAI from "openai";

import { AiError } from "@/features/ai/engine/errors";
import type {
  AiCompletion,
  AiCompletionRequest,
  AiProvider,
} from "@/features/ai/engine/types";

/**
 * OpenAI provider (OPENAI-INTEGRATION.md).
 *
 * Server-side only, API key from the environment, JSON-mode responses, and
 * transport errors normalised into `AiError` so the Workflow Manager can decide
 * whether to retry.
 */

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 60_000;

export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
}

/** True when the server has credentials to call OpenAI. */
export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function createOpenAiProvider(model?: string): AiProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiError("AI_NOT_CONFIGURED");
  }

  const resolvedModel = model || getOpenAiModel();
  const client = new OpenAI({ apiKey, maxRetries: 0 });

  return {
    id: "openai",
    model: resolvedModel,

    async complete(request: AiCompletionRequest): Promise<AiCompletion> {
      try {
        const response = await client.chat.completions.create(
          {
            model: resolvedModel,
            temperature: request.temperature ?? 0.4,
            max_tokens: request.maxOutputTokens ?? 4000,
            // Force syntactically valid JSON; the Response Validator still
            // checks the shape against the workflow's Zod schema.
            response_format: { type: "json_object" },
            messages: request.messages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          },
          { timeout: request.timeoutMs ?? DEFAULT_TIMEOUT_MS },
        );

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new AiError(
            "AI_PROVIDER_ERROR",
            "OpenAI returned an empty response",
            true,
          );
        }

        return {
          content,
          model: response.model ?? resolvedModel,
          usage: {
            promptTokens: response.usage?.prompt_tokens ?? null,
            outputTokens: response.usage?.completion_tokens ?? null,
            totalTokens: response.usage?.total_tokens ?? null,
          },
        };
      } catch (error) {
        throw normaliseOpenAiError(error);
      }
    },
  };
}

/** Map SDK failures onto platform error codes, flagging what is worth retrying. */
function normaliseOpenAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;

  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) {
      return new AiError("AI_RATE_LIMITED", error.message, true);
    }
    if (error.status !== undefined && error.status >= 500) {
      return new AiError("AI_PROVIDER_ERROR", error.message, true);
    }
    return new AiError("AI_PROVIDER_ERROR", error.message, false);
  }

  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new AiError("AI_TIMEOUT", error.message, true);
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new AiError("AI_PROVIDER_ERROR", error.message, true);
  }

  return new AiError(
    "AI_PROVIDER_ERROR",
    error instanceof Error ? error.message : "Unknown provider error",
    true,
  );
}
