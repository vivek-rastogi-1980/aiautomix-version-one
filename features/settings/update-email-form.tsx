"use client";

import { useActionState } from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { idleState } from "@/lib/forms/action-state";
import { updateEmailAction } from "@/features/settings/actions";

export function UpdateEmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction] = useActionState(updateEmailAction, idleState);

  return (
    <Card className="p-6 sm:p-7">
      <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
        Email address
      </h2>
      <p className="mt-1 text-sm text-muted">
        Your current email is{" "}
        <span className="text-foreground">{currentEmail}</span>.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4" noValidate>
        {state.status === "success" ? (
          <FormAlert variant="success">{state.message}</FormAlert>
        ) : null}
        {state.status === "error" && !state.fieldErrors ? (
          <FormAlert variant="error">{state.message}</FormAlert>
        ) : null}

        <div>
          <Label htmlFor="email">New email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className="mt-1.5"
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
          <FieldError>{state.fieldErrors?.email}</FieldError>
        </div>

        <div className="flex justify-end">
          <SubmitButton pendingText="Sending…">Update email</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
