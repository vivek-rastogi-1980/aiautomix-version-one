import { z } from "zod";

import {
  optionalText,
  optionalUuid,
  requiredText,
} from "@/lib/validations/text";

/**
 * Business idea submission contract (BUSINESS-VALIDATOR-SPEC.md "Input Fields").
 * Shared by the Server Action, the REST endpoint, and the form UI.
 *
 * Field builders and input sanitisation come from `lib/validations/text.ts`,
 * which the business-plan schema uses too.
 */

export const BUSINESS_STAGES = [
  "idea",
  "research",
  "prototype",
  "mvp",
  "launched",
  "scaling",
] as const;

export const BUSINESS_MODELS = [
  "saas",
  "marketplace",
  "ecommerce",
  "subscription",
  "services",
  "hardware",
  "advertising",
  "other",
] as const;

export type BusinessStage = (typeof BUSINESS_STAGES)[number];
export type BusinessModel = (typeof BUSINESS_MODELS)[number];

export const businessIdeaSchema = z.object({
  // Required
  businessName: requiredText("Business name", 2, 120),
  ideaDescription: requiredText("Business idea", 40, 4000),
  industry: requiredText("Industry", 2, 80),
  country: requiredText("Country", 2, 80),
  targetAudience: requiredText("Target audience", 5, 500),
  businessModel: z.enum(BUSINESS_MODELS, {
    errorMap: () => ({ message: "Choose a business model" }),
  }),
  estimatedBudget: z.coerce
    .number({ invalid_type_error: "Enter a valid budget amount" })
    .min(0, "Budget cannot be negative")
    .max(1_000_000_000, "Enter a realistic budget"),
  currentStage: z.enum(BUSINESS_STAGES, {
    errorMap: () => ({ message: "Choose your current stage" }),
  }),

  // Optional
  timeline: optionalText(120),
  competitors: optionalText(1000),
  additionalNotes: optionalText(2000),

  /** Optional link to an existing project. */
  projectId: optionalUuid("Choose a valid project"),
});

export type BusinessIdeaInput = z.infer<typeof businessIdeaSchema>;

export const STAGE_LABELS: Record<BusinessStage, string> = {
  idea: "Idea",
  research: "Researching",
  prototype: "Prototype",
  mvp: "MVP",
  launched: "Launched",
  scaling: "Scaling",
};

export const MODEL_LABELS: Record<BusinessModel, string> = {
  saas: "SaaS",
  marketplace: "Marketplace",
  ecommerce: "E-commerce",
  subscription: "Subscription",
  services: "Services / Agency",
  hardware: "Hardware",
  advertising: "Advertising",
  other: "Other",
};

/**
 * Map validated form input onto the prompt's `{{placeholder}}` variables.
 * Keeping this next to the schema means the prompt contract has one owner.
 */
export function toPromptVariables(
  input: BusinessIdeaInput,
): Record<string, string> {
  return {
    businessName: input.businessName,
    ideaDescription: input.ideaDescription,
    industry: input.industry,
    country: input.country,
    targetAudience: input.targetAudience,
    businessModel: MODEL_LABELS[input.businessModel],
    estimatedBudget: `${input.estimatedBudget.toLocaleString("en-US")} USD`,
    currentStage: STAGE_LABELS[input.currentStage],
    timeline: input.timeline ?? "",
    competitors: input.competitors ?? "",
    additionalNotes: input.additionalNotes ?? "",
  };
}
