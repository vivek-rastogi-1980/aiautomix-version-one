import "server-only";

import { canAccess } from "@/features/commerce/entitlements";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";
import { COMPETITOR_ENTITLEMENT } from "@/features/competitors/constants";
import type { Workspace, WorkspaceRole } from "@/types/database";
import type { User } from "@supabase/supabase-js";

/**
 * The single gate every Competitor Intelligence surface passes through.
 *
 * Three separate questions, kept separate because they have three different
 * answers in the UI:
 *
 *   Signed in?   — handled by `requireUser`, which redirects.
 *   Entitled?    — the workspace's plan includes competitor intelligence.
 *                  Deliberately its OWN entitlement: a plan that includes
 *                  Market Research does not automatically include this.
 *   May edit?    — a Viewer reads competitor research but does not commission
 *                  it, because commissioning spends credits.
 *
 * This is the *presentation* gate. It decides which screen to show. It is not
 * the enforcement point: `competitor_create_project` re-derives edit permission
 * from `auth.uid()` in SQL, and `features/competitors/engine.ts` re-checks the
 * entitlement inside the claim transaction before it spends a credit. Deleting
 * this file would make the product rude, not insecure.
 */

export interface CompetitorAccess {
  user: User;
  workspace: Workspace;
  role: WorkspaceRole;
  /** The plan includes Competitor Intelligence. */
  entitled: boolean;
  /** Entitled AND the role is not Viewer. */
  canCreate: boolean;
  /**
   * Why access was denied, for the upgrade panel. Deliberately coarse: a denial
   * message is a place users report bugs from, so it must not become a
   * description of the billing schema.
   */
  denialReason: "not_entitled" | "read_only" | null;
}

export async function getCompetitorAccess(): Promise<CompetitorAccess> {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  const decision = await canAccess(workspace.id, COMPETITOR_ENTITLEMENT);
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
