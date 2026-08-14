import { AiError } from "@/features/ai/engine/errors";
import type {
  AnyWorkflowDefinition,
  WorkflowDefinition,
} from "@/features/ai/engine/types";
import { businessPlanSchema } from "@/features/ai/schemas/business-plan";
import { businessValidatorReportSchema } from "@/features/ai/schemas/business-validator";
import {
  businessIdeaSchema,
  toPromptVariables,
} from "@/lib/validations/business-idea";
import {
  businessPlanInputSchema,
  toPlanPromptVariables,
} from "@/lib/validations/business-plan";
import { RESEARCH_WORKFLOWS } from "@/features/research/stages/workflows";
import { COMPETITOR_WORKFLOWS } from "@/features/competitors/stages/workflows";
import { FINANCIAL_WORKFLOWS } from "@/features/financials/stages/workflows";

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
export const BUSINESS_PLAN_WORKFLOW = "business-plan";

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
  [BUSINESS_PLAN_WORKFLOW]: {
    id: BUSINESS_PLAN_WORKFLOW,
    label: "Business Plan Generator",
    description:
      "Generates an eleven-section business plan from a structured brief.",
    promptVersion: "v1",
    inputSchema: businessPlanInputSchema,
    outputSchema: businessPlanSchema,
    toVariables: toPlanPromptVariables,
    provider: "openai",
    // Eleven prose sections do not fit in the platform default of 4000.
    maxOutputTokens: 9000,
  },

  // Sprint 8: the seven Market Research stages. Registered here like any other
  // AI product, so the stage engine gets validation, retries, usage logging and
  // cost estimation from the platform rather than reimplementing them.
  ...RESEARCH_WORKFLOWS,

  // Phase 7: the seven Competitor Intelligence stages, on the same terms.
  // Three of them declare `capability: "research"` and reach the web through
  // `AiProvider.research()`; the other four reason over stored rows.
  ...COMPETITOR_WORKFLOWS,

  // Phase 8: the FIVE AI stages of Financial Intelligence. There are eight
  // stages; the missing three are computed by `features/financials/calc` and
  // deliberately have no workflow, because no language model may produce an
  // authoritative financial figure.
  ...FINANCIAL_WORKFLOWS,
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
