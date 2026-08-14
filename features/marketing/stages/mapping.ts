import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiRetrievedSource } from "@/features/ai/engine/types";
import type { Database, GtmProjectRow } from "@/types/database";
import { AiError } from "@/features/ai/engine/errors";
import {
  BPS_SCALE,
  isCurrencyCode,
  money,
  roundHalfAwayFromZero,
  type CurrencyCode,
} from "@/features/financials/money";
import {
  CHANNELS,
  FUNNEL_TEMPLATES,
  GTM_MOTIONS,
  KPIS_BY_MOTION,
  MAX_PLAN_ACTIONS,
  funnelFor,
  isChannel,
  isGtmMotion,
  type Channel,
  type ClaimKind,
  type GtmMotion,
  type GtmStage,
} from "@/features/marketing/types";
import {
  rankChannels,
  SCORING_DIMENSION_KEYS,
  SCORING_MODEL,
  type ChannelRatings,
} from "@/features/marketing/scoring";
import {
  buildAcquisitionModel,
  buildAcquisitionScenarios,
  splitBudgetByChannel,
  type AcquisitionInput,
  type FunnelStepInput,
} from "@/features/marketing/calc/acquisition";
import type {
  ChannelOutput,
  ContentOutput,
  FunnelOutput,
  GtmPlanningOutput,
  IcpOutput,
  PlanOutput,
  PositioningOutput,
  ClaimInput,
} from "@/features/marketing/stages/contracts";

/**
 * Turning stage output into rows — and enforcing the rules while doing it.
 *
 * Three jobs, and the middle one is the reason this file is not trivial:
 *
 *   ASSEMBLING STAGE INPUT. `buildStageInput` reads the stored records each
 *   stage needs — compact summaries, never whole documents, because §42 is
 *   right that pasting a full market research report into every prompt is both
 *   expensive and worse for the output.
 *
 *   ENFORCING THE CLAIM CONTRACT. A model may assert a FACT only if the
 *   retrieval provider actually cited the host it names. When it does not, the
 *   claim is DOWNGRADED to INFERENCE and the downgrade is reported — not
 *   dropped silently, and certainly not stored as a fact with a low confidence
 *   score, because nobody reads confidence scores.
 *
 *   RUNNING THE DETERMINISTIC PARTS. Channel scores come from `scoring.ts` and
 *   acquisition economics from `calc/acquisition.ts`, both here, both from
 *   stored rows, neither ever from a completion.
 */

type Client = SupabaseClient<Database>;

export interface MappedStageOutput {
  results: unknown[];
  claims: unknown[];
  personas: unknown[];
  channels: unknown[];
  funnelSteps: unknown[];
  campaigns: unknown[];
  planActions: unknown[];
  sources: unknown[];
  projectPatch: Record<string, unknown>;
  /** Claims demoted from FACT because no citation backed them. */
  downgradedClaims: string[];
  /** Channel entries dropped entirely. */
  discardedChannels: string[];
}

const EMPTY: MappedStageOutput = {
  results: [],
  claims: [],
  personas: [],
  channels: [],
  funnelSteps: [],
  campaigns: [],
  planActions: [],
  sources: [],
  projectPatch: {},
  downgradedClaims: [],
  discardedChannels: [],
};

// ---------------------------------------------------------------------------
// URL helpers — identical controls to competitor discovery and funding
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
 * Accepts an exact match or a subdomain of a cited host. It does NOT accept a
 * suffix lookalike: `notexample.com` must never be satisfied by a citation on
 * `example.com`.
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

// ---------------------------------------------------------------------------
// The claim contract
// ---------------------------------------------------------------------------

export interface GradedClaim {
  topic: string;
  statement: string;
  kind: ClaimKind;
  rationale: string | null;
  source_url: string | null;
  source_host: string | null;
  confidence: string;
}

/**
 * Grade one claim, enforcing the citation rule.
 *
 * A FACT whose named host was not actually cited by the provider becomes an
 * INFERENCE. That is the honest re-grade: the model may well have reasoned its
 * way to something true, but it did not read it anywhere we can point to, and
 * the report must not say otherwise.
 *
 * The alternative designs are both worse. Dropping the claim loses a real
 * insight. Keeping it as a FACT with a caveat produces a document whose
 * headline sentences are unsourced, which is the exact failure this phase
 * exists to prevent.
 */
export function gradeClaim(
  claim: ClaimInput,
  topic: string,
  citedHosts: Set<string>,
  providerSources: AiRetrievedSource[],
): { row: GradedClaim; downgraded: boolean } {
  const statement = stripUrls(claim.statement);
  const rationale = claim.rationale ? stripUrls(claim.rationale) : null;

  if (claim.kind !== "FACT") {
    return {
      row: {
        topic,
        statement,
        kind: claim.kind,
        rationale,
        source_url: null,
        source_host: null,
        confidence: claim.confidence,
      },
      downgraded: false,
    };
  }

  const matched = claim.sourceDomain
    ? matchCitedHost(claim.sourceDomain, citedHosts)
    : null;
  const citation = matched ? citationFor(matched, providerSources) : undefined;

  if (!matched || !citation) {
    return {
      row: {
        topic,
        statement,
        kind: "INFERENCE",
        rationale: rationale
          ? `${rationale} (Recorded as an inference: no retrieved source supports it as a fact.)`
          : "Recorded as an inference: no retrieved source supports it as a fact.",
        source_url: null,
        source_host: null,
        // A downgraded claim cannot also keep a high confidence.
        confidence: claim.confidence === "high" ? "medium" : claim.confidence,
      },
      downgraded: true,
    };
  }

  return {
    row: {
      topic,
      statement,
      kind: "FACT",
      rationale,
      source_url: canonicalise(citation.url),
      source_host: matched,
      confidence: claim.confidence,
    },
    downgraded: false,
  };
}

