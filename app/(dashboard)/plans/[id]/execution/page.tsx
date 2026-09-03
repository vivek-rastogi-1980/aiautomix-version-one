import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarCheck, Flag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getBusinessPlan } from "@/features/business-plans/data";
import { getRoadmapDetailForPlan } from "@/features/roadmaps/data";
import { ProgressBar } from "@/features/roadmaps/roadmap-panel";
import { TaskStatusControl } from "@/features/roadmaps/task-controls";
import {
  executionRoadmapSchema,
  ROADMAP_PERIODS,
  type RoadmapPeriod,
} from "@/features/ai/schemas/execution-roadmap";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import type { RoadmapTaskPriority } from "@/types/database";

export const metadata: Metadata = { title: "Execution roadmap" };

const PERIOD_HEADING: Record<RoadmapPeriod, string> = {
  "30": "30 days",
  "60": "60 days",
  "90": "90 days",
};

const PERIOD_SUB: Record<RoadmapPeriod, string> = {
  "30": "Immediate priorities",
  "60": "Growth and validation",
  "90": "Scale and operations",
};

const PRIORITY_VARIANT: Record<
  RoadmapTaskPriority,
  "active" | "completed" | "neutral"
> = {
  HIGH: "active",
  MEDIUM: "completed",
  LOW: "neutral",
};

const CATEGORY_LABEL: Record<string, string> = {
  MARKETING: "Marketing",
  SALES: "Sales",
  OPERATIONS: "Operations",
  PRODUCT: "Product",
  TECHNOLOGY: "Technology",
  FINANCE: "Finance",
  LEGAL: "Legal",
  CUSTOMER_DEVELOPMENT: "Customer development",
  GENERAL: "General",
};

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  // The plan is resolved under the caller's own session and workspace before
  // anything else. A plan id belonging to another workspace comes back null and
  // becomes a 404 — the same response as an id that does not exist, so the page
  // never confirms that someone else's plan is real.
  const plan = await getBusinessPlan(workspace.id, id);
  if (!plan) notFound();

  const detail = await getRoadmapDetailForPlan(workspace.id, id);

  // No roadmap yet: send them back to the plan, where the CTA lives. Generating
  // from a GET would make this page a write that a prefetch could fire.
  if (!detail) redirect(`/plans/${id}`);

  const { roadmap, tasks, progress } = detail;

  // The stored document is re-validated before rendering, exactly as the
  // validation report page does: a roadmap written by an older prompt version
  // must never crash the page.
  const parsed = executionRoadmapSchema.safeParse(roadmap.document);
  const document = parsed.success ? parsed.data : null;

  const editable = canEdit(role);
  const byPeriod = (period: RoadmapPeriod) =>
    tasks.filter((task) => task.period === period);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/plans/${id}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to business plan
      </Link>

      {/* --- Header and progress --------------------------------------- */}
      <Card className="p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-violet">
          Execution roadmap
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {roadmap.title}
        </h1>
        {document?.summary ? (
          <p className="mt-3 max-w-3xl text-sm text-muted">
            {document.summary}
          </p>
        ) : null}

        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted">Overall progress</span>
            <span className="font-medium text-foreground">
              {progress.completed} of {progress.total} tasks ·{" "}
              {progress.percent}%
            </span>
          </div>
          <ProgressBar percent={progress.percent} />
          {progress.blocked > 0 ? (
            <p className="mt-2 text-xs text-red-300">
              {progress.blocked} blocked
            </p>
          ) : null}
        </div>
      </Card>

      {!parsed.success ? (
        <Card className="p-6">
          <p className="text-sm text-muted">
            The priorities and milestones for this roadmap were saved in a
            format this version of the app can no longer read. Your tasks below
            are unaffected.
          </p>
        </Card>
      ) : null}

      {/* --- The three horizons ---------------------------------------- */}
      {ROADMAP_PERIODS.map((period) => {
        const periodTasks = byPeriod(period);
        const block = document
          ? period === "30"
            ? document.days_30
            : period === "60"
              ? document.days_60
              : document.days_90
          : null;

        if (periodTasks.length === 0 && !block) return null;

        return (
          <section key={period} className="flex flex-col gap-4">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
                {PERIOD_HEADING[period]}
              </h2>
              <p className="text-sm text-muted">{PERIOD_SUB[period]}</p>
            </div>

            {block && block.priorities.length > 0 ? (
              <Card className="p-5">
                <h3 className="text-xs uppercase tracking-wider text-muted">
                  Priorities
                </h3>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {block.priorities.map((priority) => (
                    <li
                      key={priority}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <Flag className="mt-0.5 size-4 shrink-0 text-brand-violet" />
                      {priority}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {block && block.milestones.length > 0 ? (
              <Card className="p-5">
                <h3 className="text-xs uppercase tracking-wider text-muted">
                  Milestones
                </h3>
                <ul className="mt-3 flex flex-col gap-3">
                  {block.milestones.map((milestone) => (
                    <li
                      key={milestone.title}
                      className="flex items-start gap-2"
                    >
                      <CalendarCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {milestone.title}
                        </p>
                        <p className="text-sm text-muted">
                          {milestone.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <ul className="flex flex-col gap-3">
              {periodTasks.map((task) => (
                <li key={task.id}>
                  <Card
                    className={cn(
                      "p-5 transition-opacity",
                      task.status === "COMPLETED" ? "opacity-60" : undefined,
                    )}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "font-display text-base font-bold tracking-tight text-foreground",
                            task.status === "COMPLETED"
                              ? "line-through"
                              : undefined,
                          )}
                        >
                          {task.title}
                        </p>
                        {task.description ? (
                          <p className="mt-1 text-sm text-muted">
                            {task.description}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge variant={PRIORITY_VARIANT[task.priority]}>
                            {task.priority}
                          </Badge>
                          <span className="text-xs text-muted">
                            {CATEGORY_LABEL[task.category] ?? task.category}
                          </span>
                        </div>
                      </div>
                      <TaskStatusControl
                        taskId={task.id}
                        status={task.status}
                        disabled={!editable}
                      />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {/* --- Strategy session ------------------------------------------- */}
      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Need expert guidance?
          </h2>
          <p className="mt-1 text-sm text-muted">
            Discuss your business plan and execution roadmap with an AI Strategy
            Consultant.
          </p>
        </div>
        {/* The existing booking flow, unchanged — no second booking system. */}
        <Link
          href="/strategy-session"
          className={cn(buttonVariants({ variant: "secondary", size: "md" }))}
        >
          Book free strategy session
        </Link>
      </Card>
    </div>
  );
}
