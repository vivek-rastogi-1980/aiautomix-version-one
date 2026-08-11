/**
 * Commercial domain types (COMMERCIAL-PLATFORM-SPEC.md).
 *
 * The split here is deliberate and is the whole point of "data-driven plans":
 *
 *   VALUES  — prices, limits, which plan grants what — live in the database, so
 *             changing a limit is a SQL update rather than a deploy.
 *   KEYS    — feature identifiers and plan ids — are TypeScript unions, so a
 *             typo in `canAccess(ws, "buisness_plan")` fails at compile time
 *             instead of silently denying access forever.
 *
 * Getting that boundary wrong in either direction hurts: hard-coding limits
 * means a price change needs engineering, and stringly-typed features mean a
 * misspelling becomes a production access bug nobody notices.
 */

/** Feature keys, per ENTITLEMENT-ENGINE-SPEC.md. */
export const FEATURES = [
  "business_idea_validation",
  "business_plan",
  "pdf_export",
  "market_research",
  "competitor_analysis",
  "team_members",
  "api_access",
] as const;

export type Feature = (typeof FEATURES)[number];

/** Plan ids seeded by migration 0007. */
export const PLAN_IDS = [
  "free",
  "starter",
  "growth",
  "professional",
  "enterprise",
] as const;

export type PlanId = (typeof PLAN_IDS)[number];

/**
 * SUBSCRIPTION-ARCHITECTURE.md. Provider-neutral: nothing here names Stripe or
 * Razorpay, and no adapter exists in this sprint.
 */
export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "expired",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Which states may use paid features.
 *
 * `past_due` is deliberately included. Cutting access the instant a card fails
 * punishes the customer for a bank decline and generates support load; the
 * industry norm is a grace period, and the state exists precisely so dunning
 * can run while service continues. `canceled` and `expired` do not grant
 * access — they are terminal.
 */
const ENTITLED_STATUSES: readonly SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
];

export function isEntitledStatus(status: SubscriptionStatus | null): boolean {
  return status !== null && ENTITLED_STATUSES.includes(status);
}

export const CREDIT_KINDS = [
  "GRANT",
  "DEBIT",
  "REFUND",
  "ADJUSTMENT",
  "EXPIRATION",
] as const;

export type CreditKind = (typeof CREDIT_KINDS)[number];

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  /** Minor units (cents). `null` on quote-only plans. */
  price_monthly: number | null;
  price_yearly: number | null;
  currency: string;
  monthly_credits: number;
  sort_order: number;
  is_public: boolean;
}

export interface PlanEntitlement {
  plan_id: PlanId;
  feature: Feature;
  is_enabled: boolean;
  /** `null` means unlimited. `0` means denied. */
  limit_value: number | null;
}

export interface Subscription {
  id: string;
  workspace_id: string;
  plan_id: PlanId;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_ends_at: string | null;
  provider: string | null;
  provider_ref: string | null;
}

export interface CreditAccount {
  workspace_id: string;
  balance: number;
  lifetime_granted: number;
  lifetime_spent: number;
}

export interface CreditTransaction {
  id: string;
  workspace_id: string;
  kind: CreditKind;
  amount: number;
  balance_after: number;
  reason: string | null;
  workflow: string | null;
  created_at: string;
}

/** The outcome of an entitlement check. */
export interface AccessDecision {
  allowed: boolean;
  /** `null` when unlimited. */
  limit: number | null;
  /** Machine-readable cause when `allowed` is false. */
  reason?:
    | "no_subscription"
    | "subscription_inactive"
    | "feature_not_in_plan"
    | "feature_disabled"
    | "limit_reached";
  planId?: PlanId;
  status?: SubscriptionStatus;
}
