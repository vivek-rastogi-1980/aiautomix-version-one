import { z } from "zod";

import {
  BUSINESS_MODELS,
  BUSINESS_STAGES,
  MODEL_LABELS,
  STAGE_LABELS,
} from "@/lib/validations/business-idea";
import { optionalText, requiredText } from "@/lib/validations/text";

/**
 * Input contract for the `execution-roadmap` workflow (Phase 15).
 *
 * ---------------------------------------------------------------------------
 * Why the plan is summarised rather than sent whole
 * ---------------------------------------------------------------------------
 * A generated business plan is eleven prose sections and runs to several
 * thousand words. Sending all of it would cost tokens on text the roadmap does
 * not need (the model does not have to re-read the full financial narrative to
 * decide what to do in the first 30 days) and would bury the parts it does.
 *
 * So the brief that produced the plan is passed structurally — the same
 * vocabulary the plan itself was written from — plus the handful of plan
 * sections that actually bear on what to do next. §11 requires the roadmap to
 * reference the real business, model, customer and revenue model; those are all
 * in the brief, as facts the customer stated rather than prose to re-parse.
 */

export const executionRoadmapInputSchema = z.object({
  // --- The business, from the brief that generated the plan ---------------
  businessName: requiredText("Business name", 2, 120),
  ideaDescription: requiredText("Business idea", 10, 4000),
  industry: requiredText("Industry", 2, 80),
  country: requiredText("Country", 2, 80),
  targetAudience: requiredText("Target audience", 2, 500),
  businessModel: z.enum(BUSINESS_MODELS),
  currentStage: z.enum(BUSINESS_STAGES),
  estimatedBudget: z.coerce.number().min(0).max(1_000_000_000),

  // --- Optional context, forwarded only when the plan actually has it -----
  fundingGoal: optionalText(200),
  timeline: optionalText(120),
  competitors: optionalText(1000),
  teamSummary: optionalText(1000),

  /**
   * Plan sections that bear on execution, already trimmed by the caller.
   * Optional because a plan whose generation partly failed still has rows, and
   * a roadmap from a thinner plan is better than no roadmap at all.
   */
  executiveSummary: optionalText(3000),
  marketingAndSales: optionalText(3000),
  operations: optionalText(3000),
  milestonesSection: optionalText(3000),

  /** Link to the plan this came from. Never used as an authorisation input. */
  businessPlanId: z.string().uuid(),
});

export type ExecutionRoadmapInput = z.infer<typeof executionRoadmapInputSchema>;

/**
 * Map validated input onto the prompt's `{{placeholder}}` variables.
 *
 * Kept beside the schema so the prompt contract has one owner, exactly as
 * `toPlanPromptVariables` does for the business plan.
 *
 * Absent optional fields become the empty string rather than the word
 * "unknown": the prompt is instructed to turn a gap into a research task, and
 * a literal "unknown" reads to a model like a fact about the business.
 */
export function toRoadmapPromptVariables(
  input: ExecutionRoadmapInput,
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
    executiveSummary: input.executiveSummary ?? "",
    marketingAndSales: input.marketingAndSales ?? "",
    operations: input.operations ?? "",
    milestonesSection: input.milestonesSection ?? "",
  };
}
