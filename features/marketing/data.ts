import "server-only";

import { createClient } from "@/lib/supabase/server";
import { estimateRunCostFromDb } from "@/features/marketing/cost";
import {
  buildGtmProgress,
  type GtmProgress,
  type GtmStageAttempt,
} from "@/features/marketing/progress";
import { isGtmStage, type GtmStage } from "@/features/marketing/types";
import type {
  GtmCampaignRow,
  GtmChannelRow,
  GtmClaimRow,
  GtmFunnelStepRow,
  GtmPersonaRow,
  GtmPlanActionRow,
  GtmProjectRow,
  GtmResultRow,
  GtmRunRow,
  GtmSourceRow,
} from "@/types/database";

/**
 * Reads for Marketing Intelligence.
 *
 * Every query here runs under the caller's own RLS. There is no service-role
 * client and no `workspace_id` filter written by hand for security — the
 * policies do that, and duplicating them in TypeScript would create a second
 * place for the rule to be wrong.
 *
 * Queries are targeted rather than `select("*")` on wide tables where the page
 * only needs three columns. §42.
 */

export interface GtmListItem {
  id: string;
  title: string;
  status: string;
  motion: string | null;
  currency: string;
  createdAt: string;
  currentStage: GtmStage | null;
  runStatus: string | null;
  completedCount: number;
  primaryChannelCount: number;
}

