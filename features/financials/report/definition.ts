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
import {
  formatBps,
  formatMoney,
  isCurrencyCode,
  money,
  type CurrencyCode,
} from "@/features/financials/money";
import {
  ASSUMPTION_SOURCE_LABELS,
  COST_CATEGORY_LABELS,
  FINANCIAL_SECTION_TITLES,
  FUNDING_TYPE_LABELS,
  REVENUE_MODEL_FORMULA,
  REVENUE_MODEL_LABELS,
  RISK_LABELS,
  SCENARIO_LABELS,
  SUITABILITY_LABELS,
  isCostCategory,
  isFundingType,
  isRevenueModel,
  isScenario,
  type AssumptionSource,
  type FinancialReportSection,
} from "@/features/financials/types";
import type {
  FinancialAssumptionRow,
  FinancialCostRow,
  FinancialResultRow,
  FinancialSourceRow,
  FundingOptionRow,
} from "@/types/database";

/**
 * The Financial Intelligence report definition.
 *
 * Composes the sixteen sections from stored rows into the platform's
 * `ReportDocumentModel`, so the existing Report Engine renders it as HTML and
 * the existing PDF Engine renders it as A4. No new report engine, no new PDF
 * system, and no arithmetic — every figure here was calculated by
 * `calc/engine.ts` and persisted before this file ran.
 *
 * Two presentational rules carry the phase's principle into the document:
 *
 *   ASSUMPTIONS ARE LABELLED BY PROVENANCE. Each one prints who chose it, so a
 *   reader can tell a founder's number from a model's proposal.
 *
 *   RECOMMENDATIONS ARE LABELLED AS ADVICE. They render as RECOMMENDATION
 *   findings, never as facts, because they are the only part of this report a
 *   model actually authored.
 */