function gradeAll(
  claims: ClaimInput[] | undefined,
  topic: string,
  citedHosts: Set<string>,
  providerSources: AiRetrievedSource[],
): { rows: GradedClaim[]; downgraded: string[] } {
  const rows: GradedClaim[] = [];
  const downgraded: string[] = [];

  for (const claim of claims ?? []) {
    const graded = gradeClaim(claim, topic, citedHosts, providerSources);
    rows.push(graded.row);
    if (graded.downgraded) downgraded.push(graded.row.statement.slice(0, 120));
  }

  return { rows, downgraded };
}

/** Claim arrays inside a persona keep their grading but are stored as jsonb. */
function gradedJson(
  claims: ClaimInput[] | undefined,
  topic: string,
  citedHosts: Set<string>,
  providerSources: AiRetrievedSource[],
): { json: unknown[]; downgraded: string[] } {
  const graded = gradeAll(claims, topic, citedHosts, providerSources);
  return {
    json: graded.rows.map((row) => ({
      statement: row.statement,
      kind: row.kind,
      confidence: row.confidence,
      rationale: row.rationale,
      sourceUrl: row.source_url,
    })),
    downgraded: graded.downgraded,
  };
}

// ---------------------------------------------------------------------------
// Reading stored state
// ---------------------------------------------------------------------------

/** The project row, aliased so call sites read as domain code, not as schema. */
export type StoredProject = GtmProjectRow;

export function projectCurrency(project: StoredProject): CurrencyCode {
  return isCurrencyCode(project.currency) ? project.currency : "USD";
}

export function projectMotion(project: StoredProject): GtmMotion {
  return isGtmMotion(project.motion) ? project.motion : "INBOUND_SALES";
}

/** A compact digest of a section's stored content. Never the whole document. */
function digest(value: unknown, max = 1500): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Everything a later stage needs from the earlier ones.
 *
 * Read once and passed around, so a stage does not issue six queries for facts
 * a sibling already fetched.
 */
export interface GtmContext {
  project: StoredProject;
  motion: GtmMotion;
  currency: CurrencyCode;
  offering: string;
  icpSummary: string;
  painPoints: string[];
  objections: string[];
  personaRoles: string[];
  messagingPillars: string[];
  primaryChannels: Channel[];
  secondaryChannels: Channel[];
  campaignNames: string[];
}

export async function readContext(
  supabase: Client,
  project: StoredProject,
): Promise<GtmContext> {
  const [results, personas, channels, campaigns] = await Promise.all([
    supabase
      .from("gtm_results")
      .select("section_key, structured_content")
      .eq("project_id", project.id)
      .eq("is_current", true),
    supabase
      .from("gtm_personas")
      .select("role, pain_points, objections")
      .eq("project_id", project.id)
      .order("display_order"),
    supabase
      .from("gtm_channels")
      .select("channel, priority, score_bps")
      .eq("project_id", project.id)
      .order("score_bps", { ascending: false }),
    supabase
      .from("gtm_campaigns")
      .select("name")
      .eq("project_id", project.id)
      .order("display_order"),
  ]);

  const sections = new Map<string, Record<string, unknown>>();
  for (const row of results.data ?? []) {
    sections.set(
      row.section_key,
      (row.structured_content ?? {}) as Record<string, unknown>,
    );
  }

  const context = sections.get("business_context") ?? {};
  const icp = sections.get("ideal_customer_profile") ?? {};
  const positioning = sections.get("positioning") ?? {};

  const claimText = (value: unknown): string[] =>
    Array.isArray(value)
      ? value
          .map((item) =>
            item && typeof item === "object" && "statement" in item
              ? String((item as { statement: unknown }).statement)
              : typeof item === "string"
                ? item
                : "",
          )
          .filter(Boolean)
      : [];

  const painPoints: string[] = [];
  const objections: string[] = [];
  const personaRoles: string[] = [];

  for (const persona of personas.data ?? []) {
    if (persona.role) personaRoles.push(persona.role);
    painPoints.push(...claimText(persona.pain_points));
    objections.push(...claimText(persona.objections));
  }

  const pillars = Array.isArray(positioning.messagingPillars)
    ? (positioning.messagingPillars as { pillar?: unknown }[])
        .map((entry) => String(entry?.pillar ?? ""))
        .filter(Boolean)
    : [];

  const byPriority = (wanted: string): Channel[] =>
    (channels.data ?? [])
      .filter((row) => row.priority === wanted && isChannel(row.channel))
      .map((row) => row.channel as Channel);

  return {
    project,
    motion: projectMotion(project),
    currency: projectCurrency(project),
    offering: String(context.offering ?? project.title),
    icpSummary: digest(icp.summary ?? "", 3000),
    painPoints: painPoints.slice(0, 20),
    objections: objections.slice(0, 10),
    personaRoles: [...new Set(personaRoles)].slice(0, 10),
    messagingPillars: pillars.slice(0, 10),
    primaryChannels: byPriority("PRIMARY"),
    secondaryChannels: byPriority("SECONDARY"),
    campaignNames: (campaigns.data ?? []).map((row) => row.name).slice(0, 8),
  };
}

