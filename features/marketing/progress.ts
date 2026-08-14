import {
  GTM_STAGES,
  isComputeStage,
  isGtmStage,
  gtmStageIndex,
  type GtmStage,
} from "@/features/marketing/types";
import { GTM_MAX_STAGE_ATTEMPTS } from "@/features/marketing/constants";

/**
 * Run progress, derived rather than stored.
 *
 * The database records what happened — attempt rows and a stage pointer. This
 * turns that into what the UI shows. Deriving it means the two can never
 * disagree: there is no `progress_percent` column to go stale when a stage is
 * retried, and no migration needed when the stage list changes.
 *
 * A plain module, not `server-only`, because the pipeline component is a client
 * component and must enforce the same attempt budget the engine does.
 */

export interface GtmStageAttempt {
  stage: GtmStage;
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

export interface GtmStageView {
  stage: GtmStage;
  status: StageDisplayStatus;
  /** The compute stage runs the engine, costs nothing and calls no model. */
  isCompute: boolean;
  attempts: GtmStageAttempt[];
  latest: GtmStageAttempt | null;
  isNext: boolean;
  retryable: boolean;
  attemptsUsed: number;
  attemptsAllowed: number;
}

export interface GtmProgress {
  stages: GtmStageView[];
  nextStage: GtmStage | null;
  completedCount: number;
  totalCount: number;
  percent: number;
  failedStage: GtmStageView | null;
  isComplete: boolean;
  isDraft: boolean;
}

export interface GtmProgressInput {
  currentStage: string | null;
  runStatus: string | null;
  projectStatus: string;
  attempts: GtmStageAttempt[];
}

export function buildGtmProgress({
  currentStage,
  runStatus,
  projectStatus,
  attempts,
}: GtmProgressInput): GtmProgress {
  const finished = projectStatus === "completed" || runStatus === "completed";

  const pointer: GtmStage | null = isGtmStage(currentStage)
    ? currentStage
    : finished
      ? null
      : runStatus === null
        ? GTM_STAGES[0]
        : null;

  const stages: GtmStageView[] = GTM_STAGES.map((stage) => {
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
      isCompute: isComputeStage(stage),
      attempts: stageAttempts,
      latest,
      isNext: pointer === stage,
      retryable: status === "failed" && attemptsUsed < GTM_MAX_STAGE_ATTEMPTS,
      attemptsUsed,
      attemptsAllowed: GTM_MAX_STAGE_ATTEMPTS,
    };
  });

  const completedCount = stages.filter((s) => s.status === "complete").length;

  return {
    stages,
    nextStage: pointer,
    completedCount,
    totalCount: GTM_STAGES.length,
    percent: Math.round((completedCount / GTM_STAGES.length) * 100),
    failedStage: stages.find((s) => s.status === "failed") ?? null,
    isComplete: completedCount === GTM_STAGES.length,
    isDraft: attempts.length === 0,
  };
}

/** How many of the eight stages have actually been persisted as succeeded. */
export function completedStageCount(
  currentStage: string | null,
  status: string,
): number {
  if (status === "completed") return GTM_STAGES.length;
  if (!isGtmStage(currentStage)) return 0;
  return gtmStageIndex(currentStage);
}

export function gtmStatusLabel(
  progress: GtmProgress,
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
