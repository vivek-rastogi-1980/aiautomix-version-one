import { z } from "zod";

import {
  ABSENT_VALUES,
  CLAIM_KINDS,
  COMPARISON_DIMENSIONS,
  COMPETITOR_REPORT_SECTIONS,
  COMPETITOR_TYPES,
  CONFIDENCE_LEVELS,
  GAP_KINDS,
  VERIFICATION_STATUSES,
} from "@/features/competitors/types";

/**
 * Typed contracts for the seven Competitor Intelligence stages.
 *
 * Every stage has its own input and output schema. One loose schema shared
 * across all seven would mean the Response Validator could not tell a discovery
 * result from a pricing one, and a stage returning the wrong shape would
 * persist silently — the exact failure the validator exists to catch.
 *
 * Three rules run through all of them.
 *
 *   NO URLS IN MODEL OUTPUT. Competitors and sources come from provider
 *   citations (`WorkflowRunResult.sources`), never from a field the model
 *   filled in. Discovery therefore asks for *names and domains it saw in the
 *   search results*, and the server keeps only those that match a real
 *   citation. A URL a model composes is not evidence.
 *
 *   ABSENCE IS EXPRESSIBLE. Every field that might not be public accepts
 *   `UNKNOWN` / `NOT_PUBLICLY_AVAILABLE` / `INSUFFICIENT_EVIDENCE`, so the
 *   model never has to choose between inventing a value and omitting the field.
 *
 *   PROVENANCE IS REQUIRED. Claims carry `STATED` / `OBSERVED` / `INFERRED` /
 *   `RECOMMENDED`. It is a required field, so a marketing headline cannot be
 *   stored as though it were an observed fact.
 */

const sectionKey = z.enum(COMPETITOR_REPORT_SECTIONS);
const confidence = z.enum(CONFIDENCE_LEVELS);
const claimKind = z.enum(CLAIM_KINDS);
const absent = z.enum(ABSENT_VALUES);

const shortText = z.string().trim().min(1).max(2000);
const longText = z.string().trim().min(1).max(8000);

/** A value that may legitimately be missing, with the reason it is missing. */
const orAbsent = (schema: z.ZodTypeAny) => z.union([schema, absent]);

/**
 * A domain the model says it saw in the search results.
 *
 * Deliberately a hostname, not a URL: the server matches it against the
 * provider's citation hosts and discards anything that does not correspond to
 * a page actually retrieved. Accepting a full URL would invite the model to
 * compose one.
 */
const domain = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(
    /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/,
    "Must be a bare hostname, not a URL.",
  );

// ---------------------------------------------------------------------------
// 1. Planning
// ---------------------------------------------------------------------------

export const planningInputSchema = z.object({
  title: shortText,
  description: z.string().max(4000).optional(),
  category: z.string().max(200).optional(),
  geography: z.string().max(200).optional(),
  targetCustomer: z.string().max(1000).optional(),
  customerProblem: z.string().max(2000).optional(),
  businessModel: z.string().max(1000).optional(),
  knownCompetitors: z.array(z.string().max(200)).max(10).default([]),
  depth: z.string(),
  maxCompetitors: z.number().int().positive(),
});
export type PlanningInput = z.infer<typeof planningInputSchema>;

export const planningOutputSchema = z.object({
  businessCategory: shortText,
  productCategory: shortText,
  geography: shortText,
  targetCustomer: shortText,
  customerProblem: shortText,
  /** What makes something a DIRECT competitor for THIS business. */
  directCriteria: z.array(shortText).min(1).max(8),
  /** What makes something an INDIRECT alternative. */
  indirectCriteria: z.array(shortText).min(1).max(8),
  /** Queries the discovery stage should run. */
  searchStrategies: z.array(shortText).min(1).max(12),
  scopeSummary: longText,
  assumptions: z.array(shortText).max(10).default([]),
  outOfScope: z.array(shortText).max(10).default([]),
});
export type PlanningOutput = z.infer<typeof planningOutputSchema>;

// ---------------------------------------------------------------------------
// 2. Discovery  (retrieval stage)
// ---------------------------------------------------------------------------

export const discoveryInputSchema = z.object({
  businessCategory: z.string(),
  productCategory: z.string(),
  geography: z.string(),
  targetCustomer: z.string(),
  directCriteria: z.array(z.string()).min(1),
  indirectCriteria: z.array(z.string()).min(1),
  searchStrategies: z.array(z.string()).min(1),
  knownCompetitors: z.array(z.string()).max(10).default([]),
  maxCompetitors: z.number().int().positive(),
  maxSources: z.number().int().positive(),
});
export type DiscoveryInput = z.infer<typeof discoveryInputSchema>;

/**
 * Note the absence of a `website` field.
 *
 * The model reports the company name and the DOMAIN it saw in a result. The
 * server resolves that against the provider's citations and stores the real
 * URL from the citation record — so a competitor whose domain the model
 * invented simply does not survive into the database.
 */
