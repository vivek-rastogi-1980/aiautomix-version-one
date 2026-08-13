import { NextResponse } from "next/server";

import { withApiAuth } from "@/lib/api/route-handler";
import { apiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { AiError, toAiError } from "@/features/ai/engine/errors";
import {
  runNextCompetitorStage,
  startCompetitorRun,
} from "@/features/competitors/engine";

/**
 * POST /api/competitors/[id]/run-stage
 *
 * Executes EXACTLY ONE stage of a competitor run and returns the new position.
 * The client calls it again for the next stage.
 *
 * `[id]` is a competitor PROJECT id. The run is resolved (or created)
 * server-side, so a caller cannot address someone else's run by guessing a run
 * id — and cannot open a second parallel run for the same project.
 *
 * Nothing authoritative comes from the request body. Not the stage, not the
 * attempt, not the depth, not the cost, not the workspace. A body is accepted
 * for diagnostics only, and a `stage` field in it is compared against server
 * state rather than obeyed: a client that could name its stage could skip to
 * `recommendations` and pay for advice with no competitors behind it.
 */
export const POST = withApiAuth<{ id: string }>(
  {
    route: "POST /api/competitors/[id]/run-stage",
    scope: "competitors:run-stage",
    errorMessage: "The competitor stage could not be executed.",
  },
  async ({ user, request, params }) => {
    const projectId = params.id;
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) {
      return apiError("INVALID_INPUT", "Invalid competitor project id.", 422);
    }

    // Ownership: the project must be readable under the caller's own RLS.
    // A row from another workspace simply does not come back.
    const supabase = await createClient();
    const { data: project } = await supabase
      .from("competitor_projects")
      .select("id, workspace_id, status")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      // 404 rather than 403: a caller should not be able to probe which
      // project ids exist in other workspaces.
      return apiError("NOT_FOUND", "Competitor project not found.", 404);
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
            message: "This competitor run is already complete.",
          },
        },
        { status: 200 },
      );
    }

    // A `stage` in the body is informational. It is compared, never trusted.
    let requestedStage: string | null = null;
    try {
      const body = (await request.json()) as { stage?: unknown };
      if (typeof body?.stage === "string") requestedStage = body.stage;
    } catch {
      // No body is the normal case.
    }

    try {
      const runId = await startCompetitorRun(projectId);
      const result = await runNextCompetitorStage(runId, user.id);

      if (
        requestedStage &&
        requestedStage !== result.stage &&
        process.env.NODE_ENV !== "production"
      ) {
        console.warn(
          `[competitors] client asked for stage "${requestedStage}" but the server ran "${result.stage}"`,
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
            creditsCharged: result.creditsCharged,
            sourcesAdded: result.sourcesAdded,
            competitorsWritten: result.competitorsWritten,
            evidenceAdded: result.evidenceAdded,
            // Surfaced so the user learns that the model named companies the
            // search could not corroborate — a quality signal, not noise.
            discardedCandidates: result.discardedCandidates,
          },
        },
        { status: 200 },
      );
    } catch (error) {
      const aiError = toAiError(error);

      // A concurrent caller, an exhausted retry budget or a completed run are
      // all "your request is fine but cannot run now" — 409, not 500.
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
