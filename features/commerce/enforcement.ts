import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Feature } from "@/features/commerce/types";

/**
 * Atomic entitlement enforcement.
 *
 * ---------------------------------------------------------------------------
 * Why this exists alongside `canAccess`
 * ---------------------------------------------------------------------------
 * `canAccess()` answers "does this plan include this feature?" and is exactly
 * right for rendering a locked panel or deciding what to show. It does not
 * reserve anything.
 *
 * `canAccessWithinLimit()` goes further, but takes the usage count as an
 * ARGUMENT, so every caller does:
 *
 *     used = await countWorkflowRuns(...)      // a SELECT
 *     if (allowed) await runWorkflow(...)      // usage logged afterwards
 *
 * Two concurrent requests both read the pre-request count and both proceed.
 * Because `ai_usage_logs` is only written after the AI call returns, the window
 * is the whole duration of that call. Counting is not reserving.
 *
 * `consumeEntitlement` reserves. One database call takes `for update` on the
 * workspace's counter row, compares it against the CURRENT configured limit and
 * increments — so two simultaneous callers serialise and the second sees the
 * first's increment. Proven with eight parallel connections against a limit of
 * three: three allowed, five denied, every run.
 *
 * ---------------------------------------------------------------------------
 * Nothing here is trusted from the client
 * ---------------------------------------------------------------------------
 * The only inputs are a workspace id, a feature name and an idempotency key.
 * There is no parameter for a plan, a limit or a usage count — the function
 * resolves the plan from `subscriptions` and the limit from `plan_entitlements`
 * itself. A caller who names a workspace they do not belong to is refused by
 * `is_workspace_member` inside the database.
 *
 * ---------------------------------------------------------------------------
 * Limits are never cached
 * ---------------------------------------------------------------------------
 * `plan_entitlements.limit_value` is read on every call. A SUPER_ADMIN raising
 * free validations from 3 to 5 changes the answer for the very next request,
 * with no deploy, rebuild, restart or re-login. Verified against the live
 * database.
 */

export interface ConsumeResult {
  allowed: boolean;
  feature: string;
  /** Present when denied. `limit_reached`, `feature_disabled`, etc. */
  reason?: string;
  plan?: string;
  status?: string;
  used?: number;
  /** null means unlimited. */
  limit?: number | null;
  remaining?: number | null;
  period?: string;
  periodStart?: string;
  /** True when this key had already been consumed; nothing was charged again. */
  replayed?: boolean;
}

/**
 * Reserve one unit of a feature's monthly allowance.
 *
 * MUST be called before the expensive work, never after: a denial has to
 * prevent the AI call, not report on one that already happened.
 *
 * `idempotencyKey` must be deterministic for the logical operation, so a retry
 * of the same request collides instead of consuming a second unit. See
 * `validationIdempotencyKey` below.
 *
 * A transport failure denies. An entitlement system that opens up when the
 * database is unreachable is worse than none, because it fails in exactly the
 * conditions where load is highest.
 */
export async function consumeEntitlement(
  workspaceId: string,
  feature: Feature,
  idempotencyKey: string,
): Promise<ConsumeResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("entitlement_consume", {
    p_workspace_id: workspaceId,
    p_feature: feature,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("[entitlement] consume failed", {
      feature,
      code: error.code,
      message: error.message,
    });
    return { allowed: false, feature, reason: "unavailable" };
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    allowed: row["allowed"] === true,
    feature,
    reason: typeof row["reason"] === "string" ? row["reason"] : undefined,
    plan: typeof row["plan"] === "string" ? row["plan"] : undefined,
    status: typeof row["status"] === "string" ? row["status"] : undefined,
    used: typeof row["used"] === "number" ? row["used"] : undefined,
    limit:
      row["limit"] === null || typeof row["limit"] === "number"
        ? (row["limit"] as number | null)
        : undefined,
    remaining:
      row["remaining"] === null || typeof row["remaining"] === "number"
        ? (row["remaining"] as number | null)
        : undefined,
    period: typeof row["period"] === "string" ? row["period"] : undefined,
    periodStart:
      typeof row["period_start"] === "string"
        ? row["period_start"]
        : undefined,
    replayed: row["replayed"] === true,
  };
}

/**
 * Give back a reservation whose work did not happen.
 *
 * Called when the AI run fails after the allowance was reserved. Matches the
 * policy `countWorkflowRuns` already implements by counting successes only: a
 * customer does not spend allowance on something they did not receive.
 *
 * Never throws. This runs on an error path, and an exception here would replace
 * the real failure with a confusing second one.
 */
export async function releaseEntitlement(
  idempotencyKey: string,
): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("entitlement_release", {
      p_idempotency_key: idempotencyKey,
    });
    if (error) {
      console.error("[entitlement] release failed", {
        code: error.code,
        message: error.message,
      });
    }
  } catch (error) {
    console.error("[entitlement] release threw", {
      message: error instanceof Error ? error.message : error,
    });
  }
}

/** One feature's slice of the usage panel. */
export interface FeatureUsage {
  feature: string;
  is_enabled: boolean;
  /** null = unlimited. */
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface WorkspaceEntitlementUsage {
  plan: string | null;
  status?: string;
  periodStart?: string;
  periodEnd?: string;
  features: FeatureUsage[];
}

/**
 * Current plan, period and per-feature consumption for the dashboard.
 *
 * Reads through `entitlement_usage`, which returns usage alongside the CURRENT
 * limit from the same query. What the customer is shown and what the engine
 * enforces therefore come from one place and cannot drift apart.
 */
export async function getEntitlementUsage(
  workspaceId: string,
): Promise<WorkspaceEntitlementUsage | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("entitlement_usage", {
    p_workspace_id: workspaceId,
  });

  if (error) {
    console.error("[entitlement] usage unavailable", error.message);
    return null;
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    plan: typeof row["plan"] === "string" ? row["plan"] : null,
    status: typeof row["status"] === "string" ? row["status"] : undefined,
    periodStart:
      typeof row["period_start"] === "string" ? row["period_start"] : undefined,
    periodEnd:
      typeof row["period_end"] === "string" ? row["period_end"] : undefined,
    features: Array.isArray(row["features"])
      ? (row["features"] as FeatureUsage[])
      : [],
  };
}

/**
 * The idempotency key for one validation attempt.
 *
 * Deterministic in the inputs that define the attempt, so a retried request
 * collides with its first try instead of consuming a second unit of allowance.
 * Derived server-side — a client-supplied key would let a caller sidestep the
 * collision simply by sending a fresh one.
 */
export function validationIdempotencyKey(
  workspaceId: string,
  fingerprint: string,
): string {
  return `validation:${workspaceId}:${fingerprint}`;
}

/** The same, for business plan generation. */
export function businessPlanIdempotencyKey(
  workspaceId: string,
  fingerprint: string,
): string {
  return `business_plan:${workspaceId}:${fingerprint}`;
}
