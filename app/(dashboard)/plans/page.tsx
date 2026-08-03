import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, NotebookPen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getBusinessPlans } from "@/features/business-plans/data";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BusinessPlanStatus } from "@/types/database";

export const metadata: Metadata = {
  title: "Business plans",
  description: "AI-generated business plans in your workspace.",
};

const STATUS_BADGE: Record<
  BusinessPlanStatus,
  { label: string; variant: "active" | "completed" | "archived" | "neutral" }
> = {
  ready: { label: "Ready", variant: "active" },
  generating: { label: "Generating", variant: "completed" },
  draft: { label: "Draft", variant: "neutral" },
  failed: { label: "Failed", variant: "archived" },
};

export default async function PlansPage() {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);
  const plans = await getBusinessPlans(workspace.id);

  const editable = canEdit(role);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Business plans
          </h1>
          <p className="text-muted">
            Every plan in {workspace.name}. Sections are editable and versioned.
          </p>
        </div>
        {editable ? (
          <Link
            href="/plans/new"
            className={cn(buttonVariants({ size: "md" }))}
          >
            <NotebookPen className="size-4" /> New plan
          </Link>
        ) : null}
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
            <NotebookPen className="size-7" />
          </span>
          <p className="mt-5 font-display text-lg font-bold text-foreground">
            No business plans yet
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Describe your business once and the generator writes an
            eleven-section plan you can edit, version and export as a PDF.
          </p>
          {editable ? (
            <Link
              href="/plans/new"
              className={cn(buttonVariants({ size: "md" }), "mt-6")}
            >
              <NotebookPen className="size-4" /> Generate a plan
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {plans.map((plan) => {
            const status = STATUS_BADGE[plan.status];
            return (
              <li key={plan.id}>
                <Link
                  href={`/plans/${plan.id}`}
                  className="group block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet"
                >
                  <Card className="flex items-start gap-5 p-5 transition-colors group-hover:border-white/20">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet">
                      <NotebookPen className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-display text-base font-bold tracking-tight text-foreground">
                        {plan.title}
                      </h2>
                      <p className="mt-1 text-xs text-muted">
                        {formatDate(plan.created_at)} · {plan.model}
                      </p>
                      {plan.summary ? (
                        <p className="mt-2 line-clamp-2 text-sm text-muted">
                          {plan.summary}
                        </p>
                      ) : null}
                      <div className="mt-2.5">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </div>
                    <ArrowRight className="mt-1 size-5 shrink-0 text-muted-strong transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
