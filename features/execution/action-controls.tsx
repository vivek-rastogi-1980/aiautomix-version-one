"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-message";
import type { ActionState } from "@/features/execution/types";

/**
 * The action controls.
 *
 * ---------------------------------------------------------------------------
 * What this component is NOT allowed to decide
 * ---------------------------------------------------------------------------
 * It renders buttons based on state, but it does not enforce anything. Every
 * button posts to an endpoint that re-derives the state, the approval and the
 * entitlement from the database and refuses on its own terms.
 *
 * That distinction matters because a UI check is a usability feature and a
 * server check is a security control, and the two are constantly mistaken for
 * each other. If this component were compromised — or simply wrong — the worst
 * outcome is a button that returns an error, not an action that runs unapproved.
 *
 * It also sends no state, no provider, no attempt number and no idempotency
 * key. There is nothing in any request body here that the server trusts.
 */

interface ActionControlsProps {
  actionId: string;
  state: ActionState;
  approvalRequired: boolean;
  retryCount: number;
  attemptsAllowed: number;
  errorCode: string | null;
  canApprove: boolean;
  canExecute: boolean;
  /** False when the plan is paused or cancelled. */
  planActive: boolean;
}

interface Outcome {
  ok: boolean;
  message: string;
  deduplicated?: boolean;
  externalId?: string | null;
  durationMs?: number | null;
  dryRun?: boolean;
}

export function ActionControls({
  actionId,
  state,
  approvalRequired,
  retryCount,
  attemptsAllowed,
  errorCode,
  canApprove,
  canExecute,
  planActive,
}: ActionControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const working = busy || pending;

  async function post(path: string, body?: Record<string, unknown>) {
    setBusy(true);
    setOutcome(null);

    try {
      const response = await fetch(
        `/api/execution-actions/${actionId}/${path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
        },
      );

      const payload = (await response.json()) as {
        success?: boolean;
        data?: Record<string, unknown>;
        error?: { message?: string };
      };

      const data = payload.data ?? {};

      if (payload.success === false && payload.error) {
        setOutcome({
          ok: false,
          message: payload.error.message ?? "That did not work.",
        });
      } else {
        // The execute/retry endpoints report their own success inside `data`,
        // because a refused execution is a handled request, not a broken one.
        const innerOk =
          data.success === undefined ? true : data.success === true;
        setOutcome({
          ok: innerOk,
          message:
            (data.message as string) ??
            (innerOk ? "Done." : "That did not work."),
          deduplicated: data.deduplicated === true,
          externalId: (data.externalId as string | null) ?? null,
          durationMs: (data.durationMs as number | null) ?? null,
          dryRun: data.dryRun === true,
        });
      }
    } catch {
      setOutcome({
        ok: false,
        message:
          "The request could not reach the server. Nothing was changed — try again.",
      });
    } finally {
      setBusy(false);
      startTransition(() => router.refresh());
    }
  }

  const attemptsLeft = attemptsAllowed - retryCount;
  const retryable =
    state === "FAILED" &&
    attemptsLeft > 0 &&
    [
      "NETWORK_ERROR",
      "PROVIDER_TIMEOUT",
      "PROVIDER_UNAVAILABLE",
      "RATE_LIMITED",
    ].includes(errorCode ?? "");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {state === "DRAFT" && canExecute ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={working}
            onClick={() => submitTransition("READY")}
          >
            <Check className="size-4" /> Mark ready
          </Button>
        ) : null}

        {state === "READY" && approvalRequired && canExecute ? (
          <Button
            size="sm"
            disabled={working}
            onClick={() => submitTransition("AWAITING_APPROVAL")}
          >
            <Send className="size-4" /> Send for approval
          </Button>
        ) : null}

        {state === "READY" && !approvalRequired && canExecute ? (
          <Button
            size="sm"
            disabled={working || !planActive}
            onClick={() => post("execute")}
          >
            {working ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Run
          </Button>
        ) : null}

        {state === "AWAITING_APPROVAL" && canApprove ? (
          <>
            <Button
              size="sm"
              disabled={working}
              onClick={() => post("approve", { decision: "approve" })}
            >
              <ShieldCheck className="size-4" /> Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={working}
              onClick={() => post("approve", { decision: "reject" })}
            >
              <X className="size-4" /> Reject
            </Button>
          </>
        ) : null}

        {state === "APPROVED" && canExecute ? (
          <Button
            size="sm"
            disabled={working || !planActive}
            onClick={() => post("execute")}
          >
            {working ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Execute
          </Button>
        ) : null}

        {retryable && canExecute ? (
          <Button
            size="sm"
            disabled={working || !planActive}
            onClick={() => post("retry")}
          >
            <RotateCcw className="size-4" /> Retry ({attemptsLeft} left)
          </Button>
        ) : null}

        {!["COMPLETED", "CANCELLED", "EXECUTING"].includes(state) &&
        canExecute ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={working}
            onClick={() => post("cancel")}
          >
            Cancel
          </Button>
        ) : null}
      </div>

      {state === "FAILED" && !retryable ? (
        <p className="text-xs text-muted">
          {attemptsLeft <= 0
            ? `This action used all ${attemptsAllowed} attempts.`
            : "This failure will not be fixed by trying again. Correct the action instead."}
        </p>
      ) : null}

      {!planActive && ["READY", "APPROVED", "FAILED"].includes(state) ? (
        <p className="text-xs text-accent-lime">
          This plan is paused, so nothing in it can run. Resume the plan first.
        </p>
      ) : null}

      {outcome ? (
        <FormAlert variant={outcome.ok ? "success" : "error"}>
          <span className="block">{outcome.message}</span>
          {outcome.dryRun && outcome.ok ? (
            <span className="mt-1 block text-xs opacity-90">
              Dry run — the mock provider handled this. Nothing was published,
              sent or changed outside AIAutoMix.
            </span>
          ) : null}
          {outcome.deduplicated ? (
            <span className="mt-1 block text-xs opacity-90">
              An identical execution was already recorded, so this did not run a
              second time.
            </span>
          ) : null}
          {outcome.externalId ? (
            <span className="mt-1 block text-xs opacity-90">
              Reference: {outcome.externalId}
              {outcome.durationMs !== null && outcome.durationMs !== undefined
                ? ` · ${outcome.durationMs}ms`
                : ""}
            </span>
          ) : null}
        </FormAlert>
      ) : null}
    </div>
  );

  function submitTransition(to: "READY" | "AWAITING_APPROVAL") {
    void post("transition", { to });
  }
}
