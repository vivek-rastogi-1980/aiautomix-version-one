import { getBusinessIdeas } from "@/features/reports/data";
import { businessIdeaSchema } from "@/lib/validations/business-idea";
import {
  isPlatformConfigured,
  toAiError,
  validateBusinessIdea,
} from "@/features/ai";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  logApiError,
} from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/business-ideas — list the caller's submitted ideas. */
export const GET = withApiAuth(
  {
    route: "GET /api/business-ideas",
    scope: "business-ideas:list",
    errorMessage: "Could not load business ideas.",
  },
  async ({ user }) => apiSuccess(await getBusinessIdeas(user.id)),
);

/**
 * POST /api/business-ideas — submit an idea and run the validator workflow.
 * Returns the saved report. Shares the exact service the Server Action uses.
 */
export const POST = withApiAuth(
  {
    route: "POST /api/business-ideas",
    scope: "business-ideas:create",
    errorMessage: "Could not validate the business idea.",
  },
  async ({ user, request }) => {
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
      const { workspace, role } = await getWorkspaceContext(user.id);
      if (!canEdit(role)) {
        return apiError(
          "FORBIDDEN",
          "Your role in this workspace is read-only.",
          403,
        );
      }

      const outcome = await validateBusinessIdea(
        user.id,
        workspace.id,
        parsed.data,
      );
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
      // place, so all AI routes respond consistently. Kept local rather than
      // delegated to the wrapper's catch, which would flatten it to a 500.
      const aiError = toAiError(error);
      logApiError("POST /api/business-ideas", aiError);
      return apiError(aiError.code, aiError.userMessage, aiError.status);
    }
  },
);
