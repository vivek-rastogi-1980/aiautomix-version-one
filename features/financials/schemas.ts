import { z } from "zod";

import { CURRENCY_CODES } from "@/features/financials/money";
import {
  MAX_HORIZON_MONTHS,
  REVENUE_MODELS,
  ASSUMPTION_UNITS,
} from "@/features/financials/types";

/**
 * Input contracts for the Financial Intelligence product layer.
 *
 * These validate what a *user* submits — separate from
 * `features/financials/stages/contracts.ts`, which validates what a *model*
 * returns.
 *
 * The money field is the interesting one. A user types "50,000" meaning fifty
 * thousand rupees; the database stores 5,000,000 paise. That conversion happens
 * exactly once, here, and the schema carries the major-unit string through to a
 * transform rather than letting a float loose in the form handler.
 */

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => (value === "" ? undefined : value))
    .optional();

const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional()
  .refine(
    (value) =>
      value === undefined || z.string().uuid().safeParse(value).success,
    "That is not a valid id.",
  );

/**
 * A major-unit amount as typed, converted to minor units once.
 *
 * Accepts "50,000", "50000", "50000.50". Rejects anything else rather than
 * coercing — `Number("abc")` is `NaN`, and a NaN that reaches the database
 * becomes a model with no opening cash and no explanation.
 */
export const majorAmountSchema = z
  .string()
  .trim()
  .max(24, "That amount is too long.")
  .transform((raw) => raw.replace(/[,\s]/g, ""))
  .refine(
    (value) => value === "" || /^\d*\.?\d{0,2}$/.test(value),
    "Enter a plain amount, for example 50000 or 50000.50.",
  )
  .transform((value) => {
    if (value === "") return 0;
    // Rounded immediately: the float exists only for this expression.
    return Math.round(Number.parseFloat(value) * 100);
  })
  .refine(
    (minor) => Number.isSafeInteger(minor) && minor >= 0,
    "That amount is out of range.",
  );

export const createFinancialProjectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give the model a title of at least 3 characters.")
    .max(200, "The title must be 200 characters or fewer."),

  description: optionalText(4000, "The business description"),
  industry: optionalText(200, "The industry"),
  geography: optionalText(200, "The geography"),
  targetCustomer: optionalText(1000, "The target customer"),

  /** Required. A model whose currency was assumed means nothing. */
  currency: z.enum(CURRENCY_CODES as [string, ...string[]], {
    errorMap: () => ({ message: "Choose the currency for this model." }),
  }),

  revenueModel: z.enum(REVENUE_MODELS, {
    errorMap: () => ({ message: "Choose how this business earns revenue." }),
  }),

  horizonMonths: z.coerce
    .number()
    .int()
    .min(1, "Forecast at least one month.")
    .max(MAX_HORIZON_MONTHS, `Forecast at most ${MAX_HORIZON_MONTHS} months.`)
    .default(12),

  /** Cash on hand today, in major units as typed. */
  openingCash: majorAmountSchema,

  businessIdeaId: optionalUuid,
  businessPlanId: optionalUuid,
  researchRequestId: optionalUuid,
  competitorProjectId: optionalUuid,
});

export type CreateFinancialProjectInput = z.infer<
  typeof createFinancialProjectSchema
>;

/**
 * Editing one assumption.
 *
 * This is the ONLY way a user changes the model. There is deliberately no
 * schema anywhere for editing revenue, profit or break-even: those are outputs,
 * and an output you can type into is not a calculation.
 */
export const updateAssumptionSchema = z
  .object({
    projectId: z.string().uuid(),
    key: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_]{1,60}$/, "That is not a valid assumption."),
    unit: z.enum(ASSUMPTION_UNITS),
    /** Money assumptions arrive as a major-unit string. */
    amount: z.string().trim().max(24).optional(),
    /** Counts, basis points and months arrive as an integer string. */
    value: z.string().trim().max(24).optional(),
  })
  .superRefine((input, ctx) => {
    if (input.unit === "money") {
      const parsed = majorAmountSchema.safeParse(input.amount ?? "");
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amount"],
          message: "Enter a plain amount, for example 2000.",
        });
      }
      return;
    }

    const raw = (input.value ?? "").replace(/[,\s]/g, "");
    if (!/^\d+$/.test(raw)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message:
          input.unit === "bps"
            ? "Enter a whole percentage, for example 10 for 10%."
            : "Enter a whole number.",
      });
    }
  });

export type UpdateAssumptionInput = z.infer<typeof updateAssumptionSchema>;

/**
 * A percentage the user typed, as basis points.
 *
 * The form shows "10" for 10%; the engine wants 1000 bp. Converting here means
 * no component ever handles a rate in two different scales.
 */
export function percentStringToBps(raw: string): number | null {
  const cleaned = raw.replace(/[,\s%]/g, "");
  if (!/^\d*\.?\d{0,2}$/.test(cleaned) || cleaned === "") return null;
  const percent = Number.parseFloat(cleaned);
  if (!Number.isFinite(percent) || percent < 0) return null;
  return Math.round(percent * 100);
}
