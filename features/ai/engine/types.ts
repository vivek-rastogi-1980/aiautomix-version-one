import type { ZodType } from "zod";

/**
 * Core contracts of the AI Platform (AI-PLATFORM-SPEC.md).
 *
 * Everything below is provider-agnostic and workflow-agnostic: a new AI product
 * supplies a `WorkflowDefinition` and consumes `runWorkflow` — it never defines
 * its own execution, validation, logging or rendering logic.
 */

/** Providers the platform knows how to address (MODEL-PROVIDER-SPEC.md). */
export type ProviderId = "openai" | "anthropic" | "gemini" | "azure-openai";

/** Sections parsed out of a versioned prompt markdown file. */
export interface PromptTemplate {
  workflow: string;
  version: string;
  system: string;
  developer: string;
  context: string;
  input: string;
  schema: string;
  /** SHA-256 of the source file — recorded so a prompt change is auditable. */
  checksum: string;
}

/** A message handed to the provider layer. */
export interface AiMessage {
  role: "system" | "user";
  content: string;
}

/** Token accounting reported by the provider. */
export interface AiUsage {
  promptTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

/** Raw provider result, before JSON validation. */
export interface AiCompletion {
  content: string;
  model: string;
  usage: AiUsage;
}

export interface AiCompletionRequest {
  messages: AiMessage[];
  /** Deterministic-ish output for analytical workflows. */
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

/**
 * Abstract provider interface. OpenAI is the initial implementation; adding
 * Anthropic, Gemini or Azure OpenAI means adding a factory to
 * `features/ai/providers` — workflow and feature code does not change.
 */
export interface AiProvider {
  readonly id: ProviderId | string;
  readonly model: string;
  complete(request: AiCompletionRequest): Promise<AiCompletion>;
}

/**
 * A registered workflow. This is the entire contract a new AI product has to
 * satisfy: an input schema, a prompt version, an output schema, and the mapping
 * between validated input and prompt variables.
 */
export interface WorkflowDefinition<TInput, TOutput> {
  id: string;
  label: string;
  description: string;
  /** Prompt file to load: `prompts/<id>/<promptVersion>.md`. */
  promptVersion: string;
  inputSchema: ZodType<TInput>;
  outputSchema: ZodType<TOutput>;
  /** Map validated input onto the prompt's `{{placeholder}}` variables. */
  toVariables: (input: TInput) => Record<string, string>;
  /** Defaults to the platform provider when omitted. */
  provider?: ProviderId;
  /** Defaults to the provider's configured model when omitted. */
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Heterogeneous registry entry. Each workflow has its own input/output types,
 * which callers re-apply at lookup — see `getWorkflow`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWorkflowDefinition = WorkflowDefinition<any, any>;

/** Everything a workflow run needs from the caller. */
export interface WorkflowRunInput {
  workflowId: string;
  /** Owner of the run — used for logging, usage tracking and rate limiting. */
  userId: string;
  /** Raw input; validated against the workflow's `inputSchema`. */
  input: unknown;
  /** Optional project the run belongs to (USAGE-TRACKING-SPEC.md). */
  projectId?: string | null;
  /**
   * Sprint 6.5: the commercial boundary this run is metered against.
   *
   * Optional so existing callers keep compiling, but a run without it produces
   * a usage row with a null `workspace_id` — invisible to the workspace usage
   * dashboard and to any future billing period. Every caller inside the app
   * supplies it.
   */
  workspaceId?: string | null;
}

/** Provenance persisted alongside every result (JSON-SCHEMAS.md). */
export interface WorkflowRunMetadata {
  workflow: string;
  workflowLabel: string;
  promptVersion: string;
  provider: string;
  model: string;
  durationMs: number;
  tokens: number | null;
  promptTokens: number | null;
  outputTokens: number | null;
  attempts: number;
  /** Null when the model has no entry in the pricing table. */
  estimatedCostUsd: number | null;
}

export interface WorkflowRunResult<TOutput> {
  data: TOutput;
  metadata: WorkflowRunMetadata;
  /** `ai_requests.id` for this run, or null if logging was unavailable. */
  requestId: string | null;
}
