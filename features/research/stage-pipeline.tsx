"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  CircleDashed,
  Loader2,
  Play,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormAlert } from "@/components/ui/form-message";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import {
  STAGE_DESCRIPTIONS,
  STAGE_LABELS,
  type ResearchStage,
} from "@/features/research/types";
import type { RunProgress, StageView } from "@/features/research/progress";

/**
 * The seven-stage pipeline, and the button that advances it.
 *
 * ONE CLICK RUNS ONE STAGE. `POST /api/research/[id]/run-stage` executes
 * exactly one, and this component then calls `router.refresh()` so the server
 * re-reads the run from the database and hands back a fresh `progress`. There
 * is no loop that fires seven requests, and no local counter that walks the
 * stage list — the pointer lives in `research_runs.current_stage` and the only
 * way this component learns where the run got to is by asking the server.
 *
 * That is deliberate rather than cautious. A browser-side loop would keep
 * charging credits after the tab was closed mid-run, would race a second tab
 * doing the same thing, and would show a pipeline that had "finished" stages
 * the database never recorded. The persisted state is the truth; this is a view
 * of it with a button attached.
 */

interface StagePipelineProps {
  requestId: string;
  progress: RunProgress;
  /** False for a Viewer, or when the plan does not include Market Research. */
  canRun: boolean;
}

/** What the last request returned. Cleared on the next attempt. */
interface StageOutcome {
  ok: boolean;
  stage: ResearchStage | null;
  message: string;
  retryable: boolean;
  creditsCharged?: number;
  creditsRefunded?: number;
  sourcesAdded?: number;
  evidenceAdded?: number;
}

const STATUS_META: Record<
  StageView["status"],
  { icon: typeof Check; label: string; className: string; ring: string }
> = {
  complete: {
    icon: Check,
    label: "Complete",
    className: "text-brand-green",
    ring: "border-brand-green/40 bg-brand-green/10",
  },
  running: {
    icon: Loader2,
    label: "Running",
    className: "text-brand-cyan",
    ring: "border-brand-cyan/40 bg-brand-cyan/10",
  },
  failed: {
    icon: AlertCircle,
    label: "Failed",
    className: "text-danger-soft",
    ring: "border-danger/40 bg-danger/10",
  },
  pending: {
    icon: CircleDashed,
    label: "Pending",
    className: "text-muted-strong",
    ring: "border-white/10 bg-fill-2",
  },
};

