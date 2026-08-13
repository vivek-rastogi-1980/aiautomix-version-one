import type { AnyWorkflowDefinition } from "@/features/ai/engine/types";
import type { CompetitorStage } from "@/features/competitors/types";
import {
  planningInputSchema,
  planningOutputSchema,
  discoveryInputSchema,
  discoveryOutputSchema,
  verificationInputSchema,
  verificationOutputSchema,
  profilingInputSchema,
  profilingOutputSchema,
  pricingInputSchema,
  pricingOutputSchema,
  analysisInputSchema,
  analysisOutputSchema,
  recommendationsInputSchema,
  recommendationsOutputSchema,
} from "@/features/competitors/stages/contracts";

/**
 * The seven Competitor Intelligence stages as workflow definitions.
 *
 * Each is a first-class entry in the platform registry, so every stage gets the
 * engine's input validation, retries, response validation, usage logging and
 * cost estimation without this feature reimplementing any of it.
 *
 * `discovery`, `verification` and `pricing_positioning` declare
 * `capability: "research"`, which is what routes them through
 * `AiProvider.research()` and therefore to the web. The declaration lives on
 * the workflow rather than at the call site, so a retrieval stage cannot be run
 * without retrieval by accident — and, just as importantly, the other four
 * cannot quietly acquire web access and a web-sized bill.
 */

export const COMPETITOR_WORKFLOW_IDS: Record<CompetitorStage, string> = {
  planning: "competitor-planning",
  discovery: "competitor-discovery",
  verification: "competitor-verification",
  profiling: "competitor-profiling",
  pricing_positioning: "competitor-pricing",
  analysis: "competitor-analysis",
  recommendations: "competitor-recommendations",
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

export const COMPETITOR_WORKFLOWS: Record<string, AnyWorkflowDefinition> = {
  "competitor-planning": {
    id: "competitor-planning",
    label: "Competitor planning",
    description:
      "Turns a business brief into direct/indirect competitor criteria and a search strategy.",
    promptVersion: "v1",
    inputSchema: planningInputSchema,
    outputSchema: planningOutputSchema,
    provider: "openai",
    maxOutputTokens: 2500,
    toVariables: (input) => ({
      title: text(input.title),
      description: text(input.description),
      category: text(input.category),
      geography: text(input.geography),
      targetCustomer: text(input.targetCustomer),
      customerProblem: text(input.customerProblem),
      businessModel: text(input.businessModel),
      knownCompetitors: j(input.knownCompetitors),
      depth: text(input.depth),
      maxCompetitors: String(input.maxCompetitors),
    }),
  },

  "competitor-discovery": {
    id: "competitor-discovery",
    label: "Competitor discovery",
    description: "Searches the web for candidate competitors. Retrieval stage.",
    promptVersion: "v1",
    inputSchema: discoveryInputSchema,
    outputSchema: discoveryOutputSchema,
    provider: "openai",
    capability: "research",
    maxOutputTokens: 4000,
    toVariables: (input) => ({
      businessCategory: text(input.businessCategory),
      productCategory: text(input.productCategory),
      geography: text(input.geography),
      targetCustomer: text(input.targetCustomer),
      directCriteria: j(input.directCriteria),
      indirectCriteria: j(input.indirectCriteria),
      searchStrategies: j(input.searchStrategies),
      knownCompetitors: j(input.knownCompetitors),
      maxCompetitors: String(input.maxCompetitors),
      maxSources: String(input.maxSources),
    }),
  },

  "competitor-verification": {
    id: "competitor-verification",
    label: "Competitor verification",
    description:
      "Checks each candidate exists and is relevant. Retrieval stage.",
    promptVersion: "v1",
    inputSchema: verificationInputSchema,
    outputSchema: verificationOutputSchema,
    provider: "openai",
    capability: "research",
    maxOutputTokens: 4000,
    toVariables: (input) => ({
      directCriteria: j(input.directCriteria),
      indirectCriteria: j(input.indirectCriteria),
      geography: text(input.geography),
      targetCustomer: text(input.targetCustomer),
      candidates: j(input.candidates),
    }),
  },

  "competitor-profiling": {
    id: "competitor-profiling",
    label: "Competitor profiling",
    description:
      "Builds structured profiles from stored evidence. Reads rows, not the web.",
    promptVersion: "v1",
    inputSchema: profilingInputSchema,
    outputSchema: profilingOutputSchema,
    provider: "openai",
    maxOutputTokens: 9000,
    toVariables: (input) => ({
      targetCustomer: text(input.targetCustomer),
      productCategory: text(input.productCategory),
      competitors: j(input.competitors),
      evidence: j(input.evidence),
    }),
  },

  "competitor-pricing": {
    id: "competitor-pricing",
    label: "Pricing & positioning",
    description:
      "Records publicly displayed pricing and positioning. Retrieval stage.",
    promptVersion: "v1",
    inputSchema: pricingInputSchema,
    outputSchema: pricingOutputSchema,
    provider: "openai",
    capability: "research",
    maxOutputTokens: 9000,
    toVariables: (input) => ({
      competitors: j(input.competitors),
      targetCustomer: text(input.targetCustomer),
      maxSources: String(input.maxSources),
    }),
  },

  "competitor-analysis": {
    id: "competitor-analysis",
    label: "Competitive analysis",
    description:
      "Comparison matrix, market gaps and landscape, constrained to stored evidence.",
    promptVersion: "v1",
    inputSchema: analysisInputSchema,
    outputSchema: analysisOutputSchema,
    provider: "openai",
    maxOutputTokens: 10000,
    toVariables: (input) => ({
      productCategory: text(input.productCategory),
      targetCustomer: text(input.targetCustomer),
      ownBusiness: text(input.ownBusiness),
      competitors: j(input.competitors),
      evidence: j(input.evidence),
    }),
  },

  "competitor-recommendations": {
    id: "competitor-recommendations",
    label: "Strategic recommendations",
    description:
      "Positioning and go-to-market advice, labelled as advice rather than finding.",
    promptVersion: "v1",
    inputSchema: recommendationsInputSchema,
    outputSchema: recommendationsOutputSchema,
    provider: "openai",
    maxOutputTokens: 4000,
    toVariables: (input) => ({
      productCategory: text(input.productCategory),
      targetCustomer: text(input.targetCustomer),
      ownBusiness: text(input.ownBusiness),
      gaps: j(input.gaps),
      competitorSummary: text(input.competitorSummary),
      competitorCount: String(input.competitorCount),
      verifiedCount: String(input.verifiedCount),
    }),
  },
};
