import { type NextRequest } from "next/server";

import { getBusinessPlan } from "@/features/business-plans/data";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { getUser } from "@/lib/auth/session";
import {
  apiError,
  apiSuccess,
  logApiError,
  rateLimitOrError,
} from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/business-plans/:id — a plan with its sections and revision counts. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return apiError("UNAUTHORIZED", "You must be signed in.", 401);

  const limited = rateLimitOrError(user.id, "business-plans:get");
  if (limited) return limited;

  const { id } = await context.params;

  try {
    const { workspace } = await getWorkspaceContext(user.id);
    const result = await getBusinessPlan(workspace.id, id);
    if (!result) return apiError("NOT_FOUND", "Business plan not found.", 404);

    const { plan, sections, history } = result;

    return apiSuccess({
      id: plan.id,
      title: plan.title,
      status: plan.status,
      summary: plan.summary,
      metadata: {
        workflow: plan.workflow,
        promptVersion: plan.prompt_version,
        model: plan.model,
      },
      createdAt: plan.created_at,
      updatedAt: plan.updated_at,
      sections: sections.map((section) => ({
        id: section.id,
        key: section.section_key,
        title: section.title,
        content: section.content,
        position: section.position,
        version: section.current_version,
        source: section.source,
        revisions: history.get(section.id)?.length ?? 0,
      })),
    });
  } catch (error) {
    logApiError("GET /api/business-plans/:id", error);
    return apiError("INTERNAL_ERROR", "Could not load the business plan.", 500);
  }
}
