"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateAssumptionAction } from "@/features/financials/actions";
import { idleState } from "@/lib/forms/action-state";
import { CURRENCIES, type CurrencyCode } from "@/features/financials/money";

/**
 * Edit one assumption.
 *
 * This is the only writable control in the entire financial feature. There is
 * no editor for revenue, profit, break-even or runway — those are outputs, and
 * a number you can type into is not a calculation. Changing an assumption here
 * promotes the row to `USER` in SQL, which is what stops a later run
 * overwriting it with a fresh proposal.
 *
 * The input takes MAJOR units and percentages, because that is what a founder
 * thinks in. The conversion to minor units and basis points happens once, in
 * the server action, so no component ever handles a value in two scales.
 */
export function AssumptionEditor({
  projectId,
  assumptionKey,
  label,
  unit,
  currency,
  currentMinor,
  currentInt,
}: {
  projectId: string;
  assumptionKey: string;
  label: string;
  unit: string;
  currency: CurrencyCode;
  currentMinor: number | null;
  currentInt: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(updateAssumptionAction, idleState);

  const isMoney = unit === "money";
  const isRate = unit === "bps";

  const scale = 10 ** CURRENCIES[currency].minorUnits;
  const defaultValue = isMoney
    ? currentMinor !== null
      ? String(currentMinor / scale)
      : ""
    : isRate
      ? currentInt !== null
        ? String(currentInt / 100)
        : ""
      : currentInt !== null
        ? String(currentInt)
        : "";

  if (!open) {
    return (
      <>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
          aria-expanded={false}
        >
          <Pencil className="size-3.5" /> Change
        </Button>
        {state.status !== "idle" && state.message ? (
          <div className="mt-2">
            <FormAlert
              variant={state.status === "success" ? "success" : "error"}
            >
              {state.message}
            </FormAlert>
          </div>
        ) : null}
      </>
    );
  }

  const fieldName = isMoney ? "amount" : "value";
  const inputId = `assumption-${assumptionKey}`;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="key" value={assumptionKey} />
      <input type="hidden" name="unit" value={unit} />

      <Label htmlFor={inputId}>
        {label}{" "}
        <span className="font-normal text-muted-strong">
          {isMoney
            ? `(${currency}, e.g. 2000)`
            : isRate
              ? "(percent, e.g. 10 for 10%)"
              : "(whole number)"}
        </span>
      </Label>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={inputId}
          name={fieldName}
          defaultValue={defaultValue}
          inputMode="decimal"
          className="w-40"
          aria-invalid={Boolean(state.fieldErrors?.[fieldName])}
        />
        <SubmitButton size="sm" pendingText="Saving…">
          Save
        </SubmitButton>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>

      <FieldError>{state.fieldErrors?.[fieldName]}</FieldError>

      {state.status === "error" && !state.fieldErrors ? (
        <FormAlert variant="error">{state.message}</FormAlert>
      ) : null}
      {state.status === "success" ? (
        <FormAlert variant="success">{state.message}</FormAlert>
      ) : null}

      <p className="text-xs text-muted-strong">
        Saving marks this as your value. Later runs will not overwrite it.
      </p>
    </form>
  );
}
