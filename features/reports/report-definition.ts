import { BUSINESS_VALIDATOR_WORKFLOW } from "@/features/ai/registry/workflows";
import {
  AI_REPORT_DISCLAIMER,
  type ReportDocumentModel,
  type ReportScore,
  type ReportTone,
} from "@/features/ai/renderer/types";
import type { BusinessValidatorReport } from "@/features/ai/schemas/business-validator";

/**
 * Business Validator report definition.
 *
 * This is the workflow's entire presentation layer: it turns validated JSON
 * into the platform's `ReportDocumentModel`. The Report Engine renders it as
 * HTML and the PDF Engine renders it as A4 — neither needs to know anything
 * about business validation, and the section list exists in exactly one place.
 *
 * A future AI product ships a file like this one and gets both surfaces.
 */

/** Score bands from BUSINESS-VALIDATOR-SPEC.md. */
export function businessValidatorScoreBand(score: number): {
  label: string;
  tone: ReportTone;
} {
  if (score >= 70) return { label: "Strong", tone: "positive" };
  if (score >= 40) return { label: "Promising", tone: "caution" };
  return { label: "Weak", tone: "negative" };
}

const VERDICT: Record<
  BusinessValidatorReport["recommendation"],
  { label: string; tone: ReportTone; blurb: string }
> = {
  go: {
    label: "Go",
    tone: "positive",
    blurb: "Strong fundamentals — move forward.",
  },
  revise: {
    label: "Revise",
    tone: "caution",
    blurb: "Promising, but refine before committing.",
  },
  stop: {
    label: "Stop",
    tone: "negative",
    blurb: "Significant concerns — rethink the approach.",
  },
};

/** Weighted scoring model from BUSINESS-VALIDATOR-SPEC.md. */
const BREAKDOWN: {
  key: keyof BusinessValidatorReport["scoreBreakdown"];
  label: string;
  weight: number;
}[] = [
  { key: "marketDemand", label: "Market demand", weight: 20 },
  { key: "problemSeverity", label: "Problem severity", weight: 15 },
  { key: "revenuePotential", label: "Revenue potential", weight: 15 },
  { key: "competition", label: "Competition", weight: 15 },
  { key: "feasibility", label: "Feasibility", weight: 15 },
  { key: "innovation", label: "Innovation", weight: 10 },
  { key: "risk", label: "Risk", weight: 10 },
];

export interface BusinessValidatorReportSource {
  title: string;
  report: BusinessValidatorReport;
  /** ISO timestamp the report was generated. */
  createdAt: string;
  model: string;
  promptVersion: string;
  durationMs?: number | null;
  tokens?: number | null;
}

export function buildBusinessValidatorReportModel({
  title,
  report,
  createdAt,
  model,
  promptVersion,
  durationMs = null,
  tokens = null,
}: BusinessValidatorReportSource): ReportDocumentModel {
  const band = businessValidatorScoreBand(report.overallScore);
  const verdict = VERDICT[report.recommendation];

  const score: ReportScore = {
    value: report.overallScore,
    label: band.label,
    tone: band.tone,
    verdict,
  };

  return {
    workflow: BUSINESS_VALIDATOR_WORKFLOW,
    kicker: "Business Validation Report",
    title,
    summary: report.summary,
    score,
    disclaimer: AI_REPORT_DISCLAIMER,
    meta: {
      workflowLabel: "Business Idea Validator",
      model,
      promptVersion,
      generatedAt: createdAt,
      durationMs,
      tokens,
    },
    sections: [
      {
        id: "score",
        title: "Score breakdown",
        icon: "gauge",
        blocks: [
          {
            kind: "metrics",
            entries: BREAKDOWN.map(({ key, label, weight }) => ({
              key,
              label,
              weight,
              value: report.scoreBreakdown[key],
            })),
          },
        ],
      },
      {
        id: "problem",
        title: "Problem statement",
        icon: "clipboard",
        layout: "half",
        blocks: [{ kind: "paragraph", text: report.problemStatement }],
      },
      {
        id: "target-market",
        title: "Target market",
        icon: "target",
        layout: "half",
        blocks: [{ kind: "paragraph", text: report.targetMarket }],
      },
      {
        id: "persona",
        title: "Customer persona",
        icon: "users",
        layout: "half",
        blocks: [{ kind: "paragraph", text: report.customerPersona }],
      },
      {
        id: "market",
        title: "Market opportunity",
        icon: "trending",
        layout: "half",
        blocks: [{ kind: "paragraph", text: report.marketOpportunity }],
      },
      {
        id: "swot",
        title: "SWOT analysis",
        icon: "grid",
        blocks: [{ kind: "swot", content: report.swot }],
      },
      {
        id: "revenue",
        title: "Revenue models",
        icon: "coins",
        blocks: [
          {
            kind: "ranked",
            levelLabel: "Potential",
            entries: report.revenueModels.map((entry) => ({
              title: entry.name,
              description: entry.description,
              level: entry.potential,
            })),
          },
        ],
      },
      {
        id: "risks",
        title: "Key risks",
        icon: "shield",
        blocks: [
          {
            kind: "ranked",
            levelLabel: "Severity",
            entries: report.risks.map((risk) => ({
              title: risk.title,
              description: risk.description,
              level: risk.severity,
              footnote: { label: "Mitigation", value: risk.mitigation },
            })),
          },
        ],
      },
      {
        id: "recommendations",
        title: "Recommendations",
        icon: "lightbulb",
        blocks: [
          {
            kind: "ranked",
            levelLabel: "Priority",
            entries: report.recommendations.map((entry) => ({
              title: entry.title,
              description: entry.description,
              level: entry.priority,
            })),
          },
        ],
      },
      {
        id: "next-steps",
        title: "Next steps",
        icon: "route",
        blocks: [{ kind: "timeline", entries: report.nextSteps }],
      },
    ],
  };
}
