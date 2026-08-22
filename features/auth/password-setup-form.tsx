"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { idleState } from "@/lib/forms/action-state";
import { completePasswordSetupAction } from "@/features/auth/actions";

/**
 * First-run password setup.
 *
 * Mirrors `ResetPasswordForm` deliberately — same fields, same validation, same
 * components — because they are the same task for the customer and looking
 * different would only suggest they are not. The one difference is the action
 * behind it, which also clears the flag that forces this screen.
 *
 * `autoComplete="new-password"` on both fields so a password manager offers to
 * generate one rather than filling something existing.
 */
export function PasswordSetupForm() {
  const [state, formAction] = useActionState(
    completePasswordSetupAction,
    idleState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && !state.fieldErrors ? (
        <FormAlert variant="error">{state.message}</FormAlert>
      ) : null}

      <div>
        <Label htmlFor="password">Create a password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className="mt-1.5"
          aria-describedby="password-hint"
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
        <p id="password-hint" className="mt-1.5 text-xs text-muted">
          At least 8 characters. Use something you do not use elsewhere.
        </p>
        <FieldError>{state.fieldErrors?.password}</FieldError>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm password</Label>
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

      <SubmitButton className="mt-2 w-full" pendingText="Saving…">
        Save password and continue
      </SubmitButton>
    </form>
  );
}
