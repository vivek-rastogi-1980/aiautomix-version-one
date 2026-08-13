import {
  AI_REPORT_DISCLAIMER,
  type ReportBlock,
  type ReportDocumentModel,
  type ReportIconName,
  type ReportSection as ReportModelSection,
  type SourceEntry,
} from "@/features/ai/renderer/types";
import { RESEARCH_WORKFLOW_IDS } from "@/features/research/stages/workflows";
import type { ReportSection } from "@/features/research/types";
import type {
  ReportSectionContract,
  ReportSource as ReportSourceContract,
  ResearchReport,
} from "@/features/research/report/schema";

/**
 * Market Research report definition.
 *
 * The entire presentation layer for the feature: it turns the validated report
 * contract into the platform's `ReportDocumentModel`, and the existing Report
 * Engine renders that as HTML while the existing PDF Engine renders it as A4.
 * Neither renderer knows anything about market research, and the section list
 * exists in exactly one place — the same arrangement the Business Validator and
 * Business Plan already use.
 *
 * No AI runs here and no rows are read. The input is already-validated data.
 */

const SECTION_ICON: Record<ReportSection, ReportIconName> = {
  executive_summary: "clipboard",
  scope_methodology: "checklist",
  market_overview: "grid",
  market_size_growth: "trending",
  target_customer_icp: "target",
  customer_problems_needs: "users",
  industry_trends: "trending",
  demand_signals: "gauge",
  business_model_pricing: "coins",
  opportunities: "lightbulb",
  risks_challenges: "shield",
  regulatory_environmental: "shield",
  strategic_recommendations: "route",
  evidence_sources: "clipboard",
  confidence_limitations: "gauge",
};

const DEPTH_LABEL: Record<string, string> = {
  basic: "Basic",
  standard: "Standard",
  deep: "Deep",
};

const CONFIDENCE_SENTENCE: Record<string, string> = {
  high: "Findings are supported by multiple retrieved sources.",
  medium: "Findings are supported, but the evidence base is thin in places.",
  low: "The evidence base is weak. Treat the findings as leads to verify.",
  insufficient:
    "The research did not gather enough evidence to support firm conclusions.",
};

/**
 * A section's stored content as renderable blocks.
 *
 * Notices come first deliberately. A caveat printed under four paragraphs of
 * confident prose has already failed at its job.
 */
function sectionBlocks(section: ReportSectionContract): ReportBlock[] {
  const blocks: ReportBlock[] = [];

  for (const notice of section.notices) {
    blocks.push({
      kind: "callout",
      tone: notice.tone,
      title: notice.title,
      text: notice.text,
    });
  }

  if (section.narrative) {
    blocks.push({ kind: "paragraph", text: section.narrative });
  }

  if (section.findings.length) {
    blocks.push({
      kind: "findings",
      entries: section.findings.map((finding) => ({
        text: finding.text,
        kind: finding.kind,
        confidence: finding.confidence,
        citations: finding.citations.map((citation) => ({
          label: citation.label,
          ...(citation.url ? { url: citation.url } : {}),
          ...(citation.publisher ? { publisher: citation.publisher } : {}),
          ...(citation.publishedAt
            ? { publishedAt: citation.publishedAt }
            : {}),
        })),
      })),
    });
  }

  for (const list of section.lists) {
    blocks.push({ kind: "paragraph", text: list.title });
    blocks.push({ kind: "bullets", items: list.items });
  }

  if (blocks.length === 0) {
    blocks.push({
      kind: "callout",
      tone: "neutral",
      title: "Nothing stored for this section",
      text: "No stage wrote content here. This is reported rather than filled in.",
    });
  }

  return blocks;
}

/**
 * Charts, and the honest refusal to draw one.
 *
 * The only structured numeric data this pipeline stores is *about the evidence
 * base* — how many sources, of which types, and at what confidence. Those are
 * row counts, so charting them is reporting, not inference.
 *
 * Market size, growth rates and pricing are **not** charted. They exist only as
 * prose inside evidence claims, and turning a sentence into a data series means
 * guessing at units, base years and definitions. `RESEARCH-REPORT-SPEC.md`
 * forbids unsupported market-size claims; a chart is the most persuasive form
 * an unsupported claim can take, so the section says so instead.
 */