/**
 * Compact digests of the upstream products.
 *
 * Deliberately short. A market research report is tens of thousands of tokens
 * and re-sending it to every stage would cost more than the stage produces —
 * and would bury the two paragraphs that actually matter.
 */
async function readInherited(
  supabase: Client,
  project: StoredProject,
): Promise<Record<string, string | undefined>> {
  const inherited: Record<string, string | undefined> = {};

  if (project.business_idea_id) {
    const { data } = await supabase
      .from("business_ideas")
      .select("title, payload_json")
      .eq("id", project.business_idea_id)
      .maybeSingle();
    if (data) inherited.businessIdea = digest(data, 2000);
  }

  if (project.research_request_id) {
    const { data } = await supabase
      .from("research_results")
      .select("section_key, structured_content")
      .eq("research_request_id", project.research_request_id)
      .eq("is_current", true)
      .in("section_key", [
        "executive_summary",
        "target_customer",
        "demand_signals",
      ]);
    if (data?.length) inherited.marketResearch = digest(data, 3500);
  }

  if (project.competitor_project_id) {
    const { data } = await supabase
      .from("competitors")
      .select("name, positioning, verification_status")
      .eq("project_id", project.competitor_project_id)
      .limit(10);
    if (data?.length) inherited.competitors = digest(data, 3500);
  }

  if (project.financial_project_id) {
    const { data } = await supabase
      .from("financial_results")
      .select("structured_content")
      .eq("project_id", project.financial_project_id)
      .eq("section_key", "unit_economics")
      .eq("is_current", true)
      .maybeSingle();
    if (data) inherited.financials = digest(data.structured_content, 1500);
  }

  return inherited;
}

/** The unit economics Phase 8 already calculated. Read, never recomputed. §38. */
export interface InheritedUnitEconomics {
  arpuMinor: number | null;
  grossMarginBps: number | null;
  ltvMinor: number | null;
  monthlyChurnBps: number | null;
}

export async function readUnitEconomics(
  supabase: Client,
  project: StoredProject,
): Promise<InheritedUnitEconomics | null> {
  if (!project.financial_project_id) return null;

  const { data } = await supabase
    .from("financial_results")
    .select("structured_content")
    .eq("project_id", project.financial_project_id)
    .eq("section_key", "unit_economics")
    .eq("is_current", true)
    .maybeSingle();

  if (!data) return null;

  const content = (data.structured_content ?? {}) as Record<string, unknown>;
  const num = (key: string): number | null =>
    typeof content[key] === "number" && Number.isFinite(content[key])
      ? (content[key] as number)
      : null;

  return {
    arpuMinor: num("arpuMinor"),
    grossMarginBps: num("grossMarginBps"),
    ltvMinor: num("ltvMinor"),
    monthlyChurnBps: num("monthlyChurnBps"),
  };
}

// ---------------------------------------------------------------------------
// Stage input
// ---------------------------------------------------------------------------

export async function buildStageInput(
  supabase: Client,
  project: StoredProject,
  stage: GtmStage,
): Promise<unknown> {
  const context = await readContext(supabase, project);

  switch (stage) {
    case "gtm_planning":
      return {
        title: project.title,
        description: project.description ?? undefined,
        industry: project.industry ?? undefined,
        geography: project.geography ?? undefined,
        currency: project.currency,
        inherited: await readInherited(supabase, project),
      };

    case "icp_persona": {
      const inherited = await readInherited(supabase, project);
      return {
        title: project.title,
        offering: context.offering,
        motion: context.motion,
        geography: project.geography ?? undefined,
        industry: project.industry ?? undefined,
        researchFindings: inherited.marketResearch,
        competitorAudiences: inherited.competitors,
      };
    }

    case "positioning_messaging": {
      const inherited = await readInherited(supabase, project);
      return {
        title: project.title,
        offering: context.offering,
        motion: context.motion,
        icpSummary: context.icpSummary,
        painPoints: context.painPoints,
        competitorEvidence: inherited.competitors,
        productCapabilities: project.description ?? undefined,
      };
    }

    case "channel_strategy":
      return {
        title: project.title,
        offering: context.offering,
        motion: context.motion,
        geography: project.geography ?? undefined,
        icpSummary: context.icpSummary,
        personaRoles: context.personaRoles,
        // Only channels a competitor was VERIFIED to use. §37.
        competitorChannels: [],
      };

    case "content_campaign_strategy":
      return {
        title: project.title,
        offering: context.offering,
        motion: context.motion,
        icpSummary: context.icpSummary,
        messagingPillars: context.messagingPillars,
        activeChannels: [
          ...context.primaryChannels,
          ...context.secondaryChannels,
        ],
      };

    case "sales_funnel":
      return {
        title: project.title,
        offering: context.offering,
        motion: context.motion,
        // Supplied from the template so a model cannot invent a stage or hand a
        // restaurant a SaaS funnel. §13.
        funnelStages: funnelFor(context.motion),
        icpSummary: context.icpSummary,
        objections: context.objections,
      };

    case "acquisition_economics":
      throw new AiError(
        "AI_INVALID_INPUT",
        "acquisition_economics is a compute stage and has no prompt input.",
        false,
      );

    case "gtm_90_day_plan": {
      const computed = await readComputedForPlan(supabase, project);
      return {
        title: project.title,
        offering: context.offering,
        motion: context.motion,
        primaryChannels: context.primaryChannels,
        secondaryChannels: context.secondaryChannels,
        campaignNames: context.campaignNames,
        computed,
        applicableKpis: KPIS_BY_MOTION[context.motion],
      };
    }
  }
}

