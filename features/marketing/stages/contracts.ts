import { z } from "zod";

import {
  ACTION_PRIORITIES,
  CAMPAIGN_OBJECTIVES,
  CHANNELS,
  CLAIM_KINDS,
  CONFIDENCE_LEVELS,
  CONTENT_FORMATS,
  COST_BANDS,
  EFFORT_LEVELS,
  FUNNEL_BANDS,
  FUNNEL_STAGE_KEYS,
  GTM_MOTIONS,
  GTM_RISK_KINDS,
  KPI_KEYS,
  MAX_ACTIONS_PER_PERIOD,
  OWNER_ROLES,
  PLAN_PERIODS,
  RISK_SEVERITY,
} from "@/features/marketing/types";
import { SCORING_DIMENSION_KEYS } from "@/features/marketing/scoring";

/**
 * Typed contracts for the AI stages of Marketing Intelligence.
 *
 * ---------------------------------------------------------------------------
 * What is NOT in this file
 * ---------------------------------------------------------------------------
 * There is no schema for a channel SCORE, a budget AMOUNT, a required lead
 * VOLUME or an allowable CAC — because no model is ever asked for one. Channel
 * scores come from `scoring.ts`; every money and volume figure comes from
 * `calc/acquisition.ts`. `acquisition_economics` has no contract here at all,
 * because it has no prompt.
 *
 * A model rates, proposes and explains. It does not compute, and there is
 * nowhere in these schemas for it to return a computed value even if it tried.
 *
 * ---------------------------------------------------------------------------
 * The claim envelope
 * ---------------------------------------------------------------------------
 * Almost every statement carries a `kind` from `CLAIM_KINDS`. That field is the
 * feature. A model that wants to say "dentists prefer WhatsApp" must choose
 * whether that is a FACT (and then cite it), EVIDENCE from the workspace's own
 * research, an INFERENCE, or an ASSUMPTION — and the mapper enforces the
 * consequences of that choice server-side.
 */

const confidence = z.enum(CONFIDENCE_LEVELS);
const claimKind = z.enum(CLAIM_KINDS);
const shortText = z.string().trim().min(1).max(2000);
const longText = z.string().trim().min(1).max(8000);
const tinyText = z.string().trim().min(1).max(300);

/** A rating on the published rubric. Integers only — a 3.5 is not a rating. */
const rating = z
  .number()
  .int("Ratings are whole numbers from 0 to 5.")
  .min(0)
  .max(5);

/** Basis points. 10 000 = 100%. */
const bps = (max = 10_000) =>
  z
    .number()
    .int("Rates must be whole basis points (1 bp = 0.01%).")
    .min(0)
    .max(max);

const count = z.number().int().min(0).max(100_000_000);

/**
 * A bare hostname, never a URL.
 *
 * Same control as competitor discovery and funding analysis: the model names a
 * host, and the mapper checks it against hosts the retrieval provider actually
 * cited. A URL a model writes is not evidence.
 */
const bareHost = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(
    /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/,
    "Must be a bare hostname, not a URL.",
  );

// ---------------------------------------------------------------------------
// The claim envelope
// ---------------------------------------------------------------------------

/**
 * One statement, with its epistemic status attached.
 *
 * `sourceDomain` is only meaningful for FACT. The mapper DROPS a FACT whose
 * domain was not cited by the provider and re-grades it, rather than storing an
 * uncited fact with a caveat — a caveat is not a citation and readers do not
 * read them.
 */
export const claimSchema = z.object({
  statement: shortText,
  kind: claimKind,
  /** Required in practice for FACT; enforced by the mapper, not by Zod. */
  sourceDomain: bareHost.optional(),
  rationale: shortText.optional(),
  confidence,
});

export type ClaimInput = z.infer<typeof claimSchema>;

// ---------------------------------------------------------------------------
// 1. GTM planning  (context)
// ---------------------------------------------------------------------------

