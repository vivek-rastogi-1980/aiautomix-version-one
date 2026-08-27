"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { businessIdeaSchema } from "@/lib/validations/business-idea";
import {
  AiError,
  isPlatformConfigured,
  toAiError,
  validateBusinessIdea,
} from "@/features/ai";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { EntitlementError } from "@/features/commerce/errors";
import { canEdit } from "@/features/workspaces/roles";
import {
  type ActionState,
  errorState,
  zodFieldErrors,
} from "@/lib/forms/action-state";

/**
 * Submit a business idea and generate its validation report.
 *
 * The React form never touches a model provider — it calls this action, which
 * delegates to the Business Validator service and, through it, the AI Platform.
 */
export async function submitBusinessIdeaAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = businessIdeaSchema.safeParse({
    businessName: formData.get("businessName"),
    ideaDescription: formData.get("ideaDescription"),
    industry: formData.get("industry"),
    country: formData.get("country"),
    targetAudience: formData.get("targetAudience"),
    businessModel: formData.get("businessModel"),
    estimatedBudget: formData.get("estimatedBudget"),
    currentStage: formData.get("currentStage"),
    timeline: formData.get("timeline") ?? "",
    competitors: formData.get("competitors") ?? "",
    additionalNotes: formData.get("additionalNotes") ?? "",
    projectId: formData.get("projectId") ?? "",
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

  const { workspace, role } = await getWorkspaceContext(user.id);
  if (!canEdit(role)) {
    return errorState("Your role in this workspace is read-only.");
  }

  // The draft the funnel created for this customer, when the form was opened
  // from it. Passed through so the run updates that row rather than inserting
  // a second idea and leaving the original stranded as a draft forever.
  // Ownership is verified in the service, under the caller's own RLS — a value
  // arriving from a form is never trusted as authorisation.
  const draftIdeaId = formData.get("draftIdeaId");

  let reportId: string;
  try {
    const outcome = await validateBusinessIdea(
      user.id,
      workspace.id,
      parsed.data,
      typeof draftIdeaId === "string" && draftIdeaId ? draftIdeaId : null,
    );
    reportId = outcome.report.id;
  } catch (error) {
    // An entitlement refusal is a product outcome, not a provider fault, and it
    // already carries copy naming the usage, the limit and what to do next.
    // Passing it through `toAiError` would replace that with a generic "the AI
    // service failed", which is both wrong and unactionable.
    if (error instanceof EntitlementError) {
      return errorState(error.message);
    }

    const aiError = toAiError(error);
    console.error("[business-validator] run failed", {
      code: aiError.code,
      message: aiError.message,
    });
    return errorState(aiError.userMessage);
  }

  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect(`/reports/${reportId}`);
}
