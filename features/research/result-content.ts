import {
  CLAIM_LABELS,
  type ClaimLabel,
  type ReportSection,
} from "@/features/research/types";

/**
 * Narrows `research_results.structured_content` into blocks the UI can draw.
 *
 * The column is `jsonb`, so at the type level it is `unknown`, and the seven
 * stages each write a different shape into it. This module is the one place
 * that knows those shapes — and, more importantly, the one place that decides
 * what happens when the content is *not* one of them.
 *
 * Two rules.
 *
 *   NEVER RENDER RAW. Every value that reaches a component comes out of here as
 *   a plain string in a typed block. There is no HTML path, no markdown parser
 *   and no `dangerouslySetInnerHTML` anywhere downstream. Some of this text
 *   originated in retrieved web pages, and the only safe assumption about that
 *   is that it is hostile.
 *
 *   NEVER INVENT. An unrecognised shape produces no blocks, and the section
 *   renders as "no content stored" rather than as something plausible. A
 *   research product that fills gaps with confident-looking prose has defeated
 *   its own purpose.
 */

export type ContentBlock =
  | { kind: "prose"; text: string }
  | { kind: "list"; title: string; items: string[] }
  | { kind: "points"; items: LabelledPoint[] };

export interface LabelledPoint {
  text: string;
  /**
   * FACT / INFERENCE / RECOMMENDATION. Rendered as a word, never as a colour
   * alone — the distinction between a finding and a suggestion has to survive
   * greyscale and a screen reader.
   */
  label: ClaimLabel;
  sourceUrl?: string;
}

const MAX_ITEMS = 40;

function asString(value: unknown, max = 8000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item, 2000))
    .filter((item): item is string => item !== null)
    .slice(0, MAX_ITEMS);
}

function isClaimLabel(value: unknown): value is ClaimLabel {
  return (
    typeof value === "string" && (CLAIM_LABELS as readonly string[]).includes(value)
  );
}

/**
 * Keep only links we would be willing to open.
 *
 * These URLs come from provider citations rather than model prose, but this is
 * the last gate before one becomes an `href`, and `javascript:` costs nothing
 * to exclude here and everything to miss.
 */
function safeUrl(value: unknown): string | undefined {
  const raw = asString(value, 2000);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function asPoints(value: unknown): LabelledPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): LabelledPoint | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const text = asString(record.text, 2000);
      if (!text) return null;

      const sourceUrl = safeUrl(record.sourceUrl);
      return {
        text,
        // An unlabelled point is treated as an INFERENCE, not a FACT. The
        // conservative default is the one that does not overstate.
        label: isClaimLabel(record.label) ? record.label : "INFERENCE",
        // Spread rather than `sourceUrl: undefined`: the key is absent when
        // there is no usable link, which is what `exactOptionalPropertyTypes`
        // asks for and what "no source" should look like on the wire.
        ...(sourceUrl ? { sourceUrl } : {}),
      };
    })
    .filter((point): point is LabelledPoint => point !== null)
    .slice(0, MAX_ITEMS);
}

function pushList(
  blocks: ContentBlock[],
  title: string,
  value: unknown,
): void {
  const items = asStringList(value);
  if (items.length) blocks.push({ kind: "list", title, items });
}

/**
 * Turn one stored section into renderable blocks.
 *
 * Shapes are matched structurally rather than by section key, because the
 * report stage overwrites four of the keys the earlier stages wrote — a section
 * keyed `scope_methodology` holds the planning object mid-run and a plain
 * `{ text }` afterwards, and both have to render.
 */
export function toContentBlocks(content: unknown): ContentBlock[] {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return [];
  }

  const record = content as Record<string, unknown>;
  const blocks: ContentBlock[] = [];

  // --- Plain prose, written by the report stage --------------------------
  const text = asString(record.text);
  if (text) blocks.push({ kind: "prose", text });

  // --- Analysis section: summary + labelled points -----------------------
  const summary = asString(record.summary);
  if (summary) blocks.push({ kind: "prose", text: summary });

  const points = asPoints(record.points);
  if (points.length) blocks.push({ kind: "points", items: points });

  // --- Planning ----------------------------------------------------------
  const scopeSummary = asString(record.scopeSummary);
  if (scopeSummary) blocks.push({ kind: "prose", text: scopeSummary });
  pushList(blocks, "Research questions", record.researchQuestions);
  pushList(blocks, "Search strategy", record.searchStrategies);
  pushList(blocks, "Assumptions", record.assumptions);
  pushList(blocks, "Out of scope", record.outOfScope);

  // --- Discovery ---------------------------------------------------------
  if (Array.isArray(record.findings)) {
    const findings = record.findings
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const entry = item as Record<string, unknown>;
        const body = asString(entry.summary, 2000);
        if (!body) return null;
        const relatesTo = asString(entry.relatesTo, 500);
        return relatesTo ? `${body} (${relatesTo})` : body;
      })
      .filter((item): item is string => item !== null)
      .slice(0, MAX_ITEMS);
    if (findings.length) {
      blocks.push({ kind: "list", title: "What the search found", items: findings });
    }
  }
  pushList(blocks, "Searches run", record.queriesUsed);
  const notes = asString(record.notes, 4000);
  if (notes) blocks.push({ kind: "prose", text: notes });

  // --- Evidence extraction ----------------------------------------------
  // Surfaced, not suppressed: these are the claims the evidence would NOT
  // support, and hiding them is how a research tool starts lying.
  pushList(blocks, "Claims the sources did not support", record.unsupportedClaims);
  pushList(blocks, "Contradictions between sources", record.contradictions);

  // --- Synthesis ----------------------------------------------------------
  pushList(blocks, "Key conclusions", record.majorFindings);
  pushList(blocks, "Strongest evidence", record.strongestEvidence);
  pushList(blocks, "Strategic implications", record.strategicImplications);
  pushList(blocks, "Opportunities", record.opportunities);
  pushList(blocks, "Risks", record.risks);
  pushList(blocks, "Recommended actions", record.recommendedNextActions);
  pushList(blocks, "Open uncertainties", record.uncertainties);

  return blocks;
}

/**
 * Which stage produced a section, so results can be grouped the way the
 * pipeline ran rather than the way the report prints.
 */
export const SECTION_STAGE: Record<ReportSection, string> = {
  scope_methodology: "planning",
  evidence_sources: "discovery",
  confidence_limitations: "evidence",
  market_overview: "analysis",
  market_size_growth: "analysis",
  target_customer_icp: "analysis",
  customer_problems_needs: "analysis",
  industry_trends: "analysis",
  demand_signals: "analysis",
  business_model_pricing: "analysis",
  opportunities: "analysis",
  risks_challenges: "analysis",
  regulatory_environmental: "analysis",
  strategic_recommendations: "synthesis",
  executive_summary: "report",
};
