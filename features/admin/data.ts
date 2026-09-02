import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  AdminAuditLogRow,
  AiUsageLog,
  CreditAccountRow,
  CreditTransactionRow,
  PlanEntitlementRow,
  PlanRow,
  Profile,
  SubscriptionRow,
  Workspace,
  WorkspaceMember,
} from "@/types/database";
import { paged, type PageParams, type Paged } from "@/features/admin/query";

/**
 * Read-side data access for the admin panel.
 *
 * Every query below runs as the signed-in admin's own session. There is no
 * service-role client anywhere in this application — the cross-workspace reach
 * comes from the RLS policies in migration 0008, which consult
 * `admin_has(permission)` on each statement.
 *
 * The practical consequence, and the reason the design is worth the extra SQL:
 * if a caller reaches one of these functions without the matching permission,
 * they get an empty result rather than data. A forgotten guard upstream is a
 * blank page, not a breach.
 */

/** Convenience: the number of rows matching a filter, without fetching them. */
type CountResult = { count: number | null };

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface AdminUserListRow extends Profile {
  workspace_count: number;
}

export async function listUsers(
  params: PageParams,
  opts: { search?: string; status?: "active" | "suspended" } = {},
): Promise<Paged<Profile>> {
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(params.from, params.to);

  if (opts.search) {
    query = query.or(
      `full_name.ilike.%${opts.search}%,company_name.ilike.%${opts.search}%`,
    );
  }
  if (opts.status === "suspended")
    query = query.not("suspended_at", "is", null);
  if (opts.status === "active") query = query.is("suspended_at", null);

  const { data, count, error } = await query;
  if (error) return paged<Profile>([], 0, params);

  return paged<Profile>(data ?? [], count ?? 0, params);
}

export async function getUserDetail(userId: string): Promise<{
  profile: Profile | null;
  memberships: (WorkspaceMember & { workspace: Workspace | null })[];
} | null> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return null;

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("*, workspace:workspaces(*)")
    .eq("user_id", userId);

  return {
    profile,
    memberships:
      (memberships as unknown as (WorkspaceMember & {
        workspace: Workspace | null;
      })[]) ?? [],
  };
}

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

export async function listWorkspaces(
  params: PageParams,
  opts: { search?: string; status?: "active" | "suspended" } = {},
): Promise<Paged<Workspace>> {
  const supabase = await createClient();

  let query = supabase
    .from("workspaces")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(params.from, params.to);

  if (opts.search) {
    query = query.or(`name.ilike.%${opts.search}%,slug.ilike.%${opts.search}%`);
  }
  if (opts.status === "suspended")
    query = query.not("suspended_at", "is", null);
  if (opts.status === "active") query = query.is("suspended_at", null);

  const { data, count, error } = await query;
  if (error) return paged<Workspace>([], 0, params);

  return paged<Workspace>(data ?? [], count ?? 0, params);
}

export interface WorkspaceDetail {
  workspace: Workspace;
  members: (WorkspaceMember & { profile: Profile | null })[];
  subscription: SubscriptionRow | null;
  plan: PlanRow | null;
  credits: CreditAccountRow | null;
  projectCount: number;
  usage: { runs: number; tokens: number; cost: number; failures: number };
}

