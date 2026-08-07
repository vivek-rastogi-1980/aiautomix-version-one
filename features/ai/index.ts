import "server-only";

/**
 * Public surface of the AI Platform (AI-PLATFORM-SPEC.md).
 *
 * "Every AI product must consume these shared services instead of implementing
 * its own logic" — this module is that contract. A feature imports from here
 * and gets execution, validation, history and usage tracking for free.
 *
 * Server-only: it pulls in the Workflow Manager. Client components should
 * import types from `features/ai/engine/types` or renderer models directly.
 */

export { runWorkflow } from "@/features/ai/engine/workflow-manager";

export {
  AiError,
  toAiError,
  type AiErrorCode,
} from "@/features/ai/engine/errors";

export {
  repairJson,
  validateInput,
  validateResponse,
} from "@/features/ai/engine/response-validator";

export {
  BUSINESS_VALIDATOR_WORKFLOW,
  getWorkflow,
  getWorkflowLabel,
  isWorkflowRegistered,
  listWorkflows,
} from "@/features/ai/registry/workflows";

export {
  buildMessages,
  listPromptVersions,
  loadPrompt,
} from "@/features/ai/registry/prompts";

export {
  createProvider,
  getDefaultProviderId,
  getProviderLabel,
  isPlatformConfigured,
  isProviderConfigured,
  isProviderImplemented,
  PROVIDER_IDS,
} from "@/features/ai/providers";

export { estimateCostUsd, formatCostUsd } from "@/features/ai/usage/pricing";

/**
 * Per-product orchestration entry points.
 *
 * These are the functions a consumer actually calls, so they belong on the
 * contract: without them every caller had to reach past this module into
 * `services/…`, which is why nothing imported the facade at all. Each is a thin
 * consumer of `runWorkflow` above — they add domain persistence, never AI logic.
 */
export {
  generateBusinessPlan,
  type GeneratePlanOptions,
  type PlanGenerationOutcome,
} from "@/features/ai/services/business-plan";

export {
  validateBusinessIdea,
  type ValidationOutcome,
} from "@/features/ai/services/business-validator";

export type {
  AiCompletion,
  AiCompletionRequest,
  AiMessage,
  AiProvider,
  AiUsage,
  PromptTemplate,
  ProviderId,
  WorkflowDefinition,
  WorkflowRunInput,
  WorkflowRunMetadata,
  WorkflowRunResult,
} from "@/features/ai/engine/types";
