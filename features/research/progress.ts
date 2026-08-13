import {
  RESEARCH_STAGES,
  isResearchStage,
  stageIndex,
  type ResearchStage,
} from "@/features/research/types";
import { RESEARCH_MAX_STAGE_ATTEMPTS } from "@/features/research/constants";
import type { StageAttempt } from "@/features/research/data";

/**
 * Turns persisted rows into what the pipeline draws.
 *
 * Deliberately pure and free of `server-only`, so the same function runs in the
 * server page and in the client component that re-renders after a stage
 * finishes — and so the test suite can assert it without a database.
 *
 * The rule this file exists to enforce: **a stage is complete only when an
 * attempt row says it succeeded.** Not when the client asked for it, not when
 * a fetch resolved, not when the pointer looks far enough along. If the two
 * disagree, the rows win.
 */

export type StageDisplayStatus = "pending" | "running" | "complete" | "failed";

export interface StageView {
  stage: ResearchStage;
  status: StageDisplayStatus;
  /** Attempts recorded for this stage, in order. */
  attempts: StageAttempt[];
  /** The most recent attempt, or null when the stage has never been tried. */
  latest: StageAttempt | null;
  /** True when this is the stage a `Continue` would execute. */
  isNext: boolean;
  /** Only meaningful when `status` is `failed`. */
  retryable: boolean;
  attemptsUsed: number;
  attemptsAllowed: number;
}

export interface RunProgress {
  stages: StageView[];
  /** The stage a `Continue` executes, or null when nothing is left to run. */
  nextStage: ResearchStage | null;
  completedCount: number;
  totalCount: number;
  /** 0-100, from succeeded attempts only. */
  percent: number;
  /** A stage failed and has not since succeeded. */
  failedStage: StageView | null;
  /** All seven stages have a succeeded attempt. */
  isComplete: boolean;
  /** Nothing has been run yet. */
  isDraft: boolean;
}

export interface RunProgressInput {
  /** `research_runs.current_stage`. Null when there is no run, or it finished. */
  currentStage: string | null;
  /** `research_runs.status`, or null when no run exists yet. */
  runStatus: string | null;
  /** `research_requests.status`. */
  requestStatus: string;
  attempts: StageAttempt[];
}

export function buildRunProgress({
  currentStage,
  runStatus,
  requestStatus,
  attempts,
}: RunProgressInput): RunProgress {
  const finished = requestStatus === "completed" || runStatus === "completed";

  // The resume point. When the run has finished, `current_stage` is null and
  // there is nothing to run — which is different from "no run yet", where the
  // first stage is next.
  const pointer: ResearchStage | null = isResearchStage(currentStage)
    ? currentStage
    : finished
      ? null
      : runStatus === null
        ? RESEARCH_STAGES[0]
        : null;

  const stages: StageView[] = RESEARCH_STAGES.map((stage) => {
    const stageAttempts = attempts.filter((a) => a.stage === stage);
    const latest = stageAttempts[stageAttempts.length - 1] ?? null;
    const succeeded = stageAttempts.some((a) => a.status === "succeeded");

    let status: StageDisplayStatus;
    if (succeeded) {
      status = "complete";
    } else if (latest?.status === "running") {
      status = "running";
    } else if (latest?.status === "failed") {
      status = "failed";
    } else if (finished && stageIndex(stage) < RESEARCH_STAGES.length) {
      // A run marked complete whose attempt rows are missing (an old run, or a
      // partial read) is still reported from what is stored, not assumed done.
      status = "pending";
    } else {
      status = "pending";
    }

    const attemptsUsed = stageAttempts.length;

    return {
      stage,
      status,
      attempts: stageAttempts,
      latest,
      isNext: pointer === stage,
      // The engine's budget is per stage, counted from persisted history. A
      // stage that has spent all three attempts cannot be retried, and the
      // button must not offer it.
      retryable:
        status === "failed" && attemptsUsed < RESEARCH_MAX_STAGE_ATTEMPTS,
      attemptsUsed,
      attemptsAllowed: RESEARCH_MAX_STAGE_ATTEMPTS,
    };
  });

  const completedCount = stages.filter((s) => s.status === "complete").length;
  const failedStage = stages.find((s) => s.status === "failed") ?? null;

  return {
    stages,
    nextStage: pointer,
    completedCount,
    totalCount: RESEARCH_STAGES.length,
    percent: Math.round((completedCount / RESEARCH_STAGES.length) * 100),
    failedStage,
    isComplete: completedCount === RESEARCH_STAGES.length,
    isDraft: attempts.length === 0,
  };
}

/**
 * The single sentence at the top of a research card or page.
 *
 * Derived from the same rows as the pipeline, so the summary and the stage list
 * can never tell different stories.
 */
export function statusLabel(
  progress: RunProgress,
  requestStatus: string,
): {
  label: string;
  variant: "active" | "completed" | "archived" | "neutral" | "paused";
} {
  if (progress.isComplete || requestStatus === "completed") {
    return { label: "Completed", variant: "active" };
  }
  if (progress.failedStage) {
    return { label: "Failed", variant: "archived" };
  }
  if (progress.stages.some((s) => s.status === "running")) {
    return { label: "Running", variant: "completed" };
  }
  if (requestStatus === "cancelled") {
    return { label: "Cancelled", variant: "archived" };
  }
  if (progress.completedCount > 0) {
    return { label: "Incomplete", variant: "paused" };
  }
  return { label: "Draft", variant: "neutral" };
}
