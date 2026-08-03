import { type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/session";
import { getReport } from "@/features/reports/data";
import {
  apiError,
  apiSuccess,
  logApiError,
  rateLimitOrError,
} from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reports/:id — a single report with its source idea. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return apiError("UNAUTHORIZED", "You must be signed in.", 401);

  const limited = rateLimitOrError(user.id, "reports:get");
  if (limited) return limited;

  const { id } = await context.params;

  try {
    const result = await getReport(user.id, id);
    if (!result) return apiError("NOT_FOUND", "Report not found.", 404);

    return apiSuccess({
      id: result.report.id,
      score: result.report.score,
      report: result.report.report_json,
      metadata: {
        workflow: result.report.workflow,
        promptVersion: result.report.prompt_version,
        model: result.report.model,
        durationMs: result.report.duration_ms,
        tokens: result.report.tokens_used,
      },
      createdAt: result.report.created_at,
      idea: result.idea
        ? { id: result.idea.id, title: result.idea.title }
        : null,
    });
  } catch (error) {
    logApiError("GET /api/reports/:id", error);
    return apiError("INTERNAL_ERROR", "Could not load the report.", 500);
  }
}
