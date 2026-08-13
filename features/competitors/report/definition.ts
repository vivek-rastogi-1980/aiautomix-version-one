import "server-only";

import {
  AI_REPORT_DISCLAIMER,
  type ReportBlock,
  type ReportDocumentModel,
  type ReportIconName,
  type ReportSection as ReportModelSection,
  type SourceEntry,
} from "@/features/ai/renderer/types";
import { createClient } from "@/lib/supabase/server";
import { COMPETITOR_WORKFLOW_IDS } from "@/features/competitors/stages/workflows";
import {
  ABSENT_LABELS,
  COMPETITOR_SECTION_TITLES,
  COMPETITOR_TYPE_LABELS,
  DIMENSION_LABELS,
  GAP_LABELS,
  GAP_QUALIFIER,
  VERIFICATION_LABELS,
  isAbsentValue,
  isComparisonDimension,
  isPresentable,
  type ClaimKind,
  type CompetitorReportSection,
  type CompetitorType,
  type VerificationStatus,
} from "@/features/competitors/types";
import type {
  CompetitorProjectRow,
  CompetitorResultRow,
  CompetitorRow,
  CompetitorRunRow,
  CompetitorSourceRow,
} from "@/types/database";

/**
 * The Competitor Intelligence report definition.
 *
 * The entire presentation layer for the feature: it composes the fifteen
 * sections from stored rows and emits the platform's `ReportDocumentModel`, so
 * the existing Report Engine renders it as HTML and the existing PDF Engine
 * renders it as A4. Neither renderer knows anything about competitors, and the
 * section list exists in exactly one place — the same arrangement the Business
 * Validator, Business Plan and Market Research reports already use.
 *
 * No AI runs here and nothing is searched. Every statement is traceable to a
 * `competitors`, `competitor_evidence`, `competitor_sources` or
 * `competitor_results` row that some stage persisted earlier — which is what
 * makes viewing a report free and reproducible.
 *
 * The claim vocabulary maps onto the report engine's three kinds:
 *
 *   STATED      → FACT with the competitor named as the source of the claim
 *   OBSERVED    → FACT
 *   INFERRED    → INFERENCE
 *   RECOMMENDED → RECOMMENDATION
 *
 * STATED is deliberately NOT collapsed into FACT silently: the finding text is
 * prefixed with the company's name and the word "states", so a reader can never
 * mistake marketing copy for an independent observation.
 */

const SECTION_ICON: Record<CompetitorReportSection, ReportIconName> = {
  executive_summary: "clipboard",
  research_scope: "checklist",
  competitor_landscape: "grid",
  direct_competitors: "target",
  indirect_competitors: "users",
  emerging_competitors: "trending",
  competitor_profiles: "clipboard",
  feature_comparison: "grid",
  pricing_comparison: "coins",
  positioning_analysis: "route",
  strengths_weaknesses: "gauge",
  market_gaps: "lightbulb",
  differentiation_opportunities: "lightbulb",
  strategic_recommendations: "route",
  sources_limitations: "shield",
};

// ---------------------------------------------------------------------------
// Narrowing helpers
// ---------------------------------------------------------------------------

function str(value: unknown, max = 4000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function strList(value: unknown, max = 25): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => str(item, 2000))
    .filter((item): item is string => item !== null)
    .slice(0, max);
}

/** Only http(s) links become citations a reader can follow. */
function safeUrl(raw: string | null): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/** Present a value that may legitimately be absent. */
function shown(value: unknown): string {
  const text = str(value, 2000);
  if (!text) return ABSENT_LABELS.UNKNOWN;
  return isAbsentValue(text) ? ABSENT_LABELS[text] : text;
}

