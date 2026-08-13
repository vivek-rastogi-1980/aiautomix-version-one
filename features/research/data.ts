import "server-only";

import { createClient } from "@/lib/supabase/server";
import { MODEL_LABELS } from "@/lib/validations/business-idea";
import type {
  BusinessIdea,
  BusinessPlan,
  ResearchDepthRow,
  ResearchEvidenceRow,
  ResearchRequestOverviewRow,
  ResearchRequestRow,
  ResearchResultRow,
  ResearchRunRow,
  ResearchRunStageRow,
  ResearchSourceRow,
} from "@/types/database";
import {
  RESEARCH_STAGES,
  isResearchDepth,
  isResearchStage,
  stageIndex,
  type ResearchDepth,
  type ResearchStage,
} from "@/features/research/types";
import { estimateRunCost } from "@/features/research/cost";

/**
 * Read layer for the Market Research product.
 *
 * Every query filters on `workspace_id` even though RLS already does. That is
 * not superstition: the workspace here comes from `getWorkspaceContext`, which
 * derives it from the session, and stating it in the query means a future
 * refactor that loosens a policy does not silently widen these reads. RLS
 * remains the enforcement point; this is the second lock on the same door.
 *
 * Nothing in this file computes progress from anything but persisted rows. A
 * stage is complete when `research_run_stages` says it succeeded, and the
 * resume point is `research_runs.current_stage` — never a client's idea of
 * where it got to.
 */

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export interface ResearchListItem extends ResearchRequestOverviewRow {
  /** Stages persisted as succeeded, out of seven. Derived, never guessed. */
  completedStages: number;
}

/**
 * Research projects in the workspace, newest first.
 *
 * `completedStages` comes from `current_stage`: the pointer only advances when
 * `research_complete_stage` commits, so its index *is* the number of stages
 * that finished. A run with no pointer and a `completed` status has finished
 * all seven.
 */
export async function getResearchList(
  workspaceId: string,
  limit = 50,
): Promise<ResearchListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("research_request_overview")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    ...row,
    completedStages: completedStageCount(row.current_stage, row.status),
  }));
}

