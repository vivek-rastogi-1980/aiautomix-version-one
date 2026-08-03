import { z } from "zod";

/**
 * JSON contract for the `business-validator` workflow
 * (JSON-SCHEMAS.md + BUSINESS-VALIDATOR-SPEC.md).
 *
 * The AI Workflow Engine validates every model response against this schema
 * before anything is persisted — malformed responses are rejected and retried.
 */

const priority = z.enum(["high", "medium", "low"]);

const nonEmpty = z.string().trim().min(1);

/** Model output occasionally returns a float; clamp and round to 0-100. */
const score0to100 = z.coerce
  .number()
  .transform((value) => Math.round(value))
  .pipe(z.number().int().min(0).max(100));

export const scoreBreakdownSchema = z.object({
  marketDemand: score0to100,
  problemSeverity: score0to100,
  revenuePotential: score0to100,
  competition: score0to100,
  feasibility: score0to100,
  innovation: score0to100,
  risk: score0to100,
});

export const swotSchema = z.object({
  strengths: z.array(nonEmpty).min(1),
  weaknesses: z.array(nonEmpty).min(1),
  opportunities: z.array(nonEmpty).min(1),
  threats: z.array(nonEmpty).min(1),
});

export const revenueModelSchema = z.object({
  name: nonEmpty,
  description: nonEmpty,
  potential: priority,
});

export const riskSchema = z.object({
  title: nonEmpty,
  description: nonEmpty,
  severity: priority,
  mitigation: nonEmpty,
});

export const recommendationSchema = z.object({
  title: nonEmpty,
  description: nonEmpty,
  priority,
});

export const nextStepSchema = z.object({
  title: nonEmpty,
  description: nonEmpty,
  timeframe: nonEmpty,
});

export const businessValidatorReportSchema = z.object({
  overallScore: score0to100,
  recommendation: z.enum(["go", "revise", "stop"]),
  summary: nonEmpty,
  problemStatement: nonEmpty,
  targetMarket: nonEmpty,
  customerPersona: nonEmpty,
  marketOpportunity: nonEmpty,
  scoreBreakdown: scoreBreakdownSchema,
  swot: swotSchema,
  revenueModels: z.array(revenueModelSchema).min(1),
  risks: z.array(riskSchema).min(1),
  recommendations: z.array(recommendationSchema).min(1),
  nextSteps: z.array(nextStepSchema).min(1),
});

export type BusinessValidatorReport = z.infer<
  typeof businessValidatorReportSchema
>;
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;
export type Swot = z.infer<typeof swotSchema>;
export type RevenueModel = z.infer<typeof revenueModelSchema>;
export type Risk = z.infer<typeof riskSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type NextStep = z.infer<typeof nextStepSchema>;
export type Priority = z.infer<typeof priority>;
