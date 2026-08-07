"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  AiError,
  generateBusinessPlan,
  isPlatformConfigured,
  toAiError,
} from "@/features/ai";
import {
  getPlanSectionRow,
  getPlanVersion,
  saveSectionRevision,
  VersionConflictError,
} from "@/features/business-plans/data";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";
import {
  errorState,
  successState,
  zodFieldErrors,
  type ActionState,
} from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";
import {
  businessPlanInputSchema,
  planSectionContentSchema,
} from "@/lib/validations/business-plan";

/**
 * Business plan Server Actions.
 *
 * Each one re-derives the workspace and role from the session rather than
 * trusting a form field — a workspace id posted by the client would be an
 * authorisation hole. RLS would still refuse, but failing here gives the user a
 * sentence instead of a database error.
 */

const READ_ONLY = "Your role in this workspace is read-only.";

function revalidatePlan(planId?: string) {
  revalidatePath("/plans");
  revalidatePath("/dashboard");
  revalidatePath("/workspace");
  if (planId) revalidatePath(`/plans/${planId}`);
}

/** Generate a plan from the brief, then open it. */
export async function generateBusinessPlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  if (!canEdit(role)) return errorState(READ_ONLY);

  const parsed = businessPlanInputSchema.safeParse({
    businessName: formData.get("businessName"),
    ideaDescription: formData.get("ideaDescription"),
    industry: formData.get("industry"),
    country: formData.get("country"),
    targetAudience: formData.get("targetAudience"),
    businessModel: formData.get("businessModel"),
    currentStage: formData.get("currentStage"),
    estimatedBudget: formData.get("estimatedBudget"),
    fundingGoal: formData.get("fundingGoal") ?? "",
    timeline: formData.get("timeline") ?? "",
    competitors: formData.get("competitors") ?? "",
    teamSummary: formData.get("teamSummary") ?? "",
    additionalNotes: formData.get("additionalNotes") ?? "",
    projectId: formData.get("projectId") ?? "",
    businessIdeaId: formData.get("businessIdeaId") ?? "",
  });

  if (!parsed.success) {
    return errorState(
      "Please fix the errors below.",
      zodFieldErrors(parsed.error),
    );
  }

  if (!isPlatformConfigured()) {
    return errorState(new AiError("AI_NOT_CONFIGURED").userMessage);
  }

  let planId: string;
  try {
    const outcome = await generateBusinessPlan({
      userId: user.id,
      workspaceId: workspace.id,
      input: parsed.data,
    });
    planId = outcome.plan.id;
  } catch (error) {
    const aiError = toAiError(error);
    console.error("[business-plan] generation failed", {
      code: aiError.code,
      message: aiError.message,
    });
    return errorState(aiError.userMessage);
  }

  revalidatePlan(planId);
  redirect(`/plans/${planId}`);
}

/** Save a hand-edited section as the next revision. */
export async function updatePlanSectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  if (!canEdit(role)) return errorState(READ_ONLY);

  const sectionId = formData.get("sectionId");
  if (typeof sectionId !== "string" || !sectionId) {
    return errorState("Missing section id.");
  }

  const parsed = planSectionContentSchema.safeParse({
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return errorState(
      "Please fix the errors below.",
      zodFieldErrors(parsed.error),
    );
  }

  const section = await getPlanSectionRow(workspace.id, sectionId);
  if (!section) return errorState("Section not found.");

  if (section.content === parsed.data.content) {
    return successState("No changes to save.");
  }

  try {
    await saveSectionRevision({
      section,
      content: parsed.data.content,
      source: "user",
      userId: user.id,
    });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return errorState(error.message);
    }
    console.error("[business-plan] section update failed", error);
    return errorState("Could not save the section. Please try again.");
  }

  revalidatePlan(section.plan_id);
  return successState("Section saved.");
}

/**
 * Restore an earlier revision. This writes the old content forward as a *new*
 * version rather than rewinding the counter, so history stays append-only and
 * the restore itself is auditable.
 */
export async function restorePlanSectionVersionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  if (!canEdit(role)) return errorState(READ_ONLY);

  const versionId = formData.get("versionId");
  if (typeof versionId !== "string" || !versionId) {
    return errorState("Missing version id.");
  }

  const version = await getPlanVersion(workspace.id, versionId);
  if (!version) return errorState("That revision no longer exists.");

  const section = await getPlanSectionRow(workspace.id, version.section_id);
  if (!section) return errorState("Section not found.");

  if (section.content === version.content) {
    return successState("That revision is already the current content.");
  }

  try {
    await saveSectionRevision({
      section,
      content: version.content,
      source: version.source,
      userId: user.id,
    });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return errorState(error.message);
    }
    console.error("[business-plan] restore failed", error);
    return errorState("Could not restore the revision. Please try again.");
  }

  revalidatePlan(section.plan_id);
  return successState(`Restored version ${version.version}.`);
}

/** Soft-delete a plan. History and sections are retained. */
export async function deleteBusinessPlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  if (!canEdit(role)) return errorState(READ_ONLY);

  const planId = formData.get("planId");
  if (typeof planId !== "string" || !planId) {
    return errorState("Missing plan id.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("business_plans")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null);

  if (error) {
    return errorState("Could not delete the plan. Please try again.");
  }

  revalidatePlan(planId);
  return successState("Plan deleted.");
}
