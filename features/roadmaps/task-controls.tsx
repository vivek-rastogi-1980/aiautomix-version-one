"use client";

import { useState, useTransition } from "react";
import { Check, CircleDashed, Loader2, Play, Ban } from "lucide-react";

import { setRoadmapTaskStatus } from "@/features/roadmaps/actions";
import { cn } from "@/lib/utils";
import type { RoadmapTaskStatus } from "@/types/database";

/**
 * Status control for one roadmap task.
 *
 * Optimistic in appearance but not in authority: the button shows the new
 * status immediately so ticking a box feels instant, and reverts if the server
 * refuses. The server is the only thing that decides — `setRoadmapTaskStatus`
 * re-derives the workspace from the session and filters the update on it, and
 * RLS enforces the same again, so a task belonging to another workspace matches
 * zero rows however this component behaves.
 *
 * Progress is deliberately NOT recomputed here. The page re-renders from the
 * server after `revalidatePath`, and the percentage comes from SQL — a number
 * this component calculated would be a second source of truth that could
 * disagree with the database.
 */

const STATUS_META: Record<
  RoadmapTaskStatus,
  { label: string; icon: typeof Check; className: string }
> = {
  NOT_STARTED: {
    label: "Not started",
    icon: CircleDashed,
    className: "text-muted",
  },
  IN_PROGRESS: {
    label: "In progress",
    icon: Play,
    className: "text-brand-violet",
  },
  COMPLETED: { label: "Completed", icon: Check, className: "text-accent" },
  BLOCKED: { label: "Blocked", icon: Ban, className: "text-red-300" },
};

/** The order the cycle button walks. Blocked is set explicitly, not cycled into. */
const CYCLE: RoadmapTaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"];

export function TaskStatusControl({
  taskId,
  status,
  disabled,
}: {
  taskId: string;
  status: RoadmapTaskStatus;
  disabled?: boolean;
}) {
  const [current, setCurrent] = useState<RoadmapTaskStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function move(next: RoadmapTaskStatus) {
    const previous = current;
    setCurrent(next);
    setError(null);
    start(async () => {
      const result = await setRoadmapTaskStatus({ taskId, status: next });
      if (!result.ok) {
        // The server refused. Put the visible state back rather than leaving a
        // tick the database does not agree with.
        setCurrent(previous);
        setError(result.message ?? "That did not save.");
      }
    });
  }

  const meta = STATUS_META[current];
  const Icon = meta.icon;
  const nextInCycle =
    CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length] ?? "NOT_STARTED";

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() =>
            move(current === "BLOCKED" ? "IN_PROGRESS" : nextInCycle)
          }
          aria-label={`Task status: ${meta.label}. Change status.`}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong px-3.5 text-sm transition-colors hover:bg-fill-3 disabled:cursor-not-allowed disabled:opacity-50",
            meta.className,
          )}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Icon className="size-4" />
          )}
          {meta.label}
        </button>

        {current !== "BLOCKED" ? (
          <button
            type="button"
            disabled={disabled || pending}
            onClick={() => move("BLOCKED")}
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm text-muted transition-colors hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Block
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="status" className="text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
