import { getAiRuns } from "@/features/ai/history/data";
import { apiSuccess } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/history — execution history for the caller (AI-HISTORY-SPEC.md).
 *
 * Query: `workflow` to filter by slug, `limit` to cap results.
 */
export const GET = withApiAuth(
  {
    route: "GET /api/ai/history",
    scope: "ai:history:list",
    errorMessage: "Could not load AI history.",
  },
  async ({ user, request }) => {
    const params = request.nextUrl.searchParams;
    const workflow = params.get("workflow") ?? undefined;
    const rawLimit = Number(params.get("limit"));
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined;

    return apiSuccess(await getAiRuns(user.id, { workflow, limit }));
  },
);