export const gtmPlanningInputSchema = z.object({
  title: z.string(),
  description: z.string().max(4000).optional(),
  industry: z.string().max(200).optional(),
  geography: z.string().max(200).optional(),
  currency: z.string().length(3),
  /** Compact summaries of upstream work, never the full records. §42. */
  inherited: z.object({
    businessIdea: z.string().max(3000).optional(),
    businessPlan: z.string().max(3000).optional(),
    marketResearch: z.string().max(4000).optional(),
    competitors: z.string().max(4000).optional(),
    financials: z.string().max(3000).optional(),
  }),
});

export type GtmPlanningInput = z.infer<typeof gtmPlanningInputSchema>;

export const gtmPlanningOutputSchema = z.object({
  /** What is actually being sold, in one sentence a stranger would understand. */
  offering: shortText,
  /** The motion decides the funnel, so it is a closed choice, not free text. */
  motion: z.enum(GTM_MOTIONS),
  motionRationale: shortText,
  targetGeography: shortText,
  businessObjective: shortText,
  /** A count the business is aiming at. A TARGET, and labelled as one. */
  targetNewCustomers: count,
  targetHorizonMonths: z.number().int().min(1).max(24),
  context: z.array(claimSchema).max(20).default([]),
  openQuestions: z.array(shortText).max(10).default([]),
});

export type GtmPlanningOutput = z.infer<typeof gtmPlanningOutputSchema>;

// ---------------------------------------------------------------------------
// 2. ICP & personas
// ---------------------------------------------------------------------------

export const icpInputSchema = z.object({
  title: z.string(),
  offering: z.string(),
  motion: z.enum(GTM_MOTIONS),
  geography: z.string().max(200).optional(),
  industry: z.string().max(200).optional(),
  researchFindings: z.string().max(6000).optional(),
  competitorAudiences: z.string().max(4000).optional(),
});

export type IcpInput = z.infer<typeof icpInputSchema>;

/**
 * A buyer persona.
 *
 * Every list below is a list of CLAIMS, not of strings — because "dentists
 * worry about no-shows" is either something the research showed or something a
 * model supposed, and a persona that cannot tell you which is a persona you
 * cannot act on.
 */
export const personaSchema = z.object({
  name: tinyText,
  /** The job title or role that decides. */
  role: tinyText,
  /** For B2C personas this is the life situation instead. */
  segment: tinyText,
  companyType: tinyText.optional(),
  companySize: tinyText.optional(),
  geography: tinyText.optional(),
  painPoints: z.array(claimSchema).min(1).max(8),
  goals: z.array(claimSchema).min(1).max(8),
  buyingTriggers: z.array(claimSchema).max(8).default([]),
  objections: z.array(claimSchema).max(8).default([]),
  decisionCriteria: z.array(claimSchema).max(8).default([]),
  urgency: shortText.optional(),
  budgetSignals: shortText.optional(),
  /** True when this persona signs. False when they only influence. */
  isDecisionMaker: z.boolean(),
  confidence,
});

export const icpOutputSchema = z.object({
  icp: z.object({
    summary: longText,
    industries: z.array(tinyText).max(10).default([]),
    businessTypes: z.array(tinyText).max(10).default([]),
    geographies: z.array(tinyText).max(10).default([]),
    sizeBand: tinyText.optional(),
    qualifyingSignals: z.array(claimSchema).max(10).default([]),
    disqualifyingSignals: z.array(claimSchema).max(10).default([]),
  }),
  /** Two or three. A "persona" list of nine is a mailing list. */
  personas: z.array(personaSchema).min(1).max(3),
  notes: z.string().max(4000).optional(),
});

export type IcpOutput = z.infer<typeof icpOutputSchema>;

// ---------------------------------------------------------------------------
// 3. Positioning & messaging
// ---------------------------------------------------------------------------

export const positioningInputSchema = z.object({
  title: z.string(),
  offering: z.string(),
  motion: z.enum(GTM_MOTIONS),
  icpSummary: z.string().max(4000),
  painPoints: z.array(z.string()).max(20).default([]),
  /** What the competitor phase actually VERIFIED, not what competitors claim. */
  competitorEvidence: z.string().max(6000).optional(),
  productCapabilities: z.string().max(4000).optional(),
});

