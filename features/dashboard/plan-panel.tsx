import Link from "next/link";
import { ArrowUpRight, Infinity as InfinityIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { WorkspaceEntitlementUsage } from "@/features/commerce/enforcement";

/**
 * The customer's plan and monthly allowance.
 *
 * ---------------------------------------------------------------------------
 * Shown values and enforced values come from one query
 * ---------------------------------------------------------------------------
 * `entitlement_usage` returns each feature's consumption alongside its CURRENT
 * limit, read from the same `plan_entitlements` row the enforcement function
 * reads at execution time. So the panel cannot tell a customer "12 of 40" while
 * the engine is enforcing 10 — a class of bug that is invisible until somebody
 * is refused at a number the screen never showed them.
 *
 * ---------------------------------------------------------------------------
 * The UI is not the boundary
 * ---------------------------------------------------------------------------
 * Nothing here decides anything. A customer who edits the DOM to un-grey a
 * button still meets `entitlement_consume` in the database, which is what
 * actually refuses. This panel exists so the refusal is never a surprise.
 */

/** Features a customer cares about seeing a quota for, in reading order. */
const SHOWN: { feature: string; label: string }[] = [
  { feature: "business_idea_validation", label: "Business validations" },
  { feature: "business_plan", label: "Business plans" },
  { feature: "market_research", label: "Market research" },
  { feature: "competitor_analysis", label: "Competitor analysis" },
];

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  professional: "Professional",
  enterprise: "Enterprise",
};

export function PlanPanel({
  usage,
}: {
  usage: WorkspaceEntitlementUsage | null;
}) {
  // §11 of the brief: never invent a plan. If the commercial state cannot be
  // read, say so — a fabricated "Free" would be a lie about what somebody is
  // paying for.
  if (!usage || !usage.plan) {
    return (
      <Card className="p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Your plan
        </h2>
        <p className="mt-1 text-sm text-muted">Plan information unavailable.</p>
      </Card>
    );
  }

  const byFeature = new Map(usage.features.map((f) => [f.feature, f]));
  const rows = SHOWN.map((entry) => ({
    ...entry,
    data: byFeature.get(entry.feature),
  })).filter((row) => row.data);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            {PLAN_LABEL[usage.plan] ?? usage.plan}
          </h2>
          {usage.periodEnd ? (
            <p className="mt-1 text-sm text-muted">
              Allowance resets {formatDate(usage.periodEnd)}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {usage.status ? (
            <Badge
              variant={
                usage.status === "active" || usage.status === "trialing"
                  ? "active"
                  : "archived"
              }
            >
              {usage.status}
            </Badge>
          ) : null}
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3.5 py-1.5 text-sm font-medium text-foreground hover:bg-fill-3"
          >
            Upgrade plan <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {rows.map(({ feature, label, data }) => {
          if (!data) return null;

          const unlimited = data.limit === null;
          const disabled = !data.is_enabled || data.limit === 0;
          const exhausted =
            !unlimited && !disabled && (data.remaining ?? 0) <= 0;

          // Only meaningful for a capped feature. Unlimited draws no bar —
          // a full bar would read as "exhausted", the opposite of the truth.
          const percent =
            unlimited || disabled || data.limit === null
              ? null
              : Math.min(
                  Math.round((data.used / Math.max(data.limit, 1)) * 100),
                  100,
                );

          return (
            <div key={feature}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-foreground">
                  {label}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    exhausted ? "text-red-300" : "text-muted",
                  )}
                >
                  {disabled ? (
                    "Not included"
                  ) : unlimited ? (
                    <span className="inline-flex items-center gap-1">
                      <InfinityIcon className="size-3.5" /> Unlimited
                    </span>
                  ) : exhausted ? (
                    "Limit reached"
                  ) : (
                    `${data.used} / ${data.limit} used · ${data.remaining} left`
                  )}
                </span>
              </div>

              {percent !== null ? (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill-1">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      exhausted ? "bg-red-400/70" : "bg-brand-violet/60",
                    )}
                    style={{ width: `${Math.max(percent, 2)}%` }}
                  />
                </div>
              ) : null}

              {exhausted ? (
                <p className="mt-1.5 text-xs text-muted">
                  You&rsquo;ve used all {data.limit} this month. Upgrade for a
                  higher allowance, or wait for the reset.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <Link
        href="/usage"
        className="mt-5 inline-block text-sm text-accent hover:underline"
      >
        View detailed usage →
      </Link>
    </Card>
  );
}
