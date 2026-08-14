/**
 * Financial & Funding Intelligence vocabulary.
 *
 * The same VALUES-in-DB / KEYS-in-TypeScript split the rest of the platform
 * uses: migration 0016 constrains these strings in SQL and this file mirrors
 * them. `scripts/financial-smoke.tsx` asserts the mirror in both directions.
 *
 * ---------------------------------------------------------------------------
 * The distinction this feature exists to preserve
 * ---------------------------------------------------------------------------
 * A financial model is read as arithmetic, and arithmetic is trusted. But every
 * number in a forecast rests on an assumption somebody chose, and the two must
 * never be confused:
 *
 *   AI PROPOSES ASSUMPTIONS.   "100 customers in month one" is a guess.
 *   EVIDENCE SUPPORTS THEM.    A market-research source may back it.
 *   THE ENGINE CALCULATES.     Revenue = customers x price, deterministically.
 *
 * `ASSUMPTION_SOURCES` below is that distinction, and it is a required column
 * on every assumption — because the moment an AI-proposed number is rendered
 * beside a user-entered one with no label, the model has started presenting a
 * guess as an input the user chose.
 */

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

/** The eight stages, in execution order. */
export const FINANCIAL_STAGES = [
  "financial_planning",
  "cost_modeling",
  "revenue_modeling",
  "unit_economics",
  "scenario_analysis",
  "cashflow_break_even",
  "funding_analysis",
  "financial_recommendations",
] as const;

export type FinancialStage = (typeof FINANCIAL_STAGES)[number];

/**
 * How a stage does its work. This is the architectural heart of the phase.
 *
 *   ASSUMPTION  Calls a model to PROPOSE assumptions. Costs credits.
 *   COMPUTE     Runs the deterministic engine. No model, no network, no charge.
 *   RETRIEVAL   Calls a model WITH web search, for external funding evidence.
 *   NARRATIVE   Calls a model to EXPLAIN figures the engine already computed.
 *
 * A COMPUTE stage never reaches `runWorkflow`. That is not an optimisation: it
 * is the guarantee that no arithmetic in this product was produced by a
 * language model. If a compute stage ever needed AI, the design would be wrong.
 */
export const STAGE_KIND: Record<
  FinancialStage,
  "ASSUMPTION" | "COMPUTE" | "RETRIEVAL" | "NARRATIVE"
> = {
  financial_planning: "ASSUMPTION",
  cost_modeling: "ASSUMPTION",
  revenue_modeling: "ASSUMPTION",
  unit_economics: "COMPUTE",
  scenario_analysis: "COMPUTE",
  cashflow_break_even: "COMPUTE",
  funding_analysis: "RETRIEVAL",
  financial_recommendations: "NARRATIVE",
};

/** Stages that reach the network. Exactly one. */
export const FINANCIAL_RETRIEVAL_STAGES: readonly FinancialStage[] = [
  "funding_analysis",
];

/** Stages that run the deterministic engine instead of a model. */
export const FINANCIAL_COMPUTE_STAGES: readonly FinancialStage[] = [
  "unit_economics",
  "scenario_analysis",
  "cashflow_break_even",
];

export function isComputeStage(stage: FinancialStage): boolean {
  return FINANCIAL_COMPUTE_STAGES.includes(stage);
}

export const FINANCIAL_STAGE_LABELS: Record<FinancialStage, string> = {
  financial_planning: "Financial planning",
  cost_modeling: "Cost model",
  revenue_modeling: "Revenue model",
  unit_economics: "Unit economics",
  scenario_analysis: "Scenario analysis",
  cashflow_break_even: "Cash flow & break-even",
  funding_analysis: "Funding options",
  financial_recommendations: "Recommendations",
};

export const FINANCIAL_STAGE_DESCRIPTIONS: Record<FinancialStage, string> = {
  financial_planning:
    "Establishes currency, horizon and the operating shape of the business.",
  cost_modeling:
    "Proposes one-time and recurring cost assumptions. Every figure is labelled as an assumption.",
  revenue_modeling:
    "Proposes the revenue driver for this business model — customers, price, growth, churn.",
  unit_economics:
    "Calculated, not generated. CAC, LTV, ARPU, margins and payback from the stored assumptions.",
  scenario_analysis:
    "Calculated. Conservative, base and optimistic assumption sets, each fully recalculated.",
  cashflow_break_even:
    "Calculated. Monthly cash flow, runway, burn and the break-even point.",
  funding_analysis:
    "Searches the web for funding options. Every option cites a source or says it could not.",
  financial_recommendations:
    "Explains the computed figures and proposes actions. Labelled as advice.",
};

