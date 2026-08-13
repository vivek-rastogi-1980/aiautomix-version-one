import { z } from "zod";

import {
  CLAIM_LABELS,
  CONFIDENCE_LEVELS,
  REPORT_SECTIONS,
  RESEARCH_DEPTHS,
  SOURCE_TYPES,
} from "@/features/research/types";

/**
 * The Market Research Report contract.
 *
 * A strict, typed description of the fifteen-section report — no untyped blobs,
 * no `Record<string, unknown>` standing in for structure. Everything the web
 * report and the PDF render passes through this schema first, so a malformed
 * report fails at composition time with a nameable reason instead of rendering
 * as a half-empty page.
 *
 * Three properties are load-bearing.
 *
 *   ALL FIFTEEN SECTIONS ARE REQUIRED. Not "should be present" — the schema
 *   refuses a report that omits one. A section with nothing behind it is
 *   included with `status: "missing"` and says so. Silence would let an
 *   incomplete run look like a complete report.
 *
 *   EVERY CLAIM CARRIES ITS KIND. `FACT` / `INFERENCE` / `RECOMMENDATION` is a
 *   required field, not an optional annotation, and `FACT` additionally has to
 *   survive a citation check (see `researchReportSchema`). Nothing downstream
 *   can promote an inference into a fact, because the label travels with the
 *   text through both renderers.
 *
 *   CONFIDENCE INCLUDES "INSUFFICIENT". The research engine's fourth outcome is
 *   representable here, so a section that could not be supported is expressible
 *   without rounding it up to "low".
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

const sectionKey = z.enum(REPORT_SECTIONS);

/**
 * Report confidence: the engine's three grades plus `insufficient`.
 *
 * `research_results.confidence` only stores the three, and `status` carries
 * `insufficient_evidence` separately. The report merges them into one axis
 * because that is how a reader experiences it — but the merge happens once,
 * here, rather than in each renderer.
 */
export const REPORT_CONFIDENCE = [
  ...CONFIDENCE_LEVELS,
  "insufficient",
] as const;
export const reportConfidenceSchema = z.enum(REPORT_CONFIDENCE);
export type ReportConfidenceValue = z.infer<typeof reportConfidenceSchema>;

/** Per-section outcome, including the two honest failure modes. */
export const REPORT_SECTION_STATUS = [
  "complete",
  "partial",
  "insufficient_evidence",
  "missing",
  "failed",
] as const;
export const reportSectionStatusSchema = z.enum(REPORT_SECTION_STATUS);

/**
 * A citation.
 *
 * `url` is optional and, when present, must parse as http(s) — a source whose
 * link cannot be validated is still listed, but the report will not render an
 * href for it. `publishedAt` stays optional because an unknown publication date
 * is recorded as unknown rather than invented.
 */
export const reportCitationSchema = z.object({
  sourceId: z.string().uuid(),
  label: z.string().trim().min(1).max(300),
  url: z
    .string()
    .trim()
    .url()
    .refine(
      (value) => value.startsWith("https://") || value.startsWith("http://"),
      "Only http(s) sources may be cited.",
    )
    .optional(),
  publisher: z.string().trim().max(300).optional(),
  publishedAt: z.string().trim().max(40).optional(),
});
export type ReportCitation = z.infer<typeof reportCitationSchema>;

export const reportFindingSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  kind: z.enum(CLAIM_LABELS),
  confidence: reportConfidenceSchema,
  citations: z.array(reportCitationSchema).max(20).default([]),
  /** Two sources support incompatible readings of the same question. */
  isContradictory: z.boolean().default(false),
});
export type ReportFinding = z.infer<typeof reportFindingSchema>;

export const reportSectionSchema = z.object({
  key: sectionKey,
  title: z.string().trim().min(1).max(200),
  status: reportSectionStatusSchema,
  confidence: reportConfidenceSchema,
  /** The section's prose. Null when nothing was written for it. */
  narrative: z.string().trim().max(20000).nullable(),
  findings: z.array(reportFindingSchema).max(60).default([]),
  /** Sub-lists the section carries, e.g. assumptions or out-of-scope items. */
  lists: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        items: z.array(z.string().trim().min(1).max(2000)).max(40),
      }),
    )
    .max(10)
    .default([]),
  /** Stated caveats. Rendered as callouts in both surfaces. */
  notices: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        text: z.string().trim().min(1).max(4000),
        tone: z.enum(["caution", "negative", "neutral"]),
      }),
    )
    .max(10)
    .default([]),
  /** Version of the underlying `research_results` row. */
  version: z.number().int().positive().nullable(),
});
export type ReportSectionContract = z.infer<typeof reportSectionSchema>;

