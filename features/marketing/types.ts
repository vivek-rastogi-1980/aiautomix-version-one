/**
 * Marketing & Go-To-Market Intelligence — the vocabulary.
 *
 * A plain module, no `server-only`: the stage engine, the report composer, the
 * deterministic scorer and the browser all need these words to mean the same
 * thing, and a value that exists in three spellings is a value nobody can
 * filter on.
 *
 * ---------------------------------------------------------------------------
 * The distinction this whole phase turns on
 * ---------------------------------------------------------------------------
 * A go-to-market plan is mostly claims about people who are not in the room.
 * The failure mode is not that a model writes something wrong — it is that it
 * writes something unfalsifiable in the register of a fact. So every statement
 * this feature stores carries a `CLAIM_KIND`, and the report prints it:
 *
 *   FACT            verifiable in a cited source we retrieved
 *   EVIDENCE        observed in research/competitor/financial data we hold
 *   INFERENCE       AIAutoMix reasoning across that evidence
 *   ASSUMPTION      no evidence at all — stated so it can be tested
 *   RECOMMENDATION  advice; the only thing here a model actually authored
 *   TARGET          a goal chosen by the business, never a prediction
 *
 * "60% of dental clinics book by phone" and "we assume 60% book by phone" are
 * different sentences, and a founder who cannot tell them apart will spend
 * money on the second believing it was the first.
 */

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

export const GTM_STAGES = [
  "gtm_planning",
  "icp_persona",
  "positioning_messaging",
  "channel_strategy",
  "content_campaign_strategy",
  "sales_funnel",
  "acquisition_economics",
  "gtm_90_day_plan",
] as const;

export type GtmStage = (typeof GTM_STAGES)[number];

/**
 * What kind of work each stage does.
 *
 * `COMPUTE` is the load-bearing one, exactly as in Phase 8: a compute stage
 * calls no model, spends no credits and produces its numbers from a
 * deterministic function. `acquisition_economics` is compute because §16 is
 * explicit — the arithmetic of allowable CAC and budget belongs to a
 * calculation engine, not to a language model asked politely to multiply.
 */
export const STAGE_KIND: Record<
  GtmStage,
  "CONTEXT" | "ANALYSIS" | "RETRIEVAL" | "COMPUTE" | "NARRATIVE"
> = {
  gtm_planning: "CONTEXT",
  icp_persona: "ANALYSIS",
  positioning_messaging: "ANALYSIS",
  channel_strategy: "RETRIEVAL",
  content_campaign_strategy: "NARRATIVE",
  sales_funnel: "ANALYSIS",
  acquisition_economics: "COMPUTE",
  gtm_90_day_plan: "NARRATIVE",
};

/** Stages that reach the web. Exactly one, so the bill cannot surprise anyone. */
export const GTM_RETRIEVAL_STAGES: readonly GtmStage[] = ["channel_strategy"];

/** Stages that run a deterministic function instead of a model. */
export const GTM_COMPUTE_STAGES: readonly GtmStage[] = [
  "acquisition_economics",
];

export function isComputeStage(stage: GtmStage): boolean {
  return STAGE_KIND[stage] === "COMPUTE";
}

export const GTM_STAGE_LABELS: Record<GtmStage, string> = {
  gtm_planning: "GTM planning",
  icp_persona: "ICP & personas",
  positioning_messaging: "Positioning & messaging",
  channel_strategy: "Channel strategy",
  content_campaign_strategy: "Content & campaigns",
  sales_funnel: "Sales funnel",
  acquisition_economics: "Acquisition economics",
  gtm_90_day_plan: "90-day plan",
};

export const GTM_STAGE_DESCRIPTIONS: Record<GtmStage, string> = {
  gtm_planning:
    "Assembles the go-to-market context from your idea, plan, research, competitors and financial model.",
  icp_persona:
    "Defines who to sell to, and separates what the evidence shows from what is being assumed.",
  positioning_messaging:
    "States what you claim, checks each differentiator against competitor evidence, and writes the messaging.",
  channel_strategy:
    "Researches which channels reach this audience, then scores and ranks them by a published rubric.",
  content_campaign_strategy:
    "Turns positioning into content pillars and campaigns tied to funnel stages.",
  sales_funnel:
    "Builds the funnel this business model actually has, with qualification criteria and sales messaging.",
  acquisition_economics:
    "Calculates allowable CAC, conversion requirements and budget scenarios. No model is involved.",
  gtm_90_day_plan:
    "Sequences the first ninety days into prioritised actions with owners and KPIs.",
};

