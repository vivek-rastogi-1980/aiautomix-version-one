import "server-only";

import { createClient } from "@/lib/supabase/server";
import { findActionDefinition } from "@/features/execution/registry";
import { getProvider } from "@/features/execution/providers";
import {
  isActionState,
  isActionType,
  type ActionState,
} from "@/features/execution/types";
import type {
  ExecutionActionRow,
  ExecutionAuditLogRow,
  ExecutionPlanRow,
  ExecutionRunRow,
} from "@/types/database";

/**
 * Reads for Business Execution.
 *
 * Every query runs under the caller's own RLS. There is no service-role client
 * and no hand-written `workspace_id` filter standing in for a policy —
 * duplicating the rule in TypeScript would create a second place for it to be
 * wrong.
 */

export interface ExecutionPlanListItem {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  totalActions: number;
  completedActions: number;
  awaitingApproval: number;
  failedActions: number;
}

export async function getExecutionPlans(
  workspaceId: string,
  limit = 50,
): Promise<ExecutionPlanListItem[]> {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("execution_plans")
    .select("id, title, status, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!plans?.length) return [];

  const { data: actions } = await supabase
    .from("execution_actions")
    .select("execution_plan_id, status")
    .in(
      "execution_plan_id",
      plans.map((plan) => plan.id),
    );

  const counters = new Map<
    string,
    { total: number; completed: number; awaiting: number; failed: number }
  >();

  for (const action of actions ?? []) {
    const entry = counters.get(action.execution_plan_id) ?? {
      total: 0,
      completed: 0,
      awaiting: 0,
      failed: 0,
    };
    entry.total += 1;
    if (action.status === "COMPLETED") entry.completed += 1;
    if (action.status === "AWAITING_APPROVAL") entry.awaiting += 1;
    if (action.status === "FAILED") entry.failed += 1;
    counters.set(action.execution_plan_id, entry);
  }

  return plans.map((plan) => {
    const counts = counters.get(plan.id);
    return {
      id: plan.id,
      title: plan.title,
      status: plan.status,
      createdAt: plan.created_at,
      totalActions: counts?.total ?? 0,
      completedActions: counts?.completed ?? 0,
      awaitingApproval: counts?.awaiting ?? 0,
      failedActions: counts?.failed ?? 0,
    };
  });
}

/**
 * An action enriched with everything the UI needs to explain it.
 *
 * The registry data is joined here rather than in the component, so the
 * approval screen and the report cannot disagree about what an action does.
 */
export interface ExecutionActionView {
  row: ExecutionActionRow;
  state: ActionState;
  displayName: string;
  description: string;
  /** What happens in the world if this is approved. Shown before approving. */
  consequence: string;
  sideEffect: string;
  requiredIntegration: string;
  effort: string;
  providerConfigured: boolean;
  providerNote: string | null;
  attemptsAllowed: number;
  runs: ExecutionRunRow[];
}

export interface ExecutionPlanDetail {
  plan: ExecutionPlanRow;
  actions: ExecutionActionView[];
  audit: ExecutionAuditLogRow[];
}

export async function getExecutionPlanDetail(
  workspaceId: string,
  planId: string,
): Promise<ExecutionPlanDetail | null> {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("execution_plans")
    .select("*")
    .eq("id", planId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!plan) return null;

  const [actions, audit] = await Promise.all([
    supabase
      .from("execution_actions")
      .select("*")
      .eq("execution_plan_id", planId)
      .order("display_order"),
    supabase
      .from("execution_audit_logs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const actionRows = actions.data ?? [];

  const { data: runs } = actionRows.length
    ? await supabase
        .from("execution_runs")
        .select("*")
        .in(
          "action_id",
          actionRows.map((action) => action.id),
        )
        .order("attempt", { ascending: false })
    : { data: [] as ExecutionRunRow[] };

  const runsByAction = new Map<string, ExecutionRunRow[]>();
  for (const run of runs ?? []) {
    const list = runsByAction.get(run.action_id) ?? [];
    list.push(run);
    runsByAction.set(run.action_id, list);
  }

  return {
    plan,
    actions: actionRows.map((row) =>
      toView(row, runsByAction.get(row.id) ?? []),
    ),
    audit: audit.data ?? [],
  };
}

export async function getExecutionAction(
  workspaceId: string,
  actionId: string,
): Promise<ExecutionActionView | null> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("execution_actions")
    .select("*")
    .eq("id", actionId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!row) return null;

  const { data: runs } = await supabase
    .from("execution_runs")
    .select("*")
    .eq("action_id", actionId)
    .order("attempt", { ascending: false });

  return toView(row, runs ?? []);
}

function toView(
  row: ExecutionActionRow,
  runs: ExecutionRunRow[],
): ExecutionActionView {
  const definition = isActionType(row.action_type)
    ? findActionDefinition(row.action_type)
    : null;

  const provider = getProvider(row.execution_provider);

  return {
    row,
    state: isActionState(row.status) ? row.status : "DRAFT",
    displayName: definition?.displayName ?? row.action_type,
    description: definition?.description ?? "",
    consequence:
      definition?.consequence ??
      "This action's type is not in the registry, so its effect cannot be described.",
    sideEffect: definition?.sideEffect ?? "EXTERNAL_MUTATION",
    requiredIntegration: definition?.requiredIntegration ?? "Unknown",
    effort: definition?.effort ?? "MEDIUM",
    providerConfigured: provider?.isConfigured() ?? false,
    providerNote: provider?.unconfiguredReason() ?? null,
    attemptsAllowed: definition?.retryPolicy.maxAttempts ?? 1,
    runs,
  };
}

/** Plans and business plans a new execution plan can be built from. */
export async function getExecutionSources(workspaceId: string): Promise<{
  gtmProjects: { id: string; title: string }[];
  businessPlans: { id: string; title: string }[];
}> {
  const supabase = await createClient();

  const [gtm, plans] = await Promise.all([
    supabase
      .from("gtm_projects")
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
  ]);

  return {
    gtmProjects: gtm.data ?? [],
    businessPlans: plans.data ?? [],
  };
}
