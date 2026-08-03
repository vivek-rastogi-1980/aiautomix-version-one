import { type NextRequest } from "next/server";

import { getAiRuns } from "@/features/ai/history/data";
import { getUser } from "@/lib/auth/session";
import {
  apiError,
  apiSuccess,
  logApiError,
  rateLimitOrError,
} from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/history — execution history for the caller (AI-HISTORY-SPEC.md).
 *
 * Query: `workflow` to filter by slug, `limit` to cap results.
 */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return apiError("UNAUTHORIZED", "You must be signed in.", 401);

  const limited = rateLimitOrError(user.id, "ai:history:list");
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const workflow = params.get("workflow") ?? undefined;
  const rawLimit = Number(params.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined;

  try {
    return apiSuccess(await getAiRuns(user.id, { workflow, limit }));
  } catch (error) {
    logApiError("GET /api/ai/history", error);
    return apiError("INTERNAL_ERROR", "Could not load AI history.", 500);
  }
}
