"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { toAiError } from "@/features/ai/engine/errors";
import { regenerateReport } from "@/features/research/engine";
import { getResearchAccess } from "@/features/research/permissions";
import { createResearchSchema } from "@/features/research/schemas";
import {
  errorState,
  successState,
  zodFieldErrors,
  type ActionState,
} from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    return errorState(
      "Could not create the research project. Please try again.",
    );
  }

  revalidatePath("/research");
  redirect(`/research/${requestId}`);
}

/**
 * Rebuild the report from evidence that has already been gathered.
 *
 * This runs ONE stage — `report` — through the Phase 3 engine. It does not
 * search the web, does not retrieve sources and does not touch the analysis:
 * the report workflow reads stored `research_results` rows and nothing else, so
 * a regeneration costs one stage instead of seven and cites exactly the same
 * sources.
 *
 * A Server Action rather than a route because it is a form submission that ends
 * in a redirect-free revalidation, the same shape as
 * `generateBusinessPlanAction`. The stage-by-stage pipeline stays on its HTTP
 * route because that one needs a per-stage result back.
 */
export async function regenerateResearchReportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, workspace, entitled, canCreate } = await getResearchAccess();

  if (!entitled) {
    return errorState("Your current plan does not include Market Research.");
  }
  if (!canCreate) {
    return errorState("Your role in this workspace is read-only.");
  }

  const requestId = formData.get("requestId");
  if (typeof requestId !== "string" || !UUID.test(requestId)) {
    return errorState("Missing research id.");
  }

  // Ownership under the caller's own RLS. A request from another workspace
  // simply does not come back, and the action stops here rather than letting
  // the RPC decide — which keeps the message a sentence instead of a
  // database error.
  const supabase = await createClient();
  const { data: owned } = await supabase
    .from("research_requests")
    .select("id")
    .eq("id", requestId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!owned) return errorState("Research not found.");

  try {
    const result = await regenerateReport(requestId, user.id);

    if (result.status === "failed") {
      revalidateResearch(requestId);
      return errorState(
        result.error?.message ??
          "The report could not be regenerated. Please try again.",
      );
    }

    revalidateResearch(requestId);
    return successState(
      `Report regenerated. ${result.creditsCharged} credits charged; no new research was run.`,
    );
  } catch (error) {
    const aiError = toAiError(error);
    console.error("[research] report regeneration failed", {
      requestId,
      code: aiError.code,
      message: aiError.message,
    });
    return errorState(aiError.userMessage);
  }
}

function revalidateResearch(requestId: string): void {
  revalidatePath("/research");
  revalidatePath(`/research/${requestId}`);
  revalidatePath(`/research/${requestId}/report`);
}
