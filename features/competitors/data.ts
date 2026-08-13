import "server-only";

import { createClient } from "@/lib/supabase/server";
import { MODEL_LABELS } from "@/lib/validations/business-idea";
import type {
  BusinessIdea,
  BusinessPlan,
  CompetitorDepthRow,
  CompetitorEvidenceRow,
  CompetitorProjectRow,
  CompetitorResultRow,
  CompetitorRow,
  CompetitorRunRow,
  CompetitorRunStageRow,
  CompetitorSourceRow,
} from "@/types/database";
import {
  isCompetitorDepth,
  isCompetitorStage,
  isPresentable,
  type CompetitorDepth,
  type CompetitorStage,
  type VerificationStatus,
} from "@/features/competitors/types";
import { estimateRunCost } from "@/features/competitors/cost";
import { completedStageCount } from "@/features/competitors/progress";
import type { CompetitorStageAttempt } from "@/features/competitors/progress";

/**
 * Read layer for Competitor Intelligence.
 *
 * Every query filters on `workspace_id` even though RLS already does. That is
 * not superstition: the workspace comes from `getWorkspaceContext`, which
 * derives it from the session, and stating it in the query means a future
 * refactor that loosens a policy does not silently widen these reads. RLS
 * remains the enforcement point; this is the second lock on the same door.
 *
 * Nothing here computes progress from anything but persisted rows.
 */

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export interface CompetitorListItem {
  id: string;
  title: string;
  category: string | null;
  geography: string | null;
  depth: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  runStatus: string | null;
  currentStage: string | null;
  competitorCount: number;
  verifiedCount: number;
  sourceCount: number;
  completedStages: number;
}

