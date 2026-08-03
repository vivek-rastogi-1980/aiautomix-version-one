import { type NextRequest } from "next/server";

import { getAiRun } from "@/features/ai/history/data";
import { getUser } from "@/lib/auth/session";
import {
  apiError,
  apiSuccess,
  logApiError,
  rateLimitOrError,
} from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/history/:id — one execution with its input and output JSON. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return apiError("UNAUTHORIZED", "You must be signed in.", 401);

  const limited = rateLimitOrError(user.id, "ai:history:get");
  if (limited) return limited;

  const { id } = await context.params;

  try {
    const run = await getAiRun(user.id, id);
    if (!run) return apiError("NOT_FOUND", "AI run not found.", 404);
    return apiSuccess(run);
  } catch (error) {
    logApiError("GET /api/ai/history/:id", error);
    return apiError("INTERNAL_ERROR", "Could not load the AI run.", 500);
  }
}
