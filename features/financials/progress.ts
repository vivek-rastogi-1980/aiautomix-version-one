import {
  FINANCIAL_STAGES,
  financialStageIndex,
  isComputeStage,
  isFinancialStage,
  type FinancialStage,
} from "@/features/financials/types";
import { FINANCIAL_MAX_STAGE_ATTEMPTS } from "@/features/financials/constants";

/**
 * Turns persisted rows into what the pipeline draws.
 *
 * Pure and free of `server-only`, so the same function runs in the server page
 * and in the client component that re-renders after a stage finishes.
 *
 * The rule: a stage is complete only when an attempt row says it SUCCEEDED.
 * Not when the client asked for it, not when a fetch resolved, not when the
 * pointer looks far enough along.
 */

export interface FinancialStageAttempt {
  stage: FinancialStage;
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

export interface FinancialStageView {
  stage: FinancialStage;
  status: StageDisplayStatus;
  /** Compute stages run the engine, cost nothing and call no model. */
  isCompute: boolean;
  attempts: FinancialStageAttempt[];
  latest: FinancialStageAttempt | null;
  isNext: boolean;
  retryable: boolean;
  attemptsUsed: number;
  attemptsAllowed: number;
}

export interface FinancialProgress {
  stages: FinancialStageView[];
  nextStage: FinancialStage | null;
  completedCount: number;
  totalCount: number;
  percent: number;
  failedStage: FinancialStageView | null;
  isComplete: boolean;
  isDraft: boolean;
}

export interface FinancialProgressInput {
  currentStage: string | null;
  runStatus: string | null;
  projectStatus: string;
  attempts: FinancialStageAttempt[];
}

export function buildFinancialProgress({
  currentStage,
  runStatus,
  projectStatus,
  attempts,
}: FinancialProgressInput): FinancialProgress {
  const finished = projectStatus === "completed" || runStatus === "completed";

  const pointer: FinancialStage | null = isFinancialStage(currentStage)
    ? currentStage
    : finished
      ? null
      : runStatus === null
        ? FINANCIAL_STAGES[0]
        : null;

  const stages: FinancialStageView[] = FINANCIAL_STAGES.map((stage) => {
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
      retryable:
        status === "failed" && attemptsUsed < FINANCIAL_MAX_STAGE_ATTEMPTS,
      attemptsUsed,
      attemptsAllowed: FINANCIAL_MAX_STAGE_ATTEMPTS,
    };
  });

  const completedCount = stages.filter((s) => s.status === "complete").length;

  return {
    stages,
    nextStage: pointer,
    completedCount,
    totalCount: FINANCIAL_STAGES.length,
    percent: Math.round((completedCount / FINANCIAL_STAGES.length) * 100),
    failedStage: stages.find((s) => s.status === "failed") ?? null,
    isComplete: completedCount === FINANCIAL_STAGES.length,
    isDraft: attempts.length === 0,
  };
}

/** How many of the eight stages have actually been persisted as succeeded. */
export function completedStageCount(
  currentStage: string | null,
  status: string,
): number {
  if (status === "completed") return FINANCIAL_STAGES.length;
  if (!isFinancialStage(currentStage)) return 0;
  return financialStageIndex(currentStage);
}

export function financialStatusLabel(
  progress: FinancialProgress,
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
