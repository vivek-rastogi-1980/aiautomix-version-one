import { NextResponse } from "next/server";

import { withApiAuth } from "@/lib/api/route-handler";
import { apiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { AiError, toAiError } from "@/features/ai/engine/errors";
import {
  runNextFinancialStage,
  startFinancialRun,
} from "@/features/financials/engine";

/**
 * POST /api/financials/[id]/run-stage
 *
 * Executes EXACTLY ONE stage of a financial run and returns the new position.
 * The client calls it again for the next stage.
 *
 * `[id]` is a financial PROJECT id. The run is resolved (or created)
 * server-side, so a caller cannot address someone else's run by guessing a run
 * id — and cannot open a second parallel run for the same project.
 *
 * Nothing authoritative comes from the request body. Not the stage, not the
 * attempt, not the cost, not the workspace, and above all not a financial
 * figure: this endpoint accepts no numbers at all. Every amount in the model
 * comes from a stored assumption or from the deterministic engine.
 */
export const POST = withApiAuth<{ id: string }>(
  {
    route: "POST /api/financials/[id]/run-stage",
    scope: "financials:run-stage",
    errorMessage: "The financial stage could not be executed.",
  },
  async ({ user, request, params }) => {
    const projectId = params.id;
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) {
      return apiError("INVALID_INPUT", "Invalid financial project id.", 422);
    }

    // Ownership: the project must be readable under the caller's own RLS.
    const supabase = await createClient();
    const { data: project } = await supabase
      .from("financial_projects")
      .select("id, workspace_id, status")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      // 404 rather than 403: a caller should not be able to probe which
      // project ids exist in other workspaces.
      return apiError("NOT_FOUND", "Financial project not found.", 404);
    }

    if (project.status === "completed") {
      return NextResponse.json(
        {
          success: true,
          data: {
            projectId,
            status: "completed",
            currentStage: null,
            completed: true,
            message: "This financial run is already complete.",
          },
        },
        { status: 200 },
      );
    }

    // A `stage` in the body is informational. It is compared, never obeyed.
    let requestedStage: string | null = null;
    try {
      const body = (await request.json()) as { stage?: unknown };
      if (typeof body?.stage === "string") requestedStage = body.stage;
    } catch {
      // No body is the normal case.
    }

    try {
      const runId = await startFinancialRun(projectId);
      const result = await runNextFinancialStage(runId, user.id);

      if (
        requestedStage &&
        requestedStage !== result.stage &&
        process.env.NODE_ENV !== "production"
      ) {
        console.warn(
          `[financials] client asked for stage "${requestedStage}" but the server ran "${result.stage}"`,
        );
      }

      if (result.status === "failed") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: result.error?.code ?? "AI_PROVIDER_ERROR",
              message: result.error?.message ?? "The stage failed.",
            },
            data: {
              projectId,
              runId: result.runId,
              stage: result.stage,
              attempt: result.attempt,
              status: "failed",
              retryable: result.error?.retryable ?? false,
              currentStage: result.currentStage,
              creditsCharged: result.creditsCharged,
              creditsRefunded: result.creditsRefunded,
            },
          },
          { status: 200 },
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            projectId,
            runId: result.runId,
            stage: result.stage,
            attempt: result.attempt,
            status: "completed",
            nextStage: result.nextStage,
            currentStage: result.currentStage,
            completed: result.completed,
            // Surfaced so the UI can say "calculated — no AI ran, no charge".
            kind: result.kind,
            creditsCharged: result.creditsCharged,
            assumptionsWritten: result.assumptionsWritten,
            costsWritten: result.costsWritten,
            sourcesAdded: result.sourcesAdded,
            fundingWritten: result.fundingWritten,
            // A quality signal: funding programmes the model named that no
            // search result corroborated, and which were therefore dropped.
            discardedOptions: result.discardedOptions,
          },
        },
        { status: 200 },
      );
    } catch (error) {
      const aiError = toAiError(error);

      if (
        aiError instanceof AiError &&
        /already running|already complete|cannot be retried|already succeeded/i.test(
          aiError.message,
        )
      ) {
        return apiError("CONFLICT", aiError.message, 409);
      }

      return apiError(
        aiError.code,
        aiError.message,
        aiError.code === "AI_INVALID_INPUT" ? 422 : 500,
      );
    }
  },
);
