import "server-only";

import { AiError, toAiError } from "@/features/ai/engine/errors";
import {
  validateInput,
  validateResponse,
} from "@/features/ai/engine/response-validator";
import type {
  AiProvider,
  AiUsage,
  AiCompletion,
  AiRetrievedSource,
  WorkflowRunInput,
  WorkflowRunMetadata,
  WorkflowRunResult,
} from "@/features/ai/engine/types";
import { createProvider, getDefaultProviderId } from "@/features/ai/providers";
import { buildMessages, loadPrompt } from "@/features/ai/registry/prompts";
import { createResearchProvider } from "@/features/ai/providers";
import { getWorkflow } from "@/features/ai/registry/workflows";
import { estimateCostUsd } from "@/features/ai/usage/pricing";
import { recordWorkflowRun } from "@/features/ai/usage/tracker";
import { rateLimitAiRun } from "@/lib/rate-limit";

/**
 * AI Workflow Manager (WORKFLOW-MANAGER-SPEC.md).
 *
 * The single execution path for every AI product:
 *
 *   input → validation → prompt → provider → JSON validation → save → result
 *
 * Responsibilities kept here on purpose, so no feature reimplements them:
 * workflow routing, retries, error normalisation, logging and metrics.
 * Features call `runWorkflow`; they never touch a provider.
 */

const MAX_ATTEMPTS = 3;
/** Backoff between attempts (ms), indexed by the attempt just completed. */
const RETRY_DELAY_MS = [600, 1800];

const EMPTY_USAGE: AiUsage = {
  promptTokens: null,
  outputTokens: null,
  totalTokens: null,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a registered workflow and return schema-validated output plus the
 * provenance metadata that must be persisted with the result.
 *
 * @param providerOverride Injected provider, used by the smoke tests to run the
 *   full pipeline without a network call. Production callers omit it.
 */
export async function runWorkflow<TOutput>(
  run: WorkflowRunInput,
  providerOverride?: AiProvider,
): Promise<WorkflowRunResult<TOutput>> {
  const workflow = getWorkflow<TOutput>(run.workflowId);
  const startedAt = Date.now();

  // 1. Input validation — a bad payload is the caller's fault and never
  //    reaches the provider.
  const input = validateInput(run.input, workflow.inputSchema);

  // 2. Rate limiting.
  const limit = rateLimitAiRun(run.userId);
  if (!limit.success) {
    throw new AiError(
      "AI_RATE_LIMITED",
      `Rate limit reached. Try again in ${limit.retryAfterSeconds}s.`,
    );
  }

  // 3. Model selection. A retrieval workflow demands a provider that can
  //    actually search; `createResearchProvider` fails loudly at this boundary
  //    rather than halfway through a charged run.
  const providerId = workflow.provider ?? getDefaultProviderId();
  const needsResearch = workflow.capability === "research";
  const provider =
    providerOverride ??
    (needsResearch
      ? createResearchProvider(providerId, workflow.model)
      : createProvider(providerId, workflow.model));

  if (needsResearch && typeof provider.research !== "function") {
    throw new AiError(
      "AI_PROVIDER_UNSUPPORTED",
      `Workflow ${workflow.id} requires web research, which this provider does not support.`,
    );
  }

  // 4. Prompt assembly from the versioned registry.
  const template = await loadPrompt(workflow.id, workflow.promptVersion);
  const messages = buildMessages(template, workflow.toVariables(input));

  let attempts = 0;
  let lastError: AiError = new AiError("AI_PROVIDER_ERROR");
  let usage: AiUsage = EMPTY_USAGE;
  let model = provider.model;
  let sources: AiRetrievedSource[] = [];

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    try {
      // 5. Provider call — one of two shapes, chosen by the workflow.
      let completion: AiCompletion;
      if (needsResearch) {
        // The prompt's system half carries the instructions; the user half
        // carries the (already fenced) brief. Same template, same fencing —
        // only the transport differs.
        const research = await provider.research!({
          instructions: messages[0]?.content ?? "",
          input: messages[1]?.content ?? "",
          maxSources: workflow.maxSources,
          maxOutputTokens: workflow.maxOutputTokens,
        });
        completion = research;
        // Sources come from the provider's citations, never from `data`.
        sources = research.sources;
      } else {
        completion = await provider.complete({
          messages,
          temperature: workflow.temperature,
          maxOutputTokens: workflow.maxOutputTokens,
        });
      }
      usage = completion.usage;
      model = completion.model;

      // 6. JSON validation.
      const data = validateResponse<TOutput>(
        completion.content,
        workflow.outputSchema,
      );

      const metadata: WorkflowRunMetadata = {
        workflow: workflow.id,
        workflowLabel: workflow.label,
        promptVersion: workflow.promptVersion,
        provider: provider.id,
        model,
        durationMs: Date.now() - startedAt,
        tokens: usage.totalTokens,
        promptTokens: usage.promptTokens,
        outputTokens: usage.outputTokens,
        attempts,
        estimatedCostUsd: estimateCostUsd(model, usage),
      };

      // 7. Save history + usage.
      const requestId = await recordWorkflowRun({
        userId: run.userId,
        projectId: run.projectId ?? null,
        workspaceId: run.workspaceId ?? null,
        workflow: metadata.workflow,
        promptVersion: metadata.promptVersion,
        provider: metadata.provider,
        model: metadata.model,
        status: "success",
        durationMs: metadata.durationMs,
        attempts,
        usage,
        estimatedCostUsd: metadata.estimatedCostUsd,
        input,
        output: data,
      });

      return { data, metadata, requestId, sources };
    } catch (error) {
      lastError = toAiError(error);

      const canRetry = lastError.retryable && attempts < MAX_ATTEMPTS;
      if (!canRetry) break;

      await delay(RETRY_DELAY_MS[attempts - 1] ?? 1800);
    }
  }

  await recordWorkflowRun({
    userId: run.userId,
    projectId: run.projectId ?? null,
    workspaceId: run.workspaceId ?? null,
    workflow: workflow.id,
    promptVersion: workflow.promptVersion,
    provider: provider.id,
    model,
    status: "failed",
    durationMs: Date.now() - startedAt,
    attempts,
    usage,
    estimatedCostUsd: estimateCostUsd(model, usage),
    input,
    errorCode: lastError.code,
    errorMessage: lastError.message,
  });

  throw lastError;
}
