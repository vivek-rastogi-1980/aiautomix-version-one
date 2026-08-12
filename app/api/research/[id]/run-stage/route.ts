import { NextResponse } from "next/server";

import { withApiAuth } from "@/lib/api/route-handler";
import { apiError } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { AiError, toAiError } from "@/features/ai/engine/errors";
import { runNextStage, startRun } from "@/features/research/engine";

/**
 * POST /api/research/[id]/run-stage
 *
 * Executes EXACTLY ONE stage of a research run and returns the new position.
 * The client calls it again for the next stage.
 *
 * `[id]` is a research REQUEST id. The run is resolved (or created) server-side,
 * so a caller cannot address someone else's run by guessing a run id — and
 * cannot open a second parallel run for the same request.
 *
 * Nothing authoritative comes from the request body. Not the stage, not the
 * attempt, not the depth, not the cost, not the workspace. A body is accepted
 * for diagnostics only, and a `stage` field in it is validated against server
 * state rather than obeyed: a client that could name its stage could skip to
 * `report` and pay for a report with no evidence behind it.
 */
export const POST = withApiAuth<{ id: string }>(
  {
    route: "POST /api/research/[id]/run-stage",
    scope: "research:run-stage",
    errorMessage: "The research stage could not be executed.",
  },
  async ({ user, request, params }) => {
    const requestId = params.id;
    if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
      return apiError("INVALID_INPUT", "Invalid research id.", 422);
    }

    // Ownership: the request must be readable under the caller's own RLS.
    // A row from another workspace simply does not come back.
    const supabase = await createClient();
    const { data: researchRequest } = await supabase
      .from("research_requests")
      .select("id, workspace_id, status")
      .eq("id", requestId)
      .maybeSingle();

    if (!researchRequest) {
      // 404 rather than 403: a caller should not be able to probe which
      // research ids exist in other workspaces.
      return apiError("NOT_FOUND", "Research not found.", 404);
    }

    if (researchRequest.status === "completed") {
      return NextResponse.json(
        {
          success: true,
          data: {
            requestId,
            status: "completed",
            currentStage: null,
            completed: true,
            message: "This research run is already complete.",
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
      const runId = await startRun(requestId);
      const result = await runNextStage(runId, user.id);

      if (
        requestedStage &&
        requestedStage !== result.stage &&
        process.env.NODE_ENV !== "production"
      ) {
        console.warn(
          `[research] client asked for stage "${requestedStage}" but the server ran "${result.stage}"`,
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
              requestId,
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
            requestId,
            runId: result.runId,
            stage: result.stage,
            attempt: result.attempt,
            status: "completed",
            nextStage: result.nextStage,
            currentStage: result.currentStage,
            completed: result.completed,
            creditsCharged: result.creditsCharged,
            sourcesAdded: result.sourcesAdded,
            evidenceAdded: result.evidenceAdded,
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
