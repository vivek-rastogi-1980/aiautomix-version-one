"use server";

import { revalidatePath } from "next/cache";

import { getWorkspaceContext } from "@/features/workspaces/data";
import { canManage } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";
import {
  errorState,
  successState,
  zodFieldErrors,
  type ActionState,
} from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";
import { workspaceSchema } from "@/lib/validations/workspace";

/**
 * Rename the current workspace. Owner and Admin only — the role check here is
 * an early, friendly rejection; RLS enforces it regardless.
 */
export async function renameWorkspaceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  if (!canManage(role)) {
    return errorState("Only an owner or admin can rename this workspace.");
  }

  const parsed = workspaceSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return errorState(
      "Please fix the errors below.",
      zodFieldErrors(parsed.error),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ name: parsed.data.name })
    .eq("id", workspace.id);

  if (error) {
    return errorState("Could not rename the workspace. Please try again.");
  }

  revalidatePath("/workspace");
  revalidatePath("/dashboard");
  return successState("Workspace renamed.");
}
