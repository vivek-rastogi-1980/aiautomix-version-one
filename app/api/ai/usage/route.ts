import {
  DEFAULT_USAGE_WINDOW_DAYS,
  getUsageSummary,
} from "@/features/ai/usage/data";
import { apiSuccess } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WINDOW_DAYS = 365;

/**
 * GET /api/ai/usage — token, duration and estimated-cost metrics for the
 * caller (USAGE-TRACKING-SPEC.md). Query: `days` to size the window.
 */
export const GET = withApiAuth(
  {
    route: "GET /api/ai/usage",
    scope: "ai:usage",
    errorMessage: "Could not load usage metrics.",
  },
  async ({ user, request }) => {
    const requested = Number(request.nextUrl.searchParams.get("days"));
    const days =
      Number.isFinite(requested) && requested > 0
        ? Math.min(Math.floor(requested), MAX_WINDOW_DAYS)
        : DEFAULT_USAGE_WINDOW_DAYS;

    return apiSuccess(await getUsageSummary(user.id, days));
  },
);
