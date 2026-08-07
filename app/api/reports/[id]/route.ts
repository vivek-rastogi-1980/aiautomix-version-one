import { getReport } from "@/features/reports/data";
import { apiError, apiSuccess } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reports/:id — a single report with its source idea. */
export const GET = withApiAuth<{ id: string }>(
  {
    route: "GET /api/reports/:id",
    scope: "reports:get",
    errorMessage: "Could not load the report.",
  },
  async ({ user, params: { id } }) => {
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
  },
);
