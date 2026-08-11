import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Plan,
  PlanId,
  Subscription,
  SubscriptionStatus,
} from "@/features/commerce/types";

/**
 * Subscription state (SUBSCRIPTION-ARCHITECTURE.md).
 *
 * Provider-neutral by construction: this module does not import, reference or
 * know about any payment provider. `subscriptions.provider` and `provider_ref`
 * exist as opaque columns for a future adapter, and nothing in Sprint 6.5
 * writes them.
 *
 * The shape a future adapter should take:
 *
 *   Application -> Payment Service -> Provider Adapter -> Stripe / Razorpay
 *
 * The adapter's job is to translate a provider webhook into one of the five
 * states below and call `setSubscriptionState`. Feature code never learns which
 * provider was used, which is the point — swapping providers should not touch
 * anything outside the adapter.
 */

/**
 * Which transitions are legal.
 *
 * Encoded rather than left to callers because an unconstrained status column is
 * how a canceled subscription silently becomes active again. A provider webhook
 * arriving out of order is normal, and this is what refuses it.
 *
 * `expired` is terminal: a lapsed subscription is restarted by creating a new
 * period, not by mutating the dead one, so the history stays readable.
 */
const LEGAL_TRANSITIONS: Record<
  SubscriptionStatus,
  readonly SubscriptionStatus[]
> = {
  trialing: ["active", "canceled", "expired"],
  active: ["past_due", "canceled", "expired"],
  past_due: ["active", "canceled", "expired"],
  canceled: ["active"], // reactivation within the same period
  expired: [],
};

export function canTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
): boolean {
  if (from === to) return true;
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function getSubscription(
  workspaceId: string,
): Promise<Subscription | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle<Subscription>();
  return data ?? null;
}

export type SubscriptionResult =
  | { ok: true; subscription: Subscription }
  | {
      ok: false;
      error: "not_found" | "illegal_transition" | "failed";
      message: string;
    };

/**
 * Move a subscription to a new state.
 *
 * Server-side only, and unreachable from a browser: there is no Server Action
 * or API route that exposes it, and RLS grants no write policy on
 * `subscriptions` to any client role. In Sprint 6.5 the only callers are
 * internal; in a later sprint the payment adapter becomes the caller.
 */
export async function setSubscriptionState(
  workspaceId: string,
  status: SubscriptionStatus,
  options: { canceledAt?: string; periodEnd?: string } = {},
): Promise<SubscriptionResult> {
  const current = await getSubscription(workspaceId);
  if (!current) {
    return {
      ok: false,
      error: "not_found",
      message: "No subscription for this workspace.",
    };
  }

  if (!canTransition(current.status, status)) {
    return {
      ok: false,
      error: "illegal_transition",
      message: `Cannot move a ${current.status} subscription to ${status}.`,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status,
      canceled_at:
        status === "canceled"
          ? (options.canceledAt ?? new Date().toISOString())
          : null,
      current_period_end: options.periodEnd ?? current.current_period_end,
    })
    .eq("workspace_id", workspaceId)
    .select()
    .maybeSingle<Subscription>();

  if (error || !data) {
    return {
      ok: false,
      error: "failed",
      message: "Could not update the subscription.",
    };
  }
  return { ok: true, subscription: data };
}

/** The public plan catalog, ordered for display. */
export async function listPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plans")
    .select("*")
    .eq("is_public", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as Plan[];
}

export async function getPlan(planId: PlanId): Promise<Plan | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle<Plan>();
  return data ?? null;
}

/** Format minor units for display. `null` renders as the quote-only case. */
export function formatPrice(
  minorUnits: number | null,
  currency = "USD",
): string {
  if (minorUnits === null) return "Custom";
  if (minorUnits === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minorUnits / 100);
}
