import { getUser } from "@/lib/auth/session";
import { getReports } from "@/features/reports/data";
import {
  apiError,
  apiSuccess,
  logApiError,
  rateLimitOrError,
} from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/reports — the caller's validation report history. */
export async function GET() {
  const user = await getUser();
  if (!user) return apiError("UNAUTHORIZED", "You must be signed in.", 401);

  const limited = rateLimitOrError(user.id, "reports:list");
  if (limited) return limited;

  try {
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
  } catch (error) {
    logApiError("GET /api/reports", error);
    return apiError("INTERNAL_ERROR", "Could not load reports.", 500);
  }
}
