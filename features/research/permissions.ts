import "server-only";

import { canAccess } from "@/features/commerce/entitlements";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";
import type { Workspace, WorkspaceRole } from "@/types/database";
import type { User } from "@supabase/supabase-js";

/**
 * The single gate every Market Research surface passes through.
 *
 * Three separate questions, kept separate because they have three different
 * answers in the UI:
 *
 *   Signed in?   — handled by `requireUser`, which redirects.
 *   Entitled?    — the workspace's plan includes `market_research`.
 *   May edit?    — a Viewer reads research but does not commission it.
 *
 * This is the *presentation* gate. It decides which screen to show. It is not
 * the enforcement point: `research_create_request` re-derives edit permission
 * from `auth.uid()` in SQL, and `features/research/engine.ts` re-checks the
 * entitlement inside the claim transaction before it spends a credit. Deleting
 * this file would make the product rude, not insecure.
 */

export interface ResearchAccess {
  user: User;
  workspace: Workspace;
  role: WorkspaceRole;
  /** The plan includes Market Research. */
  entitled: boolean;
  /** Entitled AND the role is not Viewer. */
  canCreate: boolean;
  /**
   * Why access was denied, for the upgrade panel. Deliberately coarse: the
   * spec forbids exposing internal entitlement implementation details, so the
   * user is told they need a plan with Market Research, not which lookup
   * failed.
   */
  denialReason: "not_entitled" | "read_only" | null;
}

export async function getResearchAccess(): Promise<ResearchAccess> {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  const decision = await canAccess(workspace.id, "market_research");
  const entitled = decision.allowed;
  const editable = canEdit(role);

  return {
    user,
    workspace,
    role,
    entitled,
    canCreate: entitled && editable,
    denialReason: !entitled ? "not_entitled" : !editable ? "read_only" : null,
  };
}
