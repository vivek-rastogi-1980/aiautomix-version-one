import { z } from "zod";

import {
  REPORT_SECTIONS,
  CONFIDENCE_LEVELS,
  CLAIM_LABELS,
  SOURCE_TYPES,
} from "@/features/research/types";

/**
 * Typed contracts for the seven research stages.
 *
 * Every stage has its own input and output schema. A single loose schema shared
 * across all seven would mean the Response Validator could not tell a planning
 * result from a report, and a stage that returned the wrong shape would persist
 * silently — which is exactly the failure the validator exists to catch.
 *
 * Two rules run through all of them:
 *
 *   No URLs in model output. Sources come from provider citations
 *   (`WorkflowRunResult.sources`), never from a field the model filled in. The
 *   discovery schema therefore asks for *queries* and *findings*, not links.
 *
 *   Uncertainty is representable. Every analytical shape can say
 *   "insufficient evidence" rather than being forced to produce a number.
 */

const sectionKey = z.enum(REPORT_SECTIONS);
const confidence = z.enum(CONFIDENCE_LEVELS);
const claimLabel = z.enum(CLAIM_LABELS);

const shortText = z.string().trim().min(1).max(2000);
const longText = z.string().trim().min(1).max(8000);

// ---------------------------------------------------------------------------
// 1. Planning
// ---------------------------------------------------------------------------

export const planningInputSchema = z.object({
  title: shortText,
  scope: z.string().max(4000).optional(),
  industry: z.string().max(200).optional(),
  geography: z.string().max(200).optional(),
  targetCustomer: z.string().max(1000).optional(),
  businessModel: z.string().max(1000).optional(),
  questions: z.array(z.string().max(500)).max(20).default([]),
  depth: z.string(),
});
export type PlanningInput = z.infer<typeof planningInputSchema>;

export const planningOutputSchema = z.object({
  researchQuestions: z.array(shortText).min(1).max(12),
  /** What the searches should look for — feeds the discovery stage. */
  searchStrategies: z.array(shortText).min(1).max(12),
  scopeSummary: longText,
  assumptions: z.array(shortText).max(10).default([]),
  outOfScope: z.array(shortText).max(10).default([]),
});
export type PlanningOutput = z.infer<typeof planningOutputSchema>;

// ---------------------------------------------------------------------------
// 2. Discovery  (retrieval stage)
// ---------------------------------------------------------------------------

export const discoveryInputSchema = z.object({
  researchQuestions: z.array(z.string()).min(1),
  searchStrategies: z.array(z.string()).min(1),
  industry: z.string().optional(),
  geography: z.string().optional(),
  maxSources: z.number().int().positive(),
});
export type DiscoveryInput = z.infer<typeof discoveryInputSchema>;

/**
 * Note the absence of a `urls` field.
 *
 * The model reports what it *found*; the URLs arrive separately, from the
 * provider's citation metadata. Asking the model for links here would reopen
 * the fabrication hole the whole design closes.
 */
export const discoveryOutputSchema = z.object({
  findings: z
    .array(
      z.object({
        summary: shortText,
        relatesTo: z.string().max(500).optional(),
      }),
    )
    .max(40)
    .default([]),
  queriesUsed: z.array(z.string().max(300)).max(20).default([]),
  /** Set when the searches genuinely returned nothing usable. */
  insufficientEvidence: z.boolean().default(false),
  notes: z.string().max(4000).optional(),
});
export type DiscoveryOutput = z.infer<typeof discoveryOutputSchema>;

// ---------------------------------------------------------------------------
// 3. Collection  (retrieval stage)
// ---------------------------------------------------------------------------

export const collectionInputSchema = z.object({
  researchQuestions: z.array(z.string()).min(1),
  knownSources: z
    .array(z.object({ url: z.string(), title: z.string().nullable() }))
    .max(60)
    .default([]),
  maxSources: z.number().int().positive(),
});
export type CollectionInput = z.infer<typeof collectionInputSchema>;

export const collectionOutputSchema = z.object({
  /**
   * Classification of sources the provider retrieved, keyed by URL so the
   * server can match them to citation records. A URL here that the provider
   * never returned is discarded rather than trusted.
   */
  classifications: z
    .array(
      z.object({
        url: z.string().max(2000),
        sourceType: z.enum(SOURCE_TYPES).default("web"),
        relevance: confidence.default("medium"),
        /** Only if the page itself states one. Never inferred. */
        publishedAt: z.string().max(40).nullable().default(null),
      }),
    )
    .max(60)
    .default([]),
  insufficientEvidence: z.boolean().default(false),
});
export type CollectionOutput = z.infer<typeof collectionOutputSchema>;

