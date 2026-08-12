/**
 * Market Research vocabulary — stages, sections, depths and evidence labels.
 *
 * The same VALUES-in-DB / KEYS-in-TypeScript split the commerce and admin
 * layers already use: migration 0009 constrains these strings in SQL, and this
 * file mirrors them so the application can be type-safe about which stage it is
 * running and which section it is writing.
 *
 * `scripts/research-smoke.tsx` asserts the mirror against the migration in both
 * directions, so a stage added to one side and not the other fails the build
 * rather than failing at 2am mid-run.
 */

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

/**
 * The seven stages, in execution order.
 *
 * Reduced from the twelve in `SPRINT-08.md`. Twelve stages described twelve
 * prompts, not twelve capabilities — the eight analysis stages were one
 * analytical step wearing eight hats, and each extra stage is a separate HTTP
 * request, a separate credit charge and a separate failure mode.
 *
 * The evidence guarantee comes from `discovery` → `collection` → `evidence`,
 * which is preserved exactly.
 */
export const RESEARCH_STAGES = [
  "planning",
  "discovery",
  "collection",
  "evidence",
  "analysis",
  "synthesis",
  "report",
] as const;

export type ResearchStage = (typeof RESEARCH_STAGES)[number];

/** Stages that reach the network. Everything else reasons over stored rows. */
export const RETRIEVAL_STAGES: readonly ResearchStage[] = [
  "discovery",
  "collection",
];

export const STAGE_LABELS: Record<ResearchStage, string> = {
  planning: "Research planning",
  discovery: "Source discovery",
  collection: "Source collection",
  evidence: "Evidence extraction",
  analysis: "Market analysis",
  synthesis: "Synthesis",
  report: "Report generation",
};

export const STAGE_DESCRIPTIONS: Record<ResearchStage, string> = {
  planning: "Turns the brief into research questions and a source strategy.",
  discovery: "Searches the web for candidate sources. No content is invented.",
  collection:
    "Normalises, deduplicates and stores the sources that were found.",
  evidence: "Extracts claims from the stored sources and records confidence.",
  analysis: "Market, customer, trends, demand, pricing, opportunity and risk.",
  synthesis: "Turns the analysis into strategic conclusions.",
  report: "Assembles the fifteen sections from what has already been stored.",
};

/** The next stage, or `null` when the run is finished. */
export function nextStage(stage: ResearchStage): ResearchStage | null {
  const index = RESEARCH_STAGES.indexOf(stage);
  if (index === -1 || index === RESEARCH_STAGES.length - 1) return null;
  return RESEARCH_STAGES[index + 1];
}

/** 0-based position, used for progress display. */
export function stageIndex(stage: ResearchStage): number {
  return RESEARCH_STAGES.indexOf(stage);
}

/** Completed fraction once `stage` has succeeded. */
export function progressAfter(stage: ResearchStage): number {
  return (stageIndex(stage) + 1) / RESEARCH_STAGES.length;
}

export function isResearchStage(value: unknown): value is ResearchStage {
  return (
    typeof value === "string" &&
    (RESEARCH_STAGES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Report sections
// ---------------------------------------------------------------------------

/**
 * The fifteen sections from `SPRINT-08.md`, in report order.
 *
 * Every one is stored as its own `research_results` row before anything is
 * rendered. The UI and the PDF both read those rows, so they cannot disagree,
 * and neither is parsed back out of a generated document.
 */
export const REPORT_SECTIONS = [
  "executive_summary",
  "scope_methodology",
  "market_overview",
  "market_size_growth",
  "target_customer_icp",
  "customer_problems_needs",
  "industry_trends",
  "demand_signals",
  "business_model_pricing",
  "opportunities",
  "risks_challenges",
  "regulatory_environmental",
  "strategic_recommendations",
  "evidence_sources",
  "confidence_limitations",
] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number];

export const SECTION_TITLES: Record<ReportSection, string> = {
  executive_summary: "Executive Summary",
  scope_methodology: "Research Scope & Methodology",
  market_overview: "Market Overview",
  market_size_growth: "Market Size & Growth Evidence",
  target_customer_icp: "Target Customer / ICP",
  customer_problems_needs: "Customer Problems & Needs",
  industry_trends: "Industry Trends",
  demand_signals: "Demand Signals",
  business_model_pricing: "Business Model & Pricing Signals",
  opportunities: "Opportunities",
  risks_challenges: "Risks & Challenges",
  regulatory_environmental: "Regulatory / Environmental Considerations",
  strategic_recommendations: "Strategic Recommendations",
  evidence_sources: "Evidence & Sources",
  confidence_limitations: "Confidence / Limitations",
};

/**
 * Sections that must carry evidence to be considered complete.
 *
 * `executive_summary`, `scope_methodology`, `evidence_sources` and
 * `confidence_limitations` are derived from the rest of the report rather than
 * from sources directly, so requiring citations on them would be theatre.
 */
export const EVIDENCE_BACKED_SECTIONS: readonly ReportSection[] = [
  "market_overview",
  "market_size_growth",
  "target_customer_icp",
  "customer_problems_needs",
  "industry_trends",
  "demand_signals",
  "business_model_pricing",
  "opportunities",
  "risks_challenges",
  "regulatory_environmental",
];

export function isReportSection(value: unknown): value is ReportSection {
  return (
    typeof value === "string" &&
    (REPORT_SECTIONS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Depths
// ---------------------------------------------------------------------------

export const RESEARCH_DEPTHS = ["basic", "standard", "deep"] as const;
export type ResearchDepth = (typeof RESEARCH_DEPTHS)[number];

export function isResearchDepth(value: unknown): value is ResearchDepth {
  return (
    typeof value === "string" &&
    (RESEARCH_DEPTHS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export const REQUEST_STATUSES = [
  "draft",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const STAGE_STATUSES = [
  "running",
  "succeeded",
  "failed",
  "skipped",
] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export const SOURCE_STATUSES = [
  "discovered",
  "retrieved",
  "failed",
  "rejected",
  "duplicate",
] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const SOURCE_TYPES = [
  "web",
  "news",
  "report",
  "government",
  "academic",
  "industry",
  "company",
  "statistics",
  "other",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * Result status per section.
 *
 * `insufficient_evidence` is a first-class outcome, not an error.
 * `MARKET-RESEARCH-SPEC.md`: a claim without sufficient evidence must be
 * qualified rather than presented as fact — so the schema needs somewhere to
 * say "we looked and could not support this", and the report needs to print it.
 */
export const RESULT_STATUSES = [
  "complete",
  "partial",
  "insufficient_evidence",
  "failed",
] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

// ---------------------------------------------------------------------------
// Claim labels
// ---------------------------------------------------------------------------

/**
 * `RESEARCH-REPORT-SPEC.md` labels. Every statement in the report carries one,
 * so a reader can tell what is supported from what is reasoned or proposed —
 * which is the difference between research and confident prose.
 */
export const CLAIM_LABELS = ["FACT", "INFERENCE", "RECOMMENDATION"] as const;
export type ClaimLabel = (typeof CLAIM_LABELS)[number];

export const CLAIM_LABEL_MEANING: Record<ClaimLabel, string> = {
  FACT: "Directly supported by a cited source.",
  INFERENCE: "A reasoned conclusion drawn from the evidence.",
  RECOMMENDATION: "A proposed action, not a finding.",
};

/** A FACT must cite a source; the other two need not. */
export function requiresCitation(label: ClaimLabel): boolean {
  return label === "FACT";
}
