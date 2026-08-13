/**
 * Competitor Intelligence vocabulary.
 *
 * The same VALUES-in-DB / KEYS-in-TypeScript split the research, commerce and
 * admin layers use: migration 0014 constrains these strings in SQL and this
 * file mirrors them, so the application can be type-safe about which stage it
 * is running and what it may store. `scripts/competitor-smoke.tsx` asserts the
 * mirror in both directions.
 *
 * ---------------------------------------------------------------------------
 * The distinction this whole feature exists to preserve
 * ---------------------------------------------------------------------------
 * A competitor report is read as if it were fact, and almost none of it is.
 * Four different kinds of statement end up on the same page:
 *
 *   STATED     The competitor says this about itself, on its own site.
 *   OBSERVED   Retrieved evidence shows this, whoever said it.
 *   INFERRED   AIAutoMix reasoned this from the evidence.
 *   RECOMMENDED AIAutoMix proposes this action. It is advice, not a finding.
 *
 * `CLAIM_KINDS` below is that distinction, and it is a required field on every
 * stored claim rather than an optional annotation — because the moment a
 * marketing headline gets rendered next to a verified price with no label, the
 * product has started lying quietly.
 */

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

/** The seven stages, in execution order. */
export const COMPETITOR_STAGES = [
  "planning",
  "discovery",
  "verification",
  "profiling",
  "pricing_positioning",
  "analysis",
  "recommendations",
] as const;

export type CompetitorStage = (typeof COMPETITOR_STAGES)[number];

/**
 * Stages that reach the network.
 *
 * Everything else reasons over rows already stored. Keeping this list short is
 * the main cost control in the feature: four of the seven stages never make a
 * search request.
 */
export const COMPETITOR_RETRIEVAL_STAGES: readonly CompetitorStage[] = [
  "discovery",
  "verification",
  "pricing_positioning",
];

export const COMPETITOR_STAGE_LABELS: Record<CompetitorStage, string> = {
  planning: "Competitor planning",
  discovery: "Competitor discovery",
  verification: "Competitor verification",
  profiling: "Competitor profiling",
  pricing_positioning: "Pricing & positioning",
  analysis: "Competitive analysis",
  recommendations: "Strategic recommendations",
};

export const COMPETITOR_STAGE_DESCRIPTIONS: Record<CompetitorStage, string> = {
  planning:
    "Turns the business brief into competitor criteria and search strategy.",
  discovery:
    "Searches the web for candidate competitors. Candidates come from citations, never from invention.",
  verification:
    "Checks each candidate actually exists and is relevant. Classifies verified / partial / unverified.",
  profiling:
    "Builds a structured profile per verified competitor from stored evidence.",
  pricing_positioning:
    "Researches publicly displayed pricing and positioning. Undisclosed stays undisclosed.",
  analysis:
    "Feature comparison, strengths, weaknesses and evidence-backed market gaps.",
  recommendations:
    "Positioning, differentiation and go-to-market advice. Labelled as advice.",
};

/** The next stage, or `null` when the run is finished. */
export function nextCompetitorStage(
  stage: CompetitorStage,
): CompetitorStage | null {
  const index = COMPETITOR_STAGES.indexOf(stage);
  if (index === -1 || index === COMPETITOR_STAGES.length - 1) return null;
  return COMPETITOR_STAGES[index + 1];
}

/** 0-based position, used for progress display. */
export function competitorStageIndex(stage: CompetitorStage): number {
  return COMPETITOR_STAGES.indexOf(stage);
}