export async function getWorkspaceDetail(
  workspaceId: string,
): Promise<WorkspaceDetail | null> {
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();

  if (!workspace) return null;

  // Fetched together — a detail page that issued these serially would make the
  // admin wait on six round trips for one screen.
  const [membersRes, subRes, creditsRes, projectsRes, usageRes] =
    await Promise.all([
      supabase
        .from("workspace_members")
        .select("*, profile:profiles(*)")
        .eq("workspace_id", workspaceId),
      supabase
        .from("subscriptions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      supabase
        .from("credit_accounts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
      supabase
        .from("ai_usage_logs")
        .select("status, total_tokens, estimated_cost_usd")
        .eq("workspace_id", workspaceId)
        .limit(1000),
    ]);

  let plan: PlanRow | null = null;
  if (subRes.data?.plan_id) {
    const { data } = await supabase
      .from("plans")
      .select("*")
      .eq("id", subRes.data.plan_id)
      .maybeSingle();
    plan = data ?? null;
  }

  const events = usageRes.data ?? [];
  const usage = {
    runs: events.length,
    failures: events.filter((e) => e.status !== "success").length,
    tokens: events.reduce((sum, e) => sum + (e.total_tokens ?? 0), 0),
    cost: events.reduce((sum, e) => sum + Number(e.estimated_cost_usd ?? 0), 0),
  };

  return {
    workspace,
    members:
      (membersRes.data as unknown as (WorkspaceMember & {
        profile: Profile | null;
      })[]) ?? [],
    subscription: subRes.data ?? null,
    plan,
    credits: creditsRes.data ?? null,
    projectCount: (projectsRes as CountResult).count ?? 0,
    usage,
  };
}

// ---------------------------------------------------------------------------
// AI operations
// ---------------------------------------------------------------------------

export interface AiFilters {
  search?: string;
  status?: "success" | "failed";
  workflow?: string;
  model?: string;
  since?: string;
  until?: string;
}

export async function listAiUsage(
  params: PageParams,
  filters: AiFilters = {},
): Promise<Paged<AiUsageLog>> {
  const supabase = await createClient();

  let query = supabase
    .from("ai_usage_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(params.from, params.to);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.workflow) query = query.eq("workflow", filters.workflow);
  if (filters.model) query = query.eq("model", filters.model);
  if (filters.since) query = query.gte("created_at", filters.since);
  if (filters.until) query = query.lte("created_at", filters.until);

  const { data, count, error } = await query;
  if (error) return paged<AiUsageLog>([], 0, params);

  return paged<AiUsageLog>(data ?? [], count ?? 0, params);
}

/** Distinct workflows and models, for the filter dropdowns. */
export async function getAiFacets(): Promise<{
  workflows: string[];
  models: string[];
}> {
  const supabase = await createClient();
  // Bounded: the facet list only needs recent activity, not all history.
  const { data } = await supabase
    .from("ai_usage_logs")
    .select("workflow, model")
    .order("created_at", { ascending: false })
    .limit(500);

  const workflows = new Set<string>();
  const models = new Set<string>();
  for (const row of data ?? []) {
    if (row.workflow) workflows.add(row.workflow);
    if (row.model) models.add(row.model);
  }
  return {
    workflows: [...workflows].sort(),
    models: [...models].sort(),
  };
}

export async function getAiUsageDetail(id: string): Promise<AiUsageLog | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_usage_logs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------

export async function listCreditAccounts(
  params: PageParams,
): Promise<Paged<CreditAccountRow & { workspace: Workspace | null }>> {
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("credit_accounts")
    .select("*, workspace:workspaces(*)", { count: "exact" })
    .order("balance", { ascending: false })
    .range(params.from, params.to);

  if (error) return paged([], 0, params);
  return paged(
    (data as unknown as (CreditAccountRow & {
      workspace: Workspace | null;
    })[]) ?? [],
    count ?? 0,
    params,
  );
}

export async function listCreditTransactions(
  params: PageParams,
  opts: { workspaceId?: string; kind?: string } = {},
): Promise<Paged<CreditTransactionRow>> {
  const supabase = await createClient();

  let query = supabase
    .from("credit_transactions")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(params.from, params.to);

  if (opts.workspaceId) query = query.eq("workspace_id", opts.workspaceId);
  if (opts.kind) query = query.eq("kind", opts.kind);

  const { data, count, error } = await query;
  if (error) return paged<CreditTransactionRow>([], 0, params);
  return paged<CreditTransactionRow>(data ?? [], count ?? 0, params);
}

// ---------------------------------------------------------------------------
// Plans & entitlements
// ---------------------------------------------------------------------------

export async function listAllPlans(): Promise<PlanRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plans")
    .select("*")
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function listAllEntitlements(): Promise<PlanEntitlementRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_entitlements")
    .select("*")
    .order("plan_id", { ascending: true })
    .order("feature", { ascending: true });
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export async function listAuditLogs(
  params: PageParams,
  opts: { action?: string; entityType?: string; entityId?: string } = {},
): Promise<Paged<AdminAuditLogRow>> {
  const supabase = await createClient();

  let query = supabase
    .from("admin_audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(params.from, params.to);

  if (opts.action) query = query.eq("action", opts.action);
  if (opts.entityType) query = query.eq("entity_type", opts.entityType);
  if (opts.entityId) query = query.eq("entity_id", opts.entityId);

  const { data, count, error } = await query;
  if (error) return paged<AdminAuditLogRow>([], 0, params);
  return paged<AdminAuditLogRow>(data ?? [], count ?? 0, params);
}

// ---------------------------------------------------------------------------
// Platform statistics
// ---------------------------------------------------------------------------

/**
 * Dashboard aggregates.
 *
 * Computed by `admin_platform_stats()` in Postgres rather than by counting rows
 * in TypeScript. The function returns only the metrics the caller's role may
 * see, so a key being absent means "you cannot see this", which the dashboard
 * renders as *unavailable* rather than as zero. A missing metric shown as `0`
 * would be a lie an operator might act on.
 */
export type PlatformStats = Record<string, number | string>;

export async function getPlatformStats(
  since?: Date,
): Promise<PlatformStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_platform_stats", {
    p_since: since ? since.toISOString() : null,
  });
  if (error) return null;
  return (data as PlatformStats) ?? null;
}

/** Recent failures for the dashboard's triage panel. */
export async function recentFailures(limit = 8): Promise<AiUsageLog[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_usage_logs")
    .select("*")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function recentWorkspaces(limit = 6): Promise<Workspace[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspaces")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function recentCreditActivity(
  limit = 8,
): Promise<CreditTransactionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("credit_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Workspace plan assignment  (migration 0029)
// ---------------------------------------------------------------------------

export interface PlanHistoryEntry {
  id: string;
  old_plan: string;
  new_plan: string;
  reason: string | null;
  created_at: string;
  changed_by_role: string | null;
  changed_by_email: string | null;
}

/**
 * A workspace's plan transitions, newest first.
 *
 * Goes through `admin_workspace_plan_history` rather than selecting the table
 * directly so the actor's email arrives in the same round trip — `auth.users`
 * is not readable from a client session, and joining it here would otherwise
 * mean a second query per row.
 *
 * Returns [] rather than throwing when the caller lacks `workspaces.read`: the
 * page already renders a NoPermission panel for that case, and an exception
 * would take the whole detail view down over one absent section.
 */
export async function getWorkspacePlanHistory(
  workspaceId: string,
  limit = 20,
): Promise<PlanHistoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_workspace_plan_history", {
    p_workspace_id: workspaceId,
    p_limit: limit,
  });

  if (error) {
    console.error("[admin] plan history unavailable", error.message);
    return [];
  }
  return Array.isArray(data) ? (data as unknown as PlanHistoryEntry[]) : [];
}

/**
 * The plans a SUPER_ADMIN may assign from the workspace detail screen.
 *
 * The three self-serve tiers, per the Phase 14 brief. `professional` and
 * `enterprise` are negotiated rather than assigned from this screen, so they
 * are not offered here — but note that the restriction is presentation only:
 * `admin_change_workspace_plan` accepts any plan id that exists in the catalog,
 * so widening this list needs no migration and no change to the function.
 *
 * Names and prices come from the `plans` table, never from a literal here, so
 * this cannot drift from the catalog the customer sees on /pricing.
 */
export const ASSIGNABLE_PLAN_IDS = ["free", "starter", "growth"] as const;

export async function listAssignablePlans(): Promise<PlanRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plans")
    .select("*")
    .in("id", [...ASSIGNABLE_PLAN_IDS])
    .order("sort_order", { ascending: true });
  return data ?? [];
}