export type PositioningInput = z.infer<typeof positioningInputSchema>;

/**
 * A differentiator.
 *
 * `uniquenessEvidence` is required whenever `claimedUnique` is true, and the
 * mapper downgrades the claim when the evidence does not check out. §7: do not
 * claim a differentiator is unique unless evidence supports that claim — the
 * cheapest way to lose a deal is to tell a buyer you are the only one who does
 * something they saw a competitor do that morning.
 */
export const differentiatorSchema = z.object({
  statement: shortText,
  claimedUnique: z.boolean(),
  uniquenessEvidence: shortText.optional(),
  /** Which competitors were checked before claiming this. */
  competitorsChecked: z.array(tinyText).max(10).default([]),
  kind: claimKind,
  confidence,
});

export const positioningOutputSchema = z.object({
  positioningStatement: longText,
  valueProposition: shortText,
  primaryBenefit: shortText,
  differentiators: z.array(differentiatorSchema).min(1).max(6),
  messagingPillars: z
    .array(z.object({ pillar: tinyText, explanation: shortText }))
    .min(1)
    .max(5),
  elevatorPitch: shortText,
  shortDescription: shortText,
  longDescription: longText,
  messaging: z.object({
    websiteHero: z.object({
      headline: tinyText,
      subheadline: shortText,
      callToAction: tinyText,
    }),
    linkedin: shortText,
    email: z.object({ subject: tinyText, body: longText }),
    salesOutreach: z.object({ opener: shortText, followUp: shortText }),
    adConcepts: z
      .array(z.object({ concept: tinyText, angle: shortText }))
      .max(5)
      .default([]),
  }),
  /** Claims the model deliberately did not make, and why. */
  notClaimed: z.array(shortText).max(10).default([]),
});

export type PositioningOutput = z.infer<typeof positioningOutputSchema>;

// ---------------------------------------------------------------------------
// 4. Channel strategy  (retrieval)
// ---------------------------------------------------------------------------

export const channelInputSchema = z.object({
  title: z.string(),
  offering: z.string(),
  motion: z.enum(GTM_MOTIONS),
  geography: z.string().max(200).optional(),
  icpSummary: z.string().max(4000),
  personaRoles: z.array(z.string()).max(10).default([]),
  /** Which channels competitors were VERIFIED to use. Empty is normal. */
  competitorChannels: z.array(z.string()).max(20).default([]),
});

export type ChannelInput = z.infer<typeof channelInputSchema>;

/**
 * One channel assessment.
 *
 * The ratings are the model's contribution and the ONLY numeric thing it
 * returns. There is deliberately no `score` and no `priority` field: those come
 * from `scoring.ts`, which the model cannot reach. A model that could return
 * its own priority would make the published rubric decorative.
 */
export const channelAssessmentSchema = z.object({
  channel: z.enum(CHANNELS),
  rationale: shortText,
  targetAudience: shortText,
  acquisitionMechanism: shortText,
  effort: z.enum(EFFORT_LEVELS),
  costBand: z.enum(COST_BANDS),
  strengths: z.array(tinyText).min(1).max(6),
  weaknesses: z.array(tinyText).min(1).max(6),
  prerequisites: z.array(tinyText).max(6).default([]),
  /** One integer 0–5 per published dimension. */
  ratings: z.object(
    Object.fromEntries(
      SCORING_DIMENSION_KEYS.map((key) => [key, rating]),
    ) as Record<(typeof SCORING_DIMENSION_KEYS)[number], typeof rating>,
  ),
  /** Cited host backing the evidence rating, when there is one. */
  evidenceDomain: bareHost.optional(),
  evidenceNote: shortText.optional(),
  confidence,
});