export const discoveryOutputSchema = z.object({
  candidates: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        /** Must correspond to a host the search actually returned. */
        domain,
        /** What they appear to offer, from the search result. */
        offering: shortText,
        competitorType: z.enum(COMPETITOR_TYPES).default("UNCLASSIFIED"),
        /** Why this looked relevant. Not a score. */
        relevanceReason: shortText,
        relevance: z.number().int().min(0).max(100).optional(),
      }),
    )
    .max(50)
    .default([]),
  queriesUsed: z.array(z.string().max(300)).max(20).default([]),
  /** Set when the searches genuinely surfaced no credible competitor. */
  insufficientEvidence: z.boolean().default(false),
  notes: z.string().max(4000).optional(),
});
export type DiscoveryOutput = z.infer<typeof discoveryOutputSchema>;

// ---------------------------------------------------------------------------
// 3. Verification  (retrieval stage)
// ---------------------------------------------------------------------------

export const verificationInputSchema = z.object({
  directCriteria: z.array(z.string()).min(1),
  indirectCriteria: z.array(z.string()).min(1),
  geography: z.string(),
  targetCustomer: z.string(),
  candidates: z
    .array(z.object({ name: z.string(), domain: z.string() }))
    .min(1),
});
export type VerificationInput = z.infer<typeof verificationInputSchema>;

export const verificationOutputSchema = z.object({
  verdicts: z
    .array(
      z.object({
        domain,
        status: z.enum(VERIFICATION_STATUSES),
        competitorType: z.enum(COMPETITOR_TYPES),
        /** The specific checks that passed or failed. Shown to the user. */
        notes: shortText,
        /** Which checks were actually confirmable from a source. */
        siteReachable: z.boolean(),
        productIdentified: z.boolean(),
        marketRelevant: z.boolean(),
        confidence,
      }),
    )
    .max(50)
    .default([]),
  insufficientEvidence: z.boolean().default(false),
});
export type VerificationOutput = z.infer<typeof verificationOutputSchema>;

// ---------------------------------------------------------------------------
// 4. Profiling
// ---------------------------------------------------------------------------

const featureEntry = z.object({
  name: z.string().trim().min(1).max(200),
  /** Which comparison row this belongs to, when it maps to one. */
  dimension: z.enum(COMPARISON_DIMENSIONS).optional(),
  kind: claimKind,
});

export const profilingInputSchema = z.object({
  targetCustomer: z.string(),
  productCategory: z.string(),
  competitors: z
    .array(
      z.object({
        domain: z.string(),
        name: z.string(),
        status: z.string(),
        offering: z.string().optional(),
      }),
    )
    .min(1),
  /** Claims already extracted, so profiling reasons over stored evidence. */
  evidence: z
    .array(
      z.object({
        domain: z.string().nullable(),
        claim: z.string(),
        kind: z.string(),
        sourceUrl: z.string(),
      }),
    )
    .default([]),
});
export type ProfilingInput = z.infer<typeof profilingInputSchema>;

export const profilingOutputSchema = z.object({
  profiles: z
    .array(
      z.object({
        domain,
        description: orAbsent(shortText),
        targetCustomer: orAbsent(shortText),
        geography: orAbsent(shortText),
        productService: orAbsent(shortText),
        businessModel: orAbsent(shortText),
        valueProposition: orAbsent(shortText),
        features: z.array(featureEntry).max(25).default([]),
        integrations: z.array(z.string().max(200)).max(25).default([]),
        strengths: z.array(shortText).max(10).default([]),
        weaknesses: z.array(shortText).max(10).default([]),
        confidence,
      }),
    )
    .max(50)
    .default([]),
});
export type ProfilingOutput = z.infer<typeof profilingOutputSchema>;

// ---------------------------------------------------------------------------
// 5. Pricing & positioning  (retrieval stage)
// ---------------------------------------------------------------------------

/**
 * A pricing plan exactly as displayed.
 *
 * `displayedPrice` is a STRING on purpose. "₹2,999/clinic/month", "From $49"
 * and "Contact sales" are all real answers, and forcing them into a number
 * would mean discarding the currency, the unit and the qualifier — then
 * rendering a figure the source never printed.
 */
const pricingPlan = z.object({
  planName: z.string().trim().min(1).max(200),
  displayedPrice: orAbsent(z.string().trim().min(1).max(200)),
  billingFrequency: orAbsent(z.string().trim().min(1).max(100)),
  notes: z.string().max(500).optional(),
});

export const pricingInputSchema = z.object({
  competitors: z
    .array(z.object({ domain: z.string(), name: z.string() }))
    .min(1),
  targetCustomer: z.string(),
  maxSources: z.number().int().positive(),
});
export type PricingInput = z.infer<typeof pricingInputSchema>;