function evidenceBaseSection(report: ResearchReport): ReportModelSection {
  const { evidence } = report;
  const total = evidence.evidenceCount;

  const blocks: ReportBlock[] = [
    {
      kind: "keyValues",
      entries: [
        { label: "Sources retrieved", value: String(evidence.sourceCount) },
        { label: "Evidence items", value: String(total) },
        {
          label: "Contradictions flagged",
          value: String(evidence.contradictionCount),
        },
      ],
    },
  ];

  if (total > 0) {
    // Percentages of the evidence base — a distribution of stored rows.
    blocks.push({
      kind: "metrics",
      entries: [
        {
          key: "high",
          label: "High-confidence evidence",
          value: Math.round((evidence.byConfidence.high / total) * 100),
        },
        {
          key: "medium",
          label: "Medium-confidence evidence",
          value: Math.round((evidence.byConfidence.medium / total) * 100),
        },
        {
          key: "low",
          label: "Low-confidence evidence",
          value: Math.round((evidence.byConfidence.low / total) * 100),
        },
      ],
    });

    const types = Object.entries(evidence.bySourceType).sort(
      (a, b) => b[1] - a[1],
    );
    if (types.length && evidence.sourceCount > 0) {
      blocks.push({
        kind: "metrics",
        entries: types.slice(0, 8).map(([type, count]) => ({
          key: `type-${type}`,
          label: `${type} sources`,
          value: Math.round((count / evidence.sourceCount) * 100),
        })),
      });
    }
  } else {
    blocks.push({
      kind: "callout",
      tone: "caution",
      title: "Insufficient reliable data for visualization",
      text: "No evidence was extracted, so there is nothing to chart. Run the evidence stage, or widen the research scope.",
    });
  }

  blocks.push({
    kind: "callout",
    tone: "neutral",
    title:
      "Insufficient reliable data for visualization — market size and growth",
    text: "Market size, growth and pricing figures appear in this research only as statements inside cited sources, not as structured series with agreed units and base years. Charting them would mean inferring numbers that no source published in that form, so the figures are shown as quoted claims instead.",
  });

  if (evidence.uncitedSections.length) {
    blocks.push({
      kind: "callout",
      tone: "caution",
      title: `${evidence.uncitedSections.length} section${evidence.uncitedSections.length === 1 ? "" : "s"} carry no citations`,
      text: "Their content is reasoning over the wider evidence base rather than statements traced to a specific source.",
    });
  }

  return {
    id: "evidence-base",
    title: "Evidence Base",
    icon: "gauge",
    blocks,
  };
}

/**
 * Contract source → engine `SourceEntry`.
 *
 * Nulls become absent keys rather than empty strings, so the renderers can tell
 * "no publisher recorded" from "publisher is blank" — and the URL is re-checked
 * here because this is the last step before it becomes an `href`.
 */
function toSourceEntry(source: ReportSourceContract): SourceEntry {
  let href: string | undefined;
  try {
    const url = new URL(source.url);
    if (url.protocol === "https:" || url.protocol === "http:") {
      href = url.toString();
    }
  } catch {
    href = undefined;
  }

  return {
    title: source.title,
    ...(href ? { url: href } : {}),
    ...(source.publisher ? { publisher: source.publisher } : {}),
    ...(source.sourceType ? { sourceType: source.sourceType } : {}),
    ...(source.publishedAt ? { publishedAt: source.publishedAt } : {}),
    ...(source.retrievedAt ? { retrievedAt: source.retrievedAt } : {}),
  };
}

function contextSection(report: ResearchReport): ReportModelSection {
  const { context } = report;
  const blocks: ReportBlock[] = [
    {
      kind: "keyValues",
      entries: [
        { label: "Industry", value: context.industry ?? "Not specified" },
        { label: "Geography", value: context.geography ?? "Not specified" },
        {
          label: "Target customer",
          value: context.targetCustomer ?? "Not specified",
        },
        {
          label: "Business model",
          value: context.businessModel ?? "Not specified",
        },
        {
          label: "Research depth",
          value: DEPTH_LABEL[report.depth] ?? report.depth,
        },
        { label: "Report version", value: `v${report.version}` },
      ],
    },
  ];

  if (context.scope) {
    blocks.push({ kind: "paragraph", text: context.scope });
  }

  if (context.questions.length) {
    blocks.push({ kind: "paragraph", text: "Research questions" });
    blocks.push({ kind: "bullets", items: context.questions });
  }

  return {
    id: "research-context",
    title: "Research Context",
    icon: "clipboard",
    blocks,
  };
}

export interface ResearchReportModelSource {
  report: ResearchReport;
  model: string;
  promptVersion: string;
  durationMs?: number | null;
  tokens?: number | null;
}

export function buildResearchReportModel({
  report,
  model,
  promptVersion,
  durationMs = null,
  tokens = null,
}: ResearchReportModelSource): ReportDocumentModel {
  const byKey = new Map(
    report.sections.map((section) => [section.key, section]),
  );

  const summarySection = byKey.get("executive_summary");
  const summary =
    summarySection?.narrative ??
    "This research did not produce an executive summary.";

  const sections: ReportModelSection[] = [contextSection(report)];

  for (const section of report.sections) {
    // The executive summary is rendered by the report header and by the PDF's
    // own summary block, so repeating it as a section would print it twice.
    if (section.key === "executive_summary") continue;

    // The source index is assembled from the report's source list rather than
    // from whatever the report stage wrote into the section body.
    if (section.key === "evidence_sources") {
      sections.push(evidenceBaseSection(report));
      sections.push({
        id: "evidence_sources",
        title: section.title,
        icon: SECTION_ICON.evidence_sources,
        blocks: [
          ...(section.narrative
            ? [{ kind: "paragraph" as const, text: section.narrative }]
            : []),
          { kind: "sources", entries: report.sources.map(toSourceEntry) },
        ],
      });
      continue;
    }

    sections.push({
      id: section.key,
      title: section.title,
      icon: SECTION_ICON[section.key],
      blocks: sectionBlocks(section),
    });
  }

  return {
    workflow: RESEARCH_WORKFLOW_IDS.report,
    kicker: "Market Research Report",
    title: report.title,
    summary,
    // No score. The engine grades confidence ordinally, and a 0–100 dial on the
    // cover would imply a measurement that nothing in this pipeline made.
    disclaimer:
      `${AI_REPORT_DISCLAIMER} ${CONFIDENCE_SENTENCE[report.overallConfidence] ?? ""}`.trim(),
    meta: {
      workflowLabel: "Market Research",
      model,
      promptVersion,
      generatedAt: report.generatedAt,
      durationMs,
      tokens,
    },
    sections,
  };
}