export async function getGtmProjects(
  workspaceId: string,
  limit = 50,
): Promise<GtmListItem[]> {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("gtm_projects")
    .select("id, title, status, motion, currency, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!projects?.length) return [];

  const ids = projects.map((project) => project.id);

  const [runs, channels] = await Promise.all([
    supabase
      .from("gtm_runs")
      .select("project_id, status, current_stage, created_at")
      .in("project_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("gtm_channels")
      .select("project_id, priority")
      .in("project_id", ids)
      .eq("priority", "PRIMARY"),
  ]);

  const latestRun = new Map<string, { status: string; stage: string | null }>();
  for (const run of runs.data ?? []) {
    if (!latestRun.has(run.project_id)) {
      latestRun.set(run.project_id, {
        status: run.status,
        stage: run.current_stage,
      });
    }
  }

  const primaryCount = new Map<string, number>();
  for (const row of channels.data ?? []) {
    primaryCount.set(
      row.project_id,
      (primaryCount.get(row.project_id) ?? 0) + 1,
    );
  }

  return projects.map((project) => {
    const run = latestRun.get(project.id);
    const stage = run?.stage && isGtmStage(run.stage) ? run.stage : null;

    return {
      id: project.id,
      title: project.title,
      status: project.status,
      motion: project.motion,
      currency: project.currency,
      createdAt: project.created_at,
      currentStage: stage,
      runStatus: run?.status ?? null,
      completedCount:
        project.status === "completed" ? 8 : stage ? indexOfStage(stage) : 0,
      primaryChannelCount: primaryCount.get(project.id) ?? 0,
    };
  });
}

function indexOfStage(stage: GtmStage): number {
  return [
    "gtm_planning",
    "icp_persona",
    "positioning_messaging",
    "channel_strategy",
    "content_campaign_strategy",
    "sales_funnel",
    "acquisition_economics",
    "gtm_90_day_plan",
  ].indexOf(stage);
}

export interface GtmDetail {
  project: GtmProjectRow;
  run: GtmRunRow | null;
  progress: GtmProgress;
  personas: GtmPersonaRow[];
  channels: GtmChannelRow[];
  funnelSteps: GtmFunnelStepRow[];
  campaigns: GtmCampaignRow[];
  planActions: GtmPlanActionRow[];
  claims: GtmClaimRow[];
  results: Map<string, GtmResultRow>;
  sourceCount: number;
}

export async function getGtmDetail(
  workspaceId: string,
  projectId: string,
): Promise<GtmDetail | null> {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("gtm_projects")
    .select("*")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!project) return null;

  const { data: run } = await supabase
    .from("gtm_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [
    stages,
    personas,
    channels,
    funnelSteps,
    campaigns,
    actions,
    claims,
    results,
    sources,
  ] = await Promise.all([
    run
      ? supabase
          .from("gtm_run_stages")
          .select("*")
          .eq("run_id", run.id)
          .order("started_at")
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("gtm_personas")
      .select("*")
      .eq("project_id", projectId)
      .order("display_order"),
    supabase
      .from("gtm_channels")
      .select("*")
      .eq("project_id", projectId)
      .order("score_bps", { ascending: false }),
    supabase
      .from("gtm_funnel_steps")
      .select("*")
      .eq("project_id", projectId)
      .order("step_order"),
    supabase
      .from("gtm_campaigns")
      .select("*")
      .eq("project_id", projectId)
      .order("display_order"),
    supabase
      .from("gtm_plan_actions")
      .select("*")
      .eq("project_id", projectId)
      .order("period")
      .order("display_order"),
    supabase
      .from("gtm_claims")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at"),
    supabase
      .from("gtm_results")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_current", true),
    supabase
      .from("gtm_sources")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);

  const attempts: GtmStageAttempt[] = (stages.data ?? [])
    .filter((row) => isGtmStage(row.stage))
    .map((row) => ({
      stage: row.stage as GtmStage,
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

  const resultMap = new Map<string, GtmResultRow>();
  for (const row of results.data ?? []) resultMap.set(row.section_key, row);

  return {
    project,
    run: run ?? null,
    progress: buildGtmProgress({
      currentStage: run?.current_stage ?? null,
      runStatus: run?.status ?? null,
      projectStatus: project.status,
      attempts,
    }),
    personas: personas.data ?? [],
    channels: channels.data ?? [],
    funnelSteps: funnelSteps.data ?? [],
    campaigns: campaigns.data ?? [],
    planActions: actions.data ?? [],
    claims: claims.data ?? [],
    results: resultMap,
    sourceCount: sources.count ?? 0,
  };
}

export async function getGtmSources(
  projectId: string,
): Promise<GtmSourceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gtm_sources")
    .select("*")
    .eq("project_id", projectId)
    .order("retrieved_at", { ascending: false });
  return data ?? [];
}

export async function getRunEstimate(): Promise<number> {
  return estimateRunCostFromDb();
}

/**
 * What a new plan can be built on.
 *
 * A financial model in particular: without one, `acquisition_economics` has no
 * revenue per customer and refuses to invent one, so the form says so up front
 * rather than letting the user discover it at stage seven.
 */
export interface GtmContextOptions {
  ideas: { id: string; title: string }[];
  plans: { id: string; title: string }[];
  research: { id: string; title: string }[];
  competitors: { id: string; title: string }[];
  financials: { id: string; title: string; currency: string }[];
}

export async function getGtmContextOptions(
  workspaceId: string,
): Promise<GtmContextOptions> {
  const supabase = await createClient();

  const [ideas, plans, research, competitors, financials] = await Promise.all([
    supabase
      .from("business_ideas")
      .select("id, title")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("business_plans")
      .select("id, title")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("research_requests")
      .select("id, title")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("competitor_projects")
      .select("id, title")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("financial_projects")
      .select("id, title, currency")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  return {
    ideas: ideas.data ?? [],
    plans: plans.data ?? [],
    research: research.data ?? [],
    competitors: competitors.data ?? [],
    financials: financials.data ?? [],
  };
}

/** Prefill from a business plan, so the user does not retype what exists. */
export interface GtmPrefill {
  title?: string;
  description?: string;
  industry?: string;
  geography?: string;
  businessIdeaId?: string;
  businessPlanId?: string;
}

export async function getPrefillFromPlan(
  workspaceId: string,
  planId: string,
): Promise<GtmPrefill | null> {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("business_plans")
    .select("id, title, business_idea_id")
    .eq("id", planId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!plan) return null;

  const prefill: GtmPrefill = {
    title: `Go-to-market — ${plan.title}`,
    businessPlanId: plan.id,
  };

  if (plan.business_idea_id) {
    const { data: idea } = await supabase
      .from("business_ideas")
      .select("id, payload_json")
      .eq("id", plan.business_idea_id)
      .maybeSingle();

    if (idea) {
      prefill.businessIdeaId = idea.id;
      // The validator stores its brief as a JSON payload rather than columns,
      // so read defensively: a missing key is normal, not an error.
      const payload = (idea.payload_json ?? {}) as Record<string, unknown>;
      const text = (key: string): string | undefined =>
        typeof payload[key] === "string" && payload[key]
          ? (payload[key] as string)
          : undefined;

      const description = text("description");
      const industry = text("industry");
      const market = text("targetMarket") ?? text("target_market");
      if (description) prefill.description = description;
      if (industry) prefill.industry = industry;
      if (market) prefill.geography = market;
    }
  }

  return prefill;
}
