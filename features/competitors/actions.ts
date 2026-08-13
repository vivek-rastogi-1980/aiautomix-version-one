"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCompetitorAccess } from "@/features/competitors/permissions";
import { createCompetitorProjectSchema } from "@/features/competitors/schemas";
import {
  errorState,
  zodFieldErrors,
  type ActionState,
} from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";

/**
 * Competitor Intelligence Server Actions.
 *
 * Creation is a Server Action because that is what this codebase does for
 * mutations driven by a form — the same shape as `createResearchAction` and
 * `generateBusinessPlanAction`. Stage *execution* is not here: it stays on
 * `POST /api/competitors/[id]/run-stage`, because the client drives it one
 * stage at a time and needs the per-stage result back to decide what to render.
 * Two mechanisms, two genuinely different jobs.
 *
 * The workspace is re-derived from the session here and re-derived *again*
 * inside `competitor_create_project` from `auth.uid()`. A workspace id posted
 * by a client is never trusted at either layer.
 */

/** Create a competitor brief, then open it. */
export async function createCompetitorProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { workspace, entitled, canCreate } = await getCompetitorAccess();

  if (!entitled) {
    return errorState(
      "Your current plan does not include Competitor Intelligence. Upgrade to start a competitor project.",
    );
  }
  if (!canCreate) {
    return errorState("Your role in this workspace is read-only.");
  }

  const parsed = createCompetitorProjectSchema.safeParse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    category: formData.get("category") ?? "",
    geography: formData.get("geography") ?? "",
    targetCustomer: formData.get("targetCustomer") ?? "",
    customerProblem: formData.get("customerProblem") ?? "",
    businessModel: formData.get("businessModel") ?? "",
    knownCompetitors: formData.get("knownCompetitors") ?? "",
    depth: formData.get("depth") ?? "",
    businessIdeaId: formData.get("businessIdeaId") ?? "",
    businessPlanId: formData.get("businessPlanId") ?? "",
  });

  if (!parsed.success) {
    return errorState(
      "Please fix the errors below.",
      zodFieldErrors(parsed.error),
    );
  }

  const input = parsed.data;
  const supabase = await createClient();

  const { data: projectId, error } = await supabase.rpc(
    "competitor_create_project",
    {
      p_workspace_id: workspace.id,
      p_title: input.title,
      p_depth: input.depth,
      p_description: input.description ?? null,
      p_category: input.category ?? null,
      p_geography: input.geography ?? null,
      p_target_customer: input.targetCustomer ?? null,
      p_customer_problem: input.customerProblem ?? null,
      p_business_model: input.businessModel ?? null,
      p_known_competitors: input.knownCompetitors,
      p_business_idea_id: input.businessIdeaId ?? null,
      p_business_plan_id: input.businessPlanId ?? null,
    },
  );

  if (error || typeof projectId !== "string") {
    // The database message names tables and constraints. It goes to the log,
    // not to the user.
    console.error("[competitors] create failed", {
      workspaceId: workspace.id,
      message: error?.message,
    });
    return errorState(
      "Could not create the competitor project. Please try again.",
    );
  }

  revalidatePath("/competitors");
  redirect(`/competitors/${projectId}`);
}