/** How many of the seven stages have actually been persisted as succeeded. */
export function completedStageCount(
  currentStage: string | null,
  status: string,
): number {
  if (status === "completed") return RESEARCH_STAGES.length;
  if (!isResearchStage(currentStage)) return 0;
  return stageIndex(currentStage);
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export interface StageAttempt {
  stage: ResearchStage;
  attempt: number;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  creditsCharged: number;
  creditsRefunded: number;
  durationMs: number | null;
  startedAt: string;
  completedAt: string | null;
}

export interface ResearchDetail {
  request: ResearchRequestRow;
  /** Null until the first `run-stage` call creates the run. */
  run: ResearchRunRow | null;
  /** Every attempt of every stage, oldest first. */
  attempts: StageAttempt[];
  results: ResearchResultRow[];
  sourceCount: number;
  evidenceCount: number;
  /** Set when the request came from a business idea and it still exists. */
  idea: Pick<BusinessIdea, "id" | "title"> | null;
  plan: Pick<BusinessPlan, "id" | "title"> | null;
}

/**
 * A single research project with everything the detail page renders.
 *
 * Returns `null` for a request in another workspace — RLS returns no row, and
 * the page turns that into a 404 rather than a 403, so an id cannot be probed.
 */
export async function getResearchDetail(
  workspaceId: string,
  requestId: string,
): Promise<ResearchDetail | null> {
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("research_requests")
    .select("*")
    .eq("id", requestId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!request) return null;

  const { data: run } = await supabase
    .from("research_runs")
    .select("*")
    .eq("research_request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Counts and section results are read directly rather than from the run row,
  // so a page opened between a stage commit and a run-row update still shows
  // what is actually stored.
  const [attempts, results, sources, evidence, idea, plan] = await Promise.all([
    run ? getStageAttempts(run.id) : Promise.resolve<StageAttempt[]>([]),
    getResearchResults(requestId),
    countRows(requestId, "research_sources"),
    countRows(requestId, "research_evidence"),
    request.business_idea_id
      ? getLinkedIdea(workspaceId, request.business_idea_id)
      : Promise.resolve(null),
    request.business_plan_id
      ? getLinkedPlan(workspaceId, request.business_plan_id)
      : Promise.resolve(null),
  ]);

  return {
    request,
    run: run ?? null,
    attempts,
    results,
    sourceCount: sources,
    evidenceCount: evidence,
    idea,
    plan,
  };
}

async function getStageAttempts(runId: string): Promise<StageAttempt[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("research_run_stages")
    .select("*")
    .eq("run_id", runId)
    .order("started_at", { ascending: true });

  return (data ?? [])
    .filter((row: ResearchRunStageRow) => isResearchStage(row.stage))
    .map((row: ResearchRunStageRow) => ({
      stage: row.stage as ResearchStage,
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

// ---------------------------------------------------------------------------
// Report version history
// ---------------------------------------------------------------------------

export interface ReportVersionEntry {
  version: number;
  createdAt: string;
  status: string;
  confidence: string;
  isCurrent: boolean;
}

/**
 * Every stored version of a section, newest first.
 *
 * `research_complete_stage` stands the previous row down and inserts
 * `version = max + 1` — it never updates in place and never deletes. So this
 * query is the whole history, and a regeneration adds to it rather than
 * replacing anything.
 *
 * Keyed on `executive_summary` by default because the report stage rewrites
 * that section on every regeneration, which makes its version the report's
 * version.
 */
export async function getReportVersions(
  workspaceId: string,
  requestId: string,
  sectionKey = "executive_summary",
  limit = 20,
): Promise<ReportVersionEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("research_results")
    .select("version, created_at, status, confidence, is_current")
    .eq("research_request_id", requestId)
    .eq("workspace_id", workspaceId)
    .eq("section_key", sectionKey)
    .order("version", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => ({
    version: row.version,
    createdAt: row.created_at,
    status: row.status,
    confidence: row.confidence,
    isCurrent: row.is_current,
  }));
}

/** Current version of every section that has been written. */
export async function getResearchResults(
  requestId: string,
): Promise<ResearchResultRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("research_results")
    .select("*")
    .eq("research_request_id", requestId)
    .eq("is_current", true);
  return data ?? [];
}

async function countRows(
  requestId: string,
  table: "research_sources" | "research_evidence",
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("research_request_id", requestId);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Sources and evidence
//
// Paged rather than loaded whole. A deep run stores up to forty sources and a
// few hundred evidence rows; sending all of that to the browser to render a
// list is exactly the "load huge source content" the spec warns against.
// ---------------------------------------------------------------------------

export const SOURCE_PAGE_SIZE = 25;
export const EVIDENCE_PAGE_SIZE = 25;

export interface Page<T> {
  rows: T[];
  total: number;
  /** 0-based. */
  page: number;
  pageSize: number;
}

export async function getResearchSources(
  requestId: string,
  page = 0,
  pageSize = SOURCE_PAGE_SIZE,
): Promise<Page<ResearchSourceRow>> {
  const supabase = await createClient();
  const from = page * pageSize;
  const { data, count } = await supabase
    .from("research_sources")
    .select("*", { count: "exact" })
    .eq("research_request_id", requestId)
    .neq("status", "rejected")
    .order("created_at", { ascending: true })
    .range(from, from + pageSize - 1);

  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export interface EvidenceWithSource {
  evidence: ResearchEvidenceRow;
  /** Never null in practice: `source_id` is NOT NULL with a foreign key. */
  source: Pick<
    ResearchSourceRow,
    "id" | "url" | "title" | "publisher" | "source_type" | "published_at"
  > | null;
}

export async function getResearchEvidence(
  requestId: string,
  page = 0,
  pageSize = EVIDENCE_PAGE_SIZE,
): Promise<Page<EvidenceWithSource>> {
  const supabase = await createClient();
  const from = page * pageSize;

  // One join rather than N+1: the source is what makes a claim checkable, so
  // it is never rendered without it.
  const { data, count } = await supabase
    .from("research_evidence")
    .select(
      "*, research_sources(id, url, title, publisher, source_type, published_at)",
      { count: "exact" },
    )
    .eq("research_request_id", requestId)
    .order("section_key", { ascending: true })
    .range(from, from + pageSize - 1);

  const rows = (data ?? []).map((row) => {
    const joined = row as unknown as ResearchEvidenceRow & {
      research_sources: EvidenceWithSource["source"];
    };
    const { research_sources, ...evidence } = joined;
    return { evidence, source: research_sources ?? null };
  });

  return { rows, total: count ?? 0, page, pageSize };
}

// ---------------------------------------------------------------------------
// Depth catalog
// ---------------------------------------------------------------------------

export interface DepthOption {
  id: ResearchDepth;
  label: string;
  description: string;
  maxSources: number;
  /** Server-calculated. The UI never adds credits up itself. */
  estimatedCredits: number;
}

/**
 * The depth catalog with a server-calculated cost per depth.
 *
 * The estimate is summed by `research_estimate_credits` from the same
 * `research_stage_costs` rows the engine charges against, so a quote shown on
 * `/research/new` and the charge taken by the engine cannot drift. When the RPC
 * is unavailable the mirror in `cost.ts` answers instead — same arithmetic,
 * same numbers, asserted equal by the test suite.
 */
export async function getDepthOptions(): Promise<DepthOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("research_depths")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows = (data ?? []).filter((row: ResearchDepthRow) =>
    isResearchDepth(row.id),
  );

  return Promise.all(
    rows.map(async (row: ResearchDepthRow) => {
      const depth = row.id as ResearchDepth;
      const { data: credits } = await supabase.rpc(
        "research_estimate_credits",
        { p_depth: depth },
      );
      return {
        id: depth,
        label: row.label,
        description: row.description,
        maxSources: row.max_sources,
        estimatedCredits:
          typeof credits === "number" ? credits : estimateRunCost(depth),
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Provenance — business ideas and business plans
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

/**
 * What `/research/new` puts in the form when it is opened from an idea or plan.
 *
 * Only the scoping fields are copied, and only into form defaults the user can
 * still edit. The relationship itself is stored as an id — duplicating the
 * whole idea would mean two records that drift apart, and the research pipeline
 * re-derives everything it needs from its own brief anyway.
 */
export interface ResearchPrefill {
  title: string;
  scope?: string;
  industry?: string;
  geography?: string;
  targetCustomer?: string;
  businessModel?: string;
  businessIdeaId?: string;
  businessPlanId?: string;
  /** Rendered as "Research based on: …" above the form. */
  sourceLabel: string;
  sourceHref: string;
}

/** The subset of an idea/plan brief that maps onto a research scope. */
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
): Promise<ResearchPrefill | null> {
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
    title: `Market research — ${data.title}`.slice(0, 200),
    scope: str(payload.ideaDescription, 4000),
    industry: str(payload.industry, 200),
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
): Promise<ResearchPrefill | null> {
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
    title: `Market research — ${data.title}`.slice(0, 200),
    scope: str(input.ideaDescription, 4000) ?? str(data.summary, 4000),
    industry: str(input.industry, 200),
    geography: str(input.country, 200),
    targetCustomer: str(input.targetAudience, 1000),
    businessModel: modelLabel(input.businessModel),
    businessPlanId: data.id,
    sourceLabel: data.title,
    sourceHref: `/plans/${data.id}`,
  };
}

/** Ideas and plans offered in the "Business context" picker on a blank form. */
export async function getResearchContextOptions(workspaceId: string): Promise<{
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