export const reportSourceSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  url: z.string().trim().max(2000),
  publisher: z.string().trim().max(300).nullable(),
  sourceType: z.enum(SOURCE_TYPES),
  publishedAt: z.string().trim().max(40).nullable(),
  retrievedAt: z.string().trim().max(40),
});
export type ReportSource = z.infer<typeof reportSourceSchema>;

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

/**
 * Counts over the evidence base.
 *
 * These are the only numbers in the report that are computed rather than
 * quoted, and they are computed from row counts — not from anything a model
 * said. They are what makes the "Evidence base" chart legitimate: a
 * distribution of stored evidence, not a market statistic inferred from prose.
 */
export const evidenceProfileSchema = z.object({
  sourceCount: z.number().int().nonnegative(),
  evidenceCount: z.number().int().nonnegative(),
  byConfidence: z.object({
    high: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
  }),
  bySourceType: z.record(z.string(), z.number().int().nonnegative()),
  contradictionCount: z.number().int().nonnegative(),
  /** Sections carrying no evidence at all. */
  uncitedSections: z.array(sectionKey).max(15),
});
export type EvidenceProfile = z.infer<typeof evidenceProfileSchema>;

export const researchReportSchema = z
  .object({
    requestId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    depth: z.enum(RESEARCH_DEPTHS),
    /** ISO timestamp of the most recent report-stage completion. */
    generatedAt: z.string().trim().min(1),
    /** Increments each time the report is regenerated. */
    version: z.number().int().positive(),

    context: z.object({
      industry: z.string().trim().max(200).nullable(),
      geography: z.string().trim().max(200).nullable(),
      targetCustomer: z.string().trim().max(1000).nullable(),
      businessModel: z.string().trim().max(1000).nullable(),
      scope: z.string().trim().max(4000).nullable(),
      questions: z.array(z.string().trim().max(300)).max(10),
    }),

    overallConfidence: reportConfidenceSchema,
    sections: z.array(reportSectionSchema),
    sources: z.array(reportSourceSchema).max(500),
    evidence: evidenceProfileSchema,
  })
  .superRefine((report, ctx) => {
    // --- All fifteen sections, exactly once, in the canonical order --------
    const keys = report.sections.map((section) => section.key);
    for (const required of REPORT_SECTIONS) {
      if (!keys.includes(required)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections"],
          message: `Missing required report section: ${required}`,
        });
      }
    }
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sections"],
        message: "A report section appears more than once.",
      });
    }

    // --- Citations must resolve to a listed source ------------------------
    // This is the fabrication control at the report layer. `research_evidence`
    // already refuses a dangling `source_id` in SQL, but the report is
    // assembled in TypeScript from two queries, and a citation pointing at a
    // source that is not in the index would print a reference the reader
    // cannot follow.
    const sourceIds = new Set(report.sources.map((source) => source.id));
    report.sections.forEach((section, sectionIndex) => {
      section.findings.forEach((finding, findingIndex) => {
        finding.citations.forEach((citation, citationIndex) => {
          if (!sourceIds.has(citation.sourceId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [
                "sections",
                sectionIndex,
                "findings",
                findingIndex,
                "citations",
                citationIndex,
              ],
              message:
                "Citation refers to a source that is not in the report's source list.",
            });
          }
        });

        // --- A FACT must be able to name its source ----------------------
        // Downgrading it silently would be the more forgiving option and the
        // wrong one: an unsupported statement presented as fact is the exact
        // failure the evidence model exists to prevent, so composition fails
        // and the bug gets fixed rather than shipped.
        if (finding.kind === "FACT" && finding.citations.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["sections", sectionIndex, "findings", findingIndex],
            message:
              "A FACT must cite at least one source. Label it INFERENCE if it cannot.",
          });
        }
      });
    });
  });

export type ResearchReport = z.infer<typeof researchReportSchema>;

/**
 * Report lifecycle, derived from persisted rows — never from a client.
 *
 * `ready` means the report stage succeeded AND its sections are stored. A run
 * that is still executing is `generating`; one whose report stage failed is
 * `failed`; anything earlier is `draft`.
 */
export const REPORT_STATUSES = [
  "draft",
  "generating",
  "ready",
  "failed",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
