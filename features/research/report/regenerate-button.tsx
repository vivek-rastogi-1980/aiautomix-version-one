"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";

import { FormAlert } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { regenerateResearchReportAction } from "@/features/research/actions";
import { idleState } from "@/lib/forms/action-state";

/**
 * Rebuild the report from the evidence already gathered.
 *
 * The cost is stated on the button's own line, because the thing users need to
 * know before clicking is exactly what this does *not* do: it does not search
 * the web again. One stage is charged, not seven, and the sources stay the
 * same. A button labelled only "Regenerate" invites the reasonable fear that it
 * will re-run everything.
 */
export function RegenerateReportButton({
  requestId,
  cost,
}: {
  requestId: string;
  cost: number;
}) {
  const [state, formAction] = useActionState(
    regenerateResearchReportAction,
    idleState,
  );

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="requestId" value={requestId} />
        <SubmitButton
          variant="secondary"
          size="md"
          pendingText="Rebuilding the report…"
        >
          <RefreshCw className="size-4" /> Regenerate report
        </SubmitButton>
        <p className="text-sm text-muted">
          Rewrites the report from the evidence already gathered — no new web
          research. Costs {cost} credits.
        </p>
      </form>

      {state.status !== "idle" && state.message ? (
        <FormAlert variant={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FormAlert>
      ) : null}
    </div>
  );
}
