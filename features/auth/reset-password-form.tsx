"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { idleState } from "@/lib/forms/action-state";
import { updatePasswordAction } from "@/features/auth/actions";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, idleState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
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

      <SubmitButton className="mt-2 w-full" pendingText="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
