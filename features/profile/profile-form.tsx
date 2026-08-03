"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { Card } from "@/components/ui/card";
import { idleState } from "@/lib/forms/action-state";
import { updateProfileAction } from "@/features/profile/actions";
import type { Profile } from "@/types/database";

interface ProfileFormProps {
  profile: Profile | null;
  email: string;
}

export function ProfileForm({ profile, email }: ProfileFormProps) {
  const [state, formAction] = useActionState(updateProfileAction, idleState);

  return (
    <Card className="p-6 sm:p-7">
      <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
        Personal details
      </h2>
      <p className="mt-1 text-sm text-muted">
        This information appears across your workspace.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4" noValidate>
        {state.status === "success" ? (
          <FormAlert variant="success">{state.message}</FormAlert>
        ) : null}
        {state.status === "error" && !state.fieldErrors ? (
          <FormAlert variant="error">{state.message}</FormAlert>
        ) : null}

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={email}
            disabled
            className="mt-1.5"
            aria-describedby="email-hint"
          />
          <p id="email-hint" className="mt-1.5 text-xs text-muted-strong">
            Change your email from the Settings page.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              name="fullName"
              defaultValue={profile?.full_name ?? ""}
              placeholder="Ada Lovelace"
              className="mt-1.5"
              aria-invalid={Boolean(state.fieldErrors?.fullName)}
            />
            <FieldError>{state.fieldErrors?.fullName}</FieldError>
          </div>
          <div>
            <Label htmlFor="companyName">Company</Label>
            <Input
              id="companyName"
              name="companyName"
              defaultValue={profile?.company_name ?? ""}
              placeholder="Acme Inc."
              className="mt-1.5"
              aria-invalid={Boolean(state.fieldErrors?.companyName)}
            />
            <FieldError>{state.fieldErrors?.companyName}</FieldError>
          </div>
        </div>

        <div>
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            name="website"
            type="url"
            defaultValue={profile?.website ?? ""}
            placeholder="https://example.com"
            className="mt-1.5"
            aria-invalid={Boolean(state.fieldErrors?.website)}
          />
          <FieldError>{state.fieldErrors?.website}</FieldError>
        </div>

        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            name="bio"
            defaultValue={profile?.bio ?? ""}
            placeholder="Tell us a little about yourself."
            className="mt-1.5"
            aria-invalid={Boolean(state.fieldErrors?.bio)}
          />
          <FieldError>{state.fieldErrors?.bio}</FieldError>
        </div>

        <div className="mt-2 flex justify-end">
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