export const channelOutputSchema = z.object({
  /** Assess every channel considered, including the rejected ones. */
  assessments: z.array(channelAssessmentSchema).min(1).max(13),
  /** Channels deliberately not assessed at all, and why. */
  notConsidered: z
    .array(z.object({ channel: z.enum(CHANNELS), reason: tinyText }))
    .max(13)
    .default([]),
  queriesUsed: z.array(z.string().max(300)).max(20).default([]),
  insufficientEvidence: z.boolean().default(false),
  notes: z.string().max(4000).optional(),
});

export type ChannelOutput = z.infer<typeof channelOutputSchema>;

// ---------------------------------------------------------------------------
// 5. Content & campaign strategy
// ---------------------------------------------------------------------------

export const contentInputSchema = z.object({
  title: z.string(),
  offering: z.string(),
  motion: z.enum(GTM_MOTIONS),
  icpSummary: z.string().max(4000),
  messagingPillars: z.array(z.string()).max(10).default([]),
  /** Only the channels the rubric actually recommended. */
  activeChannels: z.array(z.string()).max(8).default([]),
});

export type ContentInput = z.infer<typeof contentInputSchema>;

export const contentPillarSchema = z.object({
  pillar: tinyText,
  audience: shortText,
  goal: shortText,
  formats: z.array(z.enum(CONTENT_FORMATS)).min(1).max(5),
  distributionChannels: z.array(z.enum(CHANNELS)).min(1).max(5),
  /** Free text because "twice a month" is clearer than an enum here. */
  frequency: tinyText,
  callToAction: tinyText,
  funnelBand: z.enum(FUNNEL_BANDS),
});

export const campaignSchema = z.object({
  name: tinyText,
  objective: z.enum(CAMPAIGN_OBJECTIVES),
  audience: shortText,
  message: shortText,
  offer: shortText,
  channels: z.array(z.enum(CHANNELS)).min(1).max(5),
  callToAction: tinyText,
  funnelBand: z.enum(FUNNEL_BANDS),
  /** How you will know it worked. A KPI from the closed list, not a vibe. */
  measurementKpi: z.enum(KPI_KEYS),
  confidence,
});

export const contentOutputSchema = z.object({
  pillars: z.array(contentPillarSchema).min(1).max(5),
  /** An initial plan, not a content farm. §11 caps this deliberately. */
  initialContentPlan: z
    .array(
      z.object({
        title: tinyText,
        format: z.enum(CONTENT_FORMATS),
        pillar: tinyText,
        funnelBand: z.enum(FUNNEL_BANDS),
        channel: z.enum(CHANNELS),
      }),
    )
    .max(12)
    .default([]),
  campaigns: z.array(campaignSchema).min(1).max(6),
  notes: z.string().max(4000).optional(),
});

export type ContentOutput = z.infer<typeof contentOutputSchema>;

// ---------------------------------------------------------------------------
// 6. Sales funnel
// ---------------------------------------------------------------------------

export const funnelInputSchema = z.object({
  title: z.string(),
  offering: z.string(),
  motion: z.enum(GTM_MOTIONS),
  /** The stage keys for this motion, supplied so the model cannot invent one. */
  funnelStages: z.array(z.enum(FUNNEL_STAGE_KEYS)).min(2).max(10),
  icpSummary: z.string().max(4000),
  objections: z.array(z.string()).max(10).default([]),
});

export type FunnelInput = z.infer<typeof funnelInputSchema>;

/**
 * One conversion step.
 *
 * `rateBps` is an ASSUMPTION unless a source says otherwise, and the schema
 * makes the model state which. Nothing downstream multiplies these — the
 * calculation engine does, from the stored values.
 */
export const funnelStepSchema = z.object({
  from: z.enum(FUNNEL_STAGE_KEYS),
  to: z.enum(FUNNEL_STAGE_KEYS),
  rateBps: bps(),
  kind: claimKind,
  rationale: shortText,
  confidence,
});

