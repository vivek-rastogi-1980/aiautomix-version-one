/**
 * Print palette for the PDF engine.
 *
 * Semantic tones (positive / caution / negative) are *not* duplicated here —
 * the PDF resolves them through `TONE_HEX` in the Report Engine, so a tone means
 * the same colour on screen and on paper.
 */
export const PDF_BRAND = {
  ink: "#0A0B0F",
  violet: "#7C5CFF",
  cyan: "#57C7FF",
  text: "#1A1B22",
  muted: "#5C5A68",
  line: "#E3E1EC",
  soft: "#F6F5FA",
  white: "#FFFFFF",
} as const;

/** A4 in PDF points, for reference in tests and layout maths. */
export const A4_POINTS = { width: 595.28, height: 841.89 } as const;
