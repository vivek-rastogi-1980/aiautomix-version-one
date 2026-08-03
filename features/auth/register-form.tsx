"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { idleState } from "@/lib/forms/action-state";
import { signUpAction } from "@/features/auth/actions";

export function RegisterForm() {
  const [state, formAction] = useActionState(signUpAction, idleState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && !state.fieldErrors ? (
        <FormAlert variant="error">{state.message}</FormAlert>
      ) : null}

      <div>
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          placeholder="Ada Lovelace"
          className="mt-1.5"
          aria-invalid={Boolean(state.fieldErrors?.fullName)}
        />
        <FieldError>{state.fieldErrors?.fullName}</FieldError>
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
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

      <div>
        <Label htmlFor="password">Password</Label>
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

      <SubmitButton className="mt-2 w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
