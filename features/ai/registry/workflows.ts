import { AiError } from "@/features/ai/engine/errors";
import type {
  AnyWorkflowDefinition,
  WorkflowDefinition,
} from "@/features/ai/engine/types";
import { businessValidatorReportSchema } from "@/features/ai/schemas/business-validator";
import {
  businessIdeaSchema,
  toPromptVariables,
} from "@/lib/validations/business-idea";

/**
 * Workflow Registry (AI-PLATFORM-SPEC.md, WORKFLOW-MANAGER-SPEC.md).
 *
 * The composition root of the platform: it is the only module that knows which
 * AI products exist. Registering a workflow is the complete integration —
 * an input schema, a prompt version, an output schema and a variable mapping.
 * The Workflow Manager handles execution, validation, retries, persistence and
 * usage tracking for every entry here without modification.
 */

export const BUSINESS_VALIDATOR_WORKFLOW = "business-validator";

const WORKFLOWS: Record<string, AnyWorkflowDefinition> = {
  [BUSINESS_VALIDATOR_WORKFLOW]: {
    id: BUSINESS_VALIDATOR_WORKFLOW,
    label: "Business Idea Validator",
    description:
      "Scores a structured business idea and returns a sectioned validation report.",
    promptVersion: "v1",
    inputSchema: businessIdeaSchema,
    outputSchema: businessValidatorReportSchema,
    toVariables: toPromptVariables,
    provider: "openai",
  },
};

/**
 * Look up a workflow. The registry is heterogeneous — each entry has its own
 * input and output types — so callers re-apply the output type here, exactly as
 * they do when reading the matching Zod schema.
 */
export function getWorkflow<TOutput>(
  id: string,
): WorkflowDefinition<unknown, TOutput> {
  const workflow = WORKFLOWS[id];
  if (!workflow) {
    throw new AiError("AI_UNKNOWN_WORKFLOW", `Unknown workflow: ${id}`);
  }
  return workflow as WorkflowDefinition<unknown, TOutput>;
}

export function isWorkflowRegistered(id: string): boolean {
  return id in WORKFLOWS;
}

/** Every registered workflow, for catalog sync and the history UI. */
export function listWorkflows(): readonly AnyWorkflowDefinition[] {
  return Object.values(WORKFLOWS);
}

/** Display label for a workflow slug, falling back to the slug itself. */
export function getWorkflowLabel(id: string): string {
  return WORKFLOWS[id]?.label ?? id;
}
