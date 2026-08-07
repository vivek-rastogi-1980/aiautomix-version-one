import { getBusinessPlan } from "@/features/business-plans/data";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { apiError, apiSuccess } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/business-plans/:id — a plan with its sections and revision counts. */
export const GET = withApiAuth<{ id: string }>(
  {
    route: "GET /api/business-plans/:id",
    scope: "business-plans:get",
    errorMessage: "Could not load the business plan.",
  },
  async ({ user, params: { id } }) => {
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
  },
);
