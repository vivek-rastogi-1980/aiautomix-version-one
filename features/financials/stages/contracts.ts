import { z } from "zod";

import {
  ASSUMPTION_SOURCES,
  ASSUMPTION_UNITS,
  COST_CATEGORIES,
  COST_KINDS,
  CONFIDENCE_LEVELS,
  FUNDING_TYPES,
  REVENUE_MODELS,
  RISK_KINDS,
  RISK_SEVERITY,
  SUITABILITY,
} from "@/features/financials/types";

/**
 * Typed contracts for the AI stages of Financial Intelligence.
 *
 * ---------------------------------------------------------------------------
 * What is NOT in this file
 * ---------------------------------------------------------------------------
 * There is no schema here for revenue, gross profit, margin, break-even,
 * runway or any other CALCULATED figure — because no model is ever asked for
 * one. The three compute stages have no contract in this file at all: they take
 * stored assumptions and run `calc/engine.ts`.
 *
 * Every schema below describes ASSUMPTIONS (inputs) or NARRATIVE (explanation
 * of figures already computed). If a future stage needed a model to return a
 * total, the design would be wrong, not the schema.
 *
 * Two further rules:
 *
 *   MONEY IS MINOR UNITS. Every amount is an integer count of minor units, and
 *   the schema refuses a float. A model that returns `2000.5` is returning a
 *   number it does not understand the scale of, and rejecting it is safer than
 *   rounding it.
 *
 *   RATES ARE BASIS POINTS. Integers, bounded. A "growth rate" of 0.1 is
 *   ambiguous between 0.1% and 10%; 1000 bp is not.
 */

const confidence = z.enum(CONFIDENCE_LEVELS);
const shortText = z.string().trim().min(1).max(2000);
const longText = z.string().trim().min(1).max(8000);

/**
 * An integer count of minor units.
 *
 * `.int()` is the load-bearing part: it rejects `2000.5` outright rather than
 * rounding it, because a fractional minor unit means the model was thinking in
 * major units and the value is off by a factor of 100.
 */
const minorUnits = z
  .number()
  .int("Money must be a whole number of minor units (paise, cents, pence).")
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);

/** Basis points. 10 000 = 100%. Bounded so a rate cannot be nonsensical. */
const bps = (max = 100_000) =>
  z
    .number()
    .int("Rates must be whole basis points (1 bp = 0.01%).")
    .min(0)
    .max(max);

/** A count of things — customers, orders, units. */
const count = z.number().int().min(0).max(100_000_000);

// ---------------------------------------------------------------------------
// The assumption envelope
// ---------------------------------------------------------------------------

/**
 * One proposed assumption.
 *
 * `source` is required and constrained. A model can only ever propose `AI` or
 * an `INHERITED_*` value; the SQL upsert refuses to let either overwrite a
 * `USER` row, so a proposal cannot quietly replace something the founder set.
 */
export const assumptionSchema = z
  .object({
    key: z
      .string()
      .trim()
      .regex(
        /^[a-z][a-z0-9_]{1,60}$/,
        "Assumption keys are lower_snake_case identifiers.",
      ),
    label: z.string().trim().min(1).max(200),
    unit: z.enum(ASSUMPTION_UNITS),
    /** Populated for `unit: "money"`. */
    valueMinor: minorUnits.optional(),
    /** Populated for every other unit. */
    valueInt: z.number().int().min(0).max(100_000_000).optional(),
    source: z.enum(ASSUMPTION_SOURCES),
    confidence,
    /** Why this number. Shown to the user beside the value. */
    rationale: z.string().trim().max(2000).optional(),
    /** A market-research or competitor URL that supports it, when one exists. */
    evidenceUrl: z.string().trim().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    // The unit decides which field is authoritative. Getting this wrong would
    // let a 500 bp churn rate be stored as five rupees.
    if (value.unit === "money" && value.valueMinor === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valueMinor"],
        message: "A money assumption must carry valueMinor.",
      });
    }
    if (value.unit !== "money" && value.valueInt === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valueInt"],
        message: "A non-money assumption must carry valueInt.",
      });
    }
    if (value.unit === "money" && value.valueInt !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valueInt"],
        message: "A money assumption must not also carry valueInt.",
      });
    }
  });

export type AssumptionInput = z.infer<typeof assumptionSchema>;

// ---------------------------------------------------------------------------
// 1. Financial planning
// ---------------------------------------------------------------------------

