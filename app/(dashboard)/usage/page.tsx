import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth/session";
import { getWorkspaceContext } from "@/features/workspaces/data";
import {
  getSubscription,
  getPlan,
  formatPrice,
} from "@/features/commerce/subscriptions";
import {
  getCreditAccount,
  getCreditHistory,
} from "@/features/commerce/credits";
import { getPlanEntitlements } from "@/features/commerce/entitlements";
import {
  getWorkspaceUsage,
  getUsageSummary,
  currentPeriodStart,
} from "@/features/commerce/usage";
import type { PlanId } from "@/features/commerce/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Usage & plan" };

/**
 * Workspace usage dashboard.
 *
 * Every figure here is read server-side under the caller's own RLS. Nothing is
 * accepted from the client and nothing is computed in the browser — a user who
 * edits their local state changes what they see and nothing else, because the
 * same checks run again on the server for any action that matters.
 */
export const dynamic = "force-dynamic";

const FEATURE_LABELS: Record<string, string> = {
  business_idea_validation: "Idea validations",
  business_plan: "Business plans",
  pdf_export: "PDF export",
  market_research: "Market research",
  competitor_analysis: "Competitor analysis",
  team_members: "Team members",
  api_access: "API access",
};

const STATUS_VARIANT: Record<
  string,
  "active" | "brand" | "neutral" | "completed"
> = {
  active: "active",
  trialing: "brand",
  past_due: "neutral",
  canceled: "neutral",
  expired: "neutral",
};

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="flex flex-col gap-1 p-5">
      <p className="text-2xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      <p className="text-sm text-muted">{label}</p>
      {sub ? <p className="text-xs text-muted-strong">{sub}</p> : null}
    </Card>
  );
}

export default async function UsagePage() {
  const user = await requireUser();
  const { workspace } = await getWorkspaceContext(user.id);

  const periodStart = currentPeriodStart();
  const [subscription, credits, summary, events, history] = await Promise.all([
    getSubscription(workspace.id),
    getCreditAccount(workspace.id),
    getUsageSummary(workspace.id, periodStart),
    getWorkspaceUsage(workspace.id, 10),
    getCreditHistory(workspace.id, 8),
  ]);

  const plan = subscription
    ? await getPlan(subscription.plan_id as PlanId)
    : null;
  const entitlements = subscription
    ? await getPlanEntitlements(subscription.plan_id as PlanId)
    : {};

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Usage &amp; plan
        </h1>
        <p className="text-muted">
          Activity for {workspace.name} since {formatDate(periodStart)}.
        </p>
      </div>

      {/* Plan */}
      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              {plan?.name ?? "No plan"}
            </h2>
            {subscription ? (
              <Badge variant={STATUS_VARIANT[subscription.status] ?? "neutral"}>
                {subscription.status.replace("_", " ")}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {plan
              ? `${formatPrice(plan.price_monthly, plan.currency)}${
                  plan.price_monthly ? " per month" : ""
                }`
              : "This workspace has no subscription."}
          </p>
        </div>
        <Link
          href="/pricing"
          className="shrink-0 text-sm font-medium text-brand-cyan hover:underline"
        >
          Compare plans →
        </Link>
      </Card>

      {/* Headline numbers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Credit balance"
          value={credits ? credits.balance.toLocaleString("en-US") : "0"}
          sub={
            credits
              ? `${credits.lifetime_spent.toLocaleString("en-US")} spent all time`
              : undefined
          }
        />
        <Stat label="AI runs this period" value={String(summary.totalRuns)} />
        <Stat
          label="Successful"
          value={String(summary.successfulRuns)}
          sub={summary.failedRuns ? `${summary.failedRuns} failed` : undefined}
        />
        <Stat
          label="Tokens used"
          value={summary.totalTokens.toLocaleString("en-US")}
          sub={`≈ $${summary.estimatedCostUsd.toFixed(4)} est. cost`}
        />
      </div>

      {/* Limits */}
      <Card className="p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Plan limits
        </h2>
        <p className="text-sm text-muted">
          What your current plan includes each month.
        </p>
        <ul className="mt-5 divide-y divide-white/[0.06]">
          {Object.entries(FEATURE_LABELS).map(([key, label]) => {
            const entry = entitlements[key];
            const denied = !entry || !entry.enabled || entry.limit === 0;
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span className="text-sm text-foreground">{label}</span>
                <span className="text-sm font-medium">
                  {denied ? (
                    <span className="text-muted-strong">Not included</span>
                  ) : entry.limit === null ? (
                    <span className="text-brand-cyan">Unlimited</span>
                  ) : (
                    <span className="text-foreground">{entry.limit}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Recent AI usage */}
      <Card className="p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Recent AI activity
        </h2>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No AI runs yet this workspace. Start with the{" "}
            <Link href="/validator" className="text-brand-cyan hover:underline">
              idea validator
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-white/[0.06]">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {event.workflow}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(event.created_at)} · {event.model}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge
                    variant={event.status === "success" ? "active" : "neutral"}
                  >
                    {event.status}
                  </Badge>
                  <p className="mt-1 text-xs text-muted">
                    {event.total_tokens?.toLocaleString("en-US") ?? "—"} tokens
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Credit ledger */}
      <Card className="p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Credit history
        </h2>
        <p className="text-sm text-muted">
          Every change to your balance. This ledger is append-only — corrections
          appear as new entries rather than edits.
        </p>
        {history.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No credit activity yet.</p>
        ) : (
          <ul className="mt-5 divide-y divide-white/[0.06]">
            {history.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {tx.kind}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {formatDateTime(tx.created_at)}
                    {tx.reason ? ` · ${tx.reason}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-semibold ${
                      tx.amount > 0 ? "text-brand-cyan" : "text-foreground"
                    }`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {tx.amount.toLocaleString("en-US")}
                  </p>
                  <p className="text-xs text-muted">
                    balance {tx.balance_after.toLocaleString("en-US")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
