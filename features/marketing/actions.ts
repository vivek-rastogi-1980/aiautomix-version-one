"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getGtmAccess } from "@/features/marketing/permissions";
import {
  createGtmProjectSchema,
  updateAcquisitionPolicySchema,
} from "@/features/marketing/schemas";
import {
  errorState,
  successState,
  zodFieldErrors,
  type ActionState,
} from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";

/**
 * Marketing Intelligence Server Actions.
 *
 * Two mutations, and what is absent matters as much as what is here.
 *
 * `createGtmProjectAction` creates the brief. Stage execution stays on
 * `POST /api/marketing/[id]/run-stage`, because the client drives it one stage
 * at a time and needs the per-stage result back.
 *
 * `updateAcquisitionPolicyAction` changes the two acquisition POLICY choices —
 * the payback window and the target LTV:CAC ratio — plus the customer target.
 * Every one of those is a decision the business makes. The deterministic engine
 * then recalculates the ceiling, the budget and all three scenarios from them.
 *
 * There is deliberately NO action for editing a channel score, a priority, a
 * budget or a required lead volume. Those are results, and a result you can
 * type into is not a calculation.
 */

/** Create a marketing plan, then open it. */
export async function createGtmProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { workspace, entitled, canCreate } = await getGtmAccess();

  if (!entitled) {
    return errorState(
      "Your current plan does not include Marketing Intelligence. Upgrade to build a go-to-market plan.",
    );
  }
  if (!canCreate) {
    return errorState("Your role in this workspace is read-only.");
  }

  const parsed = createGtmProjectSchema.safeParse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    industry: formData.get("industry") ?? "",
    geography: formData.get("geography") ?? "",
    currency: formData.get("currency") ?? "",
    motion: formData.get("motion") ?? "",
    targetNewCustomers: formData.get("targetNewCustomers") ?? 0,
    targetHorizonMonths: formData.get("targetHorizonMonths") ?? 12,
    paybackMonths: formData.get("paybackMonths") ?? 6,
    targetLtvCacBps: formData.get("targetLtvCacRatio") ?? "3",
    businessIdeaId: formData.get("businessIdeaId") ?? "",
    businessPlanId: formData.get("businessPlanId") ?? "",
    researchRequestId: formData.get("researchRequestId") ?? "",
    competitorProjectId: formData.get("competitorProjectId") ?? "",
    financialProjectId: formData.get("financialProjectId") ?? "",
  });

  if (!parsed.success) {
    return errorState(
      "Check the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }

  const input = parsed.data;
  const supabase = await createClient();

  // The RPC is the only write path. It re-derives edit permission from
  // auth.uid() and refuses any linked record from another workspace — a check
  // no RLS policy can express, which is why no insert policy exists.
  const { data: projectId, error } = await supabase.rpc("gtm_create_project", {
    p_workspace_id: workspace.id,
    p_title: input.title,
    p_currency: input.currency,
    p_description: input.description ?? null,
    p_industry: input.industry ?? null,
    p_geography: input.geography ?? null,
    p_motion: input.motion ?? null,
    p_target_new_customers: input.targetNewCustomers,
    p_target_horizon_months: input.targetHorizonMonths,
    p_payback_months: input.paybackMonths,
    p_target_ltv_cac_bps: input.targetLtvCacBps,
    p_business_idea_id: input.businessIdeaId ?? null,
    p_business_plan_id: input.businessPlanId ?? null,
    p_research_request_id: input.researchRequestId ?? null,
    p_competitor_project_id: input.competitorProjectId ?? null,
    p_financial_project_id: input.financialProjectId ?? null,
  });

  if (error || typeof projectId !== "string") {
    return errorState(
      error?.message ?? "The marketing plan could not be created.",
    );
  }

  revalidatePath("/marketing");
  redirect(`/marketing/${projectId}`);
}

/**
 * Change the acquisition policy and the customer target.
 *
 * Nothing is recalculated here. The stored values change; the deterministic
 * engine recalculates on the next run of `acquisition_economics`, which the UI
 * offers as a re-run. Recalculating in this action would put a second copy of
 * the arithmetic in a Server Action, and two copies is one too many.
 */
export async function updateAcquisitionPolicyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { workspace, entitled, canCreate } = await getGtmAccess();

  if (!entitled) {
    return errorState(
      "Your current plan does not include Marketing Intelligence.",
    );
  }
  if (!canCreate) {
    return errorState("Your role in this workspace is read-only.");
  }

  const parsed = updateAcquisitionPolicySchema.safeParse({
    projectId: formData.get("projectId") ?? "",
    targetNewCustomers: formData.get("targetNewCustomers") ?? 0,
    targetHorizonMonths: formData.get("targetHorizonMonths") ?? 12,
    paybackMonths: formData.get("paybackMonths") ?? 6,
    targetLtvCacBps: formData.get("targetLtvCacRatio") ?? "3",
  });

  if (!parsed.success) {
    return errorState(
      "Check the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }

  const input = parsed.data;
  const supabase = await createClient();

  // Scoped by workspace as well as id. RLS would refuse a cross-workspace row
  // anyway; the explicit filter makes the intent readable at the call site.
  const { error } = await supabase
    .from("gtm_projects")
    .update({
      target_new_customers: input.targetNewCustomers,
      target_horizon_months: input.targetHorizonMonths,
      payback_months: input.paybackMonths,
      target_ltv_cac_bps: input.targetLtvCacBps,
    })
    .eq("id", input.projectId)
    .eq("workspace_id", workspace.id);

  if (error) {
    return errorState("That change could not be saved.");
  }

  revalidatePath(`/marketing/${input.projectId}`);
  return successState(
    "Saved. Re-run acquisition economics to recalculate the budget from these figures.",
  );
}
