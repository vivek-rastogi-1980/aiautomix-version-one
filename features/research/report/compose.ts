import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  REPORT_SECTIONS,
  SECTION_TITLES,
  isReportSection,
  isResearchDepth,
  type ReportSection,
} from "@/features/research/types";
import { canonicalise } from "@/features/research/stages/mapping";
import { findMarketSizeDivergence } from "@/features/research/report/market-size";
import {
  researchReportSchema,
  type EvidenceProfile,
  type ReportCitation,
  type ReportConfidenceValue,
  type ReportFinding,
  type ReportSectionContract,
  type ReportSource,
  type ReportStatus,
  type ResearchReport,
} from "@/features/research/report/schema";
import type {
  ResearchEvidenceRow,
  ResearchResultRow,
  ResearchRunRow,
  ResearchSourceRow,
} from "@/types/database";

/**
 * Composes the Market Research Report from what is already stored.
 *
 * This module reads rows. It does not call a model, does not reach the network
 * and does not re-run a stage — which is what makes report regeneration cheap
 * and what stops a page view from costing credits. Everything it produces is
 * traceable to a `research_results`, `research_evidence` or `research_sources`
 * row that some stage persisted earlier.
 *
 * The one thing it is allowed to compute is counts over the evidence base.
 * Those are row counts, not market statistics, and they are the only numbers in
 * the report that were not quoted from a source.
 */

const MAX_SOURCES = 500;
const MAX_EVIDENCE = 800;

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * Report lifecycle, derived from persisted rows.
 *
 * `ready` requires BOTH a succeeded report stage and the executive summary row
 * it writes. Reporting `ready` from the stage alone would let a persistence
 * failure show a finished report with a missing first section.
 */
export function deriveReportStatus(
  run: ResearchRunRow | null,
  reportStageStatuses: string[],
  hasExecutiveSummary: boolean,
): ReportStatus {
  if (reportStageStatuses.includes("succeeded")) {
    return hasExecutiveSummary ? "ready" : "failed";
  }
  if (reportStageStatuses.includes("running")) return "generating";
  if (reportStageStatuses.includes("failed")) return "failed";
  if (run?.status === "failed") return "failed";
  return "draft";
}

// ---------------------------------------------------------------------------
// Narrowing helpers
// ---------------------------------------------------------------------------

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function strList(value: unknown, max = 40): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => str(item, 2000))
    .filter((item): item is string => item !== null)
    .slice(0, max);
}

/**
 * Merge a section's stored confidence and status onto one axis.
 *
 * `insufficient_evidence` wins over whatever confidence grade the row carries:
 * a section the sources could not support is not "medium confidence", it is
 * unsupported, and the report says so in one word.
 */
function sectionConfidence(
  row: ResearchResultRow | undefined,
): ReportConfidenceValue {
  if (!row) return "insufficient";
  if (row.status === "insufficient_evidence") return "insufficient";
  if (row.confidence === "high") return "high";
  if (row.confidence === "medium") return "medium";
  if (row.confidence === "low") return "low";
  return "insufficient";
}

function sectionStatus(
  row: ResearchResultRow | undefined,
): ReportSectionContract["status"] {
  if (!row) return "missing";
  if (
    row.status === "complete" ||
    row.status === "partial" ||
    row.status === "insufficient_evidence" ||
    row.status === "failed"
  ) {
    return row.status;
  }
  return "partial";
}