export function nextFinancialStage(
  stage: FinancialStage,
): FinancialStage | null {
  const index = FINANCIAL_STAGES.indexOf(stage);
  if (index === -1 || index === FINANCIAL_STAGES.length - 1) return null;
  return FINANCIAL_STAGES[index + 1];
}

export function financialStageIndex(stage: FinancialStage): number {
  return FINANCIAL_STAGES.indexOf(stage);
}

export function isFinancialStage(value: unknown): value is FinancialStage {
  return (
    typeof value === "string" &&
    (FINANCIAL_STAGES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Assumption provenance
// ---------------------------------------------------------------------------

/**
 * Where an assumption came from.
 *
 * `USER` outranks everything: a figure the founder entered is not overwritten
 * by a model, ever. `INHERITED_*` means it came from a business plan, market
 * research or competitor research — real, but not necessarily current, and not
 * necessarily true of this business. `AI` is a proposal.
 */
export const ASSUMPTION_SOURCES = [
  "USER",
  "AI",
  "INHERITED_PLAN",
  "INHERITED_RESEARCH",
  "INHERITED_COMPETITOR",
  "DEFAULT",
] as const;

export type AssumptionSource = (typeof ASSUMPTION_SOURCES)[number];

export const ASSUMPTION_SOURCE_LABELS: Record<AssumptionSource, string> = {
  USER: "You entered this",
  AI: "AIAutoMix proposed this",
  INHERITED_PLAN: "From your business plan",
  INHERITED_RESEARCH: "From market research",
  INHERITED_COMPETITOR: "From competitor research",
  DEFAULT: "Platform default",
};

export const ASSUMPTION_SOURCE_MEANING: Record<AssumptionSource, string> = {
  USER: "You set this value. Nothing overwrites it.",
  AI: "A proposal, not a finding. Check it before relying on the forecast.",
  INHERITED_PLAN:
    "Carried across from your business plan. It was an assumption there too.",
  INHERITED_RESEARCH:
    "Derived from evidence gathered by market research. Check the cited source.",
  INHERITED_COMPETITOR:
    "Benchmarked from a competitor's published pricing. Their price is not your price.",
  DEFAULT: "A neutral placeholder used because nothing better was available.",
};

/**
 * Does source `a` take precedence over source `b`?
 *
 * A user-set assumption is never silently replaced by a proposal — that is the
 * whole ordering. Evidence beats a plan, a plan beats a competitor benchmark,
 * and anything beats a bare AI guess or a default.
 */
export function outranks(a: AssumptionSource, b: AssumptionSource): boolean {
  const rank: Record<AssumptionSource, number> = {
    USER: 0,
    INHERITED_RESEARCH: 1,
    INHERITED_PLAN: 2,
    INHERITED_COMPETITOR: 3,
    AI: 4,
    DEFAULT: 5,
  };
  return rank[a] < rank[b];
}

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/** Units an assumption can carry. Explicit, so nothing is unit-ambiguous. */
export const ASSUMPTION_UNITS = ["money", "count", "bps", "months"] as const;
export type AssumptionUnit = (typeof ASSUMPTION_UNITS)[number];

// ---------------------------------------------------------------------------
// Revenue models
// ---------------------------------------------------------------------------

/**
 * The revenue formula families.
 *
 * Deliberately a closed set with a named driver each, rather than one universal
 * formula: "subscribers x ARPU" and "GMV x take rate" are different businesses,
 * and forcing them through one shape produces a model that is wrong for both.
 * Adding a family means adding a case to the engine and a test vector.
 */
export const REVENUE_MODELS = [
  "SUBSCRIPTION",
  "SERVICES",
  "ECOMMERCE",
  "MARKETPLACE",
  "ONE_TIME_SALES",
] as const;

export type RevenueModel = (typeof REVENUE_MODELS)[number];

export const REVENUE_MODEL_LABELS: Record<RevenueModel, string> = {
  SUBSCRIPTION: "Subscription / SaaS",
  SERVICES: "Services",
  ECOMMERCE: "E-commerce",
  MARKETPLACE: "Marketplace",
  ONE_TIME_SALES: "One-time sales",
};

/** The formula, written out, so the UI can show what is being calculated. */
export const REVENUE_MODEL_FORMULA: Record<RevenueModel, string> = {
  SUBSCRIPTION: "Active subscribers x monthly price",
  SERVICES: "Active clients x average contract value",
  ECOMMERCE: "Orders x average order value",
  MARKETPLACE: "Gross merchandise value x take rate",
  ONE_TIME_SALES: "Units sold x unit price",
};

/** What the recurring driver is called, per model. Used in the assumptions UI. */
export const DRIVER_LABELS: Record<
  RevenueModel,
  { unitLabel: string; priceLabel: string }
> = {
  SUBSCRIPTION: { unitLabel: "Subscribers", priceLabel: "Monthly price" },
  SERVICES: { unitLabel: "Clients", priceLabel: "Average contract value" },
  ECOMMERCE: { unitLabel: "Orders / month", priceLabel: "Average order value" },
  MARKETPLACE: {
    unitLabel: "Transactions / month",
    priceLabel: "Average transaction value",
  },
  ONE_TIME_SALES: { unitLabel: "Units / month", priceLabel: "Unit price" },
};

/** Which unit-economics metrics make sense for each model. */
export const APPLICABLE_METRICS: Record<RevenueModel, readonly string[]> = {
  SUBSCRIPTION: [
    "arpu",
    "cac",
    "ltv",
    "grossMargin",
    "contributionMargin",
    "cacPaybackMonths",
    "churn",
  ],
  SERVICES: [
    "arpu",
    "cac",
    "ltv",
    "grossMargin",
    "contributionMargin",
    "cacPaybackMonths",
    "churn",
  ],
  ECOMMERCE: ["arpu", "cac", "grossMargin", "contributionMargin"],
  MARKETPLACE: ["arpu", "cac", "grossMargin", "contributionMargin", "takeRate"],
  ONE_TIME_SALES: ["arpu", "cac", "grossMargin", "contributionMargin"],
};

export function isRevenueModel(value: unknown): value is RevenueModel {
  return (
    typeof value === "string" &&
    (REVENUE_MODELS as readonly string[]).includes(value)
  );
}

/**
 * Is this metric meaningful for this business model?
 *
 * The spec is explicit: do not calculate SaaS LTV for a business with no
 * recurring revenue. A number that is mathematically computable but
 * conceptually meaningless is worse than a blank, because it looks like an
 * answer. E-commerce and one-time sales have no churn, so they have no LTV
 * in the subscription sense.
 */
export function metricApplies(model: RevenueModel, metric: string): boolean {
  return APPLICABLE_METRICS[model].includes(metric);
}

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

export const COST_KINDS = ["ONE_TIME", "RECURRING"] as const;
export type CostKind = (typeof COST_KINDS)[number];

/**
 * Cost categories.
 *
 * A superset. No business uses all of them, and the model does not invent a
 * line just because a category exists — an absent category means "not
 * applicable", which is different from a line item of zero.
 */
export const COST_CATEGORIES = [
  "equipment",
  "registration",
  "technology",
  "website",
  "branding",
  "inventory",
  "salaries",
  "rent",
  "software",
  "marketing",
  "logistics",
  "operations",
  "professional_services",
  "miscellaneous",
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number];

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  equipment: "Equipment",
  registration: "Registration & licences",
  technology: "Technology & infrastructure",
  website: "Website",
  branding: "Branding",
  inventory: "Inventory",
  salaries: "Salaries",
  rent: "Rent",
  software: "Software",
  marketing: "Marketing",
  logistics: "Logistics",
  operations: "Operations",
  professional_services: "Professional services",
  miscellaneous: "Miscellaneous",
};

/**
 * Categories that scale with revenue rather than with time.
 *
 * These form COGS; everything else is an operating expense. The split is fixed
 * here rather than asked of a model, because gross margin depends on it and a
 * model that moved "inventory" out of COGS would change every margin in the
 * report without changing a single assumption.
 */
export const COGS_CATEGORIES: readonly CostCategory[] = [
  "inventory",
  "logistics",
];

export function isCogs(category: CostCategory): boolean {
  return COGS_CATEGORIES.includes(category);
}

export function isCostCategory(value: unknown): value is CostCategory {
  return (
    typeof value === "string" &&
    (COST_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isCostKind(value: unknown): value is CostKind {
  return (
    typeof value === "string" &&
    (COST_KINDS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export const SCENARIOS = ["CONSERVATIVE", "BASE", "OPTIMISTIC"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const SCENARIO_LABELS: Record<Scenario, string> = {
  CONSERVATIVE: "Conservative",
  BASE: "Base",
  OPTIMISTIC: "Optimistic",
};

export function isScenario(value: unknown): value is Scenario {
  return (
    typeof value === "string" &&
    (SCENARIOS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Funding
// ---------------------------------------------------------------------------

export const FUNDING_TYPES = [
  "BOOTSTRAP",
  "BANK_LOAN",
  "GOVERNMENT_SCHEME",
  "GRANT",
  "INCUBATOR",
  "ACCELERATOR",
  "ANGEL",
  "VENTURE_CAPITAL",
  "STRATEGIC",
  "REVENUE_BASED",
] as const;

export type FundingType = (typeof FUNDING_TYPES)[number];

export const FUNDING_TYPE_LABELS: Record<FundingType, string> = {
  BOOTSTRAP: "Bootstrapping",
  BANK_LOAN: "Bank loan",
  GOVERNMENT_SCHEME: "Government scheme",
  GRANT: "Grant",
  INCUBATOR: "Incubator",
  ACCELERATOR: "Accelerator",
  ANGEL: "Angel investment",
  VENTURE_CAPITAL: "Venture capital",
  STRATEGIC: "Strategic investment",
  REVENUE_BASED: "Revenue-based financing",
};

/**
 * How well a funding option fits.
 *
 * Always AIAutoMix's opinion, and labelled as such wherever it is drawn. A
 * grant does not become available because this engine called it a strong fit.
 */
export const SUITABILITY = ["STRONG", "POSSIBLE", "UNLIKELY"] as const;
export type Suitability = (typeof SUITABILITY)[number];

export const SUITABILITY_LABELS: Record<Suitability, string> = {
  STRONG: "Strong fit",
  POSSIBLE: "Possible fit",
  UNLIKELY: "Unlikely fit",
};

export function isFundingType(value: unknown): value is FundingType {
  return (
    typeof value === "string" &&
    (FUNDING_TYPES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Absent data
// ---------------------------------------------------------------------------

export const ABSENT_VALUES = [
  "UNKNOWN",
  "NOT_PUBLICLY_AVAILABLE",
  "INSUFFICIENT_EVIDENCE",
] as const;

export type AbsentValue = (typeof ABSENT_VALUES)[number];

export const ABSENT_LABELS: Record<AbsentValue, string> = {
  UNKNOWN: "Unknown",
  NOT_PUBLICLY_AVAILABLE: "Not publicly disclosed",
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
// Risk
// ---------------------------------------------------------------------------

export const RISK_KINDS = [
  "cost_assumption",
  "revenue_assumption",
  "break_even",
  "cash_flow",
  "pricing",
  "customer_acquisition",
  "funding",
] as const;

export type RiskKind = (typeof RISK_KINDS)[number];

export const RISK_LABELS: Record<RiskKind, string> = {
  cost_assumption: "Cost assumption",
  revenue_assumption: "Revenue assumption",
  break_even: "Break-even",
  cash_flow: "Cash flow",
  pricing: "Pricing",
  customer_acquisition: "Customer acquisition",
  funding: "Funding",
};

export const RISK_SEVERITY = ["low", "medium", "high"] as const;
export type RiskSeverity = (typeof RISK_SEVERITY)[number];

// ---------------------------------------------------------------------------
// Report sections
// ---------------------------------------------------------------------------

export const FINANCIAL_REPORT_SECTIONS = [
  "executive_summary",
  "business_context",
  "key_assumptions",
  "startup_costs",
  "operating_costs",
  "revenue_model",
  "unit_economics",
  "forecast",
  "scenarios",
  "break_even",
  "cash_flow",
  "capital_requirement",
  "funding_options",
  "financial_risks",
  "recommendations",
  "sources_limitations",
] as const;

export type FinancialReportSection = (typeof FINANCIAL_REPORT_SECTIONS)[number];

export const FINANCIAL_SECTION_TITLES: Record<FinancialReportSection, string> =
  {
    executive_summary: "Executive Summary",
    business_context: "Business & Financial Context",
    key_assumptions: "Key Assumptions",
    startup_costs: "Startup Costs",
    operating_costs: "Operating Costs",
    revenue_model: "Revenue Model",
    unit_economics: "Unit Economics",
    forecast: "12-Month Forecast",
    scenarios: "Scenario Analysis",
    break_even: "Break-even Analysis",
    cash_flow: "Cash Flow & Runway",
    capital_requirement: "Capital Requirement",
    funding_options: "Funding Options",
    financial_risks: "Financial Risks",
    recommendations: "Recommendations",
    sources_limitations: "Sources & Limitations",
  };

export function isFinancialReportSection(
  value: unknown,
): value is FinancialReportSection {
  return (
    typeof value === "string" &&
    (FINANCIAL_REPORT_SECTIONS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Statuses and horizon
// ---------------------------------------------------------------------------

/**
 * Twelve months unless a project says otherwise, capped so a forecast stays
 * bounded — an unbounded horizon is an unbounded loop in the engine.
 */
export const DEFAULT_HORIZON_MONTHS = 12;
export const MAX_HORIZON_MONTHS = 60;

export const FINANCIAL_PROJECT_STATUSES = [
  "draft",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type FinancialProjectStatus =
  (typeof FINANCIAL_PROJECT_STATUSES)[number];

export const FINANCIAL_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type FinancialRunStatus = (typeof FINANCIAL_RUN_STATUSES)[number];

export const FINANCIAL_RESULT_STATUSES = [
  "complete",
  "partial",
  "insufficient_evidence",
  "failed",
] as const;
export type FinancialResultStatus = (typeof FINANCIAL_RESULT_STATUSES)[number];
