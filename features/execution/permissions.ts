import "server-only";

import { canAccess } from "@/features/commerce/entitlements";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canEdit } from "@/features/workspaces/roles";
import { requireUser } from "@/lib/auth/session";
import { EXECUTION_ENTITLEMENT } from "@/features/execution/constants";
import type { Workspace, WorkspaceRole } from "@/types/database";
import type { User } from "@supabase/supabase-js";

/**
 * The single gate every Business Execution surface passes through.
 *
 * Four questions rather than the usual three, because execution adds one that
 * the read-only features do not have: approving an action is a materially
 * different act from creating one. A Viewer may read what is planned and what
 * was approved — that transparency is the point of an audit trail — but may
 * neither commission an action nor sign off on one that changes the world.
 *
 * This is the presentation gate. It is not the enforcement point: every RPC in
 * migration 0018 re-derives the caller's workspace role from `auth.uid()`, and
 * the execution service re-checks the entitlement before it dispatches.
 */

export interface ExecutionAccess {
  user: User;
  workspace: Workspace;
  role: WorkspaceRole;
  entitled: boolean;
  /** May create plans and actions. */
  canCreate: boolean;
  /** May approve an action that changes something outside AIAutoMix. */
  canApprove: boolean;
  /** May dispatch an approved action. */
  canExecute: boolean;
  denialReason: "not_entitled" | "read_only" | null;
}

export async function getExecutionAccess(): Promise<ExecutionAccess> {
  const user = await requireUser();
  const { workspace, role } = await getWorkspaceContext(user.id);

  const decision = await canAccess(workspace.id, EXECUTION_ENTITLEMENT);
  const entitled = decision.allowed;
  const editable = canEdit(role);

  return {
    user,
    workspace,
    role,
    entitled,
    canCreate: entitled && editable,
    // Approval and execution carry the same requirement today. They are
    // separate fields because they are separate decisions, and a later phase
    // that wants "any editor may draft, only an owner may approve" changes one
    // line here rather than hunting for approval checks across the UI.
    canApprove: entitled && editable,
    canExecute: entitled && editable,
    denialReason: !entitled ? "not_entitled" : !editable ? "read_only" : null,
  };
}