export const pricingOutputSchema = z.object({
  entries: z
    .array(
      z.object({
        domain,
        pricing: z.object({
          /** e.g. subscription, per-seat, usage-based, one-off. */
          model: orAbsent(z.string().trim().min(1).max(200)),
          plans: z.array(pricingPlan).max(12).default([]),
          freeTrial: orAbsent(z.string().trim().min(1).max(200)),
          freePlan: orAbsent(z.string().trim().min(1).max(200)),
          enterpriseCustom: orAbsent(z.string().trim().min(1).max(200)),
          /** Publisher of the page the prices were read from. */
          pricingSource: orAbsent(z.string().trim().min(1).max(300)),
        }),
        positioning: z.object({
          headline: orAbsent(shortText),
          primaryBenefit: orAbsent(shortText),
          differentiation: orAbsent(shortText),
          messagingThemes: z.array(z.string().max(200)).max(10).default([]),
          strategy: orAbsent(shortText),
          /**
           * Whether the positioning was read off the page or reasoned from it.
           * Required, so a summary of a homepage cannot be filed as the
           * company's own stated positioning.
           */
          basis: z.enum(["OBSERVED", "INFERRED"]),
        }),
        confidence,
      }),
    )
    .max(50)
    .default([]),
  insufficientEvidence: z.boolean().default(false),
});
export type PricingOutput = z.infer<typeof pricingOutputSchema>;

// ---------------------------------------------------------------------------
// 6. Competitive analysis
// ---------------------------------------------------------------------------

/**
 * One cell of the comparison matrix.
 *
 * `value` is short text or an absent marker — never a score. The spec forbids
 * arbitrary scoring, and "87% better" is precisely what a numeric cell invites.
 */
const matrixCell = z.object({
  domain,
  value: orAbsent(z.string().trim().min(1).max(300)),
  kind: claimKind,
});

export const analysisInputSchema = z.object({
  productCategory: z.string(),
  targetCustomer: z.string(),
  ownBusiness: z.string().max(4000),
  competitors: z
    .array(
      z.object({
        domain: z.string(),
        name: z.string(),
        competitorType: z.string(),
        profile: z.string().max(3000),
        pricing: z.string().max(2000),
      }),
    )
    .min(1),
  evidence: z
    .array(
      z.object({
        domain: z.string().nullable(),
        claim: z.string(),
        kind: z.string(),
        sourceUrl: z.string(),
      }),
    )
    .default([]),
});
export type AnalysisInput = z.infer<typeof analysisInputSchema>;

export const analysisOutputSchema = z.object({
  /** Only dimensions the evidence actually supports. */
  matrix: z
    .array(
      z.object({
        dimension: z.enum(COMPARISON_DIMENSIONS),
        cells: z.array(matrixCell).max(50),
        /** How the user's proposed business compares on this row. */
        ownBusiness: orAbsent(z.string().trim().min(1).max(300)),
      }),
    )
    .max(11)
    .default([]),
  gaps: z
    .array(
      z.object({
        kind: z.enum(GAP_KINDS),
        summary: shortText,
        /** The observation that supports it. Never "no one does X". */
        supportingEvidence: shortText,
        confidence,
      }),
    )
    .max(15)
    .default([]),
  landscape: z
    .array(
      z.object({
        domain,
        /** 0-100, AIAutoMix's own reading. Labelled as such wherever drawn. */
        priceLevel: z.number().int().min(0).max(100).optional(),
        featureBreadth: z.number().int().min(0).max(100).optional(),
        basis: shortText,
      }),
    )
    .max(50)
    .default([]),
  landscapeAvailable: z.boolean().default(false),
  summary: longText,
  insufficientEvidence: z.boolean().default(false),
});
export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;

// ---------------------------------------------------------------------------
// 7. Strategic recommendations
// ---------------------------------------------------------------------------

export const recommendationsInputSchema = z.object({
  productCategory: z.string(),
  targetCustomer: z.string(),
  ownBusiness: z.string().max(4000),
  gaps: z
    .array(z.object({ kind: z.string(), summary: z.string() }))
    .default([]),
  competitorSummary: z.string().max(6000),
  competitorCount: z.number().int().nonnegative(),
  verifiedCount: z.number().int().nonnegative(),
});
export type RecommendationsInput = z.infer<typeof recommendationsInputSchema>;

const recommendation = z.object({
  area: z.enum([
    "positioning",
    "differentiation",
    "target_segment",
    "pricing",
    "product",
    "features",
    "go_to_market",
  ]),
  recommendation: shortText,
  rationale: shortText,
  confidence,
});

export const recommendationsOutputSchema = z.object({
  executiveSummary: longText,
  recommendations: z.array(recommendation).min(1).max(20),
  differentiationOpportunities: z.array(shortText).max(10).default([]),
  /** What this research could not establish. Printed, not hidden. */
  limitations: z.array(shortText).max(10).default([]),
  overallConfidence: confidence,
});
export type RecommendationsOutput = z.infer<typeof recommendationsOutputSchema>;

/** Section keys the recommendations stage is responsible for writing. */
export const RECOMMENDATION_SECTIONS = [
  "executive_summary",
  "differentiation_opportunities",
  "strategic_recommendations",
  "sources_limitations",
] as const;

export { sectionKey as competitorSectionKeySchema };
