import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiRetrievedSource } from "@/features/ai/engine/types";
import type { Database } from "@/types/database";
import { AiError } from "@/features/ai/engine/errors";
import {
  isCostCategory,
  isCostKind,
  isRevenueModel,
  type FinancialStage,
} from "@/features/financials/types";
import {
  buildFinancialModel,
  buildScenarios,
  capitalRequirement,
  monthlyFixedCosts,
  type CostLine,
  type FinancialModelInput,
  type RevenueDrivers,
} from "@/features/financials/calc/engine";
import {
  isCurrencyCode,
  money,
  type CurrencyCode,
} from "@/features/financials/money";
import type {
  CostOutput,
  FundingOutput,
  PlanningOutput,
  RecommendationsOutput,
  RevenueOutput,
} from "@/features/financials/stages/contracts";

/**
 * What each stage reads, and what its output becomes.
 *
 * Two responsibilities live here and nowhere else.
 *
 *   ASSEMBLING THE ENGINE INPUT. `readModelInput` turns stored assumption and
 *   cost rows into a `FinancialModelInput`. Every compute stage goes through
 *   it, so all three see exactly the same numbers and cannot disagree.
 *
 *   ENFORCING CITATION-BACKED FUNDING. A funding option whose domain does not
 *   correspond to a host the provider actually cited is dropped, exactly as in
 *   competitor discovery. A funding programme that does not exist is the most
 *   damaging thing this report can contain.
 */

type Client = SupabaseClient<Database>;

export interface MappedStageOutput {
  results: unknown[];
  assumptions: unknown[];
  costs: unknown[];
  sources: unknown[];
  funding: unknown[];
  /** Funding options dropped because no citation backed them. */
  discardedOptions: string[];
}

const EMPTY: MappedStageOutput = {
  results: [],
  assumptions: [],
  costs: [],
  sources: [],
  funding: [],
  discardedOptions: [],
};

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

