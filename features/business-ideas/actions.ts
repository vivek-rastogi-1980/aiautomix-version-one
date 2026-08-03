"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { businessIdeaSchema } from "@/lib/validations/business-idea";
import { validateBusinessIdea } from "@/features/ai/services/business-validator";
import { AiError, toAiError } from "@/features/ai/engine/errors";
import { isPlatformConfigured } from "@/features/ai/providers";
import { getWorkspaceContext } from "@/features/workspaces/data";
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

  let reportId: string;
  try {
    const outcome = await validateBusinessIdea(
      user.id,
      workspace.id,
      parsed.data,
    );
    reportId = outcome.report.id;
  } catch (error) {
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
