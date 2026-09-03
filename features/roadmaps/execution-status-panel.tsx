import Link from "next/link";

import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ProgressBar } from "@/features/roadmaps/roadmap-panel";
import { cn } from "@/lib/utils";
import type { RoadmapProgress } from "@/features/roadmaps/data";

/**
 * Execution status on the customer dashboard (§23).
 *
 * Deliberately small. The dashboard already answers "what happened to my idea?"
 * and "what does my plan include?"; this answers only "what is the next step?",
 * and a second full progress dashboard here would compete with the roadmap page
 * rather than lead to it.
 *
 * Renders nothing at all when there is no business plan yet — an execution
 * status for a customer who has not planned anything is noise, and the funnel
 * panel above is already telling them what to do first.
 */
export function ExecutionStatusPanel({
  businessPlanId,
  planTitle,
  progress,
}: {
  /** Null when the workspace has no business plan yet. */
  businessPlanId: string | null;
  planTitle: string | null;
  /** Null when a plan exists but no roadmap has been generated. */
  progress: RoadmapProgress | null;
}) {
  if (!businessPlanId) return null;

  const started = progress !== null && progress.total > 0;

  return (
    <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Execution
          </h2>
          {planTitle ? (
            <span className="truncate text-sm text-muted">· {planTitle}</span>
          ) : null}
        </div>

        {started ? (
          <>
            <p className="mt-1 text-sm text-muted">
              {progress.percent}% complete · {progress.completed} of{" "}
              {progress.total} tasks completed
            </p>
            <div className="mt-3 max-w-md">
              <ProgressBar percent={progress.percent} />
            </div>
          </>
        ) : (
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            <span aria-hidden className="text-muted-strong">
              ●
            </span>
            Not started — turn your business plan into practical actions.
          </p>
        )}
      </div>

      <Link
        href={
          started
            ? `/plans/${businessPlanId}/execution`
            : `/plans/${businessPlanId}`
        }
        className={cn(
          buttonVariants({
            variant: started ? "secondary" : "primary",
            size: "md",
          }),
          "shrink-0",
        )}
      >
        {started ? "Continue execution" : "Create execution roadmap"}
      </Link>
    </Card>
  );
}
