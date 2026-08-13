import type { ReportCitation } from "@/features/research/report/schema";

/**
 * Detecting — and refusing to resolve — disagreement about market size.
 *
 * `RESEARCH-REPORT-SPEC.md` forbids unsupported market-size claims, and the
 * most common way one appears is not fabrication but selection: two sources
 * publish different numbers and the report quietly prints the larger one.
 *
 * This module finds the disagreement and stops there. It deliberately does NOT
 * parse the figures into comparable numbers — no currency conversion, no
 * scaling of "bn" against "crore", no base-year alignment. Code that could rank
 * these could also be asked to pick a winner, and the honest output is the
 * range plus the caveat that the definitions differ.
 *
 * A plain module rather than part of the server-only composer, so the rule is
 * unit-testable without a database.
 */

/**
 * Currency- or scale-qualified magnitudes as they were written.
 *
 * Intentionally conservative: a bare "12" is not a market size, and matching it
 * would turn every sentence containing a number into a false conflict.
 */
const MAGNITUDE =
  /(?:[$£€₹]\s?\d[\d,.]*\s*(?:billion|bn|million|mn|m\b|trillion|crore|lakh|k\b)?|\d[\d,.]*\s*(?:billion|bn|million|mn|trillion|crore|lakh)\b)/gi;

export interface MagnitudeClaim {
  /** The figure exactly as the source stated it. Never normalised. */
  figure: string;
  sourceLabel: string;
  claim: string;
}

export function findMarketSizeDivergence(
  findings: { text: string; citations: ReportCitation[] }[],
): MagnitudeClaim[] {
  const claims: MagnitudeClaim[] = [];

  for (const finding of findings) {
    const matches = finding.text.match(MAGNITUDE);
    if (!matches?.length) continue;

    const label = finding.citations[0]?.label;
    // A figure with no source attached is not evidence of disagreement; it is
    // an unsupported number, and the FACT-needs-a-citation rule handles it.
    if (!label) continue;

    claims.push({
      figure: matches[0].trim(),
      sourceLabel: label,
      claim: finding.text.slice(0, 300),
    });
  }

  // Disagreement needs at least two DIFFERENT sources quoting DIFFERENT
  // figures. Two sources agreeing, or one source quoted twice, is not a
  // conflict and must not be reported as one.
  const distinctSources = new Set(claims.map((claim) => claim.sourceLabel));
  const distinctFigures = new Set(
    claims.map((claim) => claim.figure.toLowerCase().replace(/\s+/g, "")),
  );

  return distinctSources.size >= 2 && distinctFigures.size >= 2 ? claims : [];
}
