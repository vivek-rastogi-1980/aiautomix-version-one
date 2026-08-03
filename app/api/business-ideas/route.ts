import { type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/session";
import { getBusinessIdeas } from "@/features/reports/data";
import { businessIdeaSchema } from "@/lib/validations/business-idea";
import { validateBusinessIdea } from "@/features/ai/services/business-validator";
import { toAiError } from "@/features/ai/engine/errors";
import { isPlatformConfigured } from "@/features/ai/providers";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  logApiError,
  rateLimitOrError,
} from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/business-ideas — list the caller's submitted ideas. */
export async function GET() {
  const user = await getUser();
  if (!user) return apiError("UNAUTHORIZED", "You must be signed in.", 401);

  const limited = rateLimitOrError(user.id, "business-ideas:list");
  if (limited) return limited;

  try {
    return apiSuccess(await getBusinessIdeas(user.id));
  } catch (error) {
    logApiError("GET /api/business-ideas", error);
    return apiError("INTERNAL_ERROR", "Could not load business ideas.", 500);
  }
}

/**
 * POST /api/business-ideas — submit an idea and run the validator workflow.
 * Returns the saved report. Shares the exact service the Server Action uses.
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return apiError("UNAUTHORIZED", "You must be signed in.", 401);

  const limited = rateLimitOrError(user.id, "business-ideas:create");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const parsed = businessIdeaSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  if (!isPlatformConfigured()) {
    return apiError(
      "AI_NOT_CONFIGURED",
      "The AI service is not configured.",
      503,
    );
  }

  try {
    const outcome = await validateBusinessIdea(user.id, parsed.data);
    return apiSuccess(
      {
        ideaId: outcome.idea.id,
        reportId: outcome.report.id,
        score: outcome.report.score,
        report: outcome.data,
      },
      201,
    );
  } catch (error) {
    // `AiError.status` maps every platform failure onto its HTTP code in one
    // place, so all AI routes respond consistently.
    const aiError = toAiError(error);
    logApiError("POST /api/business-ideas", aiError);
    return apiError(aiError.code, aiError.userMessage, aiError.status);
  }
}
