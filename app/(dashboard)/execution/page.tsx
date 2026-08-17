import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, PlayCircle, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getExecutionPlans } from "@/features/execution/data";
import { getExecutionAccess } from "@/features/execution/permissions";
import { ExecutionAccessNotice } from "@/features/execution/execution-access-notice";
import { PLAN_STATUS_LABELS, isPlanStatus } from "@/features/execution/types";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Execution",
  description: "Turn strategy into controlled, approved, auditable actions.",
};

/**
 * `/execution` — every execution plan in the workspace.
 *
 * The number this page leads with is actions awaiting approval, because that is
 * the only number on it that requires a person to do something.
 */
export default async function ExecutionPage() {
  const access = await getExecutionAccess();

  if (!access.entitled) {
    return (
      <div className="flex flex-col gap-8">
        <Header workspaceName={access.workspace.name} />
        <ExecutionAccessNotice reason="not_entitled" />
      </div>
    );
  }

  const plans = await getExecutionPlans(access.workspace.id);
  const awaiting = plans.reduce(
    (total, plan) => total + plan.awaitingApproval,
    0,
  );

  return (
    <div className="flex flex-col gap-8">
      <Header workspaceName={access.workspace.name} />

      {awaiting > 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-accent-lime/30 bg-accent-lime/10 px-4 py-3 text-sm text-accent-lime">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {awaiting} action{awaiting === 1 ? "" : "s"} waiting for someone to
          approve {awaiting === 1 ? "it" : "them"}. Nothing runs until{" "}
          {awaiting === 1 ? "it is" : "they are"} approved.
        </p>
      ) : null}

      {plans.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
            <PlayCircle className="size-7" />
          </span>
          <p className="mt-5 font-display text-lg font-bold text-foreground">
            No execution plans yet
          </p>
          <p className="mt-1 max-w-md text-sm text-muted">
            An execution plan turns part of your strategy into specific actions.
            Anything that leaves AIAutoMix — a published page, a post, an email
            sequence — waits for your approval before it runs, and every
            decision is recorded permanently.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {plans.map((plan) => (
            <li key={plan.id}>
              <PlanCard plan={plan} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Header({ workspaceName }: { workspaceName: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Execution
        </h1>
        <p className="max-w-prose text-muted">
          Strategy becomes actions in {workspaceName}. AIAutoMix decides what
          should happen; you decide whether it may.
        </p>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
}: {
  plan: Awaited<ReturnType<typeof getExecutionPlans>>[number];
}) {
  const status = isPlanStatus(plan.status) ? plan.status : "DRAFT";

  return (
    <Link
      href={`/execution/${plan.id}`}
      className="group block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet"
    >
      <Card className="flex h-full items-start gap-5 p-5 transition-colors group-hover:border-white/20">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
          <PlayCircle className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-base font-bold tracking-tight text-foreground">
            {plan.title}
          </h2>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge
              variant={
                status === "ACTIVE"
                  ? "active"
                  : status === "PAUSED"
                    ? "paused"
                    : status === "CANCELLED"
                      ? "archived"
                      : "neutral"
              }
            >
              {PLAN_STATUS_LABELS[status]}
            </Badge>
            {plan.awaitingApproval > 0 ? (
              <Badge variant="paused">
                {plan.awaitingApproval} awaiting approval
              </Badge>
            ) : null}
            {plan.failedActions > 0 ? (
              <Badge variant="archived">{plan.failedActions} failed</Badge>
            ) : null}
          </div>

          <p className="mt-2 text-xs text-muted-strong">
            {plan.completedActions} of {plan.totalActions} actions complete ·
            Created {formatDate(plan.createdAt)}
          </p>

          <progress
            className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-brand-gradient [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-fill-2 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-brand-gradient"
            value={plan.completedActions}
            max={Math.max(plan.totalActions, 1)}
            aria-label={`${plan.completedActions} of ${plan.totalActions} actions complete`}
          />
        </div>

        <ArrowRight className="mt-1 size-5 shrink-0 text-muted-strong transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </Card>
    </Link>
  );
}