export function isCompetitorStage(value: unknown): value is CompetitorStage {
  return (
    typeof value === "string" &&
    (COMPETITOR_STAGES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Competitor classification
// ---------------------------------------------------------------------------

/**
 * How a competitor relates to the user's business.
 *
 * `UNCLASSIFIED` exists so discovery can record a candidate before there is
 * evidence to place it. The spec forbids classifying without evidence, and a
 * schema with no way to say "not yet decided" would force a guess.
 */
export const COMPETITOR_TYPES = [
  "DIRECT",
  "INDIRECT",
  "EMERGING",
  "UNCLASSIFIED",
] as const;

export type CompetitorType = (typeof COMPETITOR_TYPES)[number];

export const COMPETITOR_TYPE_LABELS: Record<CompetitorType, string> = {
  DIRECT: "Direct",
  INDIRECT: "Indirect",
  EMERGING: "Emerging",
  UNCLASSIFIED: "Unclassified",
};

export const COMPETITOR_TYPE_MEANING: Record<CompetitorType, string> = {
  DIRECT: "Offers a substantially similar product or service.",
  INDIRECT: "Solves the same customer problem a different way.",
  EMERGING: "Newer or smaller, with observable market presence.",
  UNCLASSIFIED: "Not enough evidence to classify yet.",
};

/**
 * How far a candidate has been checked.
 *
 * Only VERIFIED and PARTIALLY_VERIFIED may appear prominently. UNVERIFIED is
 * kept rather than deleted — knowing that a name surfaced and could not be
 * confirmed is itself a finding, and silently dropping it would make the list
 * look cleaner than the evidence supports.
 */
export const VERIFICATION_STATUSES = [
  "VERIFIED",
  "PARTIALLY_VERIFIED",
  "UNVERIFIED",
  "PENDING",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  VERIFIED: "Verified",
  PARTIALLY_VERIFIED: "Partially verified",
  UNVERIFIED: "Unverified",
  PENDING: "Not yet checked",
};

export const VERIFICATION_MEANING: Record<VerificationStatus, string> = {
  VERIFIED:
    "A reachable site and an identifiable product, relevant to this market.",
  PARTIALLY_VERIFIED:
    "Some checks passed; at least one could not be confirmed from public sources.",
  UNVERIFIED:
    "Surfaced during discovery but could not be confirmed. Treat as a lead, not a competitor.",
  PENDING: "The verification stage has not examined this candidate yet.",
};

/** Verified enough to be presented as a competitor rather than a lead. */
export function isPresentable(status: VerificationStatus): boolean {
  return status === "VERIFIED" || status === "PARTIALLY_VERIFIED";
}

// ---------------------------------------------------------------------------
// Claim provenance
// ---------------------------------------------------------------------------

/**
 * The four-way distinction from the spec's final principle.
 *
 * Deliberately four values rather than the research feature's three: a
 * competitor's own marketing claim is not the same kind of statement as an
 * independently observed fact, and a report that collapses them is exactly the
 * failure this product must avoid.
 */
export const CLAIM_KINDS = [
  "STATED",
  "OBSERVED",
  "INFERRED",
  "RECOMMENDED",
] as const;

export type ClaimKind = (typeof CLAIM_KINDS)[number];

export const CLAIM_KIND_LABELS: Record<ClaimKind, string> = {
  STATED: "Competitor states",
  OBSERVED: "Evidence shows",
  INFERRED: "AIAutoMix infers",
  RECOMMENDED: "AIAutoMix recommends",
};

export const CLAIM_KIND_MEANING: Record<ClaimKind, string> = {
  STATED:
    "The competitor says this about itself. Reported as their claim, not as fact.",
  OBSERVED: "Directly visible in a cited source.",
  INFERRED: "Reasoned by AIAutoMix from the cited evidence.",
  RECOMMENDED: "Proposed action from AIAutoMix. Advice, not a finding.",
};

/** STATED and OBSERVED both point at something a source actually shows. */
export function requiresSource(kind: ClaimKind): boolean {
  return kind === "STATED" || kind === "OBSERVED";
}

// ---------------------------------------------------------------------------
// Absent data
// ---------------------------------------------------------------------------

/**
 * The three ways a field can be missing, as values rather than as `null`.
 *
 * "We could not find it", "the company does not publish it" and "we found
 * conflicting scraps" are different facts about the market, and a reader acts
 * differently on each. Collapsing them into an empty cell throws away the most
 * useful thing the research learned.
 */
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

/** Render a field that may legitimately be absent. */
export function displayValue(value: string | null | undefined): string {
  if (!value) return ABSENT_LABELS.UNKNOWN;
  return isAbsentValue(value) ? ABSENT_LABELS[value] : value;
}

// ---------------------------------------------------------------------------
// Report sections
// ---------------------------------------------------------------------------

/** The fifteen sections, in report order. */
export const COMPETITOR_REPORT_SECTIONS = [
  "executive_summary",
  "research_scope",
  "competitor_landscape",
  "direct_competitors",
  "indirect_competitors",
  "emerging_competitors",
  "competitor_profiles",
  "feature_comparison",
  "pricing_comparison",
  "positioning_analysis",
  "strengths_weaknesses",
  "market_gaps",
  "differentiation_opportunities",
  "strategic_recommendations",
  "sources_limitations",
] as const;

export type CompetitorReportSection =
  (typeof COMPETITOR_REPORT_SECTIONS)[number];

export const COMPETITOR_SECTION_TITLES: Record<
  CompetitorReportSection,
  string
> = {
  executive_summary: "Executive Summary",
  research_scope: "Research Scope",
  competitor_landscape: "Competitor Landscape",
  direct_competitors: "Direct Competitors",
  indirect_competitors: "Indirect Competitors",
  emerging_competitors: "Emerging Competitors",
  competitor_profiles: "Competitor Profiles",
  feature_comparison: "Feature Comparison",
  pricing_comparison: "Pricing Comparison",
  positioning_analysis: "Positioning Analysis",
  strengths_weaknesses: "Strengths & Weaknesses",
  market_gaps: "Market Gaps",
  differentiation_opportunities: "Differentiation Opportunities",
  strategic_recommendations: "Strategic Recommendations",
  sources_limitations: "Sources & Limitations",
};

export function isCompetitorReportSection(
  value: unknown,
): value is CompetitorReportSection {
  return (
    typeof value === "string" &&
    (COMPETITOR_REPORT_SECTIONS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Depths, statuses, confidence
// ---------------------------------------------------------------------------

export const COMPETITOR_DEPTHS = ["basic", "standard", "deep"] as const;
export type CompetitorDepth = (typeof COMPETITOR_DEPTHS)[number];

export function isCompetitorDepth(value: unknown): value is CompetitorDepth {
  return (
    typeof value === "string" &&
    (COMPETITOR_DEPTHS as readonly string[]).includes(value)
  );
}

export const COMPETITOR_PROJECT_STATUSES = [
  "draft",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type CompetitorProjectStatus =
  (typeof COMPETITOR_PROJECT_STATUSES)[number];

export const COMPETITOR_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type CompetitorRunStatus = (typeof COMPETITOR_RUN_STATUSES)[number];

export const COMPETITOR_STAGE_STATUSES = [
  "running",
  "succeeded",
  "failed",
  "skipped",
] as const;
export type CompetitorStageStatus = (typeof COMPETITOR_STAGE_STATUSES)[number];

/** Mirrors the research vocabulary; `insufficient_evidence` is an outcome. */
export const COMPETITOR_RESULT_STATUSES = [
  "complete",
  "partial",
  "insufficient_evidence",
  "failed",
] as const;
export type CompetitorResultStatus =
  (typeof COMPETITOR_RESULT_STATUSES)[number];

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/** Source types, shared with the research feature's vocabulary. */
export const COMPETITOR_SOURCE_TYPES = [
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
export type CompetitorSourceType = (typeof COMPETITOR_SOURCE_TYPES)[number];

// ---------------------------------------------------------------------------
// Comparison dimensions
// ---------------------------------------------------------------------------

/**
 * The dimensions a feature-comparison matrix may use.
 *
 * A fixed vocabulary, not free text: the matrix has to line up across
 * competitors, and a model inventing "AI-powered synergy" as a row for one
 * competitor and not another produces a table that cannot be read.
 *
 * A dimension is only included when there is evidence for it — the list is what
 * *may* appear, not what must.
 */
export const COMPARISON_DIMENSIONS = [
  "core_functionality",
  "ai_capabilities",
  "integrations",
  "automation",
  "pricing",
  "target_market",
  "geography",
  "mobile",
  "analytics",
  "support",
  "onboarding",
] as const;

export type ComparisonDimension = (typeof COMPARISON_DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<ComparisonDimension, string> = {
  core_functionality: "Core functionality",
  ai_capabilities: "AI capabilities",
  integrations: "Integrations",
  automation: "Automation",
  pricing: "Pricing",
  target_market: "Target market",
  geography: "Geography",
  mobile: "Mobile",
  analytics: "Analytics",
  support: "Support",
  onboarding: "Onboarding",
};

export function isComparisonDimension(
  value: unknown,
): value is ComparisonDimension {
  return (
    typeof value === "string" &&
    (COMPARISON_DIMENSIONS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Gaps
// ---------------------------------------------------------------------------

export const GAP_KINDS = [
  "segment",
  "feature",
  "pricing",
  "geography",
  "integration",
  "positioning",
  "service",
] as const;

export type GapKind = (typeof GAP_KINDS)[number];

export const GAP_LABELS: Record<GapKind, string> = {
  segment: "Underserved segment",
  feature: "Missing feature",
  pricing: "Pricing gap",
  geography: "Geography gap",
  integration: "Integration gap",
  positioning: "Positioning gap",
  service: "Service gap",
};

/**
 * Every gap is a *potential* opportunity.
 *
 * The spec is explicit that a gap must never be presented as a guaranteed
 * market opportunity. Absence of evidence that somebody serves a segment is not
 * evidence that nobody does — the research saw a sample of the web, not the
 * market. This prefix is applied at render time in both surfaces.
 */
export const GAP_QUALIFIER = "Potential opportunity";
