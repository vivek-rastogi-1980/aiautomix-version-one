"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getResearchAccess } from "@/features/research/permissions";
import { createResearchSchema } from "@/features/research/schemas";
import {
  errorState,
  zodFieldErrors,
  type ActionState,
} from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";

/**
 * Market Research Server Actions.
 *
 * Creation is a Server Action because that is what this codebase does for
 * mutations driven by a form — the same shape as `generateBusinessPlanAction`.
 * Stage *execution* is not here: it stays on `POST /api/research/[id]/run-stage`
 * from Phase 3, because the client drives it one stage at a time and needs the
 * per-stage result back to decide what to render. Two mechanisms, two genuinely
 * different jobs; adding a second stage-running path would be the duplicate the
 * spec forbids.
 *
 * The workspace is re-derived from the session here and re-derived *again*
 * inside `research_create_request` from `auth.uid()`. A workspace id posted by
 * a client is never trusted at either layer.
 */

/** Create a research brief, then open it. */
export async function createResearchAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { workspace, entitled, canCreate } = await getResearchAccess();

  if (!entitled) {
    return errorState(
      "Your current plan does not include Market Research. Upgrade to start a research project.",
    );
  }
  if (!canCreate) {
    return errorState("Your role in this workspace is read-only.");
  }

  const parsed = createResearchSchema.safeParse({
    title: formData.get("title") ?? "",
    scope: formData.get("scope") ?? "",
    industry: formData.get("industry") ?? "",
    geography: formData.get("geography") ?? "",
    targetCustomer: formData.get("targetCustomer") ?? "",
    businessModel: formData.get("businessModel") ?? "",
    questions: formData.get("questions") ?? "",
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

  const { data: requestId, error } = await supabase.rpc(
    "research_create_request",
    {
      p_workspace_id: workspace.id,
      p_title: input.title,
      p_depth: input.depth,
      p_scope: input.scope ?? null,
      p_industry: input.industry ?? null,
      p_geography: input.geography ?? null,
      p_target_customer: input.targetCustomer ?? null,
      p_business_model: input.businessModel ?? null,
      p_questions: input.questions,
      p_business_idea_id: input.businessIdeaId ?? null,
      p_business_plan_id: input.businessPlanId ?? null,
    },
  );

  if (error || typeof requestId !== "string") {
    // The database message names tables and constraints. It goes to the log,
    // not to the user.
    console.error("[research] create failed", {
      workspaceId: workspace.id,
      message: error?.message,
    });
    return errorState("Could not create the research project. Please try again.");
  }

  revalidatePath("/research");
  redirect(`/research/${requestId}`);
}
