import type { ConsumeResult } from "@/features/commerce/enforcement";

/**
 * The refusal a customer is allowed to see.
 *
 * ---------------------------------------------------------------------------
 * Why its own error type
 * ---------------------------------------------------------------------------
 * "You have used your three validations this month" is a normal product
 * outcome, not a fault. It needs to reach the UI with enough structure to
 * render a useful screen — how many were used, out of how many, when it resets
 * — which a plain message string cannot carry.
 *
 * It is deliberately NOT an `AiError`. That type is the AI platform's
 * vocabulary for provider failures, and a quota refusal is not a provider
 * failure: nothing was sent to a provider, which is the entire point.
 *
 * ---------------------------------------------------------------------------
 * What it must never carry
 * ---------------------------------------------------------------------------
 * No table names, no SQL, no internal identifiers beyond the feature key the
 * UI already knows. The fields below are exactly what the customer's own
 * dashboard shows them anyway.
 */
export class EntitlementError extends Error {
  readonly code = "ENTITLEMENT_LIMIT_REACHED" as const;
  readonly feature: string;
  readonly reason: string;
  readonly used: number | null;
  readonly limit: number | null;
  readonly plan: string | null;
  readonly period: string;
  readonly periodStart: string | null;

  constructor(result: ConsumeResult) {
    super(messageFor(result));
    this.name = "EntitlementError";
    this.feature = result.feature;
    this.reason = result.reason ?? "denied";
    this.used = result.used ?? null;
    this.limit = result.limit ?? null;
    this.plan = result.plan ?? null;
    this.period = result.period ?? "monthly";
    this.periodStart = result.periodStart ?? null;
  }

  /** The wire shape. Safe to return to a browser as-is. */
  toPayload(): {
    code: string;
    feature: string;
    reason: string;
    used: number | null;
    limit: number | null;
    plan: string | null;
    period: string;
    message: string;
  } {
    return {
      code: this.code,
      feature: this.feature,
      reason: this.reason,
      used: this.used,
      limit: this.limit,
      plan: this.plan,
      period: this.period,
      message: this.message,
    };
  }
}

/** Human labels. Kept here so one refusal reads the same everywhere. */
const FEATURE_LABEL: Record<string, string> = {
  business_idea_validation: "validation",
  business_plan: "Business Plan",
  market_research: "market research",
  competitor_analysis: "competitor analysis",
  financial_intelligence: "financial analysis",
  marketing_intelligence: "marketing strategy",
};

/**
 * Copy for each refusal reason.
 *
 * Every branch names what the customer can do next. "Denied" on its own tells
 * somebody they cannot proceed without telling them why or how to fix it, which
 * turns a plan limit into a support ticket.
 */
function messageFor(result: ConsumeResult): string {
  const label = FEATURE_LABEL[result.feature] ?? "this feature";

  switch (result.reason) {
    case "limit_reached":
      return result.limit === null
        ? `You have reached your monthly ${label} limit.`
        : `You've used ${result.used ?? result.limit} of ${result.limit} ${label} runs this month.`;
    case "feature_disabled":
    case "feature_not_in_plan":
      return `${capitalise(label)} is not included in your current plan.`;
    case "subscription_inactive":
      return `Your subscription is not active, so ${label} is unavailable.`;
    case "no_subscription":
      return `No plan is assigned to this workspace yet.`;
    case "unavailable":
      // A transport failure denies rather than opening up. The customer is told
      // to retry, not that the entitlement service is down.
      return `We couldn't check your plan just now. Please try again.`;
    default:
      return `${capitalise(label)} is not available on your current plan.`;
  }
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** True when a refusal means "upgrade would fix this". */
export function isUpgradable(reason: string): boolean {
  return (
    reason === "limit_reached" ||
    reason === "feature_disabled" ||
    reason === "feature_not_in_plan"
  );
}