/** Only http(s) links become citations the reader can follow. */
function safeUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function citationFor(source: ResearchSourceRow): ReportCitation {
  const url = safeUrl(source.url);
  let host = "";
  try {
    host = new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    host = "source";
  }

  return {
    sourceId: source.id,
    label: source.title?.trim() || source.publisher?.trim() || host,
    ...(url ? { url } : {}),
    ...(source.publisher?.trim() ? { publisher: source.publisher.trim() } : {}),
    // A missing publication date stays missing. The retrieval date is a
    // different fact and substituting it would overstate how current the
    // evidence is.
    ...(source.published_at
      ? { publishedAt: source.published_at.slice(0, 10) }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Section assembly
// ---------------------------------------------------------------------------

interface SectionInput {
  key: ReportSection;
  row: ResearchResultRow | undefined;
  evidence: { row: ResearchEvidenceRow; source: ResearchSourceRow }[];
  sourcesById: Map<string, ResearchSourceRow>;
  sourcesByCanonical: Map<string, ResearchSourceRow>;
}

function buildSection({
  key,
  row,
  evidence,
  sourcesByCanonical,
}: SectionInput): ReportSectionContract {
  const content = (row?.structured_content ?? {}) as Record<string, unknown>;

  const narrative =
    str(content.text, 20000) ??
    str(content.summary, 20000) ??
    str(content.scopeSummary, 20000);

  const findings: ReportFinding[] = [];

  // --- The analyst's labelled points ------------------------------------
  // These carry an explicit FACT / INFERENCE / RECOMMENDATION from the
  // analysis contract, so the label is quoted rather than assigned.
  if (Array.isArray(content.points)) {
    for (const item of content.points) {
      if (!item || typeof item !== "object") continue;
      const point = item as Record<string, unknown>;
      const text = str(point.text, 2000);
      if (!text) continue;

      const rawKind = point.label;
      const kind =
        rawKind === "FACT" || rawKind === "RECOMMENDATION"
          ? rawKind
          : "INFERENCE";

      const sourceUrl = str(point.sourceUrl, 2000);
      const matched = sourceUrl
        ? sourcesByCanonical.get(canonicalise(sourceUrl))
        : undefined;
      const citations = matched ? [citationFor(matched)] : [];

      findings.push({
        text,
        // A point labelled FACT whose URL matched nothing cannot be presented
        // as a fact: the schema would reject it, and downgrading here is the
        // honest resolution rather than dropping the statement entirely.
        kind: kind === "FACT" && citations.length === 0 ? "INFERENCE" : kind,
        confidence: sectionConfidence(row),
        citations,
        isContradictory: false,
      });
    }
  }

  // --- Extracted evidence ------------------------------------------------
  // Each row is, by construction, a claim tied to a stored source
  // (`source_id` is NOT NULL), so FACT is accurate rather than generous.
  // Included only where the analyst wrote no points, so the section shows its
  // evidence instead of nothing.
  if (findings.length === 0) {
    for (const item of evidence) {
      findings.push({
        text: item.row.claim,
        kind: "FACT",
        confidence:
          item.row.confidence === "high"
            ? "high"
            : item.row.confidence === "medium"
              ? "medium"
              : "low",
        citations: [citationFor(item.source)],
        isContradictory: item.row.is_contradictory,
      });
    }
  }

  const lists: ReportSectionContract["lists"] = [];
  const pushList = (title: string, value: unknown) => {
    const items = strList(value);
    if (items.length) lists.push({ title, items });
  };

  pushList("Research questions", content.researchQuestions);
  pushList("Search strategy", content.searchStrategies);
  pushList("Assumptions", content.assumptions);
  pushList("Out of scope", content.outOfScope);
  pushList("Key conclusions", content.majorFindings);
  pushList("Strongest evidence", content.strongestEvidence);
  pushList("Strategic implications", content.strategicImplications);
  pushList("Opportunities", content.opportunities);
  pushList("Risks", content.risks);
  pushList("Recommended actions", content.recommendedNextActions);
  pushList("Open uncertainties", content.uncertainties);

  const notices: ReportSectionContract["notices"] = [];

  if (!row) {
    notices.push({
      title: "Section not generated",
      text: "No stage wrote this section. Run the remaining research stages, or regenerate the report once the analysis is complete.",
      tone: "neutral",
    });
  } else if (row.status === "insufficient_evidence") {
    notices.push({
      title: "Insufficient evidence",
      text: "The sources retrieved did not support this section. Treat anything below as unverified and widen the research scope if you need a firm answer.",
      tone: "caution",
    });
  }

  // Claims the evidence stage could not support, and sources that disagree.
  const unsupported = strList(content.unsupportedClaims, 20);
  if (unsupported.length) {
    notices.push({
      title: `${unsupported.length} claim${unsupported.length === 1 ? "" : "s"} the sources did not support`,
      text: unsupported.join("\n"),
      tone: "caution",
    });
  }
  const contradictions = strList(content.contradictions, 20);
  if (contradictions.length) {
    notices.push({
      title: "Sources contradict each other",
      text: contradictions.join("\n"),
      tone: "negative",
    });
  }

  // --- Market size: show the disagreement, never resolve it -------------
  if (key === "market_size_growth") {
    const divergence = findMarketSizeDivergence(findings);
    if (divergence.length) {
      notices.push({
        title: "Published estimates vary materially",
        text: [
          ...divergence.map((claim) => `${claim.sourceLabel}: ${claim.figure}`),
          "",
          "AIAutoMix does not select between these. Treat the range as the finding and check the definitions and base years each source used.",
        ].join("\n"),
        tone: "caution",
      });
    }
  }

  const contradictoryFindings = findings.filter((f) => f.isContradictory);
  if (contradictoryFindings.length) {
    notices.push({
      title: `${contradictoryFindings.length} contradictory finding${contradictoryFindings.length === 1 ? "" : "s"}`,
      text: "At least one source disagrees with another on this section. Both readings are shown; neither has been chosen for you.",
      tone: "negative",
    });
  }

  return {
    key,
    title: SECTION_TITLES[key],
    status: sectionStatus(row),
    confidence: sectionConfidence(row),
    narrative,
    findings: findings.slice(0, 60),
    lists: lists.slice(0, 10),
    notices: notices.slice(0, 10),
    version: row?.version ?? null,
  };
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export interface ComposedReport {
  report: ResearchReport;
  status: ReportStatus;
}

export interface ReportCompositionFailure {
  report: null;
  status: ReportStatus;
  /** Why the report could not be assembled. Safe to show a user. */
  reason: string;
}

/**
 * Assemble and validate the report for a research request.
 *
 * Returns a failure rather than throwing, because "this research has not
 * produced a report yet" is an ordinary state the page has to draw — not an
 * exception. A validation failure, by contrast, is a bug: the reason is logged
 * in full and the user is told the report could not be assembled.
 */
export async function composeResearchReport(
  workspaceId: string,
  requestId: string,
): Promise<ComposedReport | ReportCompositionFailure> {
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("research_requests")
    .select("*")
    .eq("id", requestId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!request) {
    return { report: null, status: "draft", reason: "Research not found." };
  }

  const { data: run } = await supabase
    .from("research_runs")
    .select("*")
    .eq("research_request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [results, sources, evidence, reportStages] = await Promise.all([
    supabase
      .from("research_results")
      .select("*")
      .eq("research_request_id", requestId)
      .eq("is_current", true),
    supabase
      .from("research_sources")
      .select("*")
      .eq("research_request_id", requestId)
      .neq("status", "rejected")
      .order("created_at", { ascending: true })
      .limit(MAX_SOURCES),
    supabase
      .from("research_evidence")
      .select("*")
      .eq("research_request_id", requestId)
      .limit(MAX_EVIDENCE),
    run
      ? supabase
          .from("research_run_stages")
          .select("status")
          .eq("run_id", run.id)
          .eq("stage", "report")
      : Promise.resolve({ data: [] as { status: string }[] }),
  ]);

  const resultRows = (results.data ?? []) as ResearchResultRow[];
  const sourceRows = (sources.data ?? []) as ResearchSourceRow[];
  const evidenceRows = (evidence.data ?? []) as ResearchEvidenceRow[];
  const stageStatuses = (reportStages.data ?? []).map((row) => row.status);

  const byKey = new Map<ReportSection, ResearchResultRow>();
  for (const row of resultRows) {
    if (isReportSection(row.section_key)) byKey.set(row.section_key, row);
  }

  const status = deriveReportStatus(
    (run ?? null) as ResearchRunRow | null,
    stageStatuses,
    byKey.has("executive_summary"),
  );

  if (status !== "ready") {
    return {
      report: null,
      status,
      reason:
        status === "generating"
          ? "The report stage is still running."
          : status === "failed"
            ? "The report stage did not complete."
            : "The research has not reached the report stage yet.",
    };
  }

  // --- Indexes ------------------------------------------------------------
  const sourcesById = new Map(sourceRows.map((row) => [row.id, row]));
  const sourcesByCanonical = new Map(
    sourceRows.map((row) => [row.canonical_url, row]),
  );

  const evidenceBySection = new Map<
    ReportSection,
    { row: ResearchEvidenceRow; source: ResearchSourceRow }[]
  >();
  for (const row of evidenceRows) {
    if (!isReportSection(row.section_key)) continue;
    const source = sourcesById.get(row.source_id);
    // An evidence row whose source was rejected or trimmed away is dropped
    // rather than rendered without its citation.
    if (!source) continue;
    const bucket = evidenceBySection.get(row.section_key) ?? [];
    bucket.push({ row, source });
    evidenceBySection.set(row.section_key, bucket);
  }

  // --- Sections -----------------------------------------------------------
  const sections = REPORT_SECTIONS.map((key) =>
    buildSection({
      key,
      row: byKey.get(key),
      evidence: evidenceBySection.get(key) ?? [],
      sourcesById,
      sourcesByCanonical,
    }),
  );

  // --- Evidence profile ---------------------------------------------------
  const byConfidence = { high: 0, medium: 0, low: 0 };
  let contradictionCount = 0;
  for (const row of evidenceRows) {
    if (row.confidence === "high") byConfidence.high += 1;
    else if (row.confidence === "medium") byConfidence.medium += 1;
    else byConfidence.low += 1;
    if (row.is_contradictory) contradictionCount += 1;
  }

  const bySourceType: Record<string, number> = {};
  for (const row of sourceRows) {
    bySourceType[row.source_type] = (bySourceType[row.source_type] ?? 0) + 1;
  }

  const evidenceProfile: EvidenceProfile = {
    sourceCount: sourceRows.length,
    evidenceCount: evidenceRows.length,
    byConfidence,
    bySourceType,
    contradictionCount,
    uncitedSections: sections
      .filter(
        (section) =>
          section.findings.length > 0 &&
          section.findings.every((finding) => finding.citations.length === 0),
      )
      .map((section) => section.key),
  };

  // --- Overall confidence -------------------------------------------------
  // Taken from the synthesis section, which is where the engine records it,
  // rather than averaged. Averaging ordinal grades would invent a precision
  // the research never had.
  const overallConfidence = sectionConfidence(
    byKey.get("strategic_recommendations"),
  );

  const reportSources: ReportSource[] = sourceRows.map((row) => {
    let host = "source";
    try {
      host = new URL(row.url).hostname.replace(/^www\./, "");
    } catch {
      /* keep the fallback */
    }
    return {
      id: row.id,
      title: row.title?.trim() || host,
      url: row.url,
      publisher: row.publisher?.trim() || null,
      sourceType: (row.source_type ?? "web") as ReportSource["sourceType"],
      publishedAt: row.published_at ? row.published_at.slice(0, 10) : null,
      retrievedAt: row.retrieved_at.slice(0, 10),
    };
  });

  const summaryRow = byKey.get("executive_summary");

  const candidate = {
    requestId: request.id,
    title: request.title,
    depth: isResearchDepth(request.depth) ? request.depth : "standard",
    generatedAt: summaryRow?.updated_at ?? request.updated_at,
    // The executive summary is rewritten on every regeneration, so its version
    // IS the report's version.
    version: summaryRow?.version ?? 1,
    context: {
      industry: request.industry,
      geography: request.geography,
      targetCustomer: request.target_customer,
      businessModel: request.business_model,
      scope: request.scope,
      questions: Array.isArray(request.questions)
        ? (request.questions as unknown[])
            .filter((q): q is string => typeof q === "string")
            .slice(0, 10)
        : [],
    },
    overallConfidence,
    sections,
    sources: reportSources,
    evidence: evidenceProfile,
  };

  const parsed = researchReportSchema.safeParse(candidate);

  if (!parsed.success) {
    // A contract violation here means the composer produced something the
    // report rules forbid — an uncited FACT, a dangling citation, a missing
    // section. That is a defect, not a user error, so it is logged in full and
    // the page says the report could not be assembled rather than rendering it
    // anyway.
    console.error("[research-report] composition failed contract validation", {
      requestId,
      issues: parsed.error.issues.slice(0, 10),
    });
    return {
      report: null,
      status: "failed",
      reason:
        "The stored research could not be assembled into a valid report. Regenerate the report, or re-run the analysis stage.",
    };
  }

  return { report: parsed.data, status: "ready" };
}
