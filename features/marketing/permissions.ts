import "server-only";

import { canAccess } from "@/features/commerce/entitlements";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";
import { GTM_ENTITLEMENT } from "@/features/marketing/constants";
import type { Workspace, WorkspaceRole } from "@/types/database";
import type { User } from "@supabase/supabase-js";

/**
 * The single gate every Marketing Intelligence surface passes through.
 *
 * Three separate questions, kept separate because they have three different
 * answers in the UI: signed in, entitled, and allowed to edit. A Viewer reads a
 * GTM plan but does not commission one — running a stage spends the
 * workspace's credits, which is not a read.
 *
 * This is the presentation gate. It is not the enforcement point:
 * `gtm_create_project` re-derives edit permission from `auth.uid()` in SQL, and
 * the engine re-checks the entitlement inside the claim transaction before it
 * spends a credit.
 */

export interface GtmAccess {
  user: User;
  workspace: Workspace;
  role: WorkspaceRole;
  entitled: boolean;
  canCreate: boolean;
  denialReason: "not_entitled" | "read_only" | null;
}

export async function getGtmAccess(): Promise<GtmAccess> {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  const decision = await canAccess(workspace.id, GTM_ENTITLEMENT);
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