// ---------------------------------------------------------------------------
// 4. Evidence
// ---------------------------------------------------------------------------

export const evidenceInputSchema = z.object({
  researchQuestions: z.array(z.string()).min(1),
  sources: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().nullable(),
        publisher: z.string().nullable(),
      }),
    )
    .min(1),
});
export type EvidenceInput = z.infer<typeof evidenceInputSchema>;

export const evidenceOutputSchema = z.object({
  evidence: z
    .array(
      z.object({
        /** Must match a source URL supplied in the input. Checked server-side. */
        sourceUrl: z.string().max(2000),
        sectionKey,
        claim: shortText,
        evidenceReference: z.string().max(1000).optional(),
        confidence,
        label: claimLabel.default("FACT"),
        isContradictory: z.boolean().default(false),
      }),
    )
    .max(120)
    .default([]),
  unsupportedClaims: z.array(shortText).max(20).default([]),
  contradictions: z.array(shortText).max(20).default([]),
});
export type EvidenceOutput = z.infer<typeof evidenceOutputSchema>;

// ---------------------------------------------------------------------------
// 5. Analysis
// ---------------------------------------------------------------------------

const analysisSection = z.object({
  sectionKey,
  summary: longText,
  points: z
    .array(
      z.object({
        text: shortText,
        label: claimLabel,
        /** Present for FACT; absent for INFERENCE and RECOMMENDATION. */
        sourceUrl: z.string().max(2000).optional(),
      }),
    )
    .max(20)
    .default([]),
  confidence,
  /** True when the evidence could not support this section. */
  insufficientEvidence: z.boolean().default(false),
});

export const analysisInputSchema = z.object({
  researchQuestions: z.array(z.string()).min(1),
  evidence: z
    .array(
      z.object({
        sectionKey: z.string(),
        claim: z.string(),
        sourceUrl: z.string(),
        confidence: z.string(),
      }),
    )
    .default([]),
  industry: z.string().optional(),
  geography: z.string().optional(),
});
export type AnalysisInput = z.infer<typeof analysisInputSchema>;

export const analysisOutputSchema = z.object({
  sections: z.array(analysisSection).min(1).max(12),
});
export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;

// ---------------------------------------------------------------------------
// 6. Synthesis
// ---------------------------------------------------------------------------

export const synthesisInputSchema = z.object({
  sections: z
    .array(z.object({ sectionKey: z.string(), summary: z.string() }))
    .min(1),
  evidenceCount: z.number().int().nonnegative(),
  sourceCount: z.number().int().nonnegative(),
});
export type SynthesisInput = z.infer<typeof synthesisInputSchema>;

export const synthesisOutputSchema = z.object({
  majorFindings: z.array(shortText).min(1).max(10),
  strongestEvidence: z.array(shortText).max(10).default([]),
  uncertainties: z.array(shortText).max(10).default([]),
  opportunities: z.array(shortText).max(10).default([]),
  risks: z.array(shortText).max(10).default([]),
  strategicImplications: z.array(shortText).max(10).default([]),
  recommendedNextActions: z.array(shortText).max(10).default([]),
  overallConfidence: confidence,
});
export type SynthesisOutput = z.infer<typeof synthesisOutputSchema>;

// ---------------------------------------------------------------------------
// 7. Report
// ---------------------------------------------------------------------------

export const reportInputSchema = z.object({
  title: z.string(),
  sections: z
    .array(z.object({ sectionKey: z.string(), summary: z.string() }))
    .default([]),
  synthesis: z.object({
    majorFindings: z.array(z.string()),
    uncertainties: z.array(z.string()),
    overallConfidence: z.string(),
  }),
  sourceCount: z.number().int().nonnegative(),
  evidenceCount: z.number().int().nonnegative(),
});
export type ReportInput = z.infer<typeof reportInputSchema>;

/**
 * The report stage assembles rather than writes.
 *
 * It emits the four sections that are genuinely derived from the rest of the
 * report — summary, methodology, evidence index, confidence — and leaves the
 * ten analytical sections exactly as the analysis stage stored them. Asking a
 * model to restate work it has already done is how a report drifts from its
 * own evidence.
 */
export const reportOutputSchema = z.object({
  executiveSummary: longText,
  scopeMethodology: longText,
  confidenceLimitations: longText,
  evidenceSummary: longText,
  overallConfidence: confidence,
});
export type ReportOutput = z.infer<typeof reportOutputSchema>;

/** Section keys the report stage itself is responsible for. */
export const REPORT_STAGE_SECTIONS = [
  "executive_summary",
  "scope_methodology",
  "evidence_sources",
  "confidence_limitations",
] as const;

export { sectionKey as sectionKeySchema };
