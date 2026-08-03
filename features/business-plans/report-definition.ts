import { BUSINESS_PLAN_WORKFLOW } from "@/features/ai/registry/workflows";
import {
  AI_REPORT_DISCLAIMER,
  type ReportBlock,
  type ReportDocumentModel,
  type ReportSection,
} from "@/features/ai/renderer/types";
import { splitParagraphs } from "@/features/business-plans/paragraphs";
import { getPlanSection } from "@/features/business-plans/sections";
import type { BusinessPlan, BusinessPlanSection } from "@/types/database";

/**
 * Business plan report definition.
 *
 * The plan's entire presentation layer: it maps stored rows onto the platform's
 * `ReportDocumentModel`, which the Report Engine renders as HTML and the PDF
 * Engine renders as branded A4. Neither engine knows what a business plan is.
 *
 * Content comes from `business_plan_sections`, not from the original model
 * response, so an exported plan always reflects the user's edits.
 */

const EXECUTIVE_SUMMARY_KEY = "executive-summary";

function toParagraphBlocks(content: string): ReportBlock[] {
  return splitParagraphs(content).map((text) => ({ kind: "paragraph", text }));
}

export interface BusinessPlanReportSource {
  plan: BusinessPlan;
  sections: BusinessPlanSection[];
}

export function buildBusinessPlanReportModel({
  plan,
  sections,
}: BusinessPlanReportSource): ReportDocumentModel {
  const ordered = [...sections].sort((a, b) => a.position - b.position);

  // Both renderers already print `summary` under an "Executive summary"
  // heading, so that section is lifted out of the section list rather than
  // rendered twice. Reading it from the row keeps it current after an edit.
  const executiveSummary = ordered.find(
    (section) => section.section_key === EXECUTIVE_SUMMARY_KEY,
  );

  const body: ReportSection[] = ordered
    .filter((section) => section.section_key !== EXECUTIVE_SUMMARY_KEY)
    .map((section) => ({
      id: section.section_key,
      title: section.title,
      icon: getPlanSection(section.section_key)?.icon,
      blocks: toParagraphBlocks(section.content),
    }));

  return {
    workflow: BUSINESS_PLAN_WORKFLOW,
    kicker: "Business Plan",
    title: plan.title,
    summary: executiveSummary?.content ?? plan.summary ?? "",
    sections: body,
    disclaimer: AI_REPORT_DISCLAIMER,
    meta: {
      workflowLabel: "Business Plan Generator",
      model: plan.model,
      promptVersion: plan.prompt_version,
      generatedAt: plan.created_at,
    },
  };
}
