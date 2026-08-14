import type { AnyWorkflowDefinition } from "@/features/ai/engine/types";
import type { FinancialStage } from "@/features/financials/types";
import {
  planningInputSchema,
  planningOutputSchema,
  costInputSchema,
  costOutputSchema,
  revenueInputSchema,
  revenueOutputSchema,
  fundingInputSchema,
  fundingOutputSchema,
  recommendationsInputSchema,
  recommendationsOutputSchema,
} from "@/features/financials/stages/contracts";

/**
 * The AI stages of Financial Intelligence, as workflow definitions.
 *
 * FIVE entries for EIGHT stages, and the gap is the point: `unit_economics`,
 * `scenario_analysis` and `cashflow_break_even` have no workflow because they
 * call no model. They run `calc/engine.ts` in process. A registry entry for one
 * of them would mean a language model had entered the arithmetic path, which is
 * exactly what this phase exists to prevent — so their absence here is a
 * structural guarantee, not an oversight, and the test suite asserts it.
 *
 * `funding_analysis` is the only stage that declares `capability: "research"`.
 * It is the only one that needs the web, and the declaration lives on the
 * workflow so it cannot be run without retrieval by accident — nor can any of
 * the others quietly acquire web access and a web-sized bill.
 */

export const FINANCIAL_WORKFLOW_IDS: Partial<Record<FinancialStage, string>> = {
  financial_planning: "financial-planning",
  cost_modeling: "financial-costs",
  revenue_modeling: "financial-revenue",
  funding_analysis: "financial-funding",
  financial_recommendations: "financial-recommendations",
};

/** Compact JSON for a prompt variable. Keeps inter-stage tokens down. */
function j(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : "not specified";
}

export const FINANCIAL_WORKFLOWS: Record<string, AnyWorkflowDefinition> = {
  "financial-planning": {
    id: "financial-planning",
    label: "Financial planning",
    description:
      "Establishes the operating shape of a business as typed assumptions.",
    promptVersion: "v1",
    inputSchema: planningInputSchema,
    outputSchema: planningOutputSchema,
    provider: "openai",
    maxOutputTokens: 3500,
    toVariables: (input) => ({
      title: text(input.title),
      description: text(input.description),
      industry: text(input.industry),
      geography: text(input.geography),
      targetCustomer: text(input.targetCustomer),
      currency: text(input.currency),
      revenueModel: text(input.revenueModel),
      horizonMonths: String(input.horizonMonths),
      inherited: j(input.inherited),
    }),
  },

  "financial-costs": {
    id: "financial-costs",
    label: "Cost model",
    description:
      "Proposes itemised one-time and recurring cost assumptions. Totals are computed, not returned.",
    promptVersion: "v1",
    inputSchema: costInputSchema,
    outputSchema: costOutputSchema,
    provider: "openai",
    maxOutputTokens: 6000,
    toVariables: (input) => ({
      title: text(input.title),
      description: text(input.description),
      industry: text(input.industry),
      geography: text(input.geography),
      currency: text(input.currency),
      revenueModel: text(input.revenueModel),
      operatingModel: text(input.operatingModel),
      existingCosts: j(input.existingCosts),
    }),
  },

  "financial-revenue": {
    id: "financial-revenue",
    label: "Revenue model",
    description:
      "Proposes revenue DRIVERS — units, price, growth, churn. Never revenue itself.",
    promptVersion: "v1",
    inputSchema: revenueInputSchema,
    outputSchema: revenueOutputSchema,
    provider: "openai",
    maxOutputTokens: 4000,
    toVariables: (input) => ({
      title: text(input.title),
      description: text(input.description),
      currency: text(input.currency),
      revenueModel: text(input.revenueModel),
      targetCustomer: text(input.targetCustomer),
      geography: text(input.geography),
      horizonMonths: String(input.horizonMonths),
      monthlyFixedCostMinor: String(input.monthlyFixedCostMinor),
      pricingEvidence: j(input.pricingEvidence),
    }),
  },

  "financial-funding": {
    id: "financial-funding",
    label: "Funding options",
    description:
      "Searches the web for real funding programmes. Retrieval stage.",
    promptVersion: "v1",
    inputSchema: fundingInputSchema,
    outputSchema: fundingOutputSchema,
    provider: "openai",
    capability: "research",
    maxOutputTokens: 8000,
    toVariables: (input) => ({
      title: text(input.title),
      description: text(input.description),
      industry: text(input.industry),
      geography: text(input.geography),
      currency: text(input.currency),
      revenueModel: text(input.revenueModel),
      capitalRequiredMinor: String(input.capitalRequiredMinor),
      monthlyBurnMinor: String(input.monthlyBurnMinor),
      runwayMonths:
        input.runwayMonths === null
          ? "not applicable"
          : String(input.runwayMonths),
      breakEvenMonth:
        input.breakEvenMonth === null
          ? "not reached"
          : String(input.breakEvenMonth),
    }),
  },

  "financial-recommendations": {
    id: "financial-recommendations",
    label: "Financial recommendations",
    description:
      "Explains figures the engine already computed and proposes actions. Labelled as advice.",
    promptVersion: "v1",
    inputSchema: recommendationsInputSchema,
    outputSchema: recommendationsOutputSchema,
    provider: "openai",
    maxOutputTokens: 5000,
    toVariables: (input) => ({
      title: text(input.title),
      currency: text(input.currency),
      revenueModel: text(input.revenueModel),
      computed: j(input.computed),
      topCostLines: j(input.topCostLines),
      fundingOptionCount: String(input.fundingOptionCount),
      assumptionCount: String(input.assumptionCount),
      aiAssumptionKeys: j(input.aiAssumptionKeys),
    }),
  },
};
