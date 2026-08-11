"use client";

import { ActionForm } from "@/features/admin/action-form";
import {
  setUserSuspended,
  setWorkspaceSuspended,
  applyCredits,
} from "@/features/admin/actions";

/**
 * Client wrappers binding `ActionForm` to each Server Action.
 *
 * These exist so the detail pages stay Server Components: only the small
 * interactive control ships JavaScript, not the page around it.
 *
 * None of these components decides anything. Each one collects a reason and
 * forwards it; the permission check and the audit write happen server-side and
 * then again inside Postgres.
 */

export function UserSuspendControl({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  return (
    <ActionForm
      label={suspended ? "Restore user" : "Suspend user"}
      destructive={!suspended}
      confirmTitle={suspended ? "Restore this user?" : "Suspend this user?"}
      confirmBody={
        suspended
          ? "They regain access immediately. This is recorded in the audit log."
          : "They keep all their data but lose access. This is reversible and recorded in the audit log."
      }
      confirmLabel={suspended ? "Restore" : "Suspend"}
      reasonRequired={!suspended}
      reasonPlaceholder={
        suspended
          ? "Why are you restoring access?"
          : "Why are you suspending them?"
      }
      onSubmit={({ reason }) =>
        setUserSuspended({ userId, suspended: !suspended, reason })
      }
    />
  );
}

export function WorkspaceSuspendControl({
  workspaceId,
  suspended,
}: {
  workspaceId: string;
  suspended: boolean;
}) {
  return (
    <ActionForm
      label={suspended ? "Restore workspace" : "Suspend workspace"}
      destructive={!suspended}
      confirmTitle={
        suspended ? "Restore this workspace?" : "Suspend this workspace?"
      }
      confirmBody={
        suspended
          ? "Members regain access immediately. Recorded in the audit log."
          : "Every member loses access. No data is deleted and this can be undone."
      }
      confirmLabel={suspended ? "Restore" : "Suspend"}
      reasonRequired={!suspended}
      onSubmit={({ reason }) =>
        setWorkspaceSuspended({ workspaceId, suspended: !suspended, reason })
      }
    />
  );
}

/**
 * Credit movement.
 *
 * Three separate controls rather than one form with a dropdown: the operator
 * picks the intent by choosing a button, so "grant 500" and "adjust -500"
 * cannot be confused at the moment of acting. The sign is applied server-side
 * from the chosen kind.
 */
export function CreditControls({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="flex flex-col gap-3">
      <ActionForm
        label="Grant credits"
        confirmTitle="Grant credits"
        confirmBody="Adds credits to this workspace's balance."
        confirmLabel="Grant"
        amount={{ label: "Credits to grant", placeholder: "500" }}
        reasonPlaceholder="e.g. goodwill after the 12 Aug outage"
        onSubmit={({ reason, amount }) =>
          applyCredits({
            workspaceId,
            kind: "GRANT",
            amount: amount ?? 0,
            reason,
          })
        }
      />
      <ActionForm
        label="Refund credits"
        confirmTitle="Refund credits"
        confirmBody="Returns credits consumed by work that failed or was not delivered."
        confirmLabel="Refund"
        amount={{ label: "Credits to refund", placeholder: "50" }}
        reasonPlaceholder="e.g. refund for failed plan generation"
        onSubmit={({ reason, amount }) =>
          applyCredits({
            workspaceId,
            kind: "REFUND",
            amount: amount ?? 0,
            reason,
          })
        }
      />
      <ActionForm
        label="Manual adjustment"
        destructive
        confirmTitle="Adjust the balance"
        confirmBody="Corrects a balance in either direction. Use a negative number to remove credits. The ledger keeps both the original entry and this correction."
        confirmLabel="Apply adjustment"
        amount={{
          label: "Amount (negative removes)",
          placeholder: "-100",
          allowNegative: true,
        }}
        reasonPlaceholder="e.g. reversing a duplicate grant from 10 Aug"
        onSubmit={({ reason, amount }) =>
          applyCredits({
            workspaceId,
            kind: "ADJUSTMENT",
            amount: amount ?? 0,
            reason,
          })
        }
      />
    </div>
  );
}
