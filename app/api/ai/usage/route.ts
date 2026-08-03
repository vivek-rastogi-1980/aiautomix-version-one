import { type NextRequest } from "next/server";

import {
  DEFAULT_USAGE_WINDOW_DAYS,
  getUsageSummary,
} from "@/features/ai/usage/data";
import { getUser } from "@/lib/auth/session";
import {
  apiError,
  apiSuccess,
  logApiError,
  rateLimitOrError,
} from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WINDOW_DAYS = 365;

/**
 * GET /api/ai/usage — token, duration and estimated-cost metrics for the
 * caller (USAGE-TRACKING-SPEC.md). Query: `days` to size the window.
 */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return apiError("UNAUTHORIZED", "You must be signed in.", 401);

  const limited = rateLimitOrError(user.id, "ai:usage");
  if (limited) return limited;

  const requested = Number(request.nextUrl.searchParams.get("days"));
  const days =
    Number.isFinite(requested) && requested > 0
      ? Math.min(Math.floor(requested), MAX_WINDOW_DAYS)
      : DEFAULT_USAGE_WINDOW_DAYS;

  try {
    return apiSuccess(await getUsageSummary(user.id, days));
  } catch (error) {
    logApiError("GET /api/ai/usage", error);
    return apiError("INTERNAL_ERROR", "Could not load usage metrics.", 500);
  }
}
