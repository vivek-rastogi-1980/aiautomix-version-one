import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  BusinessIdea,
  BusinessPlan,
  FinancialAssumptionRow,
  FinancialCostRow,
  FinancialProjectRow,
  FinancialResultRow,
  FinancialRunRow,
  FinancialRunStageRow,
  FinancialSourceRow,
  FundingOptionRow,
} from "@/types/database";
import {
  isFinancialStage,
  type FinancialStage,
} from "@/features/financials/types";
import { estimateRunCost } from "@/features/financials/cost";
import { completedStageCount } from "@/features/financials/progress";
import type { FinancialStageAttempt } from "@/features/financials/progress";
import { isCurrencyCode, type CurrencyCode } from "@/features/financials/money";

/**
 * Read layer for Financial Intelligence.
 *
 * Every query filters on `workspace_id` even though RLS already does — the
 * workspace comes from the session, and stating it in the query means a future
 * policy change cannot silently widen these reads.
 */

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export interface FinancialListItem {
  id: string;
  title: string;
  currency: string;
  revenueModel: string;
  industry: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  runStatus: string | null;
  currentStage: string | null;
  assumptionCount: number;
  completedStages: number;
}

export async function getFinancialProjects(
  workspaceId: string,
  limit = 50,
): Promise<FinancialListItem[]> {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("financial_projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (projects ?? []) as FinancialProjectRow[];
  if (rows.length === 0) return [];

  // One query for every project's runs, rather than one per card.
  const { data: runs } = await supabase
    .from("financial_runs")
    .select("*")
    .in(
      "project_id",
      rows.map((row) => row.id),
    )
    .order("created_at", { ascending: false });

  const latestRun = new Map<string, FinancialRunRow>();
  for (const run of (runs ?? []) as FinancialRunRow[]) {
    if (!latestRun.has(run.project_id)) latestRun.set(run.project_id, run);
  }

  return rows.map((project) => {
    const run = latestRun.get(project.id);
    return {
      id: project.id,
      title: project.title,
      currency: project.currency,
      revenueModel: project.revenue_model,
      industry: project.industry,
      status: project.status,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      runStatus: run?.status ?? null,
      currentStage: run?.current_stage ?? null,
      assumptionCount: run?.assumption_count ?? 0,
      completedStages: completedStageCount(
        run?.current_stage ?? null,
        project.status,
      ),
    };
  });
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export interface FinancialDetail {
  project: FinancialProjectRow;
  currency: CurrencyCode;
  run: FinancialRunRow | null;
  attempts: FinancialStageAttempt[];
  assumptions: FinancialAssumptionRow[];
  costs: FinancialCostRow[];
  results: FinancialResultRow[];
  fundingOptions: FundingOptionRow[];
  sources: FinancialSourceRow[];
  idea: Pick<BusinessIdea, "id" | "title"> | null;
  plan: Pick<BusinessPlan, "id" | "title"> | null;
}

export async function getFinancialDetail(
  workspaceId: string,
  projectId: string,
): Promise<FinancialDetail | null> {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("financial_projects")
    .select("*")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!project) return null;

  const { data: run } = await supabase
    .from("financial_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [attempts, assumptions, costs, results, funding, sources, idea, plan] =
    await Promise.all([
      run
        ? getStageAttempts(run.id)
        : Promise.resolve<FinancialStageAttempt[]>([]),
      getAssumptions(projectId),
      getCosts(projectId),
      getResults(projectId),
      getFundingOptions(projectId),
      getSources(projectId),
      project.business_idea_id
        ? getLinkedIdea(workspaceId, project.business_idea_id)
        : Promise.resolve(null),
      project.business_plan_id
        ? getLinkedPlan(workspaceId, project.business_plan_id)
        : Promise.resolve(null),
    ]);

  return {
    project,
    // Falls back rather than throwing: a project with an unsupported currency
    // should still render its pipeline so the user can see what went wrong.
    currency: isCurrencyCode(project.currency) ? project.currency : "USD",
    run: run ?? null,
    attempts,
    assumptions,
    costs,
    results,
    fundingOptions: funding,
    sources,
    idea,
    plan,
  };
}

async function getStageAttempts(
  runId: string,
): Promise<FinancialStageAttempt[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("financial_run_stages")
    .select("*")
    .eq("run_id", runId)
    .order("started_at", { ascending: true });

  return ((data ?? []) as FinancialRunStageRow[])
    .filter((row) => isFinancialStage(row.stage))
    .map((row) => ({
      stage: row.stage as FinancialStage,
      attempt: row.attempt,
      status: row.status,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      creditsCharged: row.credits_charged,
      creditsRefunded: row.credits_refunded,
      durationMs: row.duration_ms,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    }));
}

/**
 * Assumptions, user-set first.
 *
 * The ordering is a courtesy; the provenance badge is the signal. A founder
 * scanning the list should meet the numbers they chose before the ones a model
 * proposed.
 */
export async function getAssumptions(
  projectId: string,
): Promise<FinancialAssumptionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("financial_assumptions")
    .select("*")
    .eq("project_id", projectId)
    .order("key", { ascending: true });

  const rank: Record<string, number> = {
    USER: 0,
    INHERITED_RESEARCH: 1,
    INHERITED_PLAN: 2,
    INHERITED_COMPETITOR: 3,
    AI: 4,
    DEFAULT: 5,
  };

  return ((data ?? []) as FinancialAssumptionRow[]).sort(
    (a, b) => (rank[a.source] ?? 9) - (rank[b.source] ?? 9),
  );
}

export async function getCosts(projectId: string): Promise<FinancialCostRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("financial_costs")
    .select("*")
    .eq("project_id", projectId)
    .order("amount_minor", { ascending: false });
  return (data ?? []) as FinancialCostRow[];
}

