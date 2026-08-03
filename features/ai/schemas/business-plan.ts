import { z } from "zod";

/**
 * JSON contract for the `business-plan` workflow (BUSINESS-PLAN-SPEC.md).
 *
 * The eleven sections the spec names, each as prose. Prose — rather than nested
 * structure — is deliberate: every section must be editable by a human in a
 * textarea and versioned as a unit, and asking someone to hand-edit nested JSON
 * would make "editable sections" hostile to use.
 *
 * The AI Platform validates every model response against this schema before
 * anything is persisted.
 */

/**
 * A generated section. The floor rejects stub output ("TBD") without being so
 * strict that a legitimately terse section triggers a retry; the ceiling bounds
 * what a single run can write into one row.
 */
const sectionText = z
  .string()
  .trim()
  .min(40, "Section content is too short to be useful")
  .max(6000, "Section content is too long");

export const businessPlanSectionsSchema = z.object({
  executiveSummary: sectionText,
  marketAnalysis: sectionText,
  customerPersona: sectionText,
  competition: sectionText,
  businessModel: sectionText,
  marketing: sectionText,
  operations: sectionText,
  financials: sectionText,
  funding: sectionText,
  risks: sectionText,
  roadmap: sectionText,
});

export const businessPlanSchema = z.object({
  title: z.string().trim().min(1).max(160),
  sections: businessPlanSectionsSchema,
});

export type BusinessPlanDocument = z.infer<typeof businessPlanSchema>;
export type BusinessPlanSections = z.infer<typeof businessPlanSectionsSchema>;

/** The eleven keys the model must return. */
export type BusinessPlanSectionField = keyof BusinessPlanSections;
