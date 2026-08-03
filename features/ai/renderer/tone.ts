import type { ReportLevel, ReportTone } from "@/features/ai/renderer/types";

/**
 * Tone palette for the Report Engine.
 *
 * The document model carries semantic tones; each renderer resolves them into
 * its own vocabulary — Tailwind classes for HTML, hex values for the PDF. Class
 * names are written out in full so Tailwind's scanner can see them.
 */

export const TONE_TEXT: Record<ReportTone, string> = {
  positive: "text-brand-green",
  caution: "text-brand-cyan",
  negative: "text-danger-soft",
  neutral: "text-muted",
};

export const TONE_DOT: Record<ReportTone, string> = {
  positive: "bg-brand-green",
  caution: "bg-brand-cyan",
  negative: "bg-danger-soft",
  neutral: "bg-muted",
};

export const TONE_BAR: Record<ReportTone, string> = {
  positive: "bg-brand-green",
  caution: "bg-brand-cyan",
  negative: "bg-danger",
  neutral: "bg-white/20",
};

export const TONE_SURFACE: Record<ReportTone, string> = {
  positive: "border-brand-green/25 bg-brand-green/[0.06]",
  caution: "border-brand-cyan/25 bg-brand-cyan/[0.06]",
  negative: "border-danger/25 bg-danger/[0.06]",
  neutral: "border-white/10 bg-white/[0.03]",
};

/** Badge variants from `components/ui/badge`. */
export const TONE_BADGE: Record<
  ReportTone,
  "active" | "completed" | "archived" | "neutral"
> = {
  positive: "active",
  caution: "completed",
  negative: "archived",
  neutral: "neutral",
};

/** Hex equivalents, for the PDF renderer and inline SVG. */
export const TONE_HEX: Record<ReportTone, string> = {
  positive: "#57F2A4",
  caution: "#57C7FF",
  negative: "#FF6B6B",
  neutral: "#8B8A99",
};

/** How a priority / severity / potential level reads as colour. */
export function levelTone(level: ReportLevel): ReportTone {
  if (level === "high") return "positive";
  if (level === "medium") return "caution";
  return "neutral";
}

/**
 * Display banding for any 0–100 metric. This is a presentation convention of
 * the Report Engine, not a scoring rule — a workflow that needs different
 * thresholds supplies its own tone on the score itself.
 */
export function valueTone(value: number): ReportTone {
  if (value >= 70) return "positive";
  if (value >= 40) return "caution";
  return "negative";
}
