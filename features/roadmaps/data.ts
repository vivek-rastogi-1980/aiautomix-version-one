import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ExecutionRoadmap, ExecutionRoadmapTask } from "@/types/database";

/**
 * Read-side data access for execution roadmaps (Phase 15).
 *
 * Every query runs as the signed-in customer's own session. The `workspace_id`
 * filters below are belt-and-braces: RLS already restricts these tables to
 * workspace members, so a caller naming someone else's workspace gets no rows
 * either way. Naming it here makes the scoping visible at the call site instead
 * of implicit in a policy somebody has to go and read.
 */

export interface RoadmapProgress {
  total: number;
  completed: number;
  blocked: number;
  high_priority_open: number;
  percent: number;
}

const EMPTY_PROGRESS: RoadmapProgress = {
  total: 0,
  completed: 0,
  blocked: 0,
  high_priority_open: 0,
  percent: 0,
};

/**
 * The roadmap for a business plan, if one has been generated.
 *
 * Returns the newest when several exist. The product creates at most one per
 * plan today — the plan page offers "Open roadmap" rather than "Create" once
 * one exists — but ordering here means a future "generate another" feature does
 * not silently surface the oldest.
 */
export async function getRoadmapForPlan(
  workspaceId: string,
  businessPlanId: string,
): Promise<ExecutionRoadmap | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("execution_roadmaps")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("business_plan_id", businessPlanId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Tasks for a roadmap, in period then display order. */
export async function getRoadmapTasks(
  workspaceId: string,
  roadmapId: string,
): Promise<ExecutionRoadmapTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("execution_roadmap_tasks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("roadmap_id", roadmapId)
    .order("period", { ascending: true })
    .order("sort_order", { ascending: true });
  return data ?? [];
}

/**
 * Completion, computed in the database.
 *
 * Deliberately not derived in TypeScript from a task list. §21 requires that
 * the client cannot manipulate the percentage; computing it in SQL means the
 * number never exists as a writable value anywhere, so there is nothing to
 * tamper with rather than a check to remember.
 *
 * Falls back to zeroes rather than throwing: a progress bar is not worth taking
 * a page down for.
 */
export async function getRoadmapProgress(
  roadmapId: string,
): Promise<RoadmapProgress> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("execution_roadmap_progress", {
    p_roadmap_id: roadmapId,
  });

  if (error || !data) {
    if (error) console.error("[roadmap] progress unavailable", error.message);
    return EMPTY_PROGRESS;
  }

  const row = data as unknown as Partial<RoadmapProgress>;
  return {
    total: row.total ?? 0,
    completed: row.completed ?? 0,
    blocked: row.blocked ?? 0,
    high_priority_open: row.high_priority_open ?? 0,
    percent: row.percent ?? 0,
  };
}

export interface RoadmapDetail {
  roadmap: ExecutionRoadmap;
  tasks: ExecutionRoadmapTask[];
  progress: RoadmapProgress;
}

/** Everything the roadmap page renders, or null when there is no roadmap. */
export async function getRoadmapDetailForPlan(
  workspaceId: string,
  businessPlanId: string,
): Promise<RoadmapDetail | null> {
  const roadmap = await getRoadmapForPlan(workspaceId, businessPlanId);
  if (!roadmap) return null;

  const [tasks, progress] = await Promise.all([
    getRoadmapTasks(workspaceId, roadmap.id),
    getRoadmapProgress(roadmap.id),
  ]);

  return { roadmap, tasks, progress };
}

/**
 * The workspace's most recent roadmap and its progress, for the dashboard.
 *
 * One query plus one aggregate rather than loading every task into the page
 * just to count them.
 */
export async function getLatestRoadmapSummary(
  workspaceId: string,
): Promise<{ roadmap: ExecutionRoadmap; progress: RoadmapProgress } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("execution_roadmaps")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { roadmap: data, progress: await getRoadmapProgress(data.id) };
}
