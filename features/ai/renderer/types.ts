/**
 * Report Engine document model (REPORT-ENGINE-SPEC.md, PDF-ENGINE-SPEC.md).
 *
 * Input: validated workflow JSON. Output: a consistent report.
 *
 * A workflow describes its report *once* as a `ReportDocumentModel`, and both
 * renderers consume it — `report-renderer.tsx` for HTML and `pdf/report-pdf.tsx`
 * for the branded A4 PDF. That is what keeps the two surfaces from drifting
 * apart, and why no workflow duplicates its section list.
 *
 * The model is plain, serialisable data: no React nodes, no icon components,
 * no Tailwind classes. Icons are named, and colour is expressed as a semantic
 * tone that each renderer maps into its own palette.
 */

/** Priority / severity / potential, rendered as a badge. */
export type ReportLevel = "high" | "medium" | "low";

/** Semantic colour, resolved per renderer. */
export type ReportTone = "positive" | "caution" | "negative" | "neutral";

/** Icon vocabulary available to sections. */
export type ReportIconName =
  | "gauge"
  | "clipboard"
  | "target"
  | "users"
  | "trending"
  | "grid"
  | "coins"
  | "shield"
  | "lightbulb"
  | "route"
  | "checklist";

export interface RankedEntry {
  title: string;
  description: string;
  level?: ReportLevel;
  /** Optional secondary line, e.g. a risk's mitigation. */
  footnote?: { label: string; value: string };
}

export interface MetricEntry {
  key: string;
  label: string;
  /** 0–100. */
  value: number;
  /** Optional contribution to a weighted total, as a percentage. */
  weight?: number;
}

export interface SwotContent {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface TimelineEntry {
  title: string;
  description: string;
  timeframe: string;
}

export interface KeyValueEntry {
  label: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Evidence vocabulary (Sprint 8 Phase 5)
//
// Added for Market Research, but deliberately generic: any workflow whose
// output is traceable to sources can use these, and the two renderers gained
// one implementation each rather than the research feature gaining a private
// renderer. That is the extension path this file has always described —
// "add a kind here and to both renderers".
// ---------------------------------------------------------------------------

/**
 * How a statement relates to its evidence.
 *
 * This is the distinction the whole research product exists to preserve, so it
 * is part of the document model rather than something a renderer infers. A
 * renderer may style these differently; it may not promote one into another.
 */
export type ClaimKind = "FACT" | "INFERENCE" | "RECOMMENDATION";

/**
 * Confidence in a finding.
 *
 * `insufficient` is a first-class value, not the absence of one. A report that
 * could only express three grades of confidence would have to round "we looked
 * and could not support this" up to "low", which is the specific dishonesty the
 * evidence model is built to prevent.
 */
export type ReportConfidence = "high" | "medium" | "low" | "insufficient";

/** A citation attached to a finding. `url` is validated by the builder. */
export interface EvidenceCitation {
  label: string;
  url?: string;
  publisher?: string;
  /** Publication date as stored. Absent means unknown — never inferred. */
  publishedAt?: string;
}

export interface FindingEntry {
  text: string;
  kind: ClaimKind;
  confidence?: ReportConfidence;
  /** Supporting sources. Empty is meaningful and is rendered as such. */
  citations?: EvidenceCitation[];
}

/** A row in the Evidence & Sources index. */
export interface SourceEntry {
  title: string;
  publisher?: string;
  url?: string;
  sourceType?: string;
  publishedAt?: string;
  retrievedAt?: string;
}

/** The renderable content types. Add a kind here and to both renderers. */
export type ReportBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "metrics"; entries: MetricEntry[] }
  | { kind: "swot"; content: SwotContent }
  | { kind: "ranked"; levelLabel?: string; entries: RankedEntry[] }
  | { kind: "timeline"; entries: TimelineEntry[] }
  | { kind: "keyValues"; entries: KeyValueEntry[] }
  | { kind: "findings"; entries: FindingEntry[] }
  | { kind: "sources"; entries: SourceEntry[] }
  /**
   * A stated caveat: insufficient evidence, sources that disagree, a chart that
   * could not honestly be drawn. It is a block rather than prose because these
   * must survive into the PDF looking like warnings, not like sentences a
   * reader can skim past.
   */
  | { kind: "callout"; tone: ReportTone; title: string; text: string };

/** Human wording for each claim kind. Shared by both renderers. */
export const CLAIM_KIND_LABEL: Record<ClaimKind, string> = {
  FACT: "Fact",
  INFERENCE: "Inference",
  RECOMMENDATION: "Recommendation",
};

export const CLAIM_KIND_MEANING: Record<ClaimKind, string> = {
  FACT: "Directly supported by a cited source.",
  INFERENCE: "A reasoned conclusion drawn from the evidence.",
  RECOMMENDATION: "A proposed action, not a finding.",
};

export const CONFIDENCE_LABEL: Record<ReportConfidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  insufficient: "Insufficient evidence",
};

/** Confidence as a tone. Used for colour, never as the only signal. */
export const CONFIDENCE_TONE: Record<ReportConfidence, ReportTone> = {
  high: "positive",
  medium: "caution",
  low: "negative",
  insufficient: "neutral",
};

/**
 * Confidence as a 0–3 meter position.
 *
 * Three steps, not a percentage: the research engine grades confidence
 * ordinally, and rendering it as "67%" would imply a measurement nobody made.
 */
export const CONFIDENCE_STEPS = 3;
export const CONFIDENCE_STEP: Record<ReportConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
  insufficient: 0,
};

export interface ReportSection {
  id: string;
  title: string;
  icon?: ReportIconName;
  blocks: ReportBlock[];
  /**
   * `half` lets short sections pair up two-per-row in HTML. The PDF renderer
   * ignores it and stacks everything, which is correct for print.
   */
  layout?: "full" | "half";
  /** Keep the section out of the section navigation. */
  navHidden?: boolean;
}

export interface ReportVerdict {
  label: string;
  tone: ReportTone;
  blurb: string;
}

export interface ReportScore {
  /** 0–100. */
  value: number;
  /** Band name, e.g. "Strong". */
  label: string;
  tone: ReportTone;
  verdict?: ReportVerdict;
}

export interface ReportMeta {
  workflowLabel: string;
  model: string;
  promptVersion: string;
  /** ISO timestamp; each renderer formats it for its own surface. */
  generatedAt: string;
  durationMs?: number | null;
  tokens?: number | null;
}

export interface ReportDocumentModel {
  /** Workflow slug that produced the report. */
  workflow: string;
  /** Eyebrow above the title, e.g. "Business Validation Report". */
  kicker: string;
  title: string;
  summary: string;
  score?: ReportScore;
  sections: ReportSection[];
  meta: ReportMeta;
  disclaimer: string;
}

/** Standard disclaimer applied to AI-generated reports. */
export const AI_REPORT_DISCLAIMER =
  "This analysis is AI-generated guidance, not professional financial, legal, or investment advice. Validate key assumptions independently before making decisions.";

/** Sections eligible for the in-page navigation. */
export function navigableSections(
  model: ReportDocumentModel,
): { id: string; label: string }[] {
  return model.sections
    .filter((section) => !section.navHidden)
    .map((section) => ({ id: section.id, label: section.title }));
}