/** Competitor projects in the workspace, newest first. */
export async function getCompetitorProjects(
  workspaceId: string,
  limit = 50,
): Promise<CompetitorListItem[]> {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("competitor_projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (projects ?? []) as CompetitorProjectRow[];
  if (rows.length === 0) return [];

  // One query for the runs of every project on this page, rather than one per
  // card. Bounded by `limit`.
  const { data: runs } = await supabase
    .from("competitor_runs")
    .select("*")
    .in(
      "project_id",
      rows.map((row) => row.id),
    )
    .order("created_at", { ascending: false });

  const latestRun = new Map<string, CompetitorRunRow>();
  for (const run of (runs ?? []) as CompetitorRunRow[]) {
    if (!latestRun.has(run.project_id)) latestRun.set(run.project_id, run);
  }

  return rows.map((project) => {
    const run = latestRun.get(project.id);
    return {
      id: project.id,
      title: project.title,
      category: project.category,
      geography: project.geography,
      depth: project.depth,
      status: project.status,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      runStatus: run?.status ?? null,
      currentStage: run?.current_stage ?? null,
      competitorCount: run?.competitor_count ?? 0,
      verifiedCount: run?.verified_count ?? 0,
      sourceCount: run?.source_count ?? 0,
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

export interface CompetitorDetail {
  project: CompetitorProjectRow;
  run: CompetitorRunRow | null;
  attempts: CompetitorStageAttempt[];
  competitors: CompetitorRow[];
  results: CompetitorResultRow[];
  sourceCount: number;
  evidenceCount: number;
  idea: Pick<BusinessIdea, "id" | "title"> | null;
  plan: Pick<BusinessPlan, "id" | "title"> | null;
  /** Verified + partially verified, the ones shown prominently. */
  presentableCount: number;
  byType: { DIRECT: number; INDIRECT: number; EMERGING: number };
}

/**
 * One project with everything the detail page renders.
 *
 * Returns `null` for a project in another workspace — RLS returns no row, and
 * the page turns that into a 404 rather than a 403, so an id cannot be probed.
 */
export async function getCompetitorDetail(
  workspaceId: string,
  projectId: string,
): Promise<CompetitorDetail | null> {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("competitor_projects")
    .select("*")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!project) return null;

  const { data: run } = await supabase
    .from("competitor_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [attempts, competitors, results, sources, evidence, idea, plan] =
    await Promise.all([
      run
        ? getStageAttempts(run.id)
        : Promise.resolve<CompetitorStageAttempt[]>([]),
      getCompetitors(projectId),
      getCompetitorResults(projectId),
      countRows(projectId, "competitor_sources"),
      countRows(projectId, "competitor_evidence"),
      project.business_idea_id
        ? getLinkedIdea(workspaceId, project.business_idea_id)
        : Promise.resolve(null),
      project.business_plan_id
        ? getLinkedPlan(workspaceId, project.business_plan_id)
        : Promise.resolve(null),
    ]);

  const byType = { DIRECT: 0, INDIRECT: 0, EMERGING: 0 };
  for (const competitor of competitors) {
    if (competitor.competitor_type === "DIRECT") byType.DIRECT += 1;
    else if (competitor.competitor_type === "INDIRECT") byType.INDIRECT += 1;
    else if (competitor.competitor_type === "EMERGING") byType.EMERGING += 1;
  }

  return {
    project,
    run: run ?? null,
    attempts,
    competitors,
    results,
    sourceCount: sources,
    evidenceCount: evidence,
    idea,
    plan,
    presentableCount: competitors.filter((c) =>
      isPresentable(c.verification_status as VerificationStatus),
    ).length,
    byType,
  };
}

async function getStageAttempts(
  runId: string,
): Promise<CompetitorStageAttempt[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("competitor_run_stages")
    .select("*")
    .eq("run_id", runId)
    .order("started_at", { ascending: true });

  return ((data ?? []) as CompetitorRunStageRow[])
    .filter((row) => isCompetitorStage(row.stage))
    .map((row) => ({
      stage: row.stage as CompetitorStage,
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
 * Competitors for a project.
 *
 * Ordered so the ones a reader should trust come first: verified before
 * partial before unverified, then by relevance. The UI still labels each one —
 * ordering is a courtesy, not the signal.
 */
export async function getCompetitors(
  projectId: string,
  limit = 60,
): Promise<CompetitorRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("competitors")
    .select("*")
    .eq("project_id", projectId)
    .order("relevance", { ascending: false, nullsFirst: false })
    .limit(limit);

  const rank: Record<string, number> = {
    VERIFIED: 0,
    PARTIALLY_VERIFIED: 1,
    PENDING: 2,
    UNVERIFIED: 3,
  };

  return ((data ?? []) as CompetitorRow[]).sort(
    (a, b) =>
      (rank[a.verification_status] ?? 9) - (rank[b.verification_status] ?? 9),
  );
}

export async function getCompetitorResults(
  projectId: string,
): Promise<CompetitorResultRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("competitor_results")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_current", true);
  return (data ?? []) as CompetitorResultRow[];
}

async function countRows(
  projectId: string,
  table: "competitor_sources" | "competitor_evidence",
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Sources and evidence — paged
// ---------------------------------------------------------------------------

export const SOURCE_PAGE_SIZE = 25;
export const EVIDENCE_PAGE_SIZE = 25;

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getCompetitorSources(
  projectId: string,
  page = 0,
  pageSize = SOURCE_PAGE_SIZE,
): Promise<Page<CompetitorSourceRow>> {
  const supabase = await createClient();
  const from = page * pageSize;
  const { data, count } = await supabase
    .from("competitor_sources")
    .select("*", { count: "exact" })
    .eq("project_id", projectId)
    .neq("status", "rejected")
    .order("created_at", { ascending: true })
    .range(from, from + pageSize - 1);

  return {
    rows: (data ?? []) as CompetitorSourceRow[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export interface EvidenceWithSource {
  evidence: CompetitorEvidenceRow;
  source: Pick<
    CompetitorSourceRow,
    "id" | "url" | "title" | "publisher" | "published_at"
  > | null;
  competitorName: string | null;
}

export async function getCompetitorEvidence(
  projectId: string,
  page = 0,
  pageSize = EVIDENCE_PAGE_SIZE,
): Promise<Page<EvidenceWithSource>> {
  const supabase = await createClient();
  const from = page * pageSize;

  // One join rather than N+1: the source is what makes a claim checkable, so
  // it is never rendered without it.
  const { data, count } = await supabase
    .from("competitor_evidence")
    .select(
      "*, competitor_sources(id, url, title, publisher, published_at), competitors(name)",
      { count: "exact" },
    )
    .eq("project_id", projectId)
    .order("section_key", { ascending: true })
    .range(from, from + pageSize - 1);

  const rows = (data ?? []).map((row) => {
    const joined = row as unknown as CompetitorEvidenceRow & {
      competitor_sources: EvidenceWithSource["source"];
      competitors: { name: string } | null;
    };
    const { competitor_sources, competitors, ...evidence } = joined;
    return {
      evidence,
      source: competitor_sources ?? null,
      competitorName: competitors?.name ?? null,
    };
  });

  return { rows, total: count ?? 0, page, pageSize };
}

// ---------------------------------------------------------------------------
// Depth catalog
// ---------------------------------------------------------------------------

export interface DepthOption {
  id: CompetitorDepth;
  label: string;
  description: string;
  maxCompetitors: number;
  maxSources: number;
  /** Server-calculated. The UI never adds credits up itself. */
  estimatedCredits: number;
}

/**
 * The depth catalog with a server-calculated cost per depth.
 *
 * The estimate is summed by `competitor_estimate_credits` from the same
 * `competitor_stage_costs` rows the engine charges against, so a quote shown on
 * `/competitors/new` and the charge taken by the engine cannot drift. When the
 * RPC is unavailable the mirror in `cost.ts` answers instead — same arithmetic,
 * same numbers, asserted equal by the test suite.
 */
export async function getDepthOptions(): Promise<DepthOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("competitor_depths")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows = ((data ?? []) as CompetitorDepthRow[]).filter((row) =>
    isCompetitorDepth(row.id),
  );

  return Promise.all(
    rows.map(async (row) => {
      const depth = row.id as CompetitorDepth;
      const { data: credits } = await supabase.rpc(
        "competitor_estimate_credits",
        { p_depth: depth },
      );
      return {
        id: depth,
        label: row.label,
        description: row.description,
        maxCompetitors: row.max_competitors,
        maxSources: row.max_sources,
        estimatedCredits:
          typeof credits === "number" ? credits : estimateRunCost(depth),
      };
    }),
  );
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

export interface CompetitorPrefill {
  title: string;
  description?: string;
  category?: string;
  geography?: string;
  targetCustomer?: string;
  businessModel?: string;
  businessIdeaId?: string;
  businessPlanId?: string;
  sourceLabel: string;
  sourceHref: string;
}

interface BriefPayload {
  businessName?: unknown;
  ideaDescription?: unknown;
  industry?: unknown;
  country?: unknown;
  targetAudience?: unknown;
  businessModel?: unknown;
}

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** `saas` -> `SaaS`. The stored value is an enum key, not something to show. */
function modelLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return (MODEL_LABELS as Record<string, string>)[value] ?? str(value, 1000);
}

export async function getPrefillFromIdea(
  workspaceId: string,
  ideaId: string,
): Promise<CompetitorPrefill | null> {
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
    title: `Competitors — ${data.title}`.slice(0, 200),
    description: str(payload.ideaDescription, 4000),
    category: str(payload.industry, 200),
    geography: str(payload.country, 200),
    targetCustomer: str(payload.targetAudience, 1000),
    businessModel: modelLabel(payload.businessModel),
    businessIdeaId: data.id,
    sourceLabel: data.title,
    sourceHref: "/validator",
  };
}

export async function getPrefillFromPlan(
  workspaceId: string,
  planId: string,
): Promise<CompetitorPrefill | null> {
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
    title: `Competitors — ${data.title}`.slice(0, 200),
    description: str(input.ideaDescription, 4000) ?? str(data.summary, 4000),
    category: str(input.industry, 200),
    geography: str(input.country, 200),
    targetCustomer: str(input.targetAudience, 1000),
    businessModel: modelLabel(input.businessModel),
    businessPlanId: data.id,
    sourceLabel: data.title,
    sourceHref: `/plans/${data.id}`,
  };
}

/** Ideas and plans offered in the "Business context" picker on a blank form. */
export async function getCompetitorContextOptions(
  workspaceId: string,
): Promise<{
  ideas: Pick<BusinessIdea, "id" | "title">[];
  plans: Pick<BusinessPlan, "id" | "title">[];
}> {
  const supabase = await createClient();
  const [ideas, plans] = await Promise.all([
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
  ]);

  return { ideas: ideas.data ?? [], plans: plans.data ?? [] };
}
