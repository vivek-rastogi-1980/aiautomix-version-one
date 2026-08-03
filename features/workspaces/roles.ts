import type { WorkspaceRole } from "@/types/database";

/**
 * Workspace role model (WORKSPACE-ARCHITECTURE.md: Owner, Admin, Member, Viewer).
 *
 * These predicates mirror the `can_edit_workspace` / `can_manage_workspace`
 * functions in migration 0004. **The database is the enforcement point** — Row
 * Level Security decides what a request may actually do. What lives here is the
 * UI's copy of the rules, used to hide affordances a user cannot use, so they
 * never meet an error they could have been spared.
 *
 * If these two ever disagree, the SQL wins and this file is the bug.
 */

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
  owner: "Full control, including deleting the workspace.",
  admin: "Manages the workspace and its members.",
  member: "Creates and edits work in the workspace.",
  viewer: "Read-only access to everything in the workspace.",
};

/** Badge variants from `components/ui/badge`. */
export const ROLE_BADGE: Record<
  WorkspaceRole,
  "brand" | "active" | "completed" | "neutral"
> = {
  owner: "brand",
  admin: "active",
  member: "completed",
  viewer: "neutral",
};

const EDIT_ROLES: readonly WorkspaceRole[] = ["owner", "admin", "member"];
const MANAGE_ROLES: readonly WorkspaceRole[] = ["owner", "admin"];

/** Owner, Admin and Member may create and edit. Viewer is read-only. */
export function canEdit(role: WorkspaceRole | null): boolean {
  return role !== null && EDIT_ROLES.includes(role);
}

/** Owner and Admin may rename the workspace and manage members. */
export function canManage(role: WorkspaceRole | null): boolean {
  return role !== null && MANAGE_ROLES.includes(role);
}