/** The already-calculated figures the plan stage explains but never produces. */
async function readComputedForPlan(
  supabase: Client,
  project: StoredProject,
): Promise<Record<string, unknown>> {
  const { data } = await supabase
    .from("gtm_results")
    .select("structured_content")
    .eq("project_id", project.id)
    .eq("section_key", "acquisition_economics")
    .eq("is_current", true)
    .maybeSingle();

  const content = (data?.structured_content ?? {}) as Record<string, unknown>;
  const num = (key: string, fallback: number | null): number | null =>
    typeof content[key] === "number" ? (content[key] as number) : fallback;

  return {
    currency: project.currency,
    targetNewCustomers: project.target_new_customers,
    horizonMonths: project.target_horizon_months,
    allowableCacMinor: num("allowableCacMinor", 0) ?? 0,
    budgetMinor: num("budgetMinor", 0) ?? 0,
    requiredTopOfFunnel: num("requiredTopOfFunnel", null),
    oneCustomerPer: num("oneCustomerPer", null),
  };
}

// ---------------------------------------------------------------------------
// The compute stage — no model, no network
// ---------------------------------------------------------------------------

/**
 * Churn to an expected lifetime in months.
 *
 * A unit conversion, not a duplicated calculation: Phase 8 stores churn, this
 * needs months, and `1 / churn` is the definition of the two being the same
 * fact. Zero churn yields `null` — an unbounded lifetime, which the acquisition
 * model then declines to turn into an LTV.
 */
export function lifetimeMonthsFromChurn(
  monthlyChurnBps: number | null,
): number | null {
  if (monthlyChurnBps === null || monthlyChurnBps <= 0) return null;
  return roundHalfAwayFromZero(BPS_SCALE, monthlyChurnBps);
}

/**
 * Run `acquisition_economics`.
 *
 * Reads the project's targets, the stored funnel steps and Phase 8's already
 * computed unit economics, then runs the deterministic engine. No provider is
 * contacted, no token is spent, and the result is a pure function of the rows —
 * run it twice and the bytes match.
 */
