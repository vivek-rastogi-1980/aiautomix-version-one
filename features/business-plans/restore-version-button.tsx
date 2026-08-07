"use client";

import { useActionState } from "react";
import { Undo2 } from "lucide-react";

import { SubmitButton } from "@/components/ui/submit-button";
import { restorePlanSectionVersionAction } from "@/features/business-plans/actions";
import { idleState } from "@/lib/forms/action-state";

interface RestoreVersionButtonProps {
  versionId: string;
  version: number;
}

/**
 * Restores one revision. Each row owns its own action state so a failure
 * reports against the revision the user actually clicked.
 */
export function RestoreVersionButton({
  versionId,
  version,
}: RestoreVersionButtonProps) {
  const [state, formAction] = useActionState(
    restorePlanSectionVersionAction,
    idleState,
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="versionId" value={versionId} />
      <SubmitButton variant="ghost" size="sm" pendingText="Restoring…">
        <Undo2 className="size-4" />
        <span className="sr-only">Restore version {version}</span>
        <span aria-hidden>Restore</span>
      </SubmitButton>
      {state.status === "error" && state.message ? (
        <p role="alert" className="text-xs text-danger-soft">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
