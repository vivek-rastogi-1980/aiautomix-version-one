"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { projectSchema } from "@/lib/validations/project";
import type { ProjectStatus } from "@/types/database";
import {
  type ActionState,
  errorState,
  successState,
  zodFieldErrors,
} from "@/lib/forms/action-state";

/**
 * Projects are workspace content, so every mutation checks the caller's role —
 * the same guard `features/business-plans/actions.ts` and
 * `features/business-ideas/actions.ts` already applied. Projects were the one
 * mutation path that skipped it, relying solely on the owner-only write policy
 * in RLS.
 *
 * That is sound today only because workspaces are all personal, which makes
 * every caller an Owner. The moment invitations land, a Viewer could create a
 * project *into* a workspace they are only supposed to read: the insert names
 * themselves as `user_id`, so the owner-only policy allows it. Closing it now
 * costs nothing — `canEdit` is true for every existing user — and means the
 * invitation flow does not have to remember to come back here.
 */
const READ_ONLY = "Your role in this workspace is read-only.";

function parseForm(formData: FormData) {
  return projectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    status: formData.get("status") ?? "active",
    website: formData.get("website") ?? "",
  });
}

function revalidateProjects() {
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

/** Create a new project owned by the current user. */
export async function createProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return errorState(
      "Please fix the errors below.",
      zodFieldErrors(parsed.error),
    );
  }

  // Sprint 5: new projects join the caller's workspace.
  const { workspace, role } = await getWorkspaceContext(user.id);
  if (!canEdit(role)) return errorState(READ_ONLY);

  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert({
    user_id: user.id,
    workspace_id: workspace.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    status: parsed.data.status as ProjectStatus,
    website: parsed.data.website || null,
  });

  if (error) {
    return errorState("Could not create the project. Please try again.");
  }

  revalidateProjects();
  return successState("Project created.");
}

/** Update an existing project (owner-only, enforced by RLS). */
export async function updateProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return errorState("Missing project id.");
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return errorState(
      "Please fix the errors below.",
      zodFieldErrors(parsed.error),
    );
  }

  const { role } = await getWorkspaceContext(user.id);
  if (!canEdit(role)) return errorState(READ_ONLY);

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      status: parsed.data.status as ProjectStatus,
      website: parsed.data.website || null,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) {
    return errorState("Could not update the project. Please try again.");
  }

  revalidateProjects();
  return successState("Project updated.");
}

/** Soft-delete a project by setting `deleted_at` (owner-only). */
export async function deleteProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return errorState("Missing project id.");
  }

  const { role } = await getWorkspaceContext(user.id);
  if (!canEdit(role)) return errorState(READ_ONLY);

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) {
    return errorState("Could not delete the project. Please try again.");
  }

  revalidateProjects();
  return successState("Project deleted.");
}
