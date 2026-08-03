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

/** The renderable content types. Add a kind here and to both renderers. */
export type ReportBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "metrics"; entries: MetricEntry[] }
  | { kind: "swot"; content: SwotContent }
  | { kind: "ranked"; levelLabel?: string; entries: RankedEntry[] }
  | { kind: "timeline"; entries: TimelineEntry[] }
  | { kind: "keyValues"; entries: KeyValueEntry[] };

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