export const planningInputSchema = z.object({
  title: shortText,
  description: z.string().max(4000).optional(),
  industry: z.string().max(200).optional(),
  geography: z.string().max(200).optional(),
  targetCustomer: z.string().max(1000).optional(),
  currency: z.string().length(3),
  revenueModel: z.enum(REVENUE_MODELS),
  horizonMonths: z.number().int().positive(),
  /** Anything already known from a plan, research or competitor project. */
  inherited: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        value: z.string(),
        origin: z.string(),
      }),
    )
    .max(40)
    .default([]),
});
export type PlanningInput = z.infer<typeof planningInputSchema>;

export const planningOutputSchema = z.object({
  operatingModel: longText,
  /** What has to be true for this model to work. Not a forecast. */
  keyDrivers: z.array(shortText).min(1).max(10),
  assumptions: z.array(assumptionSchema).max(30).default([]),
  /** Stated explicitly so the report can print what was taken on trust. */
  openQuestions: z.array(shortText).max(10).default([]),
});
export type PlanningOutput = z.infer<typeof planningOutputSchema>;

// ---------------------------------------------------------------------------
// 2. Cost modelling
// ---------------------------------------------------------------------------

export const costInputSchema = z.object({
  title: z.string(),
  description: z.string().max(4000).optional(),
  industry: z.string().max(200).optional(),
  geography: z.string().max(200).optional(),
  currency: z.string().length(3),
  revenueModel: z.enum(REVENUE_MODELS),
  operatingModel: z.string().max(8000),
  /** Costs already known, so the model does not propose them twice. */
  existingCosts: z
    .array(z.object({ category: z.string(), label: z.string() }))
    .max(60)
    .default([]),
});
export type CostInput = z.infer<typeof costInputSchema>;

/**
 * A cost line.
 *
 * `everyMonths` exists so an annual licence is stated once and spread by the
 * engine, rather than the model dividing by twelve and introducing a rounding
 * error the report cannot explain.
 */
export const costLineSchema = z.object({
  category: z.enum(COST_CATEGORIES),
  kind: z.enum(COST_KINDS),
  label: z.string().trim().min(1).max(200),
  amountMinor: minorUnits,
  everyMonths: z.number().int().min(1).max(60).default(1),
  confidence,
  rationale: z.string().trim().max(2000).optional(),
});

export const costOutputSchema = z.object({
  oneTime: z.array(costLineSchema).max(40).default([]),
  recurring: z.array(costLineSchema).max(40).default([]),
  /**
   * Categories deliberately left out, and why. The spec is explicit that not
   * every business uses every category — this is how "not applicable" is said
   * out loud rather than shown as a zero.
   */
  notApplicable: z
    .array(z.object({ category: z.enum(COST_CATEGORIES), reason: shortText }))
    .max(20)
    .default([]),
  notes: z.string().max(4000).optional(),
});
export type CostOutput = z.infer<typeof costOutputSchema>;

// ---------------------------------------------------------------------------
// 3. Revenue modelling
// ---------------------------------------------------------------------------

export const revenueInputSchema = z.object({
  title: z.string(),
  description: z.string().max(4000).optional(),
  currency: z.string().length(3),
  revenueModel: z.enum(REVENUE_MODELS),
  targetCustomer: z.string().max(1000).optional(),
  geography: z.string().max(200).optional(),
  horizonMonths: z.number().int().positive(),
  /** Pricing evidence from market research or competitor research. */
  pricingEvidence: z
    .array(
      z.object({
        source: z.string(),
        claim: z.string(),
        url: z.string().optional(),
      }),
    )
    .max(20)
    .default([]),
  monthlyFixedCostMinor: minorUnits,
});
export type RevenueInput = z.infer<typeof revenueInputSchema>;

/**
 * The revenue DRIVERS — not the revenue.
 *
 * The model proposes how many customers, at what price, growing how fast. The
 * engine multiplies. There is deliberately no `monthlyRevenue` field: if there
 * were, a model could return a number that did not equal units x price, and
 * whichever the report printed would be wrong.
 */
export const revenueOutputSchema = z.object({
  startingUnits: count,
  unitGrowthBps: bps(20_000),
  pricePerUnitMinor: minorUnits,
  monthlyChurnBps: bps(10_000),
  /** Marketplace only. The platform's cut of transaction value. */
  takeRateBps: bps(10_000).optional(),
  /** Cost to acquire one unit. Drives CAC and the marketing spend line. */
  cacPerUnitMinor: minorUnits.optional(),
  /** Variable cost of delivery as a share of revenue. */
  cogsBps: bps(10_000),
  assumptions: z.array(assumptionSchema).max(30).default([]),
  rationale: longText,
});
export type RevenueOutput = z.infer<typeof revenueOutputSchema>;

// ---------------------------------------------------------------------------
// 7. Funding analysis  (retrieval)
// ---------------------------------------------------------------------------

