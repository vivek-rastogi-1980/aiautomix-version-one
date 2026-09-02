import type { BusinessValidatorReport } from "@/features/ai/schemas/business-validator";
import { businessIdeaSchema } from "@/lib/validations/business-idea";
import type { BusinessPlanInput } from "@/lib/validations/business-plan";

/**
 * Turn a completed validation report into a starting brief for the Business
 * Plan Generator.
 *
 * ---------------------------------------------------------------------------
 * Where each field actually comes from
 * ---------------------------------------------------------------------------
 * The two schemas overlap almost exactly. `businessIdeaSchema` and
 * `businessPlanInputSchema` share nine fields by the same names and types —
 * businessName, ideaDescription, industry, country, targetAudience,
 * businessModel, currentStage, estimatedBudget, and the optional timeline /
 * competitors / additionalNotes. That is not a coincidence; the plan schema
 * says it reuses the validator's enums so "a plan generated from a validated
 * idea should describe the same business in the same vocabulary".
 *
 * So the customer's ORIGINAL SUBMISSION is the source for those nine, not the
 * model's report. This matters: those are facts the customer stated about
 * their own business. Re-deriving "industry" or "country" from generated prose
 * would risk replacing what they told us with what a model inferred.
 *
 * The REPORT contributes what the submission could not: the verdict, the score,
 * the problem statement, the market read, the SWOT and the recommendations.
 * `businessPlanInputSchema` has no field for any of those, and inventing
 * columns for them would mean rebuilding the generator's contract — explicitly
 * out of scope. They are folded into `additionalNotes`, which is the field the
 * prompt already forwards for exactly this kind of context.
 *
 * ---------------------------------------------------------------------------
 * What is deliberately left blank
 * ---------------------------------------------------------------------------
 * `fundingGoal` and `teamSummary` have no honest source in either the
 * submission or the report. They are left empty for the customer to fill in
 * rather than guessed at. A plausible-looking fabricated funding target is
 * worse than an empty box, because the customer may not notice it is invented.
 *
 * Nothing here is authoritative. Everything it produces lands in an editable
 * form, and the customer can change any of it before generating.
 */

/** Cap a list so one long report cannot push the brief past the field's max. */
function bullets(items: string[], limit: number): string {
  return items
    .slice(0, limit)
    .map((item) => `- ${item}`)
    .join("\n");
}

const RECOMMENDATION_LABEL: Record<
  BusinessValidatorReport["recommendation"],
  string
> = {
  go: "Proceed",
  revise: "Proceed with revisions",
  stop: "Reconsider",
};

/**
 * The findings paragraph appended to the brief.
 *
 * Trimmed to the schema's 2,000-character ceiling for `additionalNotes`. The
 * truncation is by whole sections rather than mid-sentence, so what survives
 * is always readable.
 */
export function validationFindingsNote(
  report: BusinessValidatorReport,
): string {
  const parts = [
    `VALIDATION SUMMARY (score ${report.overallScore}/100 — ${RECOMMENDATION_LABEL[report.recommendation]})`,
    report.summary,
    "",
    `PROBLEM: ${report.problemStatement}`,
    `TARGET MARKET: ${report.targetMarket}`,
    `CUSTOMER: ${report.customerPersona}`,
    `MARKET OPPORTUNITY: ${report.marketOpportunity}`,
    "",
    "STRENGTHS",
    bullets(report.swot.strengths, 4),
    "WEAKNESSES",
    bullets(report.swot.weaknesses, 4),
    "OPPORTUNITIES",
    bullets(report.swot.opportunities, 4),
    "THREATS",
    bullets(report.swot.threats, 4),
    "",
    "REVENUE MODELS IDENTIFIED",
    bullets(
      report.revenueModels.map(
        (m) => `${m.name} (${m.potential}): ${m.description}`,
      ),
      3,
    ),
    "",
    "KEY RECOMMENDATIONS",
    bullets(
      report.recommendations.map(
        (r) => `${r.title} (${r.priority}): ${r.description}`,
      ),
      4,
    ),
  ];

  let note = "";
  for (const part of parts) {
    const next = note === "" ? part : `${note}\n${part}`;
    // 2,000 is the schema ceiling; stop before crossing it rather than slicing
    // a sentence in half.
    if (next.length > 1_980) break;
    note = next;
  }
  return note.trim();
}

export interface ValidationPrefill {
  /** Every field the form should render pre-filled. */
  values: Partial<BusinessPlanInput>;
  /** Fields with no honest source, left for the customer. */
  blank: string[];
}

/**
 * Build the prefill for `/plans/new?validation_report_id=…`.
 *
 * `ideaPayload` is `business_ideas.payload_json` — the customer's own
 * submission. It is re-parsed with the schema that wrote it rather than
 * trusted: a payload stored by an older prompt version may not match today's
 * shape, and a partial parse is better than a crash on a page whose whole job
 * is to be a starting point.
 */
export function validationReportToBusinessPlanInput({
  report,
  ideaPayload,
  businessIdeaId,
  ideaTitle,
}: {
  report: BusinessValidatorReport;
  ideaPayload: unknown;
  businessIdeaId: string | null;
  ideaTitle: string | null;
}): ValidationPrefill {
  // `.partial()` because the goal is to carry across whatever is legible, not
  // to reject the whole prefill over one field an old payload is missing.
  const parsed = businessIdeaSchema.partial().safeParse(ideaPayload ?? {});
  const idea = parsed.success ? parsed.data : {};

  const values: Partial<BusinessPlanInput> = {
    businessName: idea.businessName ?? ideaTitle ?? undefined,
    ideaDescription: idea.ideaDescription,
    industry: idea.industry,
    country: idea.country,
    targetAudience: idea.targetAudience,
    businessModel: idea.businessModel,
    currentStage: idea.currentStage,
    estimatedBudget: idea.estimatedBudget,
    timeline: idea.timeline,
    competitors: idea.competitors,
    // The customer's own notes first, then the validation findings under a
    // heading, so neither is lost.
    additionalNotes: [idea.additionalNotes, validationFindingsNote(report)]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join("\n\n")
      .slice(0, 2_000),
    projectId: idea.projectId,
    businessIdeaId: businessIdeaId ?? undefined,
  };

  return {
    values,
    // Named so the UI can say which boxes are intentionally empty rather than
    // letting the customer wonder whether the prefill failed.
    blank: ["fundingGoal", "teamSummary"],
  };
}
