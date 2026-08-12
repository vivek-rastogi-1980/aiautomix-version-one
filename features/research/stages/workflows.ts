import type { AnyWorkflowDefinition } from "@/features/ai/engine/types";
import type { ResearchStage } from "@/features/research/types";
import {
  planningInputSchema,
  planningOutputSchema,
  discoveryInputSchema,
  discoveryOutputSchema,
  collectionInputSchema,
  collectionOutputSchema,
  evidenceInputSchema,
  evidenceOutputSchema,
  analysisInputSchema,
  analysisOutputSchema,
  synthesisInputSchema,
  synthesisOutputSchema,
  reportInputSchema,
  reportOutputSchema,
} from "@/features/research/stages/contracts";

/**
 * The seven research stages as workflow definitions.
 *
 * Each is a first-class entry in the platform registry, so every stage gets the
 * engine's input validation, retries, response validation, usage logging and
 * cost estimation without the research feature reimplementing any of it.
 *
 * `discovery` and `collection` declare `capability: "research"`, which is what
 * routes them through `AiProvider.research()` and therefore to the web. The
 * declaration lives on the workflow rather than at the call site so a stage
 * cannot be run without retrieval by accident.
 */

export const RESEARCH_WORKFLOW_IDS: Record<ResearchStage, string> = {
  planning: "research-planning",
  discovery: "research-discovery",
  collection: "research-collection",
  evidence: "research-evidence",
  analysis: "research-analysis",
  synthesis: "research-synthesis",
  report: "research-report",
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

export const RESEARCH_WORKFLOWS: Record<string, AnyWorkflowDefinition> = {
  "research-planning": {
    id: "research-planning",
    label: "Research planning",
    description: "Turns a research brief into questions and a source strategy.",
    promptVersion: "v1",
    inputSchema: planningInputSchema,
    outputSchema: planningOutputSchema,
    provider: "openai",
    maxOutputTokens: 2500,
    toVariables: (input) => ({
      title: text(input.title),
      industry: text(input.industry),
      geography: text(input.geography),
      targetCustomer: text(input.targetCustomer),
      businessModel: text(input.businessModel),
      scope: text(input.scope),
      questions: j(input.questions),
      depth: text(input.depth),
    }),
  },

  "research-discovery": {
    id: "research-discovery",
    label: "Source discovery",
    description: "Searches the web for authoritative sources. Retrieval stage.",
    promptVersion: "v1",
    inputSchema: discoveryInputSchema,
    outputSchema: discoveryOutputSchema,
    provider: "openai",
    capability: "research",
    maxOutputTokens: 3000,
    toVariables: (input) => ({
      researchQuestions: j(input.researchQuestions),
      searchStrategies: j(input.searchStrategies),
      industry: text(input.industry),
      geography: text(input.geography),
      maxSources: String(input.maxSources),
    }),
  },

  "research-collection": {
    id: "research-collection",
    label: "Source collection",
    description:
      "Normalises and classifies retrieved sources. Retrieval stage.",
    promptVersion: "v1",
    inputSchema: collectionInputSchema,
    outputSchema: collectionOutputSchema,
    provider: "openai",
    capability: "research",
    maxOutputTokens: 3000,
    toVariables: (input) => ({
      researchQuestions: j(input.researchQuestions),
      knownSources: j(input.knownSources),
      maxSources: String(input.maxSources),
    }),
  },

  "research-evidence": {
    id: "research-evidence",
    label: "Evidence extraction",
    description: "Extracts claims and ties each to a stored source.",
    promptVersion: "v1",
    inputSchema: evidenceInputSchema,
    outputSchema: evidenceOutputSchema,
    provider: "openai",
    maxOutputTokens: 6000,
    toVariables: (input) => ({
      researchQuestions: j(input.researchQuestions),
      sources: j(input.sources),
    }),
  },

  "research-analysis": {
    id: "research-analysis",
    label: "Market analysis",
    description: "Sectioned analysis constrained to the stored evidence.",
    promptVersion: "v1",
    inputSchema: analysisInputSchema,
    outputSchema: analysisOutputSchema,
    provider: "openai",
    maxOutputTokens: 9000,
    toVariables: (input) => ({
      researchQuestions: j(input.researchQuestions),
      evidence: j(input.evidence),
      industry: text(input.industry),
      geography: text(input.geography),
    }),
  },

  "research-synthesis": {
    id: "research-synthesis",
    label: "Synthesis",
    description: "Strategic conclusions across the completed analysis.",
    promptVersion: "v1",
    inputSchema: synthesisInputSchema,
    outputSchema: synthesisOutputSchema,
    provider: "openai",
    maxOutputTokens: 3500,
    toVariables: (input) => ({
      sections: j(input.sections),
      evidenceCount: String(input.evidenceCount),
      sourceCount: String(input.sourceCount),
    }),
  },

  "research-report": {
    id: "research-report",
    label: "Report generation",
    description: "Assembles the framing sections of the finished report.",
    promptVersion: "v1",
    inputSchema: reportInputSchema,
    outputSchema: reportOutputSchema,
    provider: "openai",
    maxOutputTokens: 4000,
    toVariables: (input) => ({
      title: text(input.title),
      sections: j(input.sections),
      synthesis: j(input.synthesis),
      sourceCount: String(input.sourceCount),
      evidenceCount: String(input.evidenceCount),
    }),
  },
};
