import {
  COMPETITOR_STAGES,
  competitorStageIndex,
  isCompetitorStage,
  type CompetitorStage,
} from "@/features/competitors/types";
import { COMPETITOR_MAX_STAGE_ATTEMPTS } from "@/features/competitors/constants";

/**
 * Turns persisted rows into what the pipeline draws.
 *
 * Deliberately pure and free of `server-only`, so the same function runs in the
 * server page and in the client component that re-renders after a stage
 * finishes — and so the test suite can assert it without a database.
 *
 * The rule this file exists to enforce: **a stage is complete only when an
 * attempt row says it succeeded.** Not when the client asked for it, not when a
 * fetch resolved, not when the pointer looks far enough along. If the two
 * disagree, the rows win.
 */

export interface CompetitorStageAttempt {
  stage: CompetitorStage;
  attempt: number;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  creditsCharged: number;
  creditsRefunded: number;
  durationMs: number | null;
  startedAt: string;
  completedAt: string | null;
}

export type StageDisplayStatus = "pending" | "running" | "complete" | "failed";

export interface CompetitorStageView {
  stage: CompetitorStage;
  status: StageDisplayStatus;
  attempts: CompetitorStageAttempt[];
  latest: CompetitorStageAttempt | null;
  /** True when this is the stage a `Continue` would execute. */
  isNext: boolean;
  /** Only meaningful when `status` is `failed`. */
  retryable: boolean;
  attemptsUsed: number;
  attemptsAllowed: number;
}

export interface CompetitorProgress {
  stages: CompetitorStageView[];
  /** The stage a `Continue` executes, or null when nothing is left to run. */
  nextStage: CompetitorStage | null;
  completedCount: number;
  totalCount: number;
  /** 0-100, from succeeded attempts only. */
  percent: number;
  failedStage: CompetitorStageView | null;
  isComplete: boolean;
  isDraft: boolean;
}

export interface CompetitorProgressInput {
  /** `competitor_runs.current_stage`. Null with no run, or when finished. */
  currentStage: string | null;
  /** `competitor_runs.status`, or null when no run exists yet. */
  runStatus: string | null;
  /** `competitor_projects.status`. */
  projectStatus: string;
  attempts: CompetitorStageAttempt[];
}

export function buildCompetitorProgress({
  currentStage,
  runStatus,
  projectStatus,
  attempts,
}: CompetitorProgressInput): CompetitorProgress {
  const finished = projectStatus === "completed" || runStatus === "completed";

  // The resume point. When the run has finished, `current_stage` is null and
  // there is nothing to run — different from "no run yet", where the first
  // stage is next.
  const pointer: CompetitorStage | null = isCompetitorStage(currentStage)
    ? currentStage
    : finished
      ? null
      : runStatus === null
        ? COMPETITOR_STAGES[0]
        : null;

  const stages: CompetitorStageView[] = COMPETITOR_STAGES.map((stage) => {
    const stageAttempts = attempts.filter((a) => a.stage === stage);
    const latest = stageAttempts[stageAttempts.length - 1] ?? null;
    const succeeded = stageAttempts.some((a) => a.status === "succeeded");

    let status: StageDisplayStatus;
    if (succeeded) status = "complete";
    else if (latest?.status === "running") status = "running";
    else if (latest?.status === "failed") status = "failed";
    else status = "pending";

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
        status === "failed" && attemptsUsed < COMPETITOR_MAX_STAGE_ATTEMPTS,
      attemptsUsed,
      attemptsAllowed: COMPETITOR_MAX_STAGE_ATTEMPTS,
    };
  });

  const completedCount = stages.filter((s) => s.status === "complete").length;

  return {
    stages,
    nextStage: pointer,
    completedCount,
    totalCount: COMPETITOR_STAGES.length,
    percent: Math.round((completedCount / COMPETITOR_STAGES.length) * 100),
    failedStage: stages.find((s) => s.status === "failed") ?? null,
    isComplete: completedCount === COMPETITOR_STAGES.length,
    isDraft: attempts.length === 0,
  };
}

/** How many of the seven stages have actually been persisted as succeeded. */
export function completedStageCount(
  currentStage: string | null,
  status: string,
): number {
  if (status === "completed") return COMPETITOR_STAGES.length;
  if (!isCompetitorStage(currentStage)) return 0;
  return competitorStageIndex(currentStage);
}

/** The single status word for a card or page header. */
export function competitorStatusLabel(
  progress: CompetitorProgress,
  projectStatus: string,
): {
  label: string;
  variant: "active" | "completed" | "archived" | "neutral" | "paused";
} {
  if (progress.isComplete || projectStatus === "completed") {
    return { label: "Completed", variant: "active" };
  }
  if (progress.failedStage) return { label: "Failed", variant: "archived" };
  if (progress.stages.some((s) => s.status === "running")) {
    return { label: "Running", variant: "completed" };
  }
  if (projectStatus === "cancelled") {
    return { label: "Cancelled", variant: "archived" };
  }
  if (progress.completedCount > 0) {
    return { label: "Incomplete", variant: "paused" };
  }
  return { label: "Draft", variant: "neutral" };
}
