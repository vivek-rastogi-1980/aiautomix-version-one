"use client";

import { useActionState } from "react";
import { Pause, Play, Square } from "lucide-react";

import { SubmitButton } from "@/components/ui/submit-button";
import { FormAlert } from "@/components/ui/form-message";
import { setExecutionPlanStatusAction } from "@/features/execution/actions";
import type { PlanStatus } from "@/features/execution/types";
import { idleState } from "@/lib/forms/action-state";

/**
 * Pause, resume and cancel — for the whole plan.
 *
 * §27 asks for Pause. Pausing the PLAN rather than each action is the useful
 * granularity: the thing a founder wants when something looks wrong at 2am is
 * "stop everything", not "stop these six things one at a time".
 *
 * The refusal is enforced in SQL as well as here — `execution_transition`
 * refuses to move any action into EXECUTING while its plan is not ACTIVE — so
 * pausing is a real brake and not a hidden button.
 */
export function PlanStatusControls({
  planId,
  status,
}: {
  planId: string;
  status: PlanStatus;
}) {
  const [state, formAction] = useActionState(
    setExecutionPlanStatusAction,
    idleState,
  );

  if (status === "CANCELLED") {
    return (
      <p className="text-sm text-muted">
        This plan was cancelled and cannot be changed.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {status === "ACTIVE" ? (
          <form action={formAction}>
            <input type="hidden" name="planId" value={planId} />
            <input type="hidden" name="status" value="PAUSED" />
            <SubmitButton size="sm" variant="secondary">
              <Pause className="size-4" /> Pause plan
            </SubmitButton>
          </form>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="planId" value={planId} />
            <input type="hidden" name="status" value="ACTIVE" />
            <SubmitButton size="sm">
              <Play className="size-4" /> Resume plan
            </SubmitButton>
          </form>
        )}

        <form action={formAction}>
          <input type="hidden" name="planId" value={planId} />
          <input type="hidden" name="status" value="CANCELLED" />
          <SubmitButton size="sm" variant="ghost">
            <Square className="size-4" /> Cancel plan
          </SubmitButton>
        </form>
      </div>

      {state.message ? (
        <FormAlert variant={state.status === "error" ? "error" : "success"}>
          {state.message}
        </FormAlert>
      ) : null}
    </div>
  );
}