export const funnelOutputSchema = z.object({
  steps: z.array(funnelStepSchema).min(1).max(9),
  qualificationCriteria: z
    .array(
      z.object({
        criterion: tinyText,
        whyItMatters: shortText,
        /** How you would actually observe it in a conversation. */
        howToAssess: shortText,
        disqualifying: z.boolean(),
      }),
    )
    .max(8)
    .default([]),
  salesMessaging: z.object({
    coldOutreach: shortText,
    linkedinOutreach: shortText,
    emailIntroduction: z.object({ subject: tinyText, body: longText }),
    followUp: shortText,
    discoveryQuestions: z.array(tinyText).min(1).max(10),
    objectionHandling: z
      .array(z.object({ objection: tinyText, response: shortText }))
      .max(8)
      .default([]),
  }),
  notes: z.string().max(4000).optional(),
});

export type FunnelOutput = z.infer<typeof funnelOutputSchema>;

// ---------------------------------------------------------------------------
// 7. Acquisition economics — deliberately absent
// ---------------------------------------------------------------------------
//
// There is no schema here, and no prompt in `prompts/`. `acquisition_economics`
// runs `calc/acquisition.ts` over stored assumptions. Its absence from this
// file is a structural guarantee that no model produces a budget, and the test
// suite asserts the absence.

// ---------------------------------------------------------------------------
// 8. 90-day plan
// ---------------------------------------------------------------------------

export const planInputSchema = z.object({
  title: z.string(),
  offering: z.string(),
  motion: z.enum(GTM_MOTIONS),
  primaryChannels: z.array(z.string()).max(4).default([]),
  secondaryChannels: z.array(z.string()).max(6).default([]),
  campaignNames: z.array(z.string()).max(8).default([]),
  /**
   * Everything below was CALCULATED and is passed in as read-only context. The
   * model sequences work around these figures; it does not produce them, and
   * the output schema has nowhere to return a different one.
   */
  computed: z.object({
    currency: z.string().length(3),
    targetNewCustomers: count,
    horizonMonths: z.number().int(),
    allowableCacMinor: z.number().int(),
    budgetMinor: z.number().int(),
    requiredTopOfFunnel: z.number().int().nullable(),
    oneCustomerPer: z.number().int().nullable(),
  }),
  applicableKpis: z.array(z.enum(KPI_KEYS)).max(11).default([]),
});

export type PlanInput = z.infer<typeof planInputSchema>;

export const planActionSchema = z.object({
  period: z.enum(PLAN_PERIODS),
  objective: tinyText,
  action: shortText,
  channel: z.enum(CHANNELS).optional(),
  owner: z.enum(OWNER_ROLES),
  kpi: z.enum(KPI_KEYS),
  expectedOutput: shortText,
  /** Free text naming another action or an external prerequisite. */
  dependency: tinyText.optional(),
  priority: z.enum(ACTION_PRIORITIES),
});

export const planOutputSchema = z.object({
  executiveSummary: longText,
  /** Bounded so the plan stays executable. §19. */
  actions: z
    .array(planActionSchema)
    .min(3)
    .max(MAX_ACTIONS_PER_PERIOD * PLAN_PERIODS.length),
  /** §20 — the ordered "Start Here" list. */
  firstActions: z.array(shortText).min(3).max(10),
  kpiTargets: z
    .array(
      z.object({
        kpi: z.enum(KPI_KEYS),
        /**
         * Free text, and deliberately so: "40 qualified leads/month" carries
         * its own unit. It is labelled a TARGET everywhere it is displayed.
         */
        target: tinyText,
        period: z.enum(PLAN_PERIODS),
      }),
    )
    .max(12)
    .default([]),
  risks: z
    .array(
      z.object({
        kind: z.enum(GTM_RISK_KINDS),
        severity: z.enum(RISK_SEVERITY),
        summary: shortText,
        /** Which assumption drives it. Traceability, not decoration. */
        assumptionRef: tinyText.optional(),
        mitigation: shortText.optional(),
      }),
    )
    .max(12)
    .default([]),
  /** What this plan could not establish. Printed, not hidden. */
  limitations: z.array(shortText).max(10).default([]),
  overallConfidence: confidence,
});

export type PlanOutput = z.infer<typeof planOutputSchema>;
