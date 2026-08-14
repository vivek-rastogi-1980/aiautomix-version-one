"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getFinancialAccess } from "@/features/financials/permissions";
import {
  createFinancialProjectSchema,
  majorAmountSchema,
  updateAssumptionSchema,
  percentStringToBps,
} from "@/features/financials/schemas";
import {
  errorState,
  successState,
  zodFieldErrors,
  type ActionState,
} from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";

/**
 * Financial Intelligence Server Actions.
 *
 * Two mutations, and the second is the important one.
 *
 * `createFinancialProjectAction` creates the brief. Stage execution stays on
 * `POST /api/financials/[id]/run-stage`, because the client drives it one stage
 * at a time and needs the per-stage result back.
 *
 * `updateAssumptionAction` is the ONLY way a user changes the model. They edit
 * an assumption; the engine recalculates from it. There is deliberately no
 * action anywhere for editing revenue, profit, break-even or runway — an output
 * you can type into is not a calculation, and the moment one exists the report
 * stops being arithmetic and becomes a spreadsheet somebody has overwritten.
 */

/** Create a financial model, then open it. */
export async function createFinancialProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { workspace, entitled, canCreate } = await getFinancialAccess();

  if (!entitled) {
    return errorState(
      "Your current plan does not include Financial Intelligence. Upgrade to build a financial model.",
    );
  }
  if (!canCreate) {
    return errorState("Your role in this workspace is read-only.");
  }

  const parsed = createFinancialProjectSchema.safeParse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    industry: formData.get("industry") ?? "",
    geography: formData.get("geography") ?? "",
    targetCustomer: formData.get("targetCustomer") ?? "",
    currency: formData.get("currency") ?? "",
    revenueModel: formData.get("revenueModel") ?? "",
    horizonMonths: formData.get("horizonMonths") ?? "12",
    openingCash: formData.get("openingCash") ?? "",
    businessIdeaId: formData.get("businessIdeaId") ?? "",
    businessPlanId: formData.get("businessPlanId") ?? "",
    researchRequestId: formData.get("researchRequestId") ?? "",
    competitorProjectId: formData.get("competitorProjectId") ?? "",
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
    "financial_create_project",
    {
      p_workspace_id: workspace.id,
      p_title: input.title,
      p_currency: input.currency,
      p_revenue_model: input.revenueModel,
      p_description: input.description ?? null,
      p_industry: input.industry ?? null,
      p_geography: input.geography ?? null,
      p_target_customer: input.targetCustomer ?? null,
      p_horizon_months: input.horizonMonths,
      // Already converted to minor units by the schema — exactly once.
      p_opening_cash_minor: input.openingCash,
      p_business_idea_id: input.businessIdeaId ?? null,
      p_business_plan_id: input.businessPlanId ?? null,
      p_research_request_id: input.researchRequestId ?? null,
      p_competitor_project_id: input.competitorProjectId ?? null,
    },
  );

  if (error || typeof projectId !== "string") {
    // The database message names tables and constraints. Log, don't show.
    console.error("[financials] create failed", {
      workspaceId: workspace.id,
      message: error?.message,
    });
    return errorState(
      "Could not create the financial model. Please try again.",
    );
  }

  revalidatePath("/financials");
  redirect(`/financials/${projectId}`);
}

/**
 * Change one assumption.
 *
 * The write promotes the row to `source: USER` in SQL, which is what stops a
 * later stage overwriting it with a fresh proposal. Every downstream figure is
 * recomputed on the next read, because nothing derived is stored as an input.
 */
export async function updateAssumptionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { workspace, entitled, canCreate } = await getFinancialAccess();

  if (!entitled) {
    return errorState(
      "Your current plan does not include Financial Intelligence.",
    );
  }
  if (!canCreate) {
    return errorState("Your role in this workspace is read-only.");
  }

  const parsed = updateAssumptionSchema.safeParse({
    projectId: formData.get("projectId") ?? "",
    key: formData.get("key") ?? "",
    unit: formData.get("unit") ?? "",
    amount: formData.get("amount") ?? "",
    value: formData.get("value") ?? "",
  });

  if (!parsed.success) {
    return errorState(
      "Please fix the errors below.",
      zodFieldErrors(parsed.error),
    );
  }

  const input = parsed.data;
  const supabase = await createClient();

  // Ownership under the caller's own RLS. A project from another workspace
  // simply does not come back.
  const { data: owned } = await supabase
    .from("financial_projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!owned) return errorState("Financial model not found.");

  // Convert once, here. Money arrives as major units; a rate arrives as a
  // percentage the user typed and is stored as basis points.
  let valueMinor: number | null = null;
  let valueInt: number | null = null;

  if (input.unit === "money") {
    const amount = majorAmountSchema.safeParse(input.amount ?? "");
    if (!amount.success) return errorState("Enter a valid amount.");
    valueMinor = amount.data;
  } else if (input.unit === "bps") {
    const bps = percentStringToBps(input.value ?? "");
    if (bps === null) return errorState("Enter a valid percentage.");
    valueInt = bps;
  } else {
    const raw = (input.value ?? "").replace(/[,\s]/g, "");
    if (!/^\d+$/.test(raw)) return errorState("Enter a whole number.");
    valueInt = Number.parseInt(raw, 10);
  }

  const { error } = await supabase.rpc("financial_set_assumption", {
    p_project_id: input.projectId,
    p_key: input.key,
    p_unit: input.unit,
    p_value_minor: valueMinor,
    p_value_int: valueInt,
    p_label: null,
  });

  if (error) {
    console.error("[financials] assumption update failed", {
      projectId: input.projectId,
      key: input.key,
      message: error.message,
    });
    return errorState("Could not save that assumption. Please try again.");
  }

  revalidatePath(`/financials/${input.projectId}`);
  revalidatePath(`/financials/${input.projectId}/report`);
  return successState(
    "Assumption saved. Re-run the calculated stages to update the forecast.",
  );
}