export function stripUrls(text: string): string {
  return text
    .replace(/https?:\/\/[^\s<>()[\]"']+/gi, "[link removed - see sources]")
    .replace(/www\.[^\s<>()[\]"']+/gi, "[link removed - see sources]");
}

export function canonicalise(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|ref$|source$|fbclid$|gclid$)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

export function hostOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Does a model-reported domain correspond to a host the search returned?
 *
 * Accepts an exact match or a subdomain of a cited host — a result on
 * `apply.example.gov` is genuine evidence that `example.gov` exists. It does
 * NOT accept a suffix lookalike: `notexample.gov` must never be satisfied by a
 * citation on `example.gov`.
 */
export function matchCitedHost(
  domain: string,
  citedHosts: Set<string>,
): string | null {
  const needle = domain.toLowerCase().replace(/^www\./, "");
  if (citedHosts.has(needle)) return needle;
  for (const host of citedHosts) {
    if (host.endsWith(`.${needle}`) || needle.endsWith(`.${host}`)) return host;
  }
  return null;
}

function sourceRowsFrom(providerSources: AiRetrievedSource[]): unknown[] {
  return providerSources.map((source) => ({
    url: source.url,
    canonical_url: canonicalise(source.url),
    title: source.title,
    publisher: source.publisher,
    published_at: source.publishedAt,
    status: "retrieved",
    metadata: {},
  }));
}

function citationFor(
  domain: string,
  providerSources: AiRetrievedSource[],
): AiRetrievedSource | undefined {
  const needle = domain.toLowerCase().replace(/^www\./, "");
  return providerSources.find((source) => {
    const host = hostOf(source.url);
    return host === needle || host?.endsWith(`.${needle}`);
  });
}

// ---------------------------------------------------------------------------
// Reading the model input
// ---------------------------------------------------------------------------

export interface StoredProject {
  id: string;
  currency: string;
  revenue_model: string;
  horizon_months: number;
  opening_cash_minor: number;
}

/**
 * Assemble the deterministic engine's input from stored rows.
 *
 * This is the seam between "what a model proposed" and "what gets calculated".
 * Nothing beyond this point knows or cares where a number came from — the
 * provenance stays on the row, for the UI and the report to show.
 *
 * A missing revenue assumption throws rather than defaulting to zero: a
 * forecast of zero revenue looks like a finding, and it would be a bug wearing
 * one.
 */
export async function readModelInput(
  supabase: Client,
  project: StoredProject,
): Promise<FinancialModelInput> {
  const currency = project.currency as CurrencyCode;
  if (!isCurrencyCode(currency)) {
    throw new AiError(
      "AI_INVALID_INPUT",
      `Unsupported currency on this project: ${project.currency}.`,
      false,
    );
  }
  if (!isRevenueModel(project.revenue_model)) {
    throw new AiError(
      "AI_INVALID_INPUT",
      `Unsupported revenue model: ${project.revenue_model}.`,
      false,
    );
  }

  const [{ data: assumptionRows }, { data: costRows }] = await Promise.all([
    supabase
      .from("financial_assumptions")
      .select("key, unit, value_minor, value_int")
      .eq("project_id", project.id),
    supabase
      .from("financial_costs")
      .select("category, kind, label, amount_minor, every_months")
      .eq("project_id", project.id),
  ]);

  const byKey = new Map(
    (assumptionRows ?? []).map((row) => [row.key, row] as const),
  );

  const intOf = (key: string): number | null => {
    const row = byKey.get(key);
    return row && typeof row.value_int === "number" ? row.value_int : null;
  };
  const minorOf = (key: string): number | null => {
    const row = byKey.get(key);
    return row && typeof row.value_minor === "number" ? row.value_minor : null;
  };

  const startingUnits = intOf("starting_units");
  const pricePerUnit = minorOf("price_per_unit");

  if (startingUnits === null || pricePerUnit === null) {
    throw new AiError(
      "AI_INVALID_INPUT",
      "The revenue model is incomplete — `starting_units` and `price_per_unit` must both be recorded. Run the revenue stage first.",
      false,
    );
  }

  const costs: CostLine[] = (costRows ?? [])
    .filter((row) => isCostCategory(row.category) && isCostKind(row.kind))
    .map((row) => ({
      category: row.category as CostLine["category"],
      kind: row.kind as CostLine["kind"],
      label: row.label,
      amount: money(row.amount_minor, currency),
      everyMonths: row.every_months,
    }));

  const drivers: RevenueDrivers = {
    model: project.revenue_model,
    startingUnits,
    unitGrowthBps: intOf("unit_growth_bps") ?? 0,
    pricePerUnit: money(pricePerUnit, currency),
    monthlyChurnBps: intOf("monthly_churn_bps") ?? 0,
    cogsBps: intOf("cogs_bps") ?? 0,
    ...(intOf("take_rate_bps") !== null
      ? { takeRateBps: intOf("take_rate_bps")! }
      : {}),
    ...(minorOf("cac_per_unit") !== null
      ? { cacPerUnit: money(minorOf("cac_per_unit")!, currency) }
      : {}),
  };

  return {
    currency,
    horizonMonths: project.horizon_months,
    openingCash: money(project.opening_cash_minor, currency),
    costs,
    revenue: drivers,
  };
}

// ---------------------------------------------------------------------------
// Stage inputs
// ---------------------------------------------------------------------------

export async function buildStageInput(
  supabase: Client,
  projectId: string,
  stage: FinancialStage,
): Promise<unknown> {
  const { data: project } = await supabase
    .from("financial_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    throw new AiError(
      "AI_INVALID_INPUT",
      "Financial project not found.",
      false,
    );
  }

  switch (stage) {
    case "financial_planning": {
      const inherited = await readInherited(supabase, project);
      return {
        title: project.title,
        description: project.description ?? undefined,
        industry: project.industry ?? undefined,
        geography: project.geography ?? undefined,
        targetCustomer: project.target_customer ?? undefined,
        currency: project.currency,
        revenueModel: project.revenue_model,
        horizonMonths: project.horizon_months,
        inherited,
      };
    }

    case "cost_modeling": {
      const operatingModel = await readSectionText(
        supabase,
        projectId,
        "business_context",
        "operatingModel",
      );
      const { data: existing } = await supabase
        .from("financial_costs")
        .select("category, label")
        .eq("project_id", projectId)
        .limit(60);
      return {
        title: project.title,
        description: project.description ?? undefined,
        industry: project.industry ?? undefined,
        geography: project.geography ?? undefined,
        currency: project.currency,
        revenueModel: project.revenue_model,
        operatingModel: operatingModel ?? "not specified",
        existingCosts: existing ?? [],
      };
    }

    case "revenue_modeling": {
      const currency = project.currency as CurrencyCode;
      const { data: costRows } = await supabase
        .from("financial_costs")
        .select("category, kind, label, amount_minor, every_months")
        .eq("project_id", projectId);

      const costs: CostLine[] = (costRows ?? [])
        .filter((row) => isCostCategory(row.category) && isCostKind(row.kind))
        .map((row) => ({
          category: row.category as CostLine["category"],
          kind: row.kind as CostLine["kind"],
          label: row.label,
          amount: money(row.amount_minor, currency),
          everyMonths: row.every_months,
        }));

      return {
        title: project.title,
        description: project.description ?? undefined,
        currency: project.currency,
        revenueModel: project.revenue_model,
        targetCustomer: project.target_customer ?? undefined,
        geography: project.geography ?? undefined,
        horizonMonths: project.horizon_months,
        pricingEvidence: await readPricingEvidence(supabase, project),
        // Supplied so the model can sanity-check its pricing, never so it can
        // compute a break-even.
        monthlyFixedCostMinor: monthlyFixedCosts(costs, currency).minor,
      };
    }

    case "funding_analysis": {
      const model = buildFinancialModel(
        await readModelInput(supabase, project),
      );
      return {
        title: project.title,
        description: project.description ?? undefined,
        industry: project.industry ?? undefined,
        geography: project.geography ?? undefined,
        currency: project.currency,
        revenueModel: project.revenue_model,
        capitalRequiredMinor: capitalRequirement(model).minor,
        monthlyBurnMinor: model.cashFlow.averageMonthlyBurn.minor,
        runwayMonths: model.cashFlow.runwayMonths,
        breakEvenMonth: model.breakEven.month,
      };
    }

    case "financial_recommendations": {
      const model = buildFinancialModel(
        await readModelInput(supabase, project),
      );

      const [
        { data: costRows },
        { data: aiAssumptions },
        { count: fundingCount },
        { count: assumptionCount },
      ] = await Promise.all([
        supabase
          .from("financial_costs")
          .select("label, amount_minor")
          .eq("project_id", projectId)
          .order("amount_minor", { ascending: false })
          .limit(10),
        supabase
          .from("financial_assumptions")
          .select("key")
          .eq("project_id", projectId)
          .eq("source", "AI")
          .limit(40),
        supabase
          .from("funding_options")
          .select("id", { count: "exact", head: true })
          .eq("project_id", projectId),
        supabase
          .from("financial_assumptions")
          .select("id", { count: "exact", head: true })
          .eq("project_id", projectId),
      ]);

      return {
        title: project.title,
        currency: project.currency,
        revenueModel: project.revenue_model,
        computed: {
          totalRevenueMinor: model.totals.revenue.minor,
          totalOperatingProfitMinor: model.totals.operatingProfit.minor,
          grossMarginBps: model.unitEconomics.grossMarginBps,
          breakEvenMonth: model.breakEven.month,
          breakEvenRevenueMinor: model.breakEven.revenue?.minor ?? null,
          monthlyBurnMinor: model.cashFlow.averageMonthlyBurn.minor,
          runwayMonths: model.cashFlow.runwayMonths,
          capitalRequiredMinor: capitalRequirement(model).minor,
          cacPaybackMonths: model.unitEconomics.cacPaybackMonths,
          ltvToCacBps: model.unitEconomics.ltvToCacBps,
        },
        topCostLines: (costRows ?? []).map((row) => ({
          label: row.label,
          amountMinor: row.amount_minor,
        })),
        fundingOptionCount: fundingCount ?? 0,
        assumptionCount: assumptionCount ?? 0,
        aiAssumptionKeys: (aiAssumptions ?? []).map((row) => row.key),
      };
    }

    // Compute stages never reach here — `runComputeStage` handles them without
    // a model. Reaching this branch means the engine routed one wrongly.
    case "unit_economics":
    case "scenario_analysis":
    case "cashflow_break_even":
      throw new AiError(
        "AI_INVALID_INPUT",
        `Stage ${stage} is computed, not generated, and must not be sent to a provider.`,
        false,
      );
  }
}

// ---------------------------------------------------------------------------
// Compute stages — no model, no network
// ---------------------------------------------------------------------------

/**
 * Run a compute stage.
 *
 * Reads stored assumptions, runs the deterministic engine and returns section
 * rows. No provider is contacted, no token is spent, and the result is a pure
 * function of the rows — run it twice and the bytes match.
 */
export async function runComputeStage(
  supabase: Client,
  projectId: string,
  stage: "unit_economics" | "scenario_analysis" | "cashflow_break_even",
): Promise<MappedStageOutput> {
  const { data: project } = await supabase
    .from("financial_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    throw new AiError(
      "AI_INVALID_INPUT",
      "Financial project not found.",
      false,
    );
  }

  const input = await readModelInput(supabase, project);
  const model = buildFinancialModel(input);

  switch (stage) {
    case "unit_economics":
      return {
        ...EMPTY,
        results: [
          {
            section_key: "unit_economics",
            structured_content: {
              currency: model.currency,
              ...serialiseUnitEconomics(model),
            },
            confidence: "high",
            status: "complete",
          },
          {
            section_key: "revenue_model",
            structured_content: {
              currency: model.currency,
              model: input.revenue.model,
              startingUnits: input.revenue.startingUnits,
              unitGrowthBps: input.revenue.unitGrowthBps,
              pricePerUnitMinor: input.revenue.pricePerUnit.minor,
              monthlyChurnBps: input.revenue.monthlyChurnBps,
              cogsBps: input.revenue.cogsBps ?? 0,
            },
            confidence: "high",
            status: "complete",
          },
        ],
      };

    case "scenario_analysis": {
      const scenarios = buildScenarios(input);
      return {
        ...EMPTY,
        results: [
          {
            section_key: "scenarios",
            structured_content: {
              currency: model.currency,
              scenarios: scenarios.map((entry) => ({
                scenario: entry.scenario,
                // The adjustments are printed so a reader can see exactly what
                // "conservative" meant, rather than trusting the label.
                adjustments: entry.adjustments,
                totalRevenueMinor: entry.model.totals.revenue.minor,
                totalOperatingProfitMinor:
                  entry.model.totals.operatingProfit.minor,
                grossMarginBps: entry.model.unitEconomics.grossMarginBps,
                breakEvenMonth: entry.model.breakEven.month,
                runwayMonths: entry.model.cashFlow.runwayMonths,
                capitalRequiredMinor: capitalRequirement(entry.model).minor,
              })),
            },
            confidence: "high",
            status: "complete",
          },
        ],
      };
    }

    case "cashflow_break_even":
      return {
        ...EMPTY,
        results: [
          {
            section_key: "forecast",
            structured_content: {
              currency: model.currency,
              horizonMonths: model.horizonMonths,
              months: model.months.map(serialiseMonth),
              totals: {
                revenueMinor: model.totals.revenue.minor,
                cogsMinor: model.totals.cogs.minor,
                grossProfitMinor: model.totals.grossProfit.minor,
                operatingExpensesMinor: model.totals.operatingExpenses.minor,
                operatingProfitMinor: model.totals.operatingProfit.minor,
                oneTimeCostsMinor: model.totals.oneTimeCosts.minor,
              },
            },
            confidence: "high",
            status: "complete",
          },
          {
            section_key: "break_even",
            structured_content: {
              currency: model.currency,
              revenueMinor: model.breakEven.revenue?.minor ?? null,
              units: model.breakEven.units,
              month: model.breakEven.month,
              fixedMonthlyCostsMinor: model.breakEven.fixedMonthlyCosts.minor,
              contributionMarginBps: model.breakEven.contributionMarginBps,
              unreachableReason: model.breakEven.unreachableReason,
            },
            confidence: "high",
            status: model.breakEven.revenue === null ? "partial" : "complete",
          },
          {
            section_key: "cash_flow",
            structured_content: {
              currency: model.currency,
              openingCashMinor: model.cashFlow.openingCash.minor,
              closingCashMinor: model.cashFlow.closingCash.minor,
              lowestCashMinor: model.cashFlow.lowestCash.minor,
              lowestCashMonth: model.cashFlow.lowestCashMonth,
              averageMonthlyBurnMinor: model.cashFlow.averageMonthlyBurn.minor,
              runwayMonths: model.cashFlow.runwayMonths,
              firstNegativeMonth: model.cashFlow.firstNegativeMonth,
            },
            confidence: "high",
            status: "complete",
          },
          {
            section_key: "capital_requirement",
            structured_content: {
              currency: model.currency,
              capitalRequiredMinor: capitalRequirement(model).minor,
              peakFundingRequirementMinor:
                model.cashFlow.peakFundingRequirement.minor,
              oneTimeCostsMinor: model.totals.oneTimeCosts.minor,
            },
            confidence: "high",
            status: "complete",
          },
        ],
      };
  }
}

function serialiseMonth(row: {
  month: number;
  units: number;
  newUnits: number;
  churnedUnits: number;
  revenue: { minor: number };
  cogs: { minor: number };
  grossProfit: { minor: number };
  operatingExpenses: { minor: number };
  operatingProfit: { minor: number };
  netCashFlow: { minor: number };
  closingCash: { minor: number };
  grossMarginBps: number | null;
}) {
  return {
    month: row.month,
    units: row.units,
    newUnits: row.newUnits,
    churnedUnits: row.churnedUnits,
    revenueMinor: row.revenue.minor,
    cogsMinor: row.cogs.minor,
    grossProfitMinor: row.grossProfit.minor,
    operatingExpensesMinor: row.operatingExpenses.minor,
    operatingProfitMinor: row.operatingProfit.minor,
    netCashFlowMinor: row.netCashFlow.minor,
    closingCashMinor: row.closingCash.minor,
    grossMarginBps: row.grossMarginBps,
  };
}

function serialiseUnitEconomics(model: ReturnType<typeof buildFinancialModel>) {
  const ue = model.unitEconomics;
  return {
    arpuMinor: ue.arpu?.minor ?? null,
    cacMinor: ue.cac?.minor ?? null,
    ltvMinor: ue.ltv?.minor ?? null,
    grossMarginBps: ue.grossMarginBps,
    contributionMarginBps: ue.contributionMarginBps,
    cacPaybackMonths: ue.cacPaybackMonths,
    ltvToCacBps: ue.ltvToCacBps,
    monthlyChurnBps: ue.monthlyChurnBps,
    // Printed rather than omitted: a metric the model deliberately did not
    // compute, and why, is more useful than a blank cell.
    notApplicable: ue.notApplicable,
  };
}

// ---------------------------------------------------------------------------
// AI stage outputs
// ---------------------------------------------------------------------------

export function mapStageOutput(
  stage: FinancialStage,
  data: unknown,
  providerSources: AiRetrievedSource[],
): MappedStageOutput {
  switch (stage) {
    case "financial_planning": {
      const out = data as PlanningOutput;
      return {
        ...EMPTY,
        results: [
          {
            section_key: "business_context",
            structured_content: {
              operatingModel: stripUrls(out.operatingModel),
              keyDrivers: out.keyDrivers.map(stripUrls),
              openQuestions: out.openQuestions.map(stripUrls),
            },
            confidence: "medium",
            status: "complete",
          },
        ],
        assumptions: out.assumptions.map(toAssumptionRow),
      };
    }

    case "cost_modeling": {
      const out = data as CostOutput;
      const lines = [...out.oneTime, ...out.recurring];
      return {
        ...EMPTY,
        results: [
          {
            section_key: "startup_costs",
            structured_content: {
              lines: out.oneTime,
              notApplicable: out.notApplicable,
              notes: out.notes ? stripUrls(out.notes) : null,
            },
            confidence: "medium",
            status: out.oneTime.length ? "complete" : "partial",
          },
          {
            section_key: "operating_costs",
            structured_content: {
              lines: out.recurring,
              notApplicable: out.notApplicable,
            },
            confidence: "medium",
            status: out.recurring.length ? "complete" : "partial",
          },
        ],
        costs: lines.map((line) => ({
          category: line.category,
          kind: line.kind,
          label: line.label,
          amount_minor: line.amountMinor,
          every_months: line.everyMonths,
          source: "AI",
          confidence: line.confidence,
          rationale: line.rationale ? stripUrls(line.rationale) : null,
        })),
      };
    }

    case "revenue_modeling": {
      const out = data as RevenueOutput;
      // The drivers are stored as assumptions with stable keys, which is what
      // `readModelInput` reads back. The model's own `assumptions` array is
      // merged in for anything extra it wanted to record.
      const drivers = [
        driverAssumption(
          "starting_units",
          "Starting units",
          "count",
          out.startingUnits,
        ),
        driverAssumption(
          "unit_growth_bps",
          "Monthly unit growth",
          "bps",
          out.unitGrowthBps,
        ),
        driverAssumption(
          "monthly_churn_bps",
          "Monthly churn",
          "bps",
          out.monthlyChurnBps,
        ),
        driverAssumption(
          "cogs_bps",
          "Variable cost of revenue",
          "bps",
          out.cogsBps,
        ),
        moneyAssumption(
          "price_per_unit",
          "Price per unit",
          out.pricePerUnitMinor,
        ),
        ...(out.takeRateBps !== undefined
          ? [
              driverAssumption(
                "take_rate_bps",
                "Take rate",
                "bps",
                out.takeRateBps,
              ),
            ]
          : []),
        ...(out.cacPerUnitMinor !== undefined
          ? [
              moneyAssumption(
                "cac_per_unit",
                "Customer acquisition cost",
                out.cacPerUnitMinor,
              ),
            ]
          : []),
      ];

      return {
        ...EMPTY,
        results: [
          {
            section_key: "key_assumptions",
            structured_content: { rationale: stripUrls(out.rationale) },
            confidence: "medium",
            status: "complete",
          },
        ],
        assumptions: [...drivers, ...out.assumptions.map(toAssumptionRow)],
      };
    }

    case "funding_analysis": {
      const out = data as FundingOutput;
      const citedHosts = new Set(
        providerSources
          .map((source) => hostOf(source.url))
          .filter((host): host is string => host !== null),
      );

      const discarded: string[] = [];
      const funding: unknown[] = [];

      for (const option of out.options) {
        // Bootstrapping is a legitimate option with no external source.
        if (option.fundingType === "BOOTSTRAP") {
          funding.push(toFundingRow(option, null));
          continue;
        }

        // THE fabrication control. An external programme whose domain does not
        // correspond to a host the provider actually cited is dropped — not
        // stored with low confidence. A funding programme that does not exist
        // is the most damaging thing this report can contain.
        const matched = option.domain
          ? matchCitedHost(option.domain, citedHosts)
          : null;

        if (!matched) {
          discarded.push(option.name);
          continue;
        }

        const citation = citationFor(matched, providerSources);
        funding.push(
          toFundingRow(
            option,
            citation ? canonicalise(citation.url) : null,
            citation?.url ?? null,
          ),
        );
      }

      return {
        ...EMPTY,
        results: [
          {
            section_key: "funding_options",
            structured_content: {
              queriesUsed: out.queriesUsed,
              notes: out.notes ? stripUrls(out.notes) : null,
              found: funding.length,
              discarded: discarded.length,
            },
            confidence: out.insufficientEvidence ? "low" : "medium",
            status:
              out.insufficientEvidence || funding.length === 0
                ? "insufficient_evidence"
                : "complete",
          },
        ],
        sources: sourceRowsFrom(providerSources),
        funding,
        discardedOptions: discarded,
      };
    }

    case "financial_recommendations": {
      const out = data as RecommendationsOutput;
      return {
        ...EMPTY,
        results: [
          {
            section_key: "executive_summary",
            structured_content: { text: stripUrls(out.executiveSummary) },
            confidence: out.overallConfidence,
            status: "complete",
          },
          {
            section_key: "recommendations",
            structured_content: { recommendations: out.recommendations },
            confidence: out.overallConfidence,
            status: "complete",
          },
          {
            section_key: "financial_risks",
            structured_content: { risks: out.risks },
            confidence: out.overallConfidence,
            status: out.risks.length ? "complete" : "partial",
          },
          {
            section_key: "sources_limitations",
            structured_content: { limitations: out.limitations },
            confidence: "high",
            status: "complete",
          },
        ],
      };
    }

    case "unit_economics":
    case "scenario_analysis":
    case "cashflow_break_even":
      // Compute stages produce their rows in `runComputeStage`.
      return EMPTY;
  }
}

// ---------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------

function toAssumptionRow(assumption: {
  key: string;
  label: string;
  unit: string;
  valueMinor?: number;
  valueInt?: number;
  source: string;
  confidence: string;
  rationale?: string;
  evidenceUrl?: string;
}) {
  return {
    key: assumption.key,
    label: assumption.label,
    unit: assumption.unit,
    value_minor:
      assumption.unit === "money" ? (assumption.valueMinor ?? 0) : null,
    value_int: assumption.unit === "money" ? null : (assumption.valueInt ?? 0),
    // A model may only ever propose AI or an inherited value. USER is not in
    // its vocabulary, and the SQL upsert refuses to overwrite a USER row.
    source: assumption.source === "USER" ? "AI" : assumption.source,
    confidence: assumption.confidence,
    rationale: assumption.rationale ? stripUrls(assumption.rationale) : null,
    evidence_url: assumption.evidenceUrl ?? null,
  };
}

function driverAssumption(
  key: string,
  label: string,
  unit: "count" | "bps" | "months",
  value: number,
) {
  return {
    key,
    label,
    unit,
    value_minor: null,
    value_int: value,
    source: "AI",
    confidence: "medium",
    rationale: null,
    evidence_url: null,
  };
}

function moneyAssumption(key: string, label: string, minor: number) {
  return {
    key,
    label,
    unit: "money",
    value_minor: minor,
    value_int: null,
    source: "AI",
    confidence: "medium",
    rationale: null,
    evidence_url: null,
  };
}

function toFundingRow(
  option: FundingOutput["options"][number],
  canonicalUrl: string | null,
  applicationUrl: string | null = null,
) {
  return {
    name: option.name,
    provider: option.provider ?? null,
    funding_type: option.fundingType,
    geography: option.geography ?? null,
    eligibility: option.eligibility ? stripUrls(option.eligibility) : null,
    // Absent stays absent. A range the provider does not publish is null, not
    // an estimate.
    amount_min_minor: option.amountMinMinor ?? null,
    amount_max_minor: option.amountMaxMinor ?? null,
    terms: option.terms ? stripUrls(option.terms) : null,
    // The application URL comes from the citation record, never from the model.
    application_url: applicationUrl,
    canonical_url: canonicalUrl,
    suitability: option.suitability,
    suitability_rationale: stripUrls(option.suitabilityRationale),
    confidence: option.confidence,
  };
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

async function readSectionText(
  supabase: Client,
  projectId: string,
  sectionKey: string,
  field: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("financial_results")
    .select("structured_content")
    .eq("project_id", projectId)
    .eq("section_key", sectionKey)
    .eq("is_current", true)
    .maybeSingle();

  const content = (data?.structured_content ?? {}) as Record<string, unknown>;
  const value = content[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * What the earlier products already established.
 *
 * Passed to planning as context so the model does not re-derive things the
 * business plan already states — and labelled `INHERITED_*` so the report can
 * show that the number came from somewhere rather than being invented here.
 */
async function readInherited(
  supabase: Client,
  project: {
    business_plan_id: string | null;
    research_request_id: string | null;
  },
): Promise<{ key: string; label: string; value: string; origin: string }[]> {
  const out: { key: string; label: string; value: string; origin: string }[] =
    [];

  if (project.business_plan_id) {
    const { data: plan } = await supabase
      .from("business_plans")
      .select("input_json")
      .eq("id", project.business_plan_id)
      .maybeSingle();

    const input = (plan?.input_json ?? {}) as Record<string, unknown>;
    for (const [key, label] of [
      ["businessModel", "Business model"],
      ["targetAudience", "Target audience"],
      ["estimatedBudget", "Estimated budget"],
    ] as const) {
      const value = input[key];
      if (value !== undefined && value !== null && String(value).trim()) {
        out.push({
          key,
          label,
          value: String(value).slice(0, 500),
          origin: "INHERITED_PLAN",
        });
      }
    }
  }

  if (project.research_request_id) {
    const { data: rows } = await supabase
      .from("research_evidence")
      .select("claim, section_key")
      .eq("research_request_id", project.research_request_id)
      .in("section_key", ["business_model_pricing", "market_size_growth"])
      .limit(10);

    for (const row of rows ?? []) {
      out.push({
        key: row.section_key,
        label: "Market research finding",
        value: String(row.claim).slice(0, 500),
        origin: "INHERITED_RESEARCH",
      });
    }
  }

  return out.slice(0, 40);
}

/**
 * Pricing signals from market research and competitor research.
 *
 * Given to the revenue stage as EVIDENCE, not as a value to copy. The prompt is
 * explicit that a competitor's price is a benchmark rather than a commitment.
 */
async function readPricingEvidence(
  supabase: Client,
  project: {
    research_request_id: string | null;
    competitor_project_id: string | null;
  },
): Promise<{ source: string; claim: string; url?: string }[]> {
  const out: { source: string; claim: string; url?: string }[] = [];

  if (project.research_request_id) {
    const { data } = await supabase
      .from("research_evidence")
      .select("claim, research_sources(url)")
      .eq("research_request_id", project.research_request_id)
      .eq("section_key", "business_model_pricing")
      .limit(10);

    for (const row of data ?? []) {
      const joined = row as unknown as {
        claim: string;
        research_sources: { url: string } | null;
      };
      out.push({
        source: "market research",
        claim: joined.claim.slice(0, 500),
        ...(joined.research_sources?.url
          ? { url: joined.research_sources.url }
          : {}),
      });
    }
  }

  if (project.competitor_project_id) {
    const { data } = await supabase
      .from("competitors")
      .select("name, website, pricing")
      .eq("project_id", project.competitor_project_id)
      .in("verification_status", ["VERIFIED", "PARTIALLY_VERIFIED"])
      .limit(10);

    for (const row of data ?? []) {
      const pricing = (row.pricing ?? {}) as { plans?: unknown[] };
      if (!Array.isArray(pricing.plans) || pricing.plans.length === 0) continue;
      out.push({
        source: `competitor: ${row.name}`,
        claim: JSON.stringify(pricing.plans).slice(0, 500),
        ...(row.website ? { url: row.website } : {}),
      });
    }
  }

  return out.slice(0, 20);
}