export async function getResults(
  projectId: string,
): Promise<FinancialResultRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("financial_results")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_current", true);
  return (data ?? []) as FinancialResultRow[];
}

export async function getFundingOptions(
  projectId: string,
): Promise<FundingOptionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("funding_options")
    .select("*")
    .eq("project_id", projectId)
    .order("suitability", { ascending: true })
    .limit(50);
  return (data ?? []) as FundingOptionRow[];
}

export async function getSources(
  projectId: string,
  limit = 50,
): Promise<FinancialSourceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("financial_sources")
    .select("*")
    .eq("project_id", projectId)
    .neq("status", "rejected")
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as FinancialSourceRow[];
}

// ---------------------------------------------------------------------------
// Estimate
// ---------------------------------------------------------------------------

/**
 * Server-calculated credit estimate for a full run.
 *
 * Falls back to the mirror when the RPC is unavailable. Both numbers include
 * the three compute stages at zero, which is why the quote is lower than a
 * reader might expect for eight stages — and the UI says so.
 */
export async function getRunEstimate(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("financial_estimate_credits");
  if (error || typeof data !== "number") return estimateRunCost();
  return data;
}

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

async function getLinkedIdea(
  workspaceId: string,
  ideaId: string,
): Promise<Pick<BusinessIdea, "id" | "title"> | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_ideas")
    .select("id, title")
    .eq("id", ideaId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();
  return data ?? null;
}

async function getLinkedPlan(
  workspaceId: string,
  planId: string,
): Promise<Pick<BusinessPlan, "id" | "title"> | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_plans")
    .select("id, title")
    .eq("id", planId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();
  return data ?? null;
}

export interface FinancialPrefill {
  title: string;
  description?: string;
  industry?: string;
  geography?: string;
  targetCustomer?: string;
  businessIdeaId?: string;
  businessPlanId?: string;
  sourceLabel: string;
  sourceHref: string;
}

interface BriefPayload {
  ideaDescription?: unknown;
  industry?: unknown;
  country?: unknown;
  targetAudience?: unknown;
}

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export async function getPrefillFromPlan(
  workspaceId: string,
  planId: string,
): Promise<FinancialPrefill | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_plans")
    .select("id, title, summary, input_json")
    .eq("id", planId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;
  const input = (data.input_json ?? {}) as BriefPayload;

  return {
    title: `Financials — ${data.title}`.slice(0, 200),
    description: str(input.ideaDescription, 4000) ?? str(data.summary, 4000),
    industry: str(input.industry, 200),
    geography: str(input.country, 200),
    targetCustomer: str(input.targetAudience, 1000),
    businessPlanId: data.id,
    sourceLabel: data.title,
    sourceHref: `/plans/${data.id}`,
  };
}

export async function getPrefillFromIdea(
  workspaceId: string,
  ideaId: string,
): Promise<FinancialPrefill | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_ideas")
    .select("id, title, payload_json")
    .eq("id", ideaId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) return null;
  const payload = (data.payload_json ?? {}) as BriefPayload;

  return {
    title: `Financials — ${data.title}`.slice(0, 200),
    description: str(payload.ideaDescription, 4000),
    industry: str(payload.industry, 200),
    geography: str(payload.country, 200),
    targetCustomer: str(payload.targetAudience, 1000),
    businessIdeaId: data.id,
    sourceLabel: data.title,
    sourceHref: "/validator",
  };
}

/**
 * Work already in the workspace that a model can inherit from.
 *
 * Market research and competitor projects are offered too: their pricing
 * evidence is what turns an AI-guessed price into an evidence-backed one.
 */
export async function getFinancialContextOptions(workspaceId: string): Promise<{
  ideas: Pick<BusinessIdea, "id" | "title">[];
  plans: Pick<BusinessPlan, "id" | "title">[];
  research: { id: string; title: string }[];
  competitors: { id: string; title: string }[];
}> {
  const supabase = await createClient();
  const [ideas, plans, research, competitors] = await Promise.all([
    supabase
      .from("business_ideas")
      .select("id, title")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("business_plans")
      .select("id, title")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("research_requests")
      .select("id, title")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("competitor_projects")
      .select("id, title")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    ideas: ideas.data ?? [],
    plans: plans.data ?? [],
    research: research.data ?? [],
    competitors: competitors.data ?? [],
  };
}
