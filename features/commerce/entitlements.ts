import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  type AccessDecision,
  type Feature,
  type PlanId,
  type SubscriptionStatus,
  isEntitledStatus,
} from "@/features/commerce/types";

/**
 * Entitlement engine (ENTITLEMENT-ENGINE-SPEC.md).
 *
 * The single place that decides whether a workspace may use a feature. Feature
 * modules ask `canAccess(workspaceId, feature)` and never inspect a plan name —
 * that rule is what lets pricing change without touching feature code, and it
 * is why `PlanId` deliberately appears nowhere in this module's public surface
 * except as diagnostic output on a denial.
 *
 * Server-only, and the data it reads is unwritable from a browser: migration
 * 0007 grants no INSERT/UPDATE/DELETE policy on `subscriptions` or
 * `plan_entitlements` to any client role. A caller cannot fake an entitlement
 * by tampering with a request — there is no request; the answer comes from the
 * database under the caller's own RLS.
 */

interface EntitlementRow {
  is_enabled: boolean;
  limit_value: number | null;
}

/**
 * Resolve a workspace's plan and subscription status.
 *
 * Returns `null` when the workspace has no subscription at all, which the
 * caller must treat as "no access" rather than "unlimited". Migration 0007
 * backfills every existing workspace, so this is the genuinely-missing case.
 */
export async function getWorkspacePlan(
  workspaceId: string,
): Promise<{ planId: PlanId; status: SubscriptionStatus } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("plan_id, status")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!data) return null;
  return {
    planId: data.plan_id as PlanId,
    status: data.status as SubscriptionStatus,
  };
}

/**
 * May this workspace use this feature?
 *
 * Fails closed at every step: an unknown plan, a missing entitlement row, an
 * inactive subscription and a database error all deny. The one thing this
 * function will never do is grant access because something was absent — an
 * entitlement system that defaults to "allow" when it cannot find a rule is
 * worse than none, because it looks like it is working.
 */
export async function canAccess(
  workspaceId: string,
  feature: Feature,
): Promise<AccessDecision> {
  const plan = await getWorkspacePlan(workspaceId);

  if (!plan) {
    return { allowed: false, limit: 0, reason: "no_subscription" };
  }

  if (!isEntitledStatus(plan.status)) {
    return {
      allowed: false,
      limit: 0,
      reason: "subscription_inactive",
      planId: plan.planId,
      status: plan.status,
    };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_entitlements")
    .select("is_enabled, limit_value")
    .eq("plan_id", plan.planId)
    .eq("feature", feature)
    .maybeSingle<EntitlementRow>();

  // No row means the plan does not describe this feature. Deny: a feature added
  // to the code before it is added to the catalog must not become free for all.
  if (!data) {
    return {
      allowed: false,
      limit: 0,
      reason: "feature_not_in_plan",
      planId: plan.planId,
      status: plan.status,
    };
  }

  if (!data.is_enabled || data.limit_value === 0) {
    return {
      allowed: false,
      limit: data.limit_value,
      reason: "feature_disabled",
      planId: plan.planId,
      status: plan.status,
    };
  }

  return {
    allowed: true,
    limit: data.limit_value, // null = unlimited
    planId: plan.planId,
    status: plan.status,
  };
}

/**
 * `canAccess` plus a usage cap check, for features metered per period.
 *
 * Separate from `canAccess` on purpose: counting usage costs a query, and most
 * call sites only need to know whether the feature exists on the plan. Callers
 * that enforce quotas opt into the extra work.
 */
export async function canAccessWithinLimit(
  workspaceId: string,
  feature: Feature,
  currentUsage: number,
): Promise<AccessDecision> {
  const decision = await canAccess(workspaceId, feature);
  if (!decision.allowed) return decision;

  // null limit = unlimited.
  if (decision.limit !== null && currentUsage >= decision.limit) {
    return { ...decision, allowed: false, reason: "limit_reached" };
  }
  return decision;
}

/** Every entitlement for a plan — used by the pricing page and usage dashboard. */
export async function getPlanEntitlements(
  planId: PlanId,
): Promise<Record<string, { enabled: boolean; limit: number | null }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_entitlements")
    .select("feature, is_enabled, limit_value")
    .eq("plan_id", planId);

  const out: Record<string, { enabled: boolean; limit: number | null }> = {};
  for (const row of data ?? []) {
    out[row.feature] = { enabled: row.is_enabled, limit: row.limit_value };
  }
  return out;
}

/** Human-readable denial text. Never leaks plan internals to an unauthorised caller. */
export function describeDenial(decision: AccessDecision): string {
  switch (decision.reason) {
    case "no_subscription":
      return "This workspace has no active subscription.";
    case "subscription_inactive":
      return "Your subscription is not active. Renew to continue using this feature.";
    case "feature_not_in_plan":
    case "feature_disabled":
      return "Your current plan does not include this feature.";
    case "limit_reached":
      return "You have reached your plan's limit for this feature.";
    default:
      return "This feature is not available.";
  }
}
