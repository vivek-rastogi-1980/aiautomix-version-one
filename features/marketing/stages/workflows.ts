import type { AnyWorkflowDefinition } from "@/features/ai/engine/types";
import type { GtmStage } from "@/features/marketing/types";
import {
  gtmPlanningInputSchema,
  gtmPlanningOutputSchema,
  icpInputSchema,
  icpOutputSchema,
  positioningInputSchema,
  positioningOutputSchema,
  channelInputSchema,
  channelOutputSchema,
  contentInputSchema,
  contentOutputSchema,
  funnelInputSchema,
  funnelOutputSchema,
  planInputSchema,
  planOutputSchema,
} from "@/features/marketing/stages/contracts";

/**
 * The AI stages of Marketing Intelligence, as workflow definitions.
 *
 * SEVEN entries for EIGHT stages, and the gap is the point: `acquisition_economics`
 * has no workflow because it calls no model. It runs `calc/acquisition.ts` in
 * process over stored funnel steps and the Phase 8 financial model. A registry
 * entry for it would mean a language model had entered the arithmetic path,
 * which is exactly what §16 forbids — so its absence here is a structural
 * guarantee, not an oversight, and the test suite asserts it.
 *
 * `gtm-channels` is the only stage that declares `capability: "research"`. It is
 * the only one that needs the web, and the declaration lives on the workflow so
 * it cannot be run without retrieval by accident — nor can any of the others
 * quietly acquire web access and a web-sized bill.
 */

export const GTM_WORKFLOW_IDS: Partial<Record<GtmStage, string>> = {
  gtm_planning: "gtm-planning",
  icp_persona: "gtm-icp",
  positioning_messaging: "gtm-positioning",
  channel_strategy: "gtm-channels",
  content_campaign_strategy: "gtm-content",
  sales_funnel: "gtm-funnel",
  gtm_90_day_plan: "gtm-plan",
};

/** Compact JSON for a prompt variable. Keeps inter-stage tokens down. §42. */
function j(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : "not specified";
}

function list(value: unknown): string {
  return Array.isArray(value) && value.length > 0
    ? value.map((item) => `- ${String(item)}`).join("\n")
    : "none supplied";
}

export const GTM_WORKFLOWS: Record<string, AnyWorkflowDefinition> = {
  "gtm-planning": {
    id: "gtm-planning",
    label: "GTM planning",
    description:
      "Establishes the go-to-market context and selling motion from existing business records.",
    promptVersion: "v1",
    inputSchema: gtmPlanningInputSchema,
    outputSchema: gtmPlanningOutputSchema,
    provider: "openai",
    maxOutputTokens: 3500,
    toVariables: (input) => ({
      title: text(input.title),
      description: text(input.description),
      industry: text(input.industry),
      geography: text(input.geography),
      currency: text(input.currency),
      inherited: j(input.inherited),
    }),
  },

  "gtm-icp": {
    id: "gtm-icp",
    label: "ICP & personas",
    description:
      "Defines the ideal customer profile and buyer personas, separating evidence from assumption.",
    promptVersion: "v1",
    inputSchema: icpInputSchema,
    outputSchema: icpOutputSchema,
    provider: "openai",
    maxOutputTokens: 6000,
    toVariables: (input) => ({
      title: text(input.title),
      offering: text(input.offering),
      motion: text(input.motion),
      geography: text(input.geography),
      industry: text(input.industry),
      researchFindings: text(input.researchFindings),
      competitorAudiences: text(input.competitorAudiences),
    }),
  },

  "gtm-positioning": {
    id: "gtm-positioning",
    label: "Positioning & messaging",
    description:
      "Writes positioning and messaging, checking each differentiator against competitor evidence.",
    promptVersion: "v1",
    inputSchema: positioningInputSchema,
    outputSchema: positioningOutputSchema,
    provider: "openai",
    maxOutputTokens: 6000,
    toVariables: (input) => ({
      title: text(input.title),
      offering: text(input.offering),
      motion: text(input.motion),
      icpSummary: text(input.icpSummary),
      painPoints: list(input.painPoints),
      competitorEvidence: text(input.competitorEvidence),
      productCapabilities: text(input.productCapabilities),
    }),
  },

  "gtm-channels": {
    id: "gtm-channels",
    label: "Channel strategy",
    description:
      "Researches channel fit for this audience and rates each channel on the published rubric.",
    promptVersion: "v1",
    inputSchema: channelInputSchema,
    outputSchema: channelOutputSchema,
    provider: "openai",
    // The only stage that reaches the web, declared here so it cannot be run
    // without retrieval — nor can another stage acquire it by accident.
    capability: "research",
    maxSources: 12,
    maxOutputTokens: 8000,
    toVariables: (input) => ({
      title: text(input.title),
      offering: text(input.offering),
      motion: text(input.motion),
      geography: text(input.geography),
      icpSummary: text(input.icpSummary),
      personaRoles: list(input.personaRoles),
      competitorChannels: list(input.competitorChannels),
    }),
  },

  "gtm-content": {
    id: "gtm-content",
    label: "Content & campaigns",
    description:
      "Turns positioning into content pillars and campaigns tied to funnel stages.",
    promptVersion: "v1",
    inputSchema: contentInputSchema,
    outputSchema: contentOutputSchema,
    provider: "openai",
    maxOutputTokens: 6000,
    toVariables: (input) => ({
      title: text(input.title),
      offering: text(input.offering),
      motion: text(input.motion),
      icpSummary: text(input.icpSummary),
      messagingPillars: list(input.messagingPillars),
      activeChannels: list(input.activeChannels),
    }),
  },

  "gtm-funnel": {
    id: "gtm-funnel",
    label: "Sales funnel",
    description:
      "Proposes conversion assumptions, qualification criteria and sales messaging for this motion.",
    promptVersion: "v1",
    inputSchema: funnelInputSchema,
    outputSchema: funnelOutputSchema,
    provider: "openai",
    maxOutputTokens: 6000,
    toVariables: (input) => ({
      title: text(input.title),
      offering: text(input.offering),
      motion: text(input.motion),
      funnelStages: list(input.funnelStages),
      icpSummary: text(input.icpSummary),
      objections: list(input.objections),
    }),
  },

  "gtm-plan": {
    id: "gtm-plan",
    label: "90-day GTM plan",
    description:
      "Sequences the first ninety days into prioritised actions around already-calculated figures.",
    promptVersion: "v1",
    inputSchema: planInputSchema,
    outputSchema: planOutputSchema,
    provider: "openai",
    maxOutputTokens: 8000,
    toVariables: (input) => ({
      title: text(input.title),
      offering: text(input.offering),
      motion: text(input.motion),
      primaryChannels: list(input.primaryChannels),
      secondaryChannels: list(input.secondaryChannels),
      campaignNames: list(input.campaignNames),
      computed: j(input.computed),
      applicableKpis: list(input.applicableKpis),
    }),
  },
};
