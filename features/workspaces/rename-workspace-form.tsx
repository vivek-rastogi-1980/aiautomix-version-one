"use client";

import { useActionState } from "react";

import { FieldError, FormAlert } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { renameWorkspaceAction } from "@/features/workspaces/actions";
import { idleState } from "@/lib/forms/action-state";

interface RenameWorkspaceFormProps {
  name: string;
}

/** Workspace name editor. Rendered only for roles that may manage it. */
export function RenameWorkspaceForm({ name }: RenameWorkspaceFormProps) {
  const [state, formAction] = useActionState(renameWorkspaceAction, idleState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.status !== "idle" && state.message && !state.fieldErrors ? (
        <FormAlert variant={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FormAlert>
      ) : null}

      <div>
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input
          id="workspace-name"
          name="name"
          defaultValue={name}
          maxLength={80}
          required
          aria-invalid={Boolean(state.fieldErrors?.name)}
          aria-describedby={
            state.fieldErrors?.name ? "workspace-name-error" : undefined
          }
        />
        <FieldError id="workspace-name-error">
          {state.fieldErrors?.name}
        </FieldError>
      </div>

      <SubmitButton size="sm" pendingText="Saving…" className="w-fit">
        Save name
      </SubmitButton>
    </form>
  );
}
