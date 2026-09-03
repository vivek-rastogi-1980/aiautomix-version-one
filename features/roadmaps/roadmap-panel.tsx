"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, ListChecks } from "lucide-react";

import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { generateExecutionRoadmapAction } from "@/features/roadmaps/actions";
import { idleState } from "@/lib/forms/action-state";
import { cn } from "@/lib/utils";
import type { RoadmapProgress } from "@/features/roadmaps/data";

/**
 * "Turn your plan into action" — the execution section on a business plan.
 *
 * Two states, and which one renders is decided on the server: the page looks up
 * whether a roadmap exists before this component is reached. That is what makes
 * the duplicate protection visible rather than only enforced — a customer who
 * already has a roadmap is never shown a button that would create a second one.
 *
 * Generation runs through a Server Action rather than a link, because unlike
 * the validation -> plan handoff this one really does write and really does
 * spend the customer's allowance. `SubmitButton` disables itself for the
 * duration via `useFormStatus`, so the button cannot be pressed twice; the
 * allowance reservation in the service is what actually guarantees it.
 */
export function RoadmapPanel({
  businessPlanId,
  roadmapExists,
  progress,
  taskCount,
  milestoneCount,
  canEdit,
}: {
  businessPlanId: string;
  roadmapExists: boolean;
  progress?: RoadmapProgress;
  taskCount?: number;
  milestoneCount?: number;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(
    generateExecutionRoadmapAction,
    idleState,
  );

  if (roadmapExists) {
    return (
      <Card className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Execution roadmap
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span className="text-accent">✓ Roadmap created</span>
              {typeof taskCount === "number" ? (
                <span>· {taskCount} tasks</span>
              ) : null}
              {typeof milestoneCount === "number" ? (
                <span>· {milestoneCount} milestones</span>
              ) : null}
              {progress && progress.high_priority_open > 0 ? (
                <span>· {progress.high_priority_open} high-priority open</span>
              ) : null}
            </p>
          </div>
          <Link
            href={`/plans/${businessPlanId}/execution`}
            className={cn(buttonVariants({ size: "md" }))}
          >
            Open roadmap <ArrowRight className="size-4" />
          </Link>
        </div>

        {progress ? (
          <div className="mt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Progress</span>
              <span className="font-medium text-foreground">
                {progress.completed} of {progress.total} · {progress.percent}%
              </span>
            </div>
            <ProgressBar percent={progress.percent} />
          </div>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-violet/15 text-brand-violet sm:flex">
          <ListChecks className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Turn your plan into action
          </h2>
          <p className="mt-1 text-sm text-muted">
            Your business plan defines where you want to go. Create an execution
            roadmap to work out what to do next — practical 30, 60 and 90-day
            actions and priorities drawn from this plan.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {["30 days", "60 days", "90 days"].map((label) => (
              <span
                key={label}
                className="rounded-full border border-line-strong px-3 py-1 text-xs text-muted"
              >
                {label}
              </span>
            ))}
          </div>

          {state.status === "error" ? (
            <div className="mt-4">
              <FormAlert variant="error">{state.message}</FormAlert>
            </div>
          ) : null}

          {canEdit ? (
            <form action={formAction} className="mt-5">
              <input
                type="hidden"
                name="businessPlanId"
                value={businessPlanId}
              />
              <SubmitButton size="md" pendingText="Creating your roadmap…">
                <ListChecks className="size-4" /> Create execution roadmap
              </SubmitButton>
              <p className="mt-2 text-xs text-muted">
                This uses one execution roadmap from your monthly allowance.
              </p>
            </form>
          ) : (
            <p className="mt-5 text-sm text-muted">
              Your role in this workspace is read-only, so you cannot create a
              roadmap.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * The bar itself takes a server-computed percentage and only draws it. It has
 * no way to recompute or adjust the number, which is the point: progress is
 * derived in SQL from the task rows and is never a value the client owns.
 */
export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="mt-2 h-2 w-full overflow-hidden rounded-full bg-fill-3"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Roadmap completion"
    >
      <div
        className="h-full rounded-full bg-brand-violet transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
