import { z } from "zod";

import {
  BUSINESS_MODELS,
  BUSINESS_STAGES,
  MODEL_LABELS,
  STAGE_LABELS,
} from "@/lib/validations/business-idea";
import {
  optionalText,
  optionalUuid,
  requiredText,
} from "@/lib/validations/text";

/**
 * Business plan brief (BUSINESS-PLAN-SPEC.md input side).
 * Shared by the Server Action, the REST endpoint, and the form UI.
 *
 * The overlapping fields deliberately reuse the validator's enums and labels:
 * a plan generated from a validated idea should describe the same business in
 * the same vocabulary.
 */

export const businessPlanInputSchema = z.object({
  // Required
  businessName: requiredText("Business name", 2, 120),
  ideaDescription: requiredText("Business idea", 40, 4000),
  industry: requiredText("Industry", 2, 80),
  country: requiredText("Country", 2, 80),
  targetAudience: requiredText("Target audience", 5, 500),
  businessModel: z.enum(BUSINESS_MODELS, {
    errorMap: () => ({ message: "Choose a business model" }),
  }),
  currentStage: z.enum(BUSINESS_STAGES, {
    errorMap: () => ({ message: "Choose your current stage" }),
  }),
  estimatedBudget: z.coerce
    .number({ invalid_type_error: "Enter a valid budget amount" })
    .min(0, "Budget cannot be negative")
    .max(1_000_000_000, "Enter a realistic budget"),

  // Optional
  fundingGoal: optionalText(200),
  timeline: optionalText(120),
  competitors: optionalText(1000),
  teamSummary: optionalText(1000),
  additionalNotes: optionalText(2000),

  /** Optional links up the workspace hierarchy. */
  projectId: optionalUuid("Choose a valid project"),
  businessIdeaId: optionalUuid("Choose a valid business idea"),
  /**
   * Set when the brief was prefilled from a validation report. Accepted here so
   * the plan can link back to its source, but never trusted: the Server Action
   * re-reads the report under the caller's own session before it is persisted,
   * so a forged id resolves to nothing rather than to another workspace's
   * report.
   */
  validationReportId: optionalUuid("Choose a valid validation report"),
});

export type BusinessPlanInput = z.infer<typeof businessPlanInputSchema>;

/**
 * A hand-edited section. Generous bounds: this is the user's own prose, and the
 * only hard requirements are that it is not empty and cannot be used to write
 * an unbounded blob into a row.
 */
export const planSectionContentSchema = z.object({
  content: requiredText("Section content", 1, 20_000),
});

/**
 * Map validated input onto the prompt's `{{placeholder}}` variables. Kept next
 * to the schema so the prompt contract has one owner.
 */
export function toPlanPromptVariables(
  input: BusinessPlanInput,
): Record<string, string> {
  return {
    businessName: input.businessName,
    ideaDescription: input.ideaDescription,
    industry: input.industry,
    country: input.country,
    targetAudience: input.targetAudience,
    businessModel: MODEL_LABELS[input.businessModel],
    currentStage: STAGE_LABELS[input.currentStage],
    estimatedBudget: `${input.estimatedBudget.toLocaleString("en-US")} USD`,
    fundingGoal: input.fundingGoal ?? "",
    timeline: input.timeline ?? "",
    competitors: input.competitors ?? "",
    teamSummary: input.teamSummary ?? "",
    additionalNotes: input.additionalNotes ?? "",
  };
}
