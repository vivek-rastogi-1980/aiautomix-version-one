import { z } from "zod";

import { CURRENCY_CODES } from "@/features/financials/money";
import { GTM_MOTIONS, MAX_PLAN_ACTIONS } from "@/features/marketing/types";

/**
 * User-facing validation for Marketing Intelligence.
 *
 * What a user can set is deliberately narrow: the business context, the selling
 * motion, and the two acquisition POLICY choices (payback window and target
 * LTV:CAC). Everything else is produced by a stage or calculated.
 *
 * There is no schema anywhere in this file for a channel score, a priority, a
 * budget or a required lead volume. Those are outputs, and an output you can
 * type into is not a calculation.
 */

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

const optionalUuid = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value))
  .refine(
    (value) =>
      value === undefined ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      ),
    "That reference is not valid.",
  );

/**
 * A percentage typed by a user, converted to basis points exactly once.
 *
 * Accepts "3", "3.0", "3.5x" is NOT accepted here — this is the ratio field and
 * it is expressed as a multiple, so it has its own schema below.
 */
export const percentToBpsSchema = z
  .string()
  .trim()
  .max(8)
  .refine((value) => value === "" || /^\d{1,3}(\.\d{1,2})?$/.test(value), {
    message: "Enter a percentage, for example 20 or 20.5.",
  })
  .transform((value) => (value === "" ? 0 : Math.round(Number(value) * 100)));

/**
 * A target LTV:CAC ratio typed as a multiple ("3" or "3.0"), stored as basis
 * points. 3 becomes 30 000.
 *
 * Bounded at 1x because a business that plans to spend its entire lifetime
 * value acquiring a customer has no business, and at 20x because a ceiling that
 * high is indistinguishable from having no ceiling.
 */
export const ltvCacRatioSchema = z
  .string()
  .trim()
  .max(8)
  .refine((value) => value === "" || /^\d{1,2}(\.\d{1,2})?$/.test(value), {
    message: "Enter a multiple, for example 3 or 3.5.",
  })
  .transform((value) =>
    value === "" ? 30_000 : Math.round(Number(value) * 10_000),
  )
  .refine(
    (bps) => bps >= 10_000 && bps <= 200_000,
    "The target ratio must be between 1x and 20x.",
  );

export const createGtmProjectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give the plan a title of at least 3 characters.")
    .max(200, "The title must be 200 characters or fewer."),

  description: optionalText(4000, "The business description"),
  industry: optionalText(200, "The industry"),
  geography: optionalText(200, "The geography"),

  /** Required. A budget whose currency was assumed means nothing. */
  currency: z.enum(CURRENCY_CODES as [string, ...string[]], {
    errorMap: () => ({ message: "Choose the currency for this plan." }),
  }),

  /**
   * Optional at creation: the planning stage proposes it when the user does not
   * know. Constrained when supplied, because it decides the funnel template.
   */
  motion: z
    .enum(GTM_MOTIONS)
    .optional()
    .or(z.literal("").transform(() => undefined)),

  /** A TARGET the business chooses. Never a forecast. */
  targetNewCustomers: z.coerce
    .number()
    .int()
    .min(0, "A customer target cannot be negative.")
    .max(10_000_000, "That target is out of range.")
    .default(0),

  targetHorizonMonths: z.coerce
    .number()
    .int()
    .min(1, "Plan for at least one month.")
    .max(24, "Plan for at most 24 months.")
    .default(12),

  /** Policy: months of gross profit the business will spend to acquire one. */
  paybackMonths: z.coerce
    .number()
    .int()
    .min(1, "The payback window must be at least one month.")
    .max(60, "The payback window must be 60 months or fewer.")
    .default(6),

  targetLtvCacBps: ltvCacRatioSchema.default("3"),

  businessIdeaId: optionalUuid,
  businessPlanId: optionalUuid,
  researchRequestId: optionalUuid,
  competitorProjectId: optionalUuid,
  financialProjectId: optionalUuid,
});

export type CreateGtmProjectInput = z.infer<typeof createGtmProjectSchema>;

/**
 * Editing the acquisition POLICY.
 *
 * The only numeric thing a user may change after creation, and both fields are
 * policy rather than outcome: how long you are willing to wait to recoup
 * acquisition spend, and what return you require on it. Change either and the
 * deterministic engine recalculates the ceiling, the budget and every scenario.
 *
 * Note what is absent: no field for allowable CAC itself, no field for the
 * budget, no field for a channel score. Those are results.
 */
export const updateAcquisitionPolicySchema = z.object({
  projectId: z.string().uuid(),
  targetNewCustomers: z.coerce.number().int().min(0).max(10_000_000),
  targetHorizonMonths: z.coerce.number().int().min(1).max(24),
  paybackMonths: z.coerce.number().int().min(1).max(60),
  targetLtvCacBps: ltvCacRatioSchema,
});

export type UpdateAcquisitionPolicyInput = z.infer<
  typeof updateAcquisitionPolicySchema
>;

/** Shared with the UI so the form and the engine agree on the plan cap. */
export const PLAN_ACTION_CAP = MAX_PLAN_ACTIONS;