export function StagePipeline({
  requestId,
  progress,
  canRun,
}: StagePipelineProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<StageOutcome | null>(null);

  const busy = running || pending;

  async function advanceOneStage() {
    setRunning(true);
    setOutcome(null);

    try {
      // No stage is sent. The server decides which one is next from persisted
      // state; naming it here would be a request to be ignored at best.
      const response = await fetch(`/api/research/${requestId}/run-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: Record<string, unknown>;
        error?: { code?: string; message?: string };
      };

      if (payload.success) {
        const data = payload.data ?? {};
        setOutcome({
          ok: true,
          stage: (data.stage as ResearchStage) ?? null,
          message:
            (data.message as string) ??
            `${STAGE_LABELS[data.stage as ResearchStage] ?? "Stage"} finished.`,
          retryable: false,
          creditsCharged: data.creditsCharged as number | undefined,
          sourcesAdded: data.sourcesAdded as number | undefined,
          evidenceAdded: data.evidenceAdded as number | undefined,
        });
      } else {
        const data = payload.data ?? {};
        setOutcome({
          ok: false,
          stage: (data.stage as ResearchStage) ?? null,
          // The route already sanitises this; it never carries a stack or a
          // provider payload.
          message:
            payload.error?.message ??
            "The stage could not be completed. Please try again.",
          retryable: Boolean(data.retryable),
          creditsCharged: data.creditsCharged as number | undefined,
          creditsRefunded: data.creditsRefunded as number | undefined,
        });
      }
    } catch {
      setOutcome({
        ok: false,
        stage: null,
        message:
          "The request could not reach the server. Your research is saved — try again.",
        retryable: true,
      });
    } finally {
      setRunning(false);
      // Re-read from the database rather than patching local state, so what is
      // drawn next came from the rows and not from this response.
      startTransition(() => router.refresh());
    }
  }

  const failed = progress.failedStage;
  const isRetry = Boolean(failed);
  const nextLabel = progress.nextStage
    ? STAGE_LABELS[progress.nextStage]
    : null;

  const actionable =
    canRun &&
    !progress.isComplete &&
    (isRetry ? (failed?.retryable ?? false) : Boolean(progress.nextStage));

  return (
    <section aria-labelledby="pipeline-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="pipeline-heading"
            className="font-display text-lg font-bold tracking-tight text-foreground"
          >
            Research pipeline
          </h2>
          <p className="text-sm text-muted">
            One stage runs per request, and each one is saved before the next
            begins.
          </p>
        </div>
        <p className="text-sm font-semibold text-foreground">
          {progress.completedCount} of {progress.totalCount} stages complete
        </p>
      </div>

      {/*
        A native progress element rather than a styled div: screen readers
        announce the value, and the visible percentage is not the only way to
        read it.
      */}
      <progress
        className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-brand-gradient [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-fill-2 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-brand-gradient"
        value={progress.completedCount}
        max={progress.totalCount}
        aria-label={`Research progress: ${progress.completedCount} of ${progress.totalCount} stages complete`}
      />

      <ol className="flex flex-col gap-3">
        {progress.stages.map((view, index) => (
          <StageRow key={view.stage} view={view} index={index} busy={busy} />
        ))}
      </ol>

      {outcome ? (
        <FormAlert variant={outcome.ok ? "success" : "error"}>
          <span className="block">
            {outcome.stage ? (
              <strong className="font-semibold">
                {STAGE_LABELS[outcome.stage]}:{" "}
              </strong>
            ) : null}
            {outcome.message}
          </span>
          {outcome.ok && outcome.creditsCharged !== undefined ? (
            <span className="mt-1 block text-xs opacity-90">
              {outcome.creditsCharged} credits charged
              {outcome.sourcesAdded ? ` · ${outcome.sourcesAdded} sources` : ""}
              {outcome.evidenceAdded
                ? ` · ${outcome.evidenceAdded} evidence items`
                : ""}
            </span>
          ) : null}
          {!outcome.ok && outcome.creditsRefunded ? (
            <span className="mt-1 block text-xs opacity-90">
              {outcome.creditsRefunded} credits refunded for the failed stage.
            </span>
          ) : null}
        </FormAlert>
      ) : null}

      {progress.isComplete ? (
        <p
          role="status"
          className="rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm text-brand-green"
        >
          All seven stages are complete. The full report is below.
        </p>
      ) : failed && !failed.retryable ? (
        <p
          role="status"
          className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-soft"
        >
          {STAGE_LABELS[failed.stage]} used all {failed.attemptsAllowed}{" "}
          attempts and cannot be retried. Credits for the failed attempts were
          refunded. Start a new research project with a wider scope.
        </p>
      ) : null}

      {actionable ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="md" onClick={advanceOneStage} disabled={busy}>
            {busy ? (
              <Loader2 className="animate-spin" />
            ) : isRetry ? (
              <RotateCcw />
            ) : (
              <Play />
            )}
            {busy
              ? "Running…"
              : isRetry
                ? `Retry ${STAGE_LABELS[failed!.stage]}`
                : progress.isDraft
                  ? "Start market research"
                  : `Continue — ${nextLabel}`}
          </Button>
          <p className="text-sm text-muted">
            {isRetry
              ? `Attempt ${(failed!.attemptsUsed ?? 0) + 1} of ${failed!.attemptsAllowed}. Credits are charged per attempt and refunded if it fails.`
              : "Runs one stage. Credits are charged by the server when the stage begins."}
          </p>
        </div>
      ) : !canRun && !progress.isComplete ? (
        <p className="text-sm text-muted">
          You do not have permission to run research in this workspace.
        </p>
      ) : null}
    </section>
  );
}

function StageRow({
  view,
  index,
  busy,
}: {
  view: StageView;
  index: number;
  busy: boolean;
}) {
  const meta = STATUS_META[view.status];
  const Icon = meta.icon;
  const spinning = view.status === "running" || (view.isNext && busy);

  return (
    <li>
      <Card
        className={cn(
          "flex items-start gap-4 p-4",
          view.isNext && view.status !== "complete"
            ? "border-brand-violet/40"
            : null,
        )}
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border",
            meta.ring,
          )}
        >
          <Icon
            className={cn(
              "size-4",
              meta.className,
              spinning ? "animate-spin" : null,
            )}
            aria-hidden="true"
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-display text-sm font-bold tracking-tight text-foreground">
              <span className="text-muted-strong">{index + 1}.</span>{" "}
              {STAGE_LABELS[view.stage]}
            </h3>
            {/*
              The status is spelled out in text, not carried by the icon colour
              alone — the pipeline has to be readable without colour vision and
              without the icon font loading.
            */}
            <span className={cn("text-xs font-semibold", meta.className)}>
              {meta.label}
            </span>
            {view.attemptsUsed > 1 ? (
              <span className="text-xs text-muted-strong">
                attempt {view.attemptsUsed} of {view.attemptsAllowed}
              </span>
            ) : null}
          </div>

          <p className="mt-0.5 text-xs text-muted">
            {STAGE_DESCRIPTIONS[view.stage]}
          </p>

          {view.status === "failed" && view.latest?.errorMessage ? (
            <p className="mt-2 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger-soft">
              {view.latest.errorMessage}
              {view.latest.creditsRefunded > 0 ? (
                <span className="mt-1 block opacity-80">
                  {view.latest.creditsRefunded} credits refunded.
                </span>
              ) : null}
            </p>
          ) : null}

          {view.status === "complete" && view.latest ? (
            <p className="mt-1 text-xs text-muted-strong">
              {formatDuration(view.latest.durationMs)} ·{" "}
              {view.latest.creditsCharged} credits
            </p>
          ) : null}
        </div>
      </Card>
    </li>
  );
}
