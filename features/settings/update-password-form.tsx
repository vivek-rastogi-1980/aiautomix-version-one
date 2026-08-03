"use client";

import { useActionState } from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { idleState } from "@/lib/forms/action-state";
import { changePasswordAction } from "@/features/settings/actions";

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, idleState);

  return (
    <Card className="p-6 sm:p-7">
      <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
        Password
      </h2>
      <p className="mt-1 text-sm text-muted">
        Choose a strong password you don&apos;t use elsewhere.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4" noValidate>
        {state.status === "success" ? (
          <FormAlert variant="success">{state.message}</FormAlert>
        ) : null}
        {state.status === "error" && !state.fieldErrors ? (
          <FormAlert variant="error">{state.message}</FormAlert>
        ) : null}

        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="mt-1.5"
            aria-invalid={Boolean(state.fieldErrors?.password)}
          />
          <FieldError>{state.fieldErrors?.password}</FieldError>
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            className="mt-1.5"
            aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
          />
          <FieldError>{state.fieldErrors?.confirmPassword}</FieldError>
        </div>

        <div className="flex justify-end">
          <SubmitButton pendingText="Updating…">Update password</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
