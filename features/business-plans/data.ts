import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  BusinessPlan,
  BusinessPlanSection,
  BusinessPlanVersion,
  PlanContentSource,
} from "@/types/database";

/**
 * Business plan reads and the one place a section revision is written.
 *
 * Queries are workspace-scoped in SQL *and* protected by RLS. The explicit
 * filter is not redundant: it keeps the index in play and makes the ownership
 * contract visible at the call site.
 */

export interface PlanWithSections {
  plan: BusinessPlan;
  sections: BusinessPlanSection[];
  /** Revision history for every section, newest first, keyed by section id. */
  history: Map<string, BusinessPlanVersion[]>;
}

/** Plans in a workspace, newest first. */
export async function getBusinessPlans(
  workspaceId: string,
): Promise<BusinessPlan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_plans")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * A plan with its sections and full revision history.
 *
 * History is fetched for the whole plan in one query and grouped in memory,
 * rather than one query per section — eleven sections would otherwise mean
 * eleven round trips to render a single page.
 */
export async function getBusinessPlan(
  workspaceId: string,
  planId: string,
): Promise<PlanWithSections | null> {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("business_plans")
    .select("*")
    .eq("id", planId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!plan) return null;

  const [{ data: sections }, { data: versions }] = await Promise.all([
    supabase
      .from("business_plan_sections")
      .select("*")
      .eq("plan_id", planId)
      .order("position", { ascending: true }),
    supabase
      .from("business_plan_versions")
      .select("*")
      .eq("plan_id", planId)
      .order("version", { ascending: false }),
  ]);

  const history = new Map<string, BusinessPlanVersion[]>();
  for (const version of versions ?? []) {
    const bucket = history.get(version.section_id);
    if (bucket) bucket.push(version);
    else history.set(version.section_id, [version]);
  }

  return { plan, sections: sections ?? [], history };
}

/** A single section, scoped to the workspace. */
export async function getPlanSectionRow(
  workspaceId: string,
  sectionId: string,
): Promise<BusinessPlanSection | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_plan_sections")
    .select("*")
    .eq("id", sectionId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data ?? null;
}

/** One stored revision, scoped to the workspace. */
export async function getPlanVersion(
  workspaceId: string,
  versionId: string,
): Promise<BusinessPlanVersion | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_plan_versions")
    .select("*")
    .eq("id", versionId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data ?? null;
}

/** Postgres unique-violation — two edits raced for the same version number. */
const UNIQUE_VIOLATION = "23505";

export class VersionConflictError extends Error {
  constructor() {
    super("This section changed in another tab. Reload and try again.");
    this.name = "VersionConflictError";
  }
}

/**
 * Save new content for a section as the next revision.
 *
 * The history row is written **before** the section is updated, and
 * `unique (section_id, version)` makes that insert the concurrency guard: two
 * simultaneous edits cannot both claim version N, and the loser is rejected
 * rather than silently overwriting. Ordering it this way also means a failure
 * between the two writes leaves an unused history row rather than current
 * content with no record of how it got there.
 *
 * Shared by editing and restoring, so "what a revision is" is defined once.
 */
export async function saveSectionRevision(options: {
  section: BusinessPlanSection;
  content: string;
  source: PlanContentSource;
  userId: string;
}): Promise<BusinessPlanSection> {
  const { section, content, source, userId } = options;
  const supabase = await createClient();
  const nextVersion = section.current_version + 1;

  const { error: versionError } = await supabase
    .from("business_plan_versions")
    .insert({
      section_id: section.id,
      plan_id: section.plan_id,
      workspace_id: section.workspace_id,
      section_key: section.section_key,
      version: nextVersion,
      content,
      source,
      edited_by: userId,
    });

  if (versionError) {
    if (versionError.code === UNIQUE_VIOLATION) {
      throw new VersionConflictError();
    }
    throw new Error(`Could not record the revision: ${versionError.message}`);
  }

  const { data: updated, error: updateError } = await supabase
    .from("business_plan_sections")
    .update({ content, source, current_version: nextVersion })
    .eq("id", section.id)
    .eq("current_version", section.current_version)
    .select()
    .single();

  if (updateError || !updated) {
    throw new Error(
      `Could not update the section: ${updateError?.message ?? "unknown error"}`,
    );
  }

  return updated;
}
