import { getReports } from "@/features/reports/data";
import { apiSuccess } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reports — the caller's validation report history. */
export const GET = withApiAuth(
  {
    route: "GET /api/reports",
    scope: "reports:list",
    errorMessage: "Could not load reports.",
  },
  async ({ user }) => {
    const reports = await getReports(user.id);
    return apiSuccess(
      reports.map((report) => ({
        id: report.id,
        businessIdeaId: report.business_idea_id,
        score: report.score,
        workflow: report.workflow,
        model: report.model,
        promptVersion: report.prompt_version,
        createdAt: report.created_at,
      })),
    );
  },
);
