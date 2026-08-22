import {
  generateBusinessPlan,
  isPlatformConfigured,
  toAiError,
} from "@/features/ai";
import { getBusinessPlans } from "@/features/business-plans/data";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { EntitlementError } from "@/features/commerce/errors";
import { apiEntitlementError } from "@/lib/api/response";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  logApiError,
} from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";
import { businessPlanInputSchema } from "@/lib/validations/business-plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/business-plans — plans in the caller's workspace. */
export const GET = withApiAuth(
  {
    route: "GET /api/business-plans",
    scope: "business-plans:list",
    errorMessage: "Could not load business plans.",
  },
  async ({ user }) => {
    const { workspace } = await getWorkspaceContext(user.id);
    const plans = await getBusinessPlans(workspace.id);

    return apiSuccess(
      plans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        status: plan.status,
        workspaceId: plan.workspace_id,
        projectId: plan.project_id,
        businessIdeaId: plan.business_idea_id,
        model: plan.model,
        promptVersion: plan.prompt_version,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
      })),
    );
  },
);

/**
 * POST /api/business-plans — generate a plan from a brief.
 * Shares the exact service the Server Action uses.
 */
export const POST = withApiAuth(
  {
    route: "POST /api/business-plans",
    scope: "business-plans:create",
    errorMessage: "Could not generate the business plan.",
  },
  async ({ user, request }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
    }

    const parsed = businessPlanInputSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    if (!isPlatformConfigured()) {
      return apiError(
        "AI_NOT_CONFIGURED",
        "The AI service is not configured.",
        503,
      );
    }

    // Kept local rather than delegated to the wrapper's catch: a workflow
    // failure carries its own code, user-safe message and status (rate limits,
    // provider outages, validation), and collapsing those into a generic 500
    // would lose exactly the detail the client needs to react to.
    try {
      const { workspace, role } = await getWorkspaceContext(user.id);
      if (!canEdit(role)) {
        return apiError(
          "FORBIDDEN",
          "Your role in this workspace is read-only.",
          403,
        );
      }

      const outcome = await generateBusinessPlan({
        userId: user.id,
        workspaceId: workspace.id,
        input: parsed.data,
      });

      return apiSuccess(
        {
          planId: outcome.plan.id,
          title: outcome.plan.title,
          sections: outcome.sections.map((section) => ({
            key: section.section_key,
            title: section.title,
            content: section.content,
            version: section.current_version,
          })),
        },
        201,
      );
    } catch (error) {
      // §7: a limit refusal returns structured context so the client can render
      // "3 of 3 used this month" with an upgrade path, rather than a generic
      // failure. Handled before `toAiError`, which would flatten it into a
      // provider error it is not.
      if (error instanceof EntitlementError) {
        return apiEntitlementError(error.toPayload());
      }

      const aiError = toAiError(error);
      logApiError("POST /api/business-plans", aiError);
      return apiError(aiError.code, aiError.userMessage, aiError.status);
    }
  },
);