export function nextGtmStage(stage: GtmStage): GtmStage | null {
  const index = GTM_STAGES.indexOf(stage);
  return index === -1 || index === GTM_STAGES.length - 1
    ? null
    : GTM_STAGES[index + 1];
}

export function gtmStageIndex(stage: GtmStage): number {
  return GTM_STAGES.indexOf(stage);
}

export function isGtmStage(value: unknown): value is GtmStage {
  return (
    typeof value === "string" &&
    (GTM_STAGES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Claim kinds — the epistemic label on every stored statement
// ---------------------------------------------------------------------------

export const CLAIM_KINDS = [
  "FACT",
  "EVIDENCE",
  "INFERENCE",
  "ASSUMPTION",
  "RECOMMENDATION",
  "TARGET",
] as const;

export type ClaimKind = (typeof CLAIM_KINDS)[number];

export const CLAIM_KIND_LABELS: Record<ClaimKind, string> = {
  FACT: "Fact",
  EVIDENCE: "Evidence",
  INFERENCE: "Inference",
  ASSUMPTION: "Assumption",
  RECOMMENDATION: "Recommendation",
  TARGET: "Target",
};

export const CLAIM_KIND_MEANING: Record<ClaimKind, string> = {
  FACT: "Verifiable in a source we retrieved and cited.",
  EVIDENCE:
    "Observed in your own market research, competitor analysis or financial model.",
  INFERENCE:
    "AIAutoMix reasoning from the evidence above. Not itself observed.",
  ASSUMPTION:
    "No evidence supports this. It is written down so you can test it cheaply.",
  RECOMMENDATION: "Advice from AIAutoMix. Judgement, not measurement.",
  TARGET: "A goal you are choosing to aim at. Not a prediction of the outcome.",
};

/** Kinds that must carry a source URL to be storable. */
export const CLAIM_KINDS_REQUIRING_SOURCE: readonly ClaimKind[] = ["FACT"];

export function requiresSource(kind: ClaimKind): boolean {
  return CLAIM_KINDS_REQUIRING_SOURCE.includes(kind);
}

/**
 * Kinds a language model is allowed to originate.
 *
 * A model may never mint a FACT: a fact requires a citation, and the citation
 * has to come from the retrieval provider, not from the model's memory of the
 * internet.
 */
export function modelMayOriginate(kind: ClaimKind): boolean {
  return kind !== "FACT";
}

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

// ---------------------------------------------------------------------------
// Absent values — saying "we don't know" out loud
// ---------------------------------------------------------------------------

export const ABSENT_VALUES = [
  "UNKNOWN",
  "NOT_PUBLICLY_AVAILABLE",
  "INSUFFICIENT_EVIDENCE",
] as const;

export type AbsentValue = (typeof ABSENT_VALUES)[number];

export const ABSENT_LABELS: Record<AbsentValue, string> = {
  UNKNOWN: "Unknown",
  NOT_PUBLICLY_AVAILABLE: "Not publicly available",
  INSUFFICIENT_EVIDENCE: "Insufficient evidence",
};

export function isAbsentValue(value: unknown): value is AbsentValue {
  return (
    typeof value === "string" &&
    (ABSENT_VALUES as readonly string[]).includes(value)
  );
}

export function displayValue(value: string | null | undefined): string {
  if (!value) return ABSENT_LABELS.UNKNOWN;
  return isAbsentValue(value) ? ABSENT_LABELS[value] : value;
}

// ---------------------------------------------------------------------------
// GTM motion — what shape of selling this business actually does
// ---------------------------------------------------------------------------

/**
 * The motion decides the funnel, and the funnel decides almost everything
 * downstream. §13 is explicit that a restaurant must not be handed a SaaS
 * funnel, so the funnel is looked up from the motion rather than written by a
 * model that has seen ten thousand SaaS funnels and few restaurants.
 */
export const GTM_MOTIONS = [
  "SELF_SERVE",
  "INBOUND_SALES",
  "OUTBOUND_SALES",
  "FIELD_LOCAL",
  "MARKETPLACE_LISTING",
  "RETAIL_ECOMMERCE",
] as const;

export type GtmMotion = (typeof GTM_MOTIONS)[number];

export const GTM_MOTION_LABELS: Record<GtmMotion, string> = {
  SELF_SERVE: "Self-serve signup",
  INBOUND_SALES: "Inbound sales",
  OUTBOUND_SALES: "Outbound sales",
  FIELD_LOCAL: "Local / field sales",
  MARKETPLACE_LISTING: "Marketplace listing",
  RETAIL_ECOMMERCE: "Retail / e-commerce",
};

export const GTM_MOTION_DESCRIPTIONS: Record<GtmMotion, string> = {
  SELF_SERVE:
    "The customer signs up and pays without talking to anyone. Product and pricing do the selling.",
  INBOUND_SALES:
    "Prospects arrive through content or search, then a person closes them.",
  OUTBOUND_SALES:
    "You identify accounts and contact them first. Nothing arrives on its own.",
  FIELD_LOCAL:
    "Customers are geographically local and often decide in person or by phone.",
  MARKETPLACE_LISTING:
    "Demand comes through a platform you do not own, on that platform's terms.",
  RETAIL_ECOMMERCE:
    "Customers browse and buy a product directly, usually in one session.",
};

export function isGtmMotion(value: unknown): value is GtmMotion {
  return (
    typeof value === "string" &&
    (GTM_MOTIONS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------------

export const FUNNEL_STAGE_KEYS = [
  "awareness",
  "visitor",
  "lead",
  "enquiry",
  "qualified_lead",
  "demo",
  "proposal",
  "booking",
  "visit",
  "signup",
  "activation",
  "product_view",
  "add_to_cart",
  "checkout",
  "first_transaction",
  "customer",
  "repeat_customer",
  "referral",
] as const;

export type FunnelStageKey = (typeof FUNNEL_STAGE_KEYS)[number];

export const FUNNEL_STAGE_LABELS: Record<FunnelStageKey, string> = {
  awareness: "Awareness",
  visitor: "Visitor",
  lead: "Lead",
  enquiry: "Enquiry",
  qualified_lead: "Qualified lead",
  demo: "Demo / consultation",
  proposal: "Proposal",
  booking: "Booking",
  visit: "Visit",
  signup: "Signup",
  activation: "Activation",
  product_view: "Product view",
  add_to_cart: "Add to cart",
  checkout: "Checkout",
  first_transaction: "First transaction",
  customer: "Customer",
  repeat_customer: "Repeat customer",
  referral: "Referral",
};

/**
 * The funnel each motion actually has.
 *
 * Fixed in code, not asked of a model. A dental clinic's funnel ends at a
 * booked appointment that the patient attends; calling that step "Closed Won"
 * would be a category error the whole plan would then inherit.
 */
export const FUNNEL_TEMPLATES: Record<GtmMotion, readonly FunnelStageKey[]> = {
  SELF_SERVE: [
    "awareness",
    "visitor",
    "signup",
    "activation",
    "customer",
    "repeat_customer",
  ],
  INBOUND_SALES: [
    "awareness",
    "visitor",
    "lead",
    "qualified_lead",
    "demo",
    "proposal",
    "customer",
  ],
  OUTBOUND_SALES: [
    "awareness",
    "lead",
    "qualified_lead",
    "demo",
    "proposal",
    "customer",
  ],
  FIELD_LOCAL: [
    "awareness",
    "enquiry",
    "qualified_lead",
    "booking",
    "visit",
    "repeat_customer",
  ],
  MARKETPLACE_LISTING: [
    "awareness",
    "visitor",
    "signup",
    "first_transaction",
    "repeat_customer",
  ],
  RETAIL_ECOMMERCE: [
    "awareness",
    "visitor",
    "product_view",
    "add_to_cart",
    "checkout",
    "customer",
    "repeat_customer",
  ],
};

export function funnelFor(motion: GtmMotion): readonly FunnelStageKey[] {
  return FUNNEL_TEMPLATES[motion];
}

export function isFunnelStageKey(value: unknown): value is FunnelStageKey {
  return (
    typeof value === "string" &&
    (FUNNEL_STAGE_KEYS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

/**
 * The closed channel list.
 *
 * Exactly the channels §9 names. A closed list is what makes "we did not
 * recommend LinkedIn" a decision the report can defend, rather than an
 * omission nobody noticed.
 */
export const CHANNELS = [
  "seo",
  "google_search",
  "linkedin",
  "facebook",
  "instagram",
  "youtube",
  "email",
  "outbound_sales",
  "partnerships",
  "referrals",
  "communities",
  "marketplaces",
  "local_offline",
] as const;

export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  seo: "SEO",
  google_search: "Google Search ads",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  email: "Email",
  outbound_sales: "Outbound sales",
  partnerships: "Partnerships",
  referrals: "Referrals",
  communities: "Communities",
  marketplaces: "Marketplaces",
  local_offline: "Local / offline",
};

export function isChannel(value: unknown): value is Channel {
  return (
    typeof value === "string" && (CHANNELS as readonly string[]).includes(value)
  );
}

/** How much work a channel takes to run, as a band rather than a fake number. */
export const EFFORT_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

/**
 * Expected spend as a BAND, deliberately not a currency amount.
 *
 * §21 forbids fabricating CPC and CPM. A model does not know this quarter's
 * LinkedIn CPM for dental clinics in Pune, and a plausible-looking number would
 * be worse than an honest band because it would get budgeted against.
 */
export const COST_BANDS = ["LOW", "MEDIUM", "HIGH", "VARIABLE"] as const;
export type CostBand = (typeof COST_BANDS)[number];

export const COST_BAND_LABELS: Record<CostBand, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  VARIABLE: "Highly variable",
};

/** Where a recommended channel lands after deterministic scoring. */
export const CHANNEL_PRIORITIES = [
  "PRIMARY",
  "SECONDARY",
  "EXPERIMENTAL",
  "NOT_RECOMMENDED",
] as const;

export type ChannelPriority = (typeof CHANNEL_PRIORITIES)[number];

export const CHANNEL_PRIORITY_LABELS: Record<ChannelPriority, string> = {
  PRIMARY: "Primary",
  SECONDARY: "Secondary",
  EXPERIMENTAL: "Experimental",
  NOT_RECOMMENDED: "Not recommended",
};

export function isChannelPriority(value: unknown): value is ChannelPriority {
  return (
    typeof value === "string" &&
    (CHANNEL_PRIORITIES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Content and campaigns
// ---------------------------------------------------------------------------

export const CONTENT_FORMATS = [
  "blog",
  "linkedin_post",
  "short_video",
  "long_video",
  "carousel",
  "email",
  "case_study",
  "webinar",
  "lead_magnet",
] as const;

export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = {
  blog: "Blog post",
  linkedin_post: "LinkedIn post",
  short_video: "Short video",
  long_video: "Long-form video",
  carousel: "Carousel",
  email: "Email",
  case_study: "Case study",
  webinar: "Webinar",
  lead_magnet: "Lead magnet",
};

export function isContentFormat(value: unknown): value is ContentFormat {
  return (
    typeof value === "string" &&
    (CONTENT_FORMATS as readonly string[]).includes(value)
  );
}

/** Where a piece of content or a campaign sits in the funnel. */
export const FUNNEL_BANDS = ["TOFU", "MOFU", "BOFU"] as const;
export type FunnelBand = (typeof FUNNEL_BANDS)[number];

export const FUNNEL_BAND_LABELS: Record<FunnelBand, string> = {
  TOFU: "Top of funnel",
  MOFU: "Middle of funnel",
  BOFU: "Bottom of funnel",
};

export const CAMPAIGN_OBJECTIVES = [
  "AWARENESS",
  "LEAD_GENERATION",
  "DEMO_CONSULTATION",
  "CONVERSION",
  "RETARGETING",
  "RETENTION_REFERRAL",
] as const;

export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];

export const CAMPAIGN_OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  AWARENESS: "Awareness",
  LEAD_GENERATION: "Lead generation",
  DEMO_CONSULTATION: "Demo / consultation",
  CONVERSION: "Conversion",
  RETARGETING: "Retargeting",
  RETENTION_REFERRAL: "Retention & referral",
};

export function isCampaignObjective(
  value: unknown,
): value is CampaignObjective {
  return (
    typeof value === "string" &&
    (CAMPAIGN_OBJECTIVES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export const KPI_KEYS = [
  "traffic",
  "leads",
  "mqls",
  "sqls",
  "demos",
  "conversion_rate",
  "cac",
  "revenue",
  "roas",
  "retention",
  "referrals",
] as const;

export type KpiKey = (typeof KPI_KEYS)[number];

export const KPI_LABELS: Record<KpiKey, string> = {
  traffic: "Traffic",
  leads: "Leads",
  mqls: "Marketing-qualified leads",
  sqls: "Sales-qualified leads",
  demos: "Demos / consultations",
  conversion_rate: "Conversion rate",
  cac: "Customer acquisition cost",
  revenue: "Revenue",
  roas: "Return on ad spend",
  retention: "Retention",
  referrals: "Referrals",
};

/**
 * Which KPIs actually mean something for a motion.
 *
 * §18: do not force irrelevant KPIs. ROAS on a business that runs no paid ads
 * is a divide by zero dressed up as a metric, and MQL/SQL on a walk-in clinic
 * is vocabulary borrowed from a business it does not resemble.
 */
export const KPIS_BY_MOTION: Record<GtmMotion, readonly KpiKey[]> = {
  SELF_SERVE: [
    "traffic",
    "leads",
    "conversion_rate",
    "cac",
    "revenue",
    "retention",
  ],
  INBOUND_SALES: [
    "traffic",
    "leads",
    "mqls",
    "sqls",
    "demos",
    "conversion_rate",
    "cac",
    "revenue",
  ],
  OUTBOUND_SALES: [
    "leads",
    "sqls",
    "demos",
    "conversion_rate",
    "cac",
    "revenue",
  ],
  FIELD_LOCAL: [
    "leads",
    "demos",
    "conversion_rate",
    "cac",
    "revenue",
    "retention",
    "referrals",
  ],
  MARKETPLACE_LISTING: [
    "traffic",
    "conversion_rate",
    "cac",
    "revenue",
    "retention",
  ],
  RETAIL_ECOMMERCE: [
    "traffic",
    "conversion_rate",
    "cac",
    "revenue",
    "roas",
    "retention",
  ],
};

export function kpiApplies(motion: GtmMotion, kpi: KpiKey): boolean {
  return KPIS_BY_MOTION[motion].includes(kpi);
}

export function isKpiKey(value: unknown): value is KpiKey {
  return (
    typeof value === "string" && (KPI_KEYS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Budget scenarios
// ---------------------------------------------------------------------------

export const BUDGET_SCENARIOS = ["CONSERVATIVE", "BASE", "AGGRESSIVE"] as const;
export type BudgetScenario = (typeof BUDGET_SCENARIOS)[number];

export const BUDGET_SCENARIO_LABELS: Record<BudgetScenario, string> = {
  CONSERVATIVE: "Conservative",
  BASE: "Base",
  AGGRESSIVE: "Aggressive",
};

export function isBudgetScenario(value: unknown): value is BudgetScenario {
  return (
    typeof value === "string" &&
    (BUDGET_SCENARIOS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// 90-day plan
// ---------------------------------------------------------------------------

export const PLAN_PERIODS = ["DAYS_1_30", "DAYS_31_60", "DAYS_61_90"] as const;
export type PlanPeriod = (typeof PLAN_PERIODS)[number];

export const PLAN_PERIOD_LABELS: Record<PlanPeriod, string> = {
  DAYS_1_30: "Days 1–30",
  DAYS_31_60: "Days 31–60",
  DAYS_61_90: "Days 61–90",
};

export function isPlanPeriod(value: unknown): value is PlanPeriod {
  return (
    typeof value === "string" &&
    (PLAN_PERIODS as readonly string[]).includes(value)
  );
}

export const ACTION_PRIORITIES = ["P1", "P2", "P3"] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

export const ACTION_PRIORITY_LABELS: Record<ActionPriority, string> = {
  P1: "Do first",
  P2: "Do next",
  P3: "Do if capacity allows",
};

/** Roles a small team actually has. Kept short so "owner" stays assignable. */
export const OWNER_ROLES = [
  "FOUNDER",
  "MARKETING",
  "SALES",
  "PRODUCT",
  "AGENCY_FREELANCER",
] as const;

export type OwnerRole = (typeof OWNER_ROLES)[number];

export const OWNER_ROLE_LABELS: Record<OwnerRole, string> = {
  FOUNDER: "Founder",
  MARKETING: "Marketing",
  SALES: "Sales",
  PRODUCT: "Product",
  AGENCY_FREELANCER: "Agency / freelancer",
};

/**
 * The cap on plan size.
 *
 * §19 forbids an unrealistic hundred-task plan. Twenty-four actions across
 * three months is roughly two a week, which a founder can actually do; a
 * hundred is a document that gets abandoned in week two.
 */
export const MAX_PLAN_ACTIONS = 24;
export const MAX_ACTIONS_PER_PERIOD = 8;

/** The "Start Here" list. §20 asks for exactly ten. */
export const FIRST_ACTIONS_COUNT = 10;

// ---------------------------------------------------------------------------
// Risks
// ---------------------------------------------------------------------------

export const GTM_RISK_KINDS = [
  "icp_uncertainty",
  "channel_saturation",
  "message_differentiation",
  "acquisition_cost",
  "conversion_assumption",
  "capacity",
  "dependency",
] as const;

export type GtmRiskKind = (typeof GTM_RISK_KINDS)[number];

export const GTM_RISK_LABELS: Record<GtmRiskKind, string> = {
  icp_uncertainty: "ICP uncertainty",
  channel_saturation: "Channel saturation",
  message_differentiation: "Weak differentiation",
  acquisition_cost: "Acquisition cost",
  conversion_assumption: "Conversion assumption",
  capacity: "Team capacity",
  dependency: "External dependency",
};

export const RISK_SEVERITY = ["low", "medium", "high"] as const;
export type RiskSeverity = (typeof RISK_SEVERITY)[number];

// ---------------------------------------------------------------------------
// Report sections
// ---------------------------------------------------------------------------

export const GTM_REPORT_SECTIONS = [
  "executive_summary",
  "business_context",
  "ideal_customer_profile",
  "buyer_personas",
  "positioning",
  "messaging",
  "channel_strategy",
  "content_strategy",
  "campaign_strategy",
  "sales_funnel",
  "acquisition_economics",
  "marketing_budget",
  "kpi_framework",
  "ninety_day_plan",
  "risks_assumptions",
  "sources_limitations",
] as const;

export type GtmReportSection = (typeof GTM_REPORT_SECTIONS)[number];

export const GTM_SECTION_TITLES: Record<GtmReportSection, string> = {
  executive_summary: "Executive Summary",
  business_context: "Business Context",
  ideal_customer_profile: "Ideal Customer Profile",
  buyer_personas: "Buyer Personas",
  positioning: "Positioning",
  messaging: "Messaging",
  channel_strategy: "Channel Strategy",
  content_strategy: "Content Strategy",
  campaign_strategy: "Campaign Strategy",
  sales_funnel: "Sales Funnel",
  acquisition_economics: "Acquisition Economics",
  marketing_budget: "Marketing Budget",
  kpi_framework: "KPI Framework",
  ninety_day_plan: "90-Day GTM Plan",
  risks_assumptions: "Risks & Assumptions",
  sources_limitations: "Sources & Limitations",
};

export function isGtmReportSection(value: unknown): value is GtmReportSection {
  return (
    typeof value === "string" &&
    (GTM_REPORT_SECTIONS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export const GTM_PROJECT_STATUSES = [
  "draft",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type GtmProjectStatus = (typeof GTM_PROJECT_STATUSES)[number];

export const GTM_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type GtmRunStatus = (typeof GTM_RUN_STATUSES)[number];

export const GTM_RESULT_STATUSES = [
  "complete",
  "partial",
  "insufficient_evidence",
] as const;

export type GtmResultStatus = (typeof GTM_RESULT_STATUSES)[number];
