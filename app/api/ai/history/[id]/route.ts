import { getAiRun } from "@/features/ai/history/data";
import { apiError, apiSuccess } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/history/:id — one execution with its input and output JSON. */
export const GET = withApiAuth<{ id: string }>(
  {
    route: "GET /api/ai/history/:id",
    scope: "ai:history:get",
    errorMessage: "Could not load the AI run.",
  },
  async ({ user, params: { id } }) => {
    const run = await getAiRun(user.id, id);
    if (!run) return apiError("NOT_FOUND", "AI run not found.", 404);
    return apiSuccess(run);
  },
);