const SECTION_ICON: Record<FinancialReportSection, ReportIconName> = {
  executive_summary: "clipboard",
  business_context: "clipboard",
  key_assumptions: "checklist",
  startup_costs: "coins",
  operating_costs: "coins",
  revenue_model: "trending",
  unit_economics: "gauge",
  forecast: "trending",
  scenarios: "grid",
  break_even: "target",
  cash_flow: "coins",
  capital_requirement: "coins",
  funding_options: "lightbulb",
  financial_risks: "shield",
  recommendations: "route",
  sources_limitations: "shield",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(value: unknown, max = 8000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function strList(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => str(item, 2000))
    .filter((item): item is string => item !== null)
    .slice(0, max);
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

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

export interface FinancialReportStatus {
  ready: boolean;
  reason: string;
}

export interface ComposedFinancialReport {
  model: ReportDocumentModel;
  version: number;
  generatedAt: string;
  currency: CurrencyCode;
}

/**
 * Build the report, or explain why it is not ready.
 *
 * `ready` requires both a stored executive summary AND a stored forecast. A
 * financial report with no forecast is a page of assumptions, and printing it
 * under AIAutoMix branding as a financial model would misrepresent it.
 */
export async function composeFinancialReport(
  workspaceId: string,
  projectId: string,
): Promise<ComposedFinancialReport | FinancialReportStatus> {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("financial_projects")
    .select("*")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!project) return { ready: false, reason: "Financial model not found." };

  const [resultsRes, assumptionsRes, costsRes, fundingRes, sourcesRes] =
    await Promise.all([
      supabase
        .from("financial_results")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_current", true),
      supabase
        .from("financial_assumptions")
        .select("*")
        .eq("project_id", projectId)
        .limit(100),
      supabase
        .from("financial_costs")
        .select("*")
        .eq("project_id", projectId)
        .order("amount_minor", { ascending: false })
        .limit(100),
      supabase
        .from("funding_options")
        .select("*")
        .eq("project_id", projectId)
        .limit(50),
      supabase
        .from("financial_sources")
        .select("*")
        .eq("project_id", projectId)
        .neq("status", "rejected")
        .limit(100),
    ]);

  const results = (resultsRes.data ?? []) as FinancialResultRow[];
  const assumptions = (assumptionsRes.data ?? []) as FinancialAssumptionRow[];
  const costs = (costsRes.data ?? []) as FinancialCostRow[];
  const funding = (fundingRes.data ?? []) as FundingOptionRow[];
  const sources = (sourcesRes.data ?? []) as FinancialSourceRow[];

  const byKey = new Map(results.map((row) => [row.section_key, row]));
  const content = (key: string): Record<string, unknown> =>
    (byKey.get(key)?.structured_content ?? {}) as Record<string, unknown>;

  const summaryRow = byKey.get("executive_summary");
  if (!summaryRow) {
    return {
      ready: false,
      reason:
        "The recommendations stage has not completed, so there is no report yet.",
    };
  }
  if (!byKey.has("forecast")) {
    return {
      ready: false,
      reason:
        "The forecast has not been calculated. Run the cash flow & break-even stage — it is calculated from your assumptions and costs nothing.",
    };
  }

  const currency: CurrencyCode = isCurrencyCode(project.currency)
    ? project.currency
    : "USD";

  const fmt = (minor: number | null): string =>
    minor === null ? "—" : formatMoney(money(minor, currency));

  const sections: ReportModelSection[] = [];
  const push = (key: FinancialReportSection, blocks: ReportBlock[]): void => {
    // The executive summary is rendered by the header and the PDF's own summary
    // block, so repeating it as a section would print it twice.
    if (key === "executive_summary") return;
    sections.push({
      id: key,
      title: FINANCIAL_SECTION_TITLES[key],
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

  // --- Context -------------------------------------------------------------
  const contextContent = content("business_context");
  push("business_context", [
    {
      kind: "keyValues",
      entries: [
        { label: "Currency", value: project.currency },
        {
          label: "Revenue model",
          value: isRevenueModel(project.revenue_model)
            ? `${REVENUE_MODEL_LABELS[project.revenue_model]} — ${REVENUE_MODEL_FORMULA[project.revenue_model]}`
            : project.revenue_model,
        },
        {
          label: "Forecast horizon",
          value: `${project.horizon_months} months`,
        },
        { label: "Opening cash", value: fmt(project.opening_cash_minor) },
        { label: "Industry", value: project.industry ?? "Not specified" },
        { label: "Geography", value: project.geography ?? "Not specified" },
      ],
    },
    ...(str(contextContent.operatingModel)
      ? [
          {
            kind: "paragraph" as const,
            text: str(contextContent.operatingModel)!,
          },
        ]
      : []),
    ...listBlock("Key drivers", contextContent.keyDrivers),
    ...listBlock("Open questions", contextContent.openQuestions),
  ]);

  // --- Assumptions ---------------------------------------------------------
  const aiCount = assumptions.filter((a) => a.source === "AI").length;
  push("key_assumptions", [
    {
      kind: "callout",
      tone: aiCount > 0 ? "caution" : "neutral",
      title: "Every figure in this report derives from these",
      text:
        aiCount > 0
          ? `${aiCount} of the ${assumptions.length} assumptions below were proposed by AIAutoMix rather than entered by you or drawn from evidence. They are the weakest points in the forecast. Each assumption is labelled with where it came from.`
          : "Each assumption is labelled with where it came from. Change any of them and the whole model recalculates.",
    },
    {
      kind: "keyValues",
      entries: assumptions.slice(0, 40).map((assumption) => ({
        label: assumption.label,
        value: `${assumptionValue(assumption, currency)}  [${
          ASSUMPTION_SOURCE_LABELS[
            (assumption.source ?? "AI") as AssumptionSource
          ]
        }]`,
      })),
    },
  ]);

  // --- Costs ---------------------------------------------------------------
  const oneTime = costs.filter((c) => c.kind === "ONE_TIME");
  const recurring = costs.filter((c) => c.kind === "RECURRING");

  push("startup_costs", costBlocks(oneTime, fmt, content("startup_costs")));
  push(
    "operating_costs",
    costBlocks(recurring, fmt, content("operating_costs")),
  );

  // --- Revenue model -------------------------------------------------------
  const revenueContent = content("revenue_model");
  push("revenue_model", [
    {
      kind: "keyValues",
      entries: [
        {
          label: "Formula",
          value: isRevenueModel(project.revenue_model)
            ? REVENUE_MODEL_FORMULA[project.revenue_model]
            : project.revenue_model,
        },
        {
          label: "Starting units",
          value: String(num(revenueContent.startingUnits) ?? "—"),
        },
        {
          label: "Price per unit",
          value: fmt(num(revenueContent.pricePerUnitMinor)),
        },
        {
          label: "Monthly growth",
          value: formatBps(num(revenueContent.unitGrowthBps)),
        },
        {
          label: "Monthly churn",
          value: formatBps(num(revenueContent.monthlyChurnBps)),
        },
        {
          label: "Variable cost of revenue",
          value: formatBps(num(revenueContent.cogsBps)),
        },
      ],
    },
    ...(str(content("key_assumptions").rationale)
      ? [
          {
            kind: "paragraph" as const,
            text: str(content("key_assumptions").rationale)!,
          },
        ]
      : []),
  ]);

  // --- Unit economics ------------------------------------------------------
  const ue = content("unit_economics");
  push("unit_economics", [
    {
      kind: "keyValues",
      entries: [
        { label: "ARPU", value: fmt(num(ue.arpuMinor)) },
        { label: "CAC", value: fmt(num(ue.cacMinor)) },
        { label: "LTV", value: fmt(num(ue.ltvMinor)) },
        { label: "Gross margin", value: formatBps(num(ue.grossMarginBps)) },
        {
          label: "Contribution margin",
          value: formatBps(num(ue.contributionMarginBps)),
        },
        {
          label: "CAC payback",
          value:
            num(ue.cacPaybackMonths) !== null
              ? `${num(ue.cacPaybackMonths)} months`
              : "—",
        },
        {
          label: "LTV : CAC",
          value:
            num(ue.ltvToCacBps) !== null
              ? `${(num(ue.ltvToCacBps)! / 10000).toFixed(1)}x`
              : "—",
        },
      ],
    },
    // A metric deliberately not computed, and why. More useful than a blank,
    // and far more useful than a meaningless number.
    ...(strList(ue.notApplicable).length
      ? [
          {
            kind: "callout" as const,
            tone: "neutral" as const,
            title: "Metrics not calculated for this business model",
            text: strList(ue.notApplicable).join("\n"),
          },
        ]
      : []),
  ]);

  // --- Forecast ------------------------------------------------------------
  const forecast = content("forecast");
  const totals = (forecast.totals ?? {}) as Record<string, unknown>;
  const monthRows = Array.isArray(forecast.months)
    ? (forecast.months as Record<string, unknown>[])
    : [];

  push("forecast", [
    {
      kind: "keyValues",
      entries: [
        { label: "Total revenue", value: fmt(num(totals.revenueMinor)) },
        { label: "Total COGS", value: fmt(num(totals.cogsMinor)) },
        { label: "Gross profit", value: fmt(num(totals.grossProfitMinor)) },
        {
          label: "Operating expenses",
          value: fmt(num(totals.operatingExpensesMinor)),
        },
        {
          label: "Operating profit",
          value: fmt(num(totals.operatingProfitMinor)),
        },
        { label: "One-time costs", value: fmt(num(totals.oneTimeCostsMinor)) },
      ],
    },
    // A month-by-month table in a keyValues block: a wide grid does not survive
    // A4, and the reader needs the month label beside every figure anyway.
    ...monthRows.slice(0, 24).map((row) => ({
      kind: "keyValues" as const,
      entries: [
        {
          label: `Month ${String(row.month ?? "")}`,
          value: [
            `${num(row.units) ?? 0} units`,
            `revenue ${fmt(num(row.revenueMinor))}`,
            `gross ${fmt(num(row.grossProfitMinor))}`,
            `op. profit ${fmt(num(row.operatingProfitMinor))}`,
            `cash ${fmt(num(row.closingCashMinor))}`,
          ].join(" · "),
        },
      ],
    })),
  ]);

  // --- Scenarios -----------------------------------------------------------
  const scenarioRows = Array.isArray(content("scenarios").scenarios)
    ? (content("scenarios").scenarios as Record<string, unknown>[])
    : [];

  push("scenarios", [
    {
      kind: "callout",
      tone: "neutral",
      title: "Each scenario is recalculated, not scaled",
      text: "Conservative and optimistic cases change the underlying assumptions — growth, churn, price, cost, acquisition — and the engine runs the whole model again from them. None of them multiplies the base result by a percentage.",
    },
    ...scenarioRows.map((row) => {
      const key = String(row.scenario ?? "");
      return {
        kind: "keyValues" as const,
        entries: [
          {
            label: isScenario(key) ? SCENARIO_LABELS[key] : key,
            value: [
              `revenue ${fmt(num(row.totalRevenueMinor))}`,
              `op. profit ${fmt(num(row.totalOperatingProfitMinor))}`,
              `margin ${formatBps(num(row.grossMarginBps))}`,
              num(row.breakEvenMonth) !== null
                ? `break-even month ${num(row.breakEvenMonth)}`
                : "no break-even",
              `capital ${fmt(num(row.capitalRequiredMinor))}`,
            ].join(" · "),
          },
        ],
      };
    }),
  ]);

  // --- Break-even ----------------------------------------------------------
  const be = content("break_even");
  const unreachable = str(be.unreachableReason, 2000);
  push("break_even", [
    ...(unreachable
      ? [
          {
            kind: "callout" as const,
            tone: "negative" as const,
            title: "Break-even is not reachable at these assumptions",
            text: unreachable,
          },
        ]
      : []),
    {
      kind: "keyValues",
      entries: [
        { label: "Break-even revenue", value: fmt(num(be.revenueMinor)) },
        {
          label: "Break-even units",
          value: num(be.units)?.toLocaleString("en-US") ?? "—",
        },
        {
          label: "Break-even month",
          value:
            num(be.month) !== null
              ? `Month ${num(be.month)}`
              : "Not within the forecast horizon",
        },
        {
          label: "Fixed monthly costs",
          value: fmt(num(be.fixedMonthlyCostsMinor)),
        },
        {
          label: "Contribution margin",
          value: formatBps(num(be.contributionMarginBps)),
        },
      ],
    },
    {
      kind: "paragraph",
      text: "Break-even revenue = fixed monthly costs ÷ contribution margin. Both inputs are shown above so the figure can be checked by hand.",
    },
  ]);

  // --- Cash flow -----------------------------------------------------------
  const cf = content("cash_flow");
  push("cash_flow", [
    {
      kind: "keyValues",
      entries: [
        { label: "Opening cash", value: fmt(num(cf.openingCashMinor)) },
        { label: "Closing cash", value: fmt(num(cf.closingCashMinor)) },
        {
          label: "Lowest cash",
          value: `${fmt(num(cf.lowestCashMinor))} (month ${num(cf.lowestCashMonth) ?? "—"})`,
        },
        {
          label: "Average monthly burn",
          value: fmt(num(cf.averageMonthlyBurnMinor)),
        },
        {
          label: "Runway",
          value:
            num(cf.runwayMonths) !== null
              ? `${num(cf.runwayMonths)} months`
              : "Not burning cash",
        },
      ],
    },
    ...(num(cf.firstNegativeMonth) !== null
      ? [
          {
            kind: "callout" as const,
            tone: "negative" as const,
            title: `Cash goes negative in month ${num(cf.firstNegativeMonth)}`,
            text: "Funding, a cost reduction or faster revenue is needed before that month. The capital requirement below is the size of the gap.",
          },
        ]
      : []),
  ]);

  // --- Capital -------------------------------------------------------------
  const capital = content("capital_requirement");
  push("capital_requirement", [
    {
      kind: "keyValues",
      entries: [
        {
          label: "Capital required",
          value: fmt(num(capital.capitalRequiredMinor)),
        },
        {
          label: "Peak cash shortfall",
          value: fmt(num(capital.peakFundingRequirementMinor)),
        },
        { label: "One-time costs", value: fmt(num(capital.oneTimeCostsMinor)) },
      ],
    },
    {
      kind: "paragraph",
      text: "The capital requirement is the deepest point the cash balance reaches below its starting level — which is usually larger than the closing loss, because the trough comes before revenue catches up.",
    },
  ]);

  // --- Funding -------------------------------------------------------------
  push("funding_options", fundingBlocks(funding, sources, fmt));

  // --- Risks ---------------------------------------------------------------
  const riskRows = Array.isArray(content("financial_risks").risks)
    ? (content("financial_risks").risks as Record<string, unknown>[])
    : [];

  push(
    "financial_risks",
    riskRows.length
      ? [
          {
            kind: "ranked",
            levelLabel: "Severity",
            entries: riskRows.flatMap((risk) => {
              const summary = str(risk.summary, 2000);
              if (!summary) return [];
              const kind = String(risk.kind ?? "");
              const severity = String(risk.severity ?? "low");
              return [
                {
                  title: RISK_LABELS[kind as keyof typeof RISK_LABELS] ?? kind,
                  description: summary,
                  level: (severity === "high"
                    ? "high"
                    : severity === "medium"
                      ? "medium"
                      : "low") as "high" | "medium" | "low",
                  ...(str(risk.assumptionKey, 60)
                    ? {
                        footnote: {
                          label: "Driven by assumption",
                          value: str(risk.assumptionKey, 60)!,
                        },
                      }
                    : {}),
                },
              ];
            }),
          },
        ]
      : [],
  );

  // --- Recommendations -----------------------------------------------------
  const recommendations = Array.isArray(
    content("recommendations").recommendations,
  )
    ? (content("recommendations").recommendations as Record<string, unknown>[])
    : [];

  push(
    "recommendations",
    recommendations.length
      ? [
          {
            kind: "callout",
            tone: "neutral",
            title: "These are recommendations, not findings",
            text: "Everything in this section is AIAutoMix's advice based on the calculated figures. The arithmetic above is deterministic; this is judgement.",
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
        ]
      : [],
  );

  // --- Sources and limitations --------------------------------------------
  const limitations = strList(content("sources_limitations").limitations);
  push("sources_limitations", [
    ...(limitations.length
      ? [
          {
            kind: "callout" as const,
            tone: "caution" as const,
            title: "What this model could not establish",
            text: limitations.join("\n"),
          },
        ]
      : []),
    {
      kind: "callout",
      tone: "neutral",
      title: "How to read this report",
      text: "Every figure was calculated deterministically from the assumptions listed earlier — the same inputs always produce the same outputs. No figure here was generated by a language model. What a model DID produce is the assumptions themselves and the recommendations, both of which are labelled. A projection is arithmetic over assumptions, not a forecast of what will happen.",
    },
    { kind: "sources", entries: sources.map(toSourceEntry) },
  ]);

  const summary =
    str(content("executive_summary").text) ??
    "This model did not produce an executive summary.";

  return {
    model: {
      workflow: "financial-recommendations",
      kicker: "Financial & Funding Report",
      title: project.title,
      summary,
      // No score. Nothing in a financial model reduces to a 0-100 dial without
      // inventing a weighting nobody agreed.
      disclaimer: `${AI_REPORT_DISCLAIMER} All figures are projections calculated from stated assumptions in ${project.currency}, not forecasts of actual results.`,
      meta: {
        workflowLabel: "Financial Intelligence",
        model: "",
        promptVersion: "v1",
        generatedAt: summaryRow.updated_at,
        durationMs: null,
        tokens: null,
      },
      sections,
    },
    version: summaryRow.version,
    generatedAt: summaryRow.updated_at,
    currency,
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

function assumptionValue(
  assumption: FinancialAssumptionRow,
  currency: CurrencyCode,
): string {
  if (assumption.unit === "money") {
    return assumption.value_minor === null
      ? "—"
      : formatMoney(money(assumption.value_minor, currency));
  }
  if (assumption.unit === "bps") return formatBps(assumption.value_int);
  return String(assumption.value_int ?? "—");
}

function costBlocks(
  lines: FinancialCostRow[],
  fmt: (minor: number | null) => string,
  section: Record<string, unknown>,
): ReportBlock[] {
  const notApplicable = Array.isArray(section.notApplicable)
    ? (section.notApplicable as { category?: unknown; reason?: unknown }[])
    : [];

  const blocks: ReportBlock[] = [];

  if (lines.length === 0) {
    blocks.push({
      kind: "callout",
      tone: "neutral",
      title: "No lines recorded in this category",
      text: "Reported rather than filled in with zeros.",
    });
  } else {
    blocks.push({
      kind: "keyValues",
      entries: lines.slice(0, 40).map((line) => ({
        label: `${line.label}${
          line.kind === "RECURRING" && line.every_months > 1
            ? ` (every ${line.every_months} months)`
            : ""
        }`,
        value: `${fmt(line.amount_minor)} · ${
          isCostCategory(line.category)
            ? COST_CATEGORY_LABELS[line.category]
            : line.category
        }`,
      })),
    });
  }

  // "Not applicable" is a finding. A category left out on purpose is more
  // informative than a line item of zero.
  if (notApplicable.length) {
    blocks.push({
      kind: "callout",
      tone: "neutral",
      title: "Categories that do not apply to this business",
      text: notApplicable
        .map((entry) => {
          const category = str(entry.category, 60) ?? "";
          const reason = str(entry.reason, 500) ?? "";
          const label = isCostCategory(category)
            ? COST_CATEGORY_LABELS[category]
            : category;
          return `${label}: ${reason}`;
        })
        .join("\n"),
    });
  }

  return blocks;
}

function fundingBlocks(
  options: FundingOptionRow[],
  sources: FinancialSourceRow[],
  fmt: (minor: number | null) => string,
): ReportBlock[] {
  if (options.length === 0) {
    return [
      {
        kind: "callout",
        tone: "caution",
        title: "No funding options were recorded",
        text: "The funding stage keeps only programmes a real search result backs. Nothing that could be verified was found for this business and geography.",
      },
    ];
  }

  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return [
    {
      kind: "callout",
      tone: "neutral",
      title: "Suitability is AIAutoMix's judgement",
      text: "It reflects the capital requirement and stage of this business against what each provider publishes. It is not a decision by any provider, and it does not mean the business qualifies. Check eligibility at the source before applying.",
    },
    {
      kind: "ranked",
      levelLabel: "Fit",
      entries: options.slice(0, 30).map((option) => {
        const source = option.source_id
          ? sourceById.get(option.source_id)
          : undefined;
        const hasRange =
          option.amount_min_minor !== null || option.amount_max_minor !== null;

        return {
          title: `${option.name}${option.provider ? ` — ${option.provider}` : ""}`,
          description: [
            isFundingType(option.funding_type)
              ? FUNDING_TYPE_LABELS[option.funding_type]
              : option.funding_type,
            hasRange
              ? `${fmt(option.amount_min_minor)} – ${fmt(option.amount_max_minor)}`
              : "Amount not publicly disclosed",
            option.eligibility ?? "Eligibility not stated",
          ].join(" · "),
          level: (option.suitability === "STRONG"
            ? "high"
            : option.suitability === "POSSIBLE"
              ? "medium"
              : "low") as "high" | "medium" | "low",
          footnote: {
            label:
              SUITABILITY_LABELS[
                (option.suitability ??
                  "POSSIBLE") as keyof typeof SUITABILITY_LABELS
              ] ?? option.suitability,
            value:
              option.suitability_rationale ??
              (source?.url ? `Source: ${source.url}` : "No source recorded."),
          },
        };
      }),
    },
  ];
}

function toSourceEntry(source: FinancialSourceRow): SourceEntry {
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
    // A missing publication date stays missing.
    ...(source.published_at
      ? { publishedAt: source.published_at.slice(0, 10) }
      : {}),
    ...(source.retrieved_at
      ? { retrievedAt: source.retrieved_at.slice(0, 10) }
      : {}),
  };
}
