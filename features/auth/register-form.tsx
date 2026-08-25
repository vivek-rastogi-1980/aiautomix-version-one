"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { idleState } from "@/lib/forms/action-state";
import { activateAccountAction, signUpAction } from "@/features/auth/actions";

/**
 * One form, two jobs.
 *
 * ---------------------------------------------------------------------------
 * Plain registration
 * ---------------------------------------------------------------------------
 * Somebody who walks up to /register fills in everything and gets the existing
 * `signUpAction`, which sends a verification email. Unchanged.
 *
 * ---------------------------------------------------------------------------
 * Finishing an emailed activation
 * ---------------------------------------------------------------------------
 * A visitor arriving from a funnel email carries a one-time token in the URL.
 * Their name and address are prefilled from what they already typed, and the
 * form calls `activateAccountAction`, which exchanges the token and sets the
 * password in one step. No second confirmation email: the token proves the
 * address, so asking them to confirm it again is friction with no security
 * value.
 *
 * The email box is READ-ONLY in that mode. The account is resolved from the
 * token, never from this field, so an editable box would be a lie — typing a
 * different address would change nothing about which account gets the
 * password. Read-only says that honestly. It is a `readOnly` input rather than
 * `disabled` so screen readers still announce it and the value stays visible.
 */

export interface RegisterFormProps {
  /** Present only when arriving from an activation email. */
  tokenHash?: string;
  tokenType?: string;
  defaultEmail?: string;
  defaultName?: string;
  next?: string;
}

export function RegisterForm({
  tokenHash,
  tokenType,
  defaultEmail,
  defaultName,
  next,
}: RegisterFormProps) {
  const activating = Boolean(tokenHash && tokenType);

  const [state, formAction] = useActionState(
    activating ? activateAccountAction : signUpAction,
    idleState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.status === "error" && !state.fieldErrors ? (
        <FormAlert variant="error">{state.message}</FormAlert>
      ) : null}

      {activating ? (
        <>
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={tokenType} />
          <input type="hidden" name="next" value={next ?? "/dashboard"} />
        </>
      ) : null}

      <div>
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          placeholder="Ada Lovelace"
          className="mt-1.5"
          defaultValue={defaultName ?? ""}
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
          defaultValue={defaultEmail ?? ""}
          readOnly={activating}
          aria-describedby={activating ? "email-locked" : undefined}
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
        {activating ? (
          <p id="email-locked" className="mt-1.5 text-xs text-muted">
            This is the address we sent your link to.
          </p>
        ) : null}
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

      <SubmitButton
        className="mt-2 w-full"
        pendingText={
          activating ? "Opening your workspace…" : "Creating account…"
        }
      >
        {activating ? "Set password and continue" : "Create account"}
      </SubmitButton>
    </form>
  );
}