export const fundingInputSchema = z.object({
  title: z.string(),
  description: z.string().max(4000).optional(),
  industry: z.string().max(200).optional(),
  geography: z.string().max(200).optional(),
  currency: z.string().length(3),
  revenueModel: z.enum(REVENUE_MODELS),
  /** Computed by the engine, not by the model. Given so options can be sized. */
  capitalRequiredMinor: minorUnits,
  monthlyBurnMinor: minorUnits,
  runwayMonths: z.number().int().nullable(),
  breakEvenMonth: z.number().int().nullable(),
});
export type FundingInput = z.infer<typeof fundingInputSchema>;

/**
 * One funding option.
 *
 * Amounts are optional because most providers do not publish a range, and the
 * schema must let the model say so rather than forcing it to invent one. The
 * `domain` field is a bare hostname matched against the provider's citations,
 * exactly as in competitor discovery — an option whose host was not actually
 * returned by the search is discarded server-side.
 */
export const fundingOptionSchema = z.object({
  name: z.string().trim().min(1).max(300),
  provider: z.string().trim().max(300).optional(),
  fundingType: z.enum(FUNDING_TYPES),
  geography: z.string().trim().max(200).optional(),
  eligibility: z.string().trim().max(4000).optional(),
  /** Published range only. Omit rather than estimate. */
  amountMinMinor: minorUnits.optional(),
  amountMaxMinor: minorUnits.optional(),
  terms: z.string().trim().max(4000).optional(),
  /**
   * Bare hostname the search returned, e.g. `startupindia.gov.in`. Never a
   * full URL — a URL a model writes is not evidence.
   */
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .regex(
      /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/,
      "Must be a bare hostname, not a URL.",
    )
    .optional(),
  suitability: z.enum(SUITABILITY),
  suitabilityRationale: shortText,
  confidence,
});

export const fundingOutputSchema = z.object({
  options: z.array(fundingOptionSchema).max(30).default([]),
  queriesUsed: z.array(z.string().max(300)).max(20).default([]),
  insufficientEvidence: z.boolean().default(false),
  notes: z.string().max(4000).optional(),
});
export type FundingOutput = z.infer<typeof fundingOutputSchema>;

// ---------------------------------------------------------------------------
// 8. Recommendations  (narrative over computed figures)
// ---------------------------------------------------------------------------

export const recommendationsInputSchema = z.object({
  title: z.string(),
  currency: z.string().length(3),
  revenueModel: z.enum(REVENUE_MODELS),
  /**
   * Everything below was CALCULATED by the engine and is passed in as read-only
   * context. The model explains these figures; it does not produce them, and
   * the contract below has nowhere to return a different total.
   */
  computed: z.object({
    totalRevenueMinor: minorUnits,
    totalOperatingProfitMinor: z.number().int(),
    grossMarginBps: z.number().int().nullable(),
    breakEvenMonth: z.number().int().nullable(),
    breakEvenRevenueMinor: minorUnits.nullable(),
    monthlyBurnMinor: minorUnits,
    runwayMonths: z.number().int().nullable(),
    capitalRequiredMinor: minorUnits,
    cacPaybackMonths: z.number().int().nullable(),
    ltvToCacBps: z.number().int().nullable(),
  }),
  topCostLines: z
    .array(z.object({ label: z.string(), amountMinor: z.number().int() }))
    .max(10)
    .default([]),
  fundingOptionCount: z.number().int().nonnegative(),
  assumptionCount: z.number().int().nonnegative(),
  /** Assumptions the model itself proposed, so risk can name them. */
  aiAssumptionKeys: z.array(z.string()).max(40).default([]),
});
export type RecommendationsInput = z.infer<typeof recommendationsInputSchema>;

export const recommendationsOutputSchema = z.object({
  executiveSummary: longText,
  recommendations: z
    .array(
      z.object({
        area: z.enum([
          "pricing",
          "cost_control",
          "growth",
          "funding",
          "runway",
          "unit_economics",
        ]),
        recommendation: shortText,
        rationale: shortText,
        confidence,
      }),
    )
    .min(1)
    .max(20),
  risks: z
    .array(
      z.object({
        kind: z.enum(RISK_KINDS),
        severity: z.enum(RISK_SEVERITY),
        summary: shortText,
        /** Which assumption drives it. Traceability, not decoration. */
        assumptionKey: z.string().trim().max(60).optional(),
        mitigation: shortText.optional(),
      }),
    )
    .max(15)
    .default([]),
  /** What this model could not establish. Printed, not hidden. */
  limitations: z.array(shortText).max(10).default([]),
  overallConfidence: confidence,
});
export type RecommendationsOutput = z.infer<typeof recommendationsOutputSchema>;
