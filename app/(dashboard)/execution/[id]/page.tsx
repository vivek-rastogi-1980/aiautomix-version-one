import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getExecutionPlanDetail } from "@/features/execution/data";
import { getExecutionAccess } from "@/features/execution/permissions";
import { ExecutionAccessNotice } from "@/features/execution/execution-access-notice";
import { ActionControls } from "@/features/execution/action-controls";
import { PlanStatusControls } from "@/features/execution/plan-controls";
import {
  ActionCard,
  AuditTrail,
  EmptyActions,
  PlanSummary,
  planTotals,
} from "@/features/execution/execution-views";
import {
  PLAN_STATUS_LABELS,
  isPlanStatus,
  planAllowsExecution,
} from "@/features/execution/types";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Execution plan" };

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * `/execution/[id]` — the plan, its actions and the audit trail.
 *
 * A Server Component. The only client code on the page is the control strip
 * under each action, and it enforces nothing: every button posts to an endpoint
 * that re-checks state, approval and entitlement from the database.
 */
export default async function ExecutionPlanPage({ params }: PageProps) {
  const { id } = await params;
  const access = await getExecutionAccess();

  if (!access.entitled) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <ExecutionAccessNotice reason="not_entitled" />
      </div>
    );
  }

  const detail = await getExecutionPlanDetail(access.workspace.id, id);
  if (!detail) notFound();

  const { plan, actions, audit } = detail;
  const status = isPlanStatus(plan.status) ? plan.status : "DRAFT";
  const planActive = planAllowsExecution(status);
  const totals = planTotals(actions);

  return (
    <div className="flex flex-col gap-8">
      <BackLink />

      <Card className="p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-violet">
              Execution Plan
            </p>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {plan.title}
            </h1>
            {plan.description ? (
              <p className="mt-1.5 max-w-prose text-sm text-muted">
                {plan.description}
              </p>
            ) : null}
            <p className="mt-1.5 text-sm text-muted">
              Created {formatDate(plan.created_at)}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
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
              {!access.canCreate ? (
                <Badge variant="neutral">Read-only</Badge>
              ) : null}
            </div>
          </div>

          {access.canCreate ? (
            <PlanStatusControls planId={plan.id} status={status} />
          ) : null}
        </div>
      </Card>

      <PlanSummary status={status} totals={totals} />

      <section
        aria-labelledby="execution-actions"
        className="flex flex-col gap-4"
      >
        <div>
          <h2
            id="execution-actions"
            className="font-display text-lg font-bold tracking-tight text-foreground"
          >
            Actions
          </h2>
          <p className="max-w-prose text-sm text-muted">
            Every action shows what it would do, where, with what data and
            through which integration — before anyone approves it. Nothing in
            this release reaches an external service: execution runs against a
            mock provider.
          </p>
        </div>

        {actions.length === 0 ? (
          <EmptyActions />
        ) : (
          <ul className="flex flex-col gap-4">
            {actions.map((view) => (
              <li key={view.row.id}>
                <ActionCard view={view}>
                  {access.canCreate ? (
                    <ActionControls
                      actionId={view.row.id}
                      state={view.state}
                      approvalRequired={view.row.approval_required}
                      retryCount={view.row.retry_count}
                      attemptsAllowed={view.attemptsAllowed}
                      errorCode={view.row.error_code}
                      canApprove={access.canApprove}
                      canExecute={access.canExecute}
                      planActive={planActive}
                    />
                  ) : null}
                </ActionCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AuditTrail entries={audit} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/execution"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Back to execution
    </Link>
  );
}
