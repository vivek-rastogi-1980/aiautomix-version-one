"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Calculator,
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
  FINANCIAL_STAGE_DESCRIPTIONS,
  FINANCIAL_STAGE_LABELS,
  type FinancialStage,
} from "@/features/financials/types";
import type {
  FinancialProgress,
  FinancialStageView,
} from "@/features/financials/progress";

/**
 * The eight-stage pipeline.
 *
 * ONE CLICK RUNS ONE STAGE, and the server decides which. The component sends
 * no stage, runs no loop and keeps no progress counter — after each stage it
 * calls `router.refresh()` and the server re-derives everything from rows.
 *
 * The one thing this pipeline shows that the others do not is WHICH KIND of
 * stage each one is. Three of the eight are marked "Calculated" and cost
 * nothing: they run the deterministic engine, not a model. A user watching
 * credits leave their account deserves to see which steps spend them and which
 * are arithmetic.
 */

interface StagePipelineProps {
  projectId: string;
  progress: FinancialProgress;
  canRun: boolean;
}

interface StageOutcome {
  ok: boolean;
  stage: FinancialStage | null;
  kind?: "ai" | "compute";
  message: string;
  creditsCharged?: number;
  creditsRefunded?: number;
  assumptionsWritten?: number;
  costsWritten?: number;
  fundingWritten?: number;
  discardedOptions?: string[];
}

const STATUS_META: Record<
  FinancialStageView["status"],
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

export function FinancialStagePipeline({
  projectId,
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
      const response = await fetch(`/api/financials/${projectId}/run-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: Record<string, unknown>;
        error?: { message?: string };
      };
      const data = payload.data ?? {};

      if (payload.success) {
        setOutcome({
          ok: true,
          stage: (data.stage as FinancialStage) ?? null,
          kind: data.kind as "ai" | "compute" | undefined,
          message:
            (data.message as string) ??
            `${FINANCIAL_STAGE_LABELS[data.stage as FinancialStage] ?? "Stage"} finished.`,
          creditsCharged: data.creditsCharged as number | undefined,
          assumptionsWritten: data.assumptionsWritten as number | undefined,
          costsWritten: data.costsWritten as number | undefined,
          fundingWritten: data.fundingWritten as number | undefined,
          discardedOptions: Array.isArray(data.discardedOptions)
            ? (data.discardedOptions as string[])
            : undefined,
        });
      } else {
        setOutcome({
          ok: false,
          stage: (data.stage as FinancialStage) ?? null,
          message:
            payload.error?.message ??
            "The stage could not be completed. Please try again.",
          creditsCharged: data.creditsCharged as number | undefined,
          creditsRefunded: data.creditsRefunded as number | undefined,
        });
      }
    } catch {
      setOutcome({
        ok: false,
        stage: null,
        message:
          "The request could not reach the server. Your model is saved — try again.",
      });
    } finally {
      setRunning(false);
      startTransition(() => router.refresh());
    }
  }

  const failed = progress.failedStage;
  const isRetry = Boolean(failed);
  const nextStage = progress.stages.find((s) => s.isNext) ?? null;
  const nextLabel = progress.nextStage
    ? FINANCIAL_STAGE_LABELS[progress.nextStage]
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
            Model pipeline
          </h2>
          <p className="text-sm text-muted">
            One stage per request. Three of the eight are calculated by the
            engine — they call no model and cost nothing.
          </p>
        </div>
        <p className="text-sm font-semibold text-foreground">
          {progress.completedCount} of {progress.totalCount} stages complete
        </p>
      </div>

      <progress
        className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-brand-gradient [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-fill-2 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-brand-gradient"
        value={progress.completedCount}
        max={progress.totalCount}
        aria-label={`Financial model progress: ${progress.completedCount} of ${progress.totalCount} stages complete`}
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
                {FINANCIAL_STAGE_LABELS[outcome.stage]}:{" "}
              </strong>
            ) : null}
            {outcome.message}
          </span>
          {outcome.ok ? (
            <span className="mt-1 block text-xs opacity-90">
              {outcome.kind === "compute"
                ? "Calculated by the engine — no AI ran, nothing charged."
                : `${outcome.creditsCharged ?? 0} credits charged`}
              {outcome.assumptionsWritten
                ? ` · ${outcome.assumptionsWritten} assumptions`
                : ""}
              {outcome.costsWritten
                ? ` · ${outcome.costsWritten} cost lines`
                : ""}
              {outcome.fundingWritten
                ? ` · ${outcome.fundingWritten} funding options`
                : ""}
            </span>
          ) : null}
          {/* A quality signal: funding programmes the model named that no
              search result corroborated, and which were therefore dropped. */}
          {outcome.discardedOptions?.length ? (
            <span className="mt-1 block text-xs opacity-90">
              {outcome.discardedOptions.length} suggested funding option
              {outcome.discardedOptions.length === 1 ? " was" : "s were"}{" "}
              discarded because no search result backed{" "}
              {outcome.discardedOptions.length === 1 ? "it" : "them"}.
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
          All eight stages are complete. The full financial report is below.
        </p>
      ) : failed && !failed.retryable ? (
        <p
          role="status"
          className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-soft"
        >
          {FINANCIAL_STAGE_LABELS[failed.stage]} used all{" "}
          {failed.attemptsAllowed} attempts and cannot be retried. Credits for
          the failed attempts were refunded.
        </p>
      ) : null}

      {actionable ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="md" onClick={advanceOneStage} disabled={busy}>
            {busy ? (
              <Loader2 className="animate-spin" />
            ) : isRetry ? (
              <RotateCcw />
            ) : nextStage?.isCompute ? (
              <Calculator />
            ) : (
              <Play />
            )}
            {busy
              ? "Running…"
              : isRetry
                ? `Retry ${FINANCIAL_STAGE_LABELS[failed!.stage]}`
                : progress.isDraft
                  ? "Start financial model"
                  : `Continue — ${nextLabel}`}
          </Button>
          <p className="text-sm text-muted">
            {isRetry
              ? `Attempt ${(failed!.attemptsUsed ?? 0) + 1} of ${failed!.attemptsAllowed}. Credits are charged per attempt and refunded if it fails.`
              : nextStage?.isCompute
                ? "This stage is calculated from your stored assumptions. No AI, no charge."
                : "Runs one stage. Credits are charged by the server when the stage begins."}
          </p>
        </div>
      ) : !canRun && !progress.isComplete ? (
        <p className="text-sm text-muted">
          You do not have permission to run financial models in this workspace.
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
  view: FinancialStageView;
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
              {FINANCIAL_STAGE_LABELS[view.stage]}
            </h3>
            <span className={cn("text-xs font-semibold", meta.className)}>
              {meta.label}
            </span>
            {/* The distinction a user paying for credits most needs to see. */}
            {view.isCompute ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-2 py-0.5 text-[11px] font-semibold text-accent"
                title="Runs the deterministic engine over your stored assumptions. No model is called and no credits are charged."
              >
                <Calculator className="size-3" aria-hidden="true" />
                Calculated · free
              </span>
            ) : null}
            {view.attemptsUsed > 1 ? (
              <span className="text-xs text-muted-strong">
                attempt {view.attemptsUsed} of {view.attemptsAllowed}
              </span>
            ) : null}
          </div>

          <p className="mt-0.5 text-xs text-muted">
            {FINANCIAL_STAGE_DESCRIPTIONS[view.stage]}
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
              {view.isCompute
                ? "calculated, no charge"
                : `${view.latest.creditsCharged} credits`}
            </p>
          ) : null}
        </div>
      </Card>
    </li>
  );
}
