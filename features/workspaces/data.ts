import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from "@/types/database";

/**
 * Workspace data layer (WORKSPACE-ARCHITECTURE.md).
 *
 * Every user works inside exactly one personal workspace in this sprint. The
 * workspace is created by migration 0004 for users that already existed, and
 * lazily here for anyone who signs up afterwards.
 *
 * Bootstrapping lazily rather than from a signup trigger is deliberate: an
 * error inside the `auth.users` trigger would fail registration itself, and
 * breaking signup to create a container is a bad trade. Doing it on first read
 * costs one extra query on a cold workspace and can never block sign-up.
 */

export interface WorkspaceContext {
  workspace: Workspace;
  /** The current user's role in that workspace. */
  role: WorkspaceRole;
}

/** Postgres unique-violation, raised when two requests bootstrap at once. */
const UNIQUE_VIOLATION = "23505";

function personalSlug(userId: string): string {
  return `ws-${userId.replace(/-/g, "")}`;
}

async function findMembership(
  userId: string,
): Promise<WorkspaceContext | null> {
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", membership.workspace_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!workspace) return null;
  return { workspace, role: membership.role };
}

/** Derive a friendly workspace name from the profile, falling back to email. */
async function defaultWorkspaceName(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const name =
    profile?.full_name?.trim() || user?.email?.split("@")[0] || "Personal";
  return `${name}'s workspace`;
}

async function createPersonalWorkspace(
  userId: string,
): Promise<WorkspaceContext> {
  const supabase = await createClient();
  const slug = personalSlug(userId);

  const { data: created, error } = await supabase
    .from("workspaces")
    .insert({
      owner_id: userId,
      name: await defaultWorkspaceName(userId),
      slug,
      is_personal: true,
    })
    .select()
    .single();

  // Lost a race with a concurrent request: the other one already made it.
  if (error?.code === UNIQUE_VIOLATION) {
    const existing = await findMembership(userId);
    if (existing) return existing;
  }

  if (error || !created) {
    throw new Error(
      `Could not create a workspace: ${error?.message ?? "unknown error"}`,
    );
  }

  // The owner is also a member — every permission check reads one table.
  await supabase
    .from("workspace_members")
    .insert({ workspace_id: created.id, user_id: userId, role: "owner" });

  return { workspace: created, role: "owner" };
}

/**
 * The current user's workspace and role, creating the personal workspace on
 * first use. Every workspace-scoped write goes through this.
 */
export async function getWorkspaceContext(
  userId: string,
): Promise<WorkspaceContext> {
  return (
    (await findMembership(userId)) ?? (await createPersonalWorkspace(userId))
  );
}

/**
 * The roster. Profile rows are readable only by their owner, so this
 * deliberately returns roles and join dates rather than names — surfacing other
 * members' identities needs a profile-visibility change that belongs with
 * collaboration, which is out of scope for this sprint.
 */
export async function getWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

/** Counts for the workspace overview, scoped by RLS to what the user may see. */
export interface WorkspaceStats {
  projects: number;
  ideas: number;
  plans: number;
  reports: number;
}

export async function getWorkspaceStats(
  workspaceId: string,
): Promise<WorkspaceStats> {
  const supabase = await createClient();

  const countIn = async (
    table:
      "projects" | "business_ideas" | "business_plans" | "validation_reports",
  ): Promise<number> => {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null);
    return count ?? 0;
  };

  const [projects, ideas, plans, reports] = await Promise.all([
    countIn("projects"),
    countIn("business_ideas"),
    countIn("business_plans"),
    countIn("validation_reports"),
  ]);

  return { projects, ideas, plans, reports };
}