export async function runComputeStage(
  supabase: Client,
  projectId: string,
): Promise<MappedStageOutput> {
  const { data: project } = await supabase
    .from("gtm_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    throw new AiError(
      "AI_INVALID_INPUT",
      "Marketing project not found.",
      false,
    );
  }

  const currency = projectCurrency(project);
  const motion = projectMotion(project);

  const { data: stepRows } = await supabase
    .from("gtm_funnel_steps")
    .select("*")
    .eq("project_id", projectId)
    .order("step_order");

  if (!stepRows || stepRows.length === 0) {
    throw new AiError(
      "AI_INVALID_INPUT",
      "The sales funnel stage must run before acquisition economics — there are no conversion assumptions to calculate from.",
      false,
    );
  }

  const unitEconomics = await readUnitEconomics(supabase, project);

  // Without a linked financial model there is no revenue per customer, and an
  // invented one would make every downstream figure fiction. Fail loudly.
  if (!unitEconomics || unitEconomics.arpuMinor === null) {
    throw new AiError(
      "AI_INVALID_INPUT",
      "Acquisition economics needs unit economics from a linked financial model. Run Financial Intelligence for this business first, then link it to this marketing plan.",
      false,
    );
  }

  const funnel: FunnelStepInput[] = stepRows.map((row) => ({
    from: row.from_stage as FunnelStepInput["from"],
    to: row.to_stage as FunnelStepInput["to"],
    rateBps: row.rate_bps,
    kind: row.kind as ClaimKind,
    ...(row.rationale ? { rationale: row.rationale } : {}),
  }));

  const input: AcquisitionInput = {
    currency,
    targetNewCustomers: project.target_new_customers,
    horizonMonths: project.target_horizon_months,
    monthlyRevenuePerCustomer: money(unitEconomics.arpuMinor, currency),
    grossMarginBps: unitEconomics.grossMarginBps ?? 0,
    customerLifetimeMonths: lifetimeMonthsFromChurn(
      unitEconomics.monthlyChurnBps,
    ),
    paybackMonths: project.payback_months,
    targetLtvToCacBps: project.target_ltv_cac_bps,
    funnel,
  };

  const model = buildAcquisitionModel(input);
  const scenarios = buildAcquisitionScenarios(input);

  // Budget allocation follows the rubric's own scores, so the money goes where
  // the published ranking said it should.
  const { data: channelRows } = await supabase
    .from("gtm_channels")
    .select("channel, score_bps, priority, contributions")
    .eq("project_id", projectId)
    .order("score_bps", { ascending: false });

  const scoresForSplit = (channelRows ?? [])
    .filter((row) => isChannel(row.channel))
    .map((row) => ({
      channel: row.channel as Channel,
      scoreBps: row.score_bps,
      priority: row.priority as
        "PRIMARY" | "SECONDARY" | "EXPERIMENTAL" | "NOT_RECOMMENDED",
      contributions: [],
      priorityNote: null,
    }));

  const allocation = splitBudgetByChannel(model.budget, scoresForSplit);

  return {
    ...EMPTY,
    results: [
      {
        section_key: "acquisition_economics",
        structured_content: {
          currency,
          motion,
          targetNewCustomers: model.targetNewCustomers,
          horizonMonths: model.horizonMonths,
          grossProfitPerMonthMinor: model.grossProfitPerMonth.minor,
          lifetimeValueMinor: model.lifetimeValue?.minor ?? null,
          paybackAllowableCacMinor: model.paybackAllowableCac.minor,
          ltvAllowableCacMinor: model.ltvAllowableCac?.minor ?? null,
          allowableCacMinor: model.allowableCac.minor,
          bindingConstraint: model.bindingConstraint,
          paybackMonths: project.payback_months,
          targetLtvToCacBps: project.target_ltv_cac_bps,
          requiredTopOfFunnel: model.requiredTopOfFunnel,
          overallConversionBps: model.overallConversionBps,
          oneCustomerPer: model.oneCustomerPer,
          budgetMinor: model.budget.minor,
          funnel: model.funnel.map((step) => ({
            from: step.from,
            to: step.to,
            rateBps: step.rateBps,
            kind: step.kind,
            requiredFrom: step.requiredFrom,
            requiredTo: step.requiredTo,
          })),
          notes: model.notes,
        },
        confidence: "high",
        status: "complete",
      },
      {
        section_key: "marketing_budget",
        structured_content: {
          currency,
          // Every scenario prints the adjustments it applied, so a reader can
          // see what "conservative" meant rather than trusting the label.
          scenarios: scenarios.map((entry) => ({
            scenario: entry.scenario,
            adjustments: entry.adjustments,
            targetNewCustomers: entry.model.targetNewCustomers,
            budgetMinor: entry.model.budget.minor,
            allowableCacMinor: entry.model.allowableCac.minor,
            requiredTopOfFunnel: entry.model.requiredTopOfFunnel,
            oneCustomerPer: entry.model.oneCustomerPer,
          })),
          allocation: allocation.map((line) => ({
            channel: line.channel,
            shareBps: line.shareBps,
            amountMinor: line.amount.minor,
          })),
          allocationBasis:
            "Share of the deterministic channel score, among channels the rubric did not reject.",
        },
        confidence: "high",
        status: allocation.length > 0 ? "complete" : "partial",
      },
      {
        section_key: "kpi_framework",
        structured_content: {
          motion,
          // Looked up from the motion, not asked of a model: ROAS on a business
          // that runs no ads is a divide by zero dressed as a metric. §18.
          kpis: KPIS_BY_MOTION[motion],
          note: "KPIs are selected by selling motion. Metrics that do not apply to this business are deliberately absent.",
        },
        confidence: "high",
        status: "complete",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// AI stage outputs
// ---------------------------------------------------------------------------

export function mapStageOutput(
  stage: GtmStage,
  data: unknown,
  providerSources: AiRetrievedSource[],
  motion: GtmMotion = "INBOUND_SALES",
): MappedStageOutput {
  const citedHosts = new Set(
    providerSources
      .map((source) => hostOf(source.url))
      .filter((host): host is string => host !== null),
  );

  switch (stage) {
    case "gtm_planning": {
      const out = data as GtmPlanningOutput;
      const graded = gradeAll(
        out.context,
        "context",
        citedHosts,
        providerSources,
      );

      return {
        ...EMPTY,
        projectPatch: {
          motion: out.motion,
          target_new_customers: out.targetNewCustomers,
          target_horizon_months: out.targetHorizonMonths,
        },
        claims: graded.rows,
        downgradedClaims: graded.downgraded,
        results: [
          {
            section_key: "business_context",
            structured_content: {
              offering: stripUrls(out.offering),
              motion: out.motion,
              motionRationale: stripUrls(out.motionRationale),
              targetGeography: stripUrls(out.targetGeography),
              businessObjective: stripUrls(out.businessObjective),
              // Labelled a target at the point of storage, so no renderer has
              // to remember to label it later.
              targetNewCustomers: out.targetNewCustomers,
              targetKind: "TARGET",
              targetHorizonMonths: out.targetHorizonMonths,
              openQuestions: out.openQuestions.map(stripUrls),
            },
            confidence: "medium",
            status: "complete",
          },
        ],
      };
    }

    case "icp_persona": {
      const out = data as IcpOutput;
      const downgraded: string[] = [];

      const qualifying = gradedJson(
        out.icp.qualifyingSignals,
        "icp_qualifying",
        citedHosts,
        providerSources,
      );
      const disqualifying = gradedJson(
        out.icp.disqualifyingSignals,
        "icp_disqualifying",
        citedHosts,
        providerSources,
      );
      downgraded.push(...qualifying.downgraded, ...disqualifying.downgraded);

      const personas = out.personas.map((persona) => {
        const pains = gradedJson(
          persona.painPoints,
          "pain",
          citedHosts,
          providerSources,
        );
        const goals = gradedJson(
          persona.goals,
          "goal",
          citedHosts,
          providerSources,
        );
        const triggers = gradedJson(
          persona.buyingTriggers,
          "trigger",
          citedHosts,
          providerSources,
        );
        const objections = gradedJson(
          persona.objections,
          "objection",
          citedHosts,
          providerSources,
        );
        const criteria = gradedJson(
          persona.decisionCriteria,
          "criterion",
          citedHosts,
          providerSources,
        );

        downgraded.push(
          ...pains.downgraded,
          ...goals.downgraded,
          ...triggers.downgraded,
          ...objections.downgraded,
          ...criteria.downgraded,
        );

        return {
          name: stripUrls(persona.name),
          role: stripUrls(persona.role),
          segment: stripUrls(persona.segment),
          company_type: persona.companyType
            ? stripUrls(persona.companyType)
            : null,
          company_size: persona.companySize
            ? stripUrls(persona.companySize)
            : null,
          geography: persona.geography ? stripUrls(persona.geography) : null,
          pain_points: pains.json,
          goals: goals.json,
          buying_triggers: triggers.json,
          objections: objections.json,
          decision_criteria: criteria.json,
          urgency: persona.urgency ? stripUrls(persona.urgency) : null,
          budget_signals: persona.budgetSignals
            ? stripUrls(persona.budgetSignals)
            : null,
          is_decision_maker: persona.isDecisionMaker,
          confidence: persona.confidence,
        };
      });

      return {
        ...EMPTY,
        personas,
        downgradedClaims: downgraded,
        results: [
          {
            section_key: "ideal_customer_profile",
            structured_content: {
              summary: stripUrls(out.icp.summary),
              industries: out.icp.industries.map(stripUrls),
              businessTypes: out.icp.businessTypes.map(stripUrls),
              geographies: out.icp.geographies.map(stripUrls),
              sizeBand: out.icp.sizeBand ? stripUrls(out.icp.sizeBand) : null,
              qualifyingSignals: qualifying.json,
              disqualifyingSignals: disqualifying.json,
            },
            confidence: "medium",
            status: "complete",
          },
          {
            section_key: "buyer_personas",
            structured_content: { count: personas.length },
            confidence: "medium",
            status: personas.length > 0 ? "complete" : "partial",
          },
        ],
      };
    }

    case "positioning_messaging": {
      const out = data as PositioningOutput;
      const downgraded: string[] = [];

      /**
       * THE uniqueness control. §7.
       *
       * A differentiator claimed as unique without stating which competitors
       * were checked keeps the statement but LOSES the uniqueness claim. The
       * cheapest way to lose a deal is to tell a buyer you are the only one who
       * does something they watched a competitor do that morning.
       */
      const differentiators = out.differentiators.map((entry) => {
        const substantiated =
          entry.claimedUnique &&
          Boolean(entry.uniquenessEvidence) &&
          entry.competitorsChecked.length > 0;

        if (entry.claimedUnique && !substantiated) {
          downgraded.push(entry.statement.slice(0, 120));
        }

        return {
          statement: stripUrls(entry.statement),
          claimedUnique: substantiated,
          uniquenessEvidence: entry.uniquenessEvidence
            ? stripUrls(entry.uniquenessEvidence)
            : null,
          competitorsChecked: entry.competitorsChecked.map(stripUrls),
          kind: substantiated ? entry.kind : "INFERENCE",
          confidence: entry.confidence,
          note:
            entry.claimedUnique && !substantiated
              ? "Claimed as unique, but no competitor comparison was supplied. Presented as a strength rather than an exclusive."
              : null,
        };
      });

      const claims = differentiators.map((entry) => ({
        topic: "differentiator",
        statement: entry.statement,
        kind: entry.kind as ClaimKind,
        rationale: entry.note,
        source_url: null,
        source_host: null,
        confidence: entry.confidence,
      }));

      const m = out.messaging;

      return {
        ...EMPTY,
        claims,
        downgradedClaims: downgraded,
        results: [
          {
            section_key: "positioning",
            structured_content: {
              positioningStatement: stripUrls(out.positioningStatement),
              valueProposition: stripUrls(out.valueProposition),
              primaryBenefit: stripUrls(out.primaryBenefit),
              differentiators,
              messagingPillars: out.messagingPillars.map((pillar) => ({
                pillar: stripUrls(pillar.pillar),
                explanation: stripUrls(pillar.explanation),
              })),
              elevatorPitch: stripUrls(out.elevatorPitch),
              shortDescription: stripUrls(out.shortDescription),
              longDescription: stripUrls(out.longDescription),
              notClaimed: out.notClaimed.map(stripUrls),
            },
            confidence: "medium",
            status: "complete",
          },
          {
            section_key: "messaging",
            structured_content: {
              websiteHero: {
                headline: stripUrls(m.websiteHero.headline),
                subheadline: stripUrls(m.websiteHero.subheadline),
                callToAction: stripUrls(m.websiteHero.callToAction),
              },
              linkedin: stripUrls(m.linkedin),
              email: {
                subject: stripUrls(m.email.subject),
                body: stripUrls(m.email.body),
              },
              salesOutreach: {
                opener: stripUrls(m.salesOutreach.opener),
                followUp: stripUrls(m.salesOutreach.followUp),
              },
              adConcepts: m.adConcepts.map((concept) => ({
                concept: stripUrls(concept.concept),
                angle: stripUrls(concept.angle),
              })),
            },
            confidence: "medium",
            status: "complete",
          },
        ],
      };
    }

    case "channel_strategy": {
      const out = data as ChannelOutput;
      const discarded: string[] = [];

      /**
       * The model rated. Now the ENGINE scores.
       *
       * `rankChannels` applies the published weights, the evidence floor and
       * the two-primary cap. Nothing the model returned contains a score or a
       * priority, and nothing here reads one from it.
       */
      const ratingsByChannel: Partial<Record<Channel, ChannelRatings>> = {};
      const detail = new Map<Channel, (typeof out.assessments)[number]>();

      for (const assessment of out.assessments) {
        if (!isChannel(assessment.channel)) {
          discarded.push(String(assessment.channel));
          continue;
        }
        ratingsByChannel[assessment.channel] =
          assessment.ratings as ChannelRatings;
        detail.set(assessment.channel, assessment);
      }

      const ranked = rankChannels(ratingsByChannel);

      const channels = ranked.map((score) => {
        const assessment = detail.get(score.channel)!;
        const matched = assessment.evidenceDomain
          ? matchCitedHost(assessment.evidenceDomain, citedHosts)
          : null;
        const citation = matched
          ? citationFor(matched, providerSources)
          : undefined;

        return {
          channel: score.channel,
          rationale: stripUrls(assessment.rationale),
          target_audience: stripUrls(assessment.targetAudience),
          acquisition_mechanism: stripUrls(assessment.acquisitionMechanism),
          effort: assessment.effort,
          cost_band: assessment.costBand,
          strengths: assessment.strengths.map(stripUrls),
          weaknesses: assessment.weaknesses.map(stripUrls),
          prerequisites: assessment.prerequisites.map(stripUrls),
          ratings: assessment.ratings,
          contributions: score.contributions,
          score_bps: score.scoreBps,
          priority: score.priority,
          priority_note: score.priorityNote,
          // Only a genuinely cited host survives as evidence.
          evidence_url: citation ? canonicalise(citation.url) : null,
          evidence_host: matched,
          evidence_note: assessment.evidenceNote
            ? stripUrls(assessment.evidenceNote)
            : null,
          confidence: assessment.confidence,
        };
      });

      return {
        ...EMPTY,
        channels,
        sources: sourceRowsFrom(providerSources),
        discardedChannels: discarded,
        results: [
          {
            section_key: "channel_strategy",
            structured_content: {
              // The rubric itself, printed. This is the answer to §10's ban on
              // unexplained percentages: the reader can recompute the ranking.
              rubric: SCORING_MODEL.map((dimension) => ({
                key: dimension.key,
                label: dimension.label,
                weightBps: dimension.weightBps,
                inverted: dimension.inverted,
                meaning: dimension.meaning,
              })),
              scoreBasis:
                "AIAutoMix analysis. Each channel was rated 0-5 per dimension, then scored by the fixed weights above.",
              considered: channels.length,
              notConsidered: out.notConsidered.map((entry) => ({
                channel: entry.channel,
                reason: stripUrls(entry.reason),
              })),
              queriesUsed: out.queriesUsed,
              notes: out.notes ? stripUrls(out.notes) : null,
            },
            confidence: out.insufficientEvidence ? "low" : "medium",
            status:
              out.insufficientEvidence || channels.length === 0
                ? "insufficient_evidence"
                : "complete",
          },
        ],
      };
    }

    case "content_campaign_strategy": {
      const out = data as ContentOutput;

      return {
        ...EMPTY,
        campaigns: out.campaigns.map((campaign) => ({
          name: stripUrls(campaign.name),
          objective: campaign.objective,
          audience: stripUrls(campaign.audience),
          message: stripUrls(campaign.message),
          offer: stripUrls(campaign.offer),
          channels: campaign.channels,
          call_to_action: stripUrls(campaign.callToAction),
          funnel_band: campaign.funnelBand,
          measurement_kpi: campaign.measurementKpi,
          confidence: campaign.confidence,
        })),
        results: [
          {
            section_key: "content_strategy",
            structured_content: {
              pillars: out.pillars.map((pillar) => ({
                pillar: stripUrls(pillar.pillar),
                audience: stripUrls(pillar.audience),
                goal: stripUrls(pillar.goal),
                formats: pillar.formats,
                distributionChannels: pillar.distributionChannels,
                frequency: stripUrls(pillar.frequency),
                callToAction: stripUrls(pillar.callToAction),
                funnelBand: pillar.funnelBand,
              })),
              initialContentPlan: out.initialContentPlan.map((item) => ({
                title: stripUrls(item.title),
                format: item.format,
                pillar: stripUrls(item.pillar),
                funnelBand: item.funnelBand,
                channel: item.channel,
              })),
              notes: out.notes ? stripUrls(out.notes) : null,
            },
            confidence: "medium",
            status: "complete",
          },
          {
            section_key: "campaign_strategy",
            structured_content: { count: out.campaigns.length },
            confidence: "medium",
            status: out.campaigns.length > 0 ? "complete" : "partial",
          },
        ],
      };
    }

    case "sales_funnel": {
      const out = data as FunnelOutput;

      /**
       * The funnel a model returns is checked against the TEMPLATE for this
       * motion. A step between stages this motion does not have is dropped —
       * that is how §13 is enforced rather than merely requested.
       */
      const allowed = new Set<string>(FUNNEL_TEMPLATES[motion]);
      const steps = out.steps.filter(
        (step) => allowed.has(step.from) && allowed.has(step.to),
      );

      const sm = out.salesMessaging;

      return {
        ...EMPTY,
        funnelSteps: steps.map((step) => ({
          from_stage: step.from,
          to_stage: step.to,
          rate_bps: step.rateBps,
          kind: step.kind,
          rationale: stripUrls(step.rationale),
          confidence: step.confidence,
        })),
        claims: steps.map((step) => ({
          topic: "conversion_rate",
          statement: `${step.from} to ${step.to}: ${(step.rateBps / 100).toFixed(2)}%`,
          kind: step.kind,
          rationale: stripUrls(step.rationale),
          source_url: null,
          source_host: null,
          confidence: step.confidence,
        })),
        results: [
          {
            section_key: "sales_funnel",
            structured_content: {
              motion,
              // The template, so the report can show the funnel even when the
              // model returned fewer steps than the motion has.
              template: FUNNEL_TEMPLATES[motion],
              steps: steps.map((step) => ({
                from: step.from,
                to: step.to,
                rateBps: step.rateBps,
                kind: step.kind,
                rationale: stripUrls(step.rationale),
              })),
              droppedSteps: out.steps.length - steps.length,
              qualificationCriteria: out.qualificationCriteria.map((entry) => ({
                criterion: stripUrls(entry.criterion),
                whyItMatters: stripUrls(entry.whyItMatters),
                howToAssess: stripUrls(entry.howToAssess),
                disqualifying: entry.disqualifying,
              })),
              salesMessaging: {
                coldOutreach: stripUrls(sm.coldOutreach),
                linkedinOutreach: stripUrls(sm.linkedinOutreach),
                emailIntroduction: {
                  subject: stripUrls(sm.emailIntroduction.subject),
                  body: stripUrls(sm.emailIntroduction.body),
                },
                followUp: stripUrls(sm.followUp),
                discoveryQuestions: sm.discoveryQuestions.map(stripUrls),
                objectionHandling: sm.objectionHandling.map((entry) => ({
                  objection: stripUrls(entry.objection),
                  response: stripUrls(entry.response),
                })),
              },
            },
            confidence: "medium",
            status: steps.length > 0 ? "complete" : "partial",
          },
        ],
      };
    }

    case "acquisition_economics":
      // Unreachable: the engine routes compute stages to `runComputeStage`
      // before this switch is consulted. Kept so a future stage cannot fall
      // through to an implicit empty result.
      throw new AiError(
        "AI_INVALID_INPUT",
        "acquisition_economics is computed, not generated.",
        false,
      );

    case "gtm_90_day_plan": {
      const out = data as PlanOutput;

      const actions = out.actions.slice(0, MAX_PLAN_ACTIONS).map((action) => ({
        period: action.period,
        objective: stripUrls(action.objective),
        action: stripUrls(action.action),
        channel: action.channel ?? null,
        owner_role: action.owner,
        kpi: action.kpi,
        expected_output: stripUrls(action.expectedOutput),
        dependency: action.dependency ? stripUrls(action.dependency) : null,
        priority: action.priority,
      }));

      const claims = [
        ...out.kpiTargets.map((entry) => ({
          topic: "kpi_target",
          statement: `${entry.kpi}: ${entry.target} (${entry.period})`,
          // A KPI number is a target the business is aiming at, never a
          // prediction, and it is stored under that label.
          kind: "TARGET" as ClaimKind,
          rationale: null,
          source_url: null,
          source_host: null,
          confidence: "medium",
        })),
        ...out.risks.map((risk) => ({
          topic: `risk:${risk.kind}`,
          statement: stripUrls(risk.summary),
          kind: "INFERENCE" as ClaimKind,
          rationale: risk.mitigation ? stripUrls(risk.mitigation) : null,
          source_url: null,
          source_host: null,
          confidence: "medium",
        })),
      ];

      return {
        ...EMPTY,
        planActions: actions,
        claims,
        results: [
          {
            section_key: "ninety_day_plan",
            structured_content: {
              actions: actions.map((action) => ({
                period: action.period,
                objective: action.objective,
                action: action.action,
                channel: action.channel,
                owner: action.owner_role,
                kpi: action.kpi,
                expectedOutput: action.expected_output,
                dependency: action.dependency,
                priority: action.priority,
              })),
              firstActions: out.firstActions.map(stripUrls),
              kpiTargets: out.kpiTargets.map((entry) => ({
                kpi: entry.kpi,
                target: stripUrls(entry.target),
                period: entry.period,
                kind: "TARGET",
              })),
              truncated: Math.max(0, out.actions.length - actions.length),
            },
            confidence: "medium",
            status: "complete",
          },
          {
            section_key: "executive_summary",
            structured_content: {
              summary: stripUrls(out.executiveSummary),
              overallConfidence: out.overallConfidence,
            },
            confidence: out.overallConfidence,
            status: "complete",
          },
          {
            section_key: "risks_assumptions",
            structured_content: {
              risks: out.risks.map((risk) => ({
                kind: risk.kind,
                severity: risk.severity,
                summary: stripUrls(risk.summary),
                assumptionRef: risk.assumptionRef
                  ? stripUrls(risk.assumptionRef)
                  : null,
                mitigation: risk.mitigation ? stripUrls(risk.mitigation) : null,
              })),
              limitations: out.limitations.map(stripUrls),
            },
            confidence: "medium",
            status: "complete",
          },
        ],
      };
    }
  }
}

/** Exposed so the smoke suite can assert the vocabulary agrees with the rubric. */
export const SCORING_KEYS = SCORING_DIMENSION_KEYS;
export const KNOWN_CHANNELS = CHANNELS;
export const KNOWN_MOTIONS = GTM_MOTIONS;