function claimKindToReport(
  kind: string,
): "FACT" | "INFERENCE" | "RECOMMENDATION" {
  if (kind === "OBSERVED" || kind === "STATED") return "FACT";
  if (kind === "RECOMMENDED") return "RECOMMENDATION";
  return "INFERENCE";
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export interface CompetitorReportStatus {
  ready: boolean;
  reason: string;
}

export interface ComposedCompetitorReport {
  model: ReportDocumentModel;
  /** Version of the executive summary — the report's version. */
  version: number;
  generatedAt: string;
}

/**
 * Build the report, or explain why it is not ready.
 *
 * `ready` requires BOTH a stored executive summary and at least one presentable
 * competitor. A report of seven unverified names is not a competitor report; it
 * is a list of search results, and printing it under AIAutoMix branding would
 * be the product's worst possible output.
 */
export async function composeCompetitorReport(
  workspaceId: string,
  projectId: string,
): Promise<ComposedCompetitorReport | CompetitorReportStatus> {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("competitor_projects")
    .select("*")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!project)
    return { ready: false, reason: "Competitor project not found." };

  const [runRes, resultsRes, competitorsRes, sourcesRes] = await Promise.all([
    supabase
      .from("competitor_runs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("competitor_results")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_current", true),
    supabase
      .from("competitors")
      .select("*")
      .eq("project_id", projectId)
      .limit(100),
    supabase
      .from("competitor_sources")
      .select("*")
      .eq("project_id", projectId)
      .neq("status", "rejected")
      .order("created_at", { ascending: true })
      .limit(300),
  ]);

  const results = (resultsRes.data ?? []) as CompetitorResultRow[];
  const competitors = (competitorsRes.data ?? []) as CompetitorRow[];
  const sources = (sourcesRes.data ?? []) as CompetitorSourceRow[];
  const run = (runRes.data ?? null) as CompetitorRunRow | null;

  const byKey = new Map<string, CompetitorResultRow>(
    results.map((row) => [row.section_key, row]),
  );

  const summaryRow = byKey.get("executive_summary");
  if (!summaryRow) {
    return {
      ready: false,
      reason:
        "The recommendations stage has not completed, so there is no report yet.",
    };
  }

  const presentable = competitors.filter((competitor) =>
    isPresentable(competitor.verification_status as VerificationStatus),
  );

  if (presentable.length === 0) {
    return {
      ready: false,
      reason:
        "No competitor could be verified, so there is nothing to report. Retry verification, or widen the competitor criteria.",
    };
  }

  const content = (key: string): Record<string, unknown> =>
    (byKey.get(key)?.structured_content ?? {}) as Record<string, unknown>;

  const summary =
    str(content("executive_summary").text, 8000) ??
    "This research did not produce an executive summary.";

  const sections: ReportModelSection[] = [];
  const push = (key: CompetitorReportSection, blocks: ReportBlock[]): void => {
    // The executive summary is rendered by the report header and by the PDF's
    // own summary block, so repeating it as a section would print it twice.
    if (key === "executive_summary") return;
    sections.push({
      id: key,
      title: COMPETITOR_SECTION_TITLES[key],
      icon: SECTION_ICON[key],
      blocks: blocks.length
        ? blocks
        : [
            {
              kind: "callout",
              tone: "neutral",
              title: "Nothing stored for this section",
              text: "No stage wrote content here. This is reported rather than filled in.",
            },
          ],
    });
  };

  // --- Research scope ------------------------------------------------------
  const scope = content("research_scope");
  push("research_scope", [
    {
      kind: "keyValues",
      entries: [
        { label: "Category", value: project.category ?? "Not specified" },
        { label: "Geography", value: project.geography ?? "Not specified" },
        {
          label: "Target customer",
          value: project.target_customer ?? "Not specified",
        },
        { label: "Depth", value: project.depth },
        { label: "Competitors found", value: String(competitors.length) },
        { label: "Verified", value: String(presentable.length) },
      ],
    },
    ...(str(scope.scopeSummary, 8000)
      ? [{ kind: "paragraph" as const, text: str(scope.scopeSummary, 8000)! }]
      : []),
    ...listBlock("Direct competitor criteria", scope.directCriteria),
    ...listBlock("Indirect competitor criteria", scope.indirectCriteria),
    ...listBlock("Assumptions", scope.assumptions),
    ...listBlock("Out of scope", scope.outOfScope),
  ]);

  // --- Landscape -----------------------------------------------------------
  const landscape = content("competitor_landscape");
  push("competitor_landscape", [
    ...(str(landscape.summary, 8000)
      ? [{ kind: "paragraph" as const, text: str(landscape.summary, 8000)! }]
      : []),
    {
      kind: "keyValues",
      entries: [
        { label: "Direct", value: countType(competitors, "DIRECT") },
        { label: "Indirect", value: countType(competitors, "INDIRECT") },
        { label: "Emerging", value: countType(competitors, "EMERGING") },
        {
          label: "Unverified",
          value: String(
            competitors.filter((c) => c.verification_status === "UNVERIFIED")
              .length,
          ),
        },
      ],
    },
    ...(landscape.landscapeAvailable
      ? []
      : [
          {
            kind: "callout" as const,
            tone: "neutral" as const,
            title: "Insufficient reliable data for visualization",
            text: "Placing competitors on a price/feature chart needs a defensible reading of both axes for at least two of them. The evidence did not support that, so the comparison table is the honest version of that picture.",
          },
        ]),
  ]);

  // --- Competitors by type -------------------------------------------------
  for (const [key, type] of [
    ["direct_competitors", "DIRECT"],
    ["indirect_competitors", "INDIRECT"],
    ["emerging_competitors", "EMERGING"],
  ] as const) {
    const group = presentable.filter((c) => c.competitor_type === type);
    push(
      key,
      group.length
        ? [
            {
              kind: "ranked",
              levelLabel: "Verification",
              entries: group.map((competitor) => ({
                title: competitor.name,
                description: shown(
                  (competitor.profile as Record<string, unknown>)
                    ?.productService ??
                    (competitor.profile as Record<string, unknown>)?.offering ??
                    (competitor.profile as Record<string, unknown>)
                      ?.description,
                ),
                footnote: {
                  label: "Verification",
                  value:
                    VERIFICATION_LABELS[
                      competitor.verification_status as VerificationStatus
                    ] ?? competitor.verification_status,
                },
              })),
            },
          ]
        : [
            {
              kind: "callout",
              tone: "neutral",
              title: `No ${COMPETITOR_TYPE_LABELS[type as CompetitorType].toLowerCase()} competitors were verified`,
              text: "The research did not confirm any company in this category. That is reported rather than filled in.",
            },
          ],
    );
  }

  // --- Profiles ------------------------------------------------------------
  push(
    "competitor_profiles",
    presentable.flatMap((competitor) => profileBlocks(competitor, sources)),
  );

  // --- Feature comparison --------------------------------------------------
  push(
    "feature_comparison",
    comparisonBlocks(content("feature_comparison"), competitors),
  );

  // --- Pricing -------------------------------------------------------------
  push("pricing_comparison", pricingBlocks(presentable));

  // --- Positioning ---------------------------------------------------------
  push("positioning_analysis", positioningBlocks(presentable));

  // --- Strengths and weaknesses -------------------------------------------
  push("strengths_weaknesses", strengthsBlocks(presentable));

  // --- Gaps ----------------------------------------------------------------
  push("market_gaps", gapBlocks(content("market_gaps")));

  // --- Differentiation -----------------------------------------------------
  const differentiation = strList(
    content("differentiation_opportunities").opportunities,
  );
  push(
    "differentiation_opportunities",
    differentiation.length
      ? [
          {
            kind: "findings",
            entries: differentiation.map((text) => ({
              text,
              kind: "RECOMMENDATION" as const,
              confidence: "medium" as const,
            })),
          },
        ]
      : [],
  );

  // --- Recommendations -----------------------------------------------------
  push(
    "strategic_recommendations",
    recommendationBlocks(content("strategic_recommendations")),
  );

  // --- Sources and limitations --------------------------------------------
  push("sources_limitations", [
    ...(strList(content("sources_limitations").limitations).length
      ? [
          {
            kind: "callout" as const,
            tone: "caution" as const,
            title: "What this research could not establish",
            text: strList(content("sources_limitations").limitations).join(
              "\n",
            ),
          },
        ]
      : []),
    {
      kind: "callout",
      tone: "neutral",
      title: "How to read this report",
      text: "FACT is visible in a cited source — where it is a company's own claim about itself, the statement says so. INFERENCE is AIAutoMix's reading of the evidence. RECOMMENDATION is proposed action, not a finding. Gaps are possibilities to test: this research examined a sample of the web, not the whole market.",
    },
    { kind: "sources", entries: sources.map(toSourceEntry) },
  ]);

  return {
    model: {
      workflow: COMPETITOR_WORKFLOW_IDS.recommendations,
      kicker: "Competitor Intelligence Report",
      title: project.title,
      summary,
      // No score. Scoring competitors would be the "87% better" the spec
      // forbids, and nothing in this pipeline measures anything numerically.
      disclaimer: `${AI_REPORT_DISCLAIMER} Competitor information is gathered from public web sources and reflects what was visible when the research ran.`,
      meta: {
        workflowLabel: "Competitor Intelligence",
        model: "",
        promptVersion: "v1",
        generatedAt: summaryRow.updated_at,
        durationMs: null,
        tokens: run?.total_tokens ?? null,
      },
      sections,
    },
    version: summaryRow.version,
    generatedAt: summaryRow.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Block builders
// ---------------------------------------------------------------------------

function listBlock(title: string, value: unknown): ReportBlock[] {
  const items = strList(value);
  if (!items.length) return [];
  return [
    { kind: "paragraph", text: title },
    { kind: "bullets", items },
  ];
}

function countType(competitors: CompetitorRow[], type: string): string {
  return String(competitors.filter((c) => c.competitor_type === type).length);
}

function toSourceEntry(source: CompetitorSourceRow): SourceEntry {
  const url = safeUrl(source.url);
  let host = "source";
  try {
    host = new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    /* keep the fallback */
  }
  return {
    title: source.title?.trim() || host,
    ...(url ? { url } : {}),
    ...(source.publisher?.trim() ? { publisher: source.publisher.trim() } : {}),
    ...(source.source_type ? { sourceType: source.source_type } : {}),
    // A missing publication date stays missing.
    ...(source.published_at
      ? { publishedAt: source.published_at.slice(0, 10) }
      : {}),
    ...(source.retrieved_at
      ? { retrievedAt: source.retrieved_at.slice(0, 10) }
      : {}),
  };
}

function profileBlocks(
  competitor: CompetitorRow,
  sources: CompetitorSourceRow[],
): ReportBlock[] {
  const profile = (competitor.profile ?? {}) as Record<string, unknown>;
  const citation = sources.find((source) => {
    try {
      return (
        new URL(source.url).hostname.replace(/^www\./, "") ===
        competitor.canonical_domain
      );
    } catch {
      return false;
    }
  });

  const url = safeUrl(competitor.website ?? citation?.url ?? null);

  const features = Array.isArray(profile.features)
    ? (profile.features as { name?: unknown; kind?: unknown }[])
    : [];

  return [
    {
      kind: "paragraph",
      text: `${competitor.name} — ${competitor.canonical_domain}`,
    },
    {
      kind: "keyValues",
      entries: [
        {
          label: "Verification",
          value:
            VERIFICATION_LABELS[
              competitor.verification_status as VerificationStatus
            ] ?? competitor.verification_status,
        },
        {
          label: "Type",
          value:
            COMPETITOR_TYPE_LABELS[
              competitor.competitor_type as CompetitorType
            ] ?? competitor.competitor_type,
        },
        { label: "Target customer", value: shown(profile.targetCustomer) },
        { label: "Geography", value: shown(profile.geography) },
        { label: "Business model", value: shown(profile.businessModel) },
        { label: "Value proposition", value: shown(profile.valueProposition) },
      ],
    },
    ...(features.length
      ? [
          {
            kind: "findings" as const,
            entries: features.slice(0, 20).map((feature) => {
              const kind = (
                typeof feature.kind === "string" ? feature.kind : "INFERRED"
              ) as ClaimKind;
              const name = str(feature.name, 300) ?? "Feature";
              return {
                // STATED is prefixed with the company name so a marketing claim
                // is never printed as though it were independently observed.
                text:
                  kind === "STATED"
                    ? `${competitor.name} states: ${name}`
                    : name,
                kind: claimKindToReport(kind),
                confidence: (competitor.confidence ?? "low") as
                  "low" | "medium" | "high",
                citations: url
                  ? [{ label: competitor.canonical_domain, url }]
                  : [],
              };
            }),
          },
        ]
      : []),
  ];
}

function comparisonBlocks(
  section: Record<string, unknown>,
  competitors: CompetitorRow[],
): ReportBlock[] {
  const matrix = Array.isArray(section.matrix)
    ? (section.matrix as {
        dimension?: unknown;
        cells?: { domain?: unknown; value?: unknown; kind?: unknown }[];
        ownBusiness?: unknown;
      }[])
    : [];

  if (!matrix.length) {
    return [
      {
        kind: "callout",
        tone: "caution",
        title: "No comparison could be built",
        text: "A dimension is only included when there is evidence for most of the competitors on it. None reached that bar, so no table is printed rather than one that looks researched and is not.",
      },
    ];
  }

  const nameFor = (domain: string) =>
    competitors.find((c) => c.canonical_domain === domain)?.name ?? domain;

  // Rendered as one keyValues block per dimension: a wide grid does not survive
  // A4, and the reader needs the row label beside every value anyway.
  return matrix.flatMap((row) => {
    if (!isComparisonDimension(row.dimension)) return [];
    const cells = row.cells ?? [];
    return [
      { kind: "paragraph" as const, text: DIMENSION_LABELS[row.dimension] },
      {
        kind: "keyValues" as const,
        entries: [
          ...cells.map((cell) => ({
            label: nameFor(str(cell.domain, 300) ?? ""),
            value: `${typeof cell.kind === "string" ? `[${cell.kind}] ` : ""}${shown(cell.value)}`,
          })),
          { label: "Your business", value: shown(row.ownBusiness) },
        ],
      },
    ];
  });
}

function pricingBlocks(competitors: CompetitorRow[]): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  let disclosed = 0;

  for (const competitor of competitors) {
    const pricing = (competitor.pricing ?? {}) as Record<string, unknown>;
    const plans = Array.isArray(pricing.plans)
      ? (pricing.plans as {
          planName?: unknown;
          displayedPrice?: unknown;
          billingFrequency?: unknown;
        }[])
      : [];

    if (plans.length === 0) {
      blocks.push({
        kind: "keyValues",
        entries: [
          { label: competitor.name, value: "Pricing not publicly disclosed." },
        ],
      });
      continue;
    }

    disclosed += 1;
    blocks.push({ kind: "paragraph", text: competitor.name });
    blocks.push({
      kind: "keyValues",
      entries: plans.slice(0, 12).map((plan) => ({
        label: str(plan.planName, 200) ?? "Plan",
        value: `${shown(plan.displayedPrice)}${
          str(plan.billingFrequency, 100) &&
          !isAbsentValue(str(plan.billingFrequency, 100)!)
            ? ` · ${str(plan.billingFrequency, 100)}`
            : ""
        }`,
      })),
    });
  }

  blocks.unshift({
    kind: "callout",
    tone: disclosed === 0 ? "caution" : "neutral",
    title: `${disclosed} of ${competitors.length} competitors publish pricing`,
    text: "Prices are reproduced exactly as displayed on the source page, including currency and unit. Nothing here is converted, normalised or estimated — a price that is not published is reported as not published.",
  });

  return blocks;
}

function positioningBlocks(competitors: CompetitorRow[]): ReportBlock[] {
  const entries = competitors.flatMap((competitor) => {
    const positioning = (competitor.positioning ?? {}) as Record<
      string,
      unknown
    >;
    const headline = str(positioning.headline, 1000);
    if (!headline || isAbsentValue(headline)) return [];

    const observed = positioning.basis === "OBSERVED";
    return [
      {
        // The company's own words are attributed to the company.
        text: observed
          ? `${competitor.name} states: ${headline}`
          : `${competitor.name}: ${headline}`,
        kind: observed ? ("FACT" as const) : ("INFERENCE" as const),
        confidence: (competitor.confidence ?? "low") as
          "low" | "medium" | "high",
        citations: safeUrl(competitor.website)
          ? [
              {
                label: competitor.canonical_domain,
                url: safeUrl(competitor.website)!,
              },
            ]
          : [],
      },
    ];
  });

  return entries.length ? [{ kind: "findings", entries }] : [];
}

function strengthsBlocks(competitors: CompetitorRow[]): ReportBlock[] {
  return competitors.flatMap((competitor) => {
    const profile = (competitor.profile ?? {}) as Record<string, unknown>;
    const strengths = strList(profile.strengths, 10);
    const weaknesses = strList(profile.weaknesses, 10);
    if (!strengths.length && !weaknesses.length) return [];

    return [
      { kind: "paragraph" as const, text: competitor.name },
      ...(strengths.length
        ? [
            { kind: "paragraph" as const, text: "Strengths" },
            { kind: "bullets" as const, items: strengths },
          ]
        : []),
      ...(weaknesses.length
        ? [
            { kind: "paragraph" as const, text: "Weaknesses" },
            { kind: "bullets" as const, items: weaknesses },
          ]
        : []),
    ];
  });
}

function gapBlocks(section: Record<string, unknown>): ReportBlock[] {
  const gaps = Array.isArray(section.gaps)
    ? (section.gaps as {
        kind?: unknown;
        summary?: unknown;
        supportingEvidence?: unknown;
        confidence?: unknown;
      }[])
    : [];

  if (!gaps.length) return [];

  return [
    {
      kind: "callout",
      tone: "caution",
      title: "Every gap below is a possibility to test",
      text: "Absence of evidence that a competitor serves a segment is not evidence that nobody does. This research examined a sample of the web, not the market.",
    },
    {
      kind: "ranked",
      levelLabel: "Confidence",
      entries: gaps.flatMap((gap) => {
        const summary = str(gap.summary, 2000);
        if (!summary) return [];
        const kind = (str(gap.kind, 40) ??
          "feature") as keyof typeof GAP_LABELS;
        return [
          {
            title: `${GAP_QUALIFIER} — ${GAP_LABELS[kind] ?? "Gap"}`,
            description: summary,
            level: (gap.confidence === "high"
              ? "high"
              : gap.confidence === "medium"
                ? "medium"
                : "low") as "high" | "medium" | "low",
            ...(str(gap.supportingEvidence, 2000)
              ? {
                  footnote: {
                    label: "Observed",
                    value: str(gap.supportingEvidence, 2000)!,
                  },
                }
              : {}),
          },
        ];
      }),
    },
  ];
}

function recommendationBlocks(section: Record<string, unknown>): ReportBlock[] {
  const recommendations = Array.isArray(section.recommendations)
    ? (section.recommendations as {
        area?: unknown;
        recommendation?: unknown;
        rationale?: unknown;
        confidence?: unknown;
      }[])
    : [];

  if (!recommendations.length) return [];

  return [
    {
      kind: "callout",
      tone: "neutral",
      title: "These are recommendations, not findings",
      text: "Everything in this section is AIAutoMix's strategic advice based on the competitor evidence gathered. It is not something a source stated.",
    },
    {
      kind: "findings",
      entries: recommendations.flatMap((entry) => {
        const text = str(entry.recommendation, 2000);
        if (!text) return [];
        const rationale = str(entry.rationale, 2000);
        const area = str(entry.area, 60);
        return [
          {
            text: `${area ? `[${area}] ` : ""}${text}${rationale ? ` — ${rationale}` : ""}`,
            kind: "RECOMMENDATION" as const,
            confidence: (entry.confidence === "high"
              ? "high"
              : entry.confidence === "medium"
                ? "medium"
                : "low") as "low" | "medium" | "high",
          },
        ];
      }),
    },
  ];
}

export type { CompetitorProjectRow };
