import "server-only";

import { canAccess } from "@/features/commerce/entitlements";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";
import { FINANCIAL_ENTITLEMENT } from "@/features/financials/constants";
import type { Workspace, WorkspaceRole } from "@/types/database";
import type { User } from "@supabase/supabase-js";

/**
 * The single gate every Financial Intelligence surface passes through.
 *
 * Three separate questions, kept separate because they have three different
 * answers in the UI: signed in, entitled, and allowed to edit. A Viewer reads a
 * financial model but does not commission one and does not change assumptions —
 * changing an assumption changes every downstream figure, so it is an edit.
 *
 * This is the presentation gate. It is not the enforcement point:
 * `financial_create_project` and `financial_set_assumption` re-derive edit
 * permission from `auth.uid()` in SQL, and the engine re-checks the entitlement
 * inside the claim transaction before it spends a credit.
 */

export interface FinancialAccess {
  user: User;
  workspace: Workspace;
  role: WorkspaceRole;
  entitled: boolean;
  canCreate: boolean;
  denialReason: "not_entitled" | "read_only" | null;
}

export async function getFinancialAccess(): Promise<FinancialAccess> {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  const decision = await canAccess(workspace.id, FINANCIAL_ENTITLEMENT);
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
