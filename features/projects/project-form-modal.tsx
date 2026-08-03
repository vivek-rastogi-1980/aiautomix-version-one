"use client";

import { useActionState, useEffect } from "react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError, FormAlert } from "@/components/ui/form-message";
import { idleState } from "@/lib/forms/action-state";
import { PROJECT_STATUSES, type Project } from "@/types/database";
import {
  createProjectAction,
  updateProjectAction,
} from "@/features/projects/actions";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the modal edits this project; otherwise it creates one. */
  project?: Project | null;
}

export function ProjectFormModal({
  open,
  onClose,
  project,
}: ProjectFormModalProps) {
  const isEdit = Boolean(project);
  const [state, formAction] = useActionState(
    isEdit ? updateProjectAction : createProjectAction,
    idleState,
  );

  // Close automatically once the mutation succeeds (list re-renders via
  // revalidatePath).
  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit project" : "New project"}
      description={
        isEdit
          ? "Update the details of your project."
          : "Give your project a name to get started."
      }
    >
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {state.status === "error" && !state.fieldErrors ? (
          <FormAlert variant="error">{state.message}</FormAlert>
        ) : null}

        {isEdit ? <input type="hidden" name="id" value={project!.id} /> : null}

        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={project?.name ?? ""}
            placeholder="Acme storefront"
            className="mt-1.5"
            autoFocus
            aria-invalid={Boolean(state.fieldErrors?.name)}
          />
          <FieldError>{state.fieldErrors?.name}</FieldError>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={project?.description ?? ""}
            placeholder="What is this project about?"
            className="mt-1.5"
            aria-invalid={Boolean(state.fieldErrors?.description)}
          />
          <FieldError>{state.fieldErrors?.description}</FieldError>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              name="status"
              defaultValue={project?.status ?? "active"}
              className="mt-1.5"
            >
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              name="website"
              type="url"
              defaultValue={project?.website ?? ""}
              placeholder="https://example.com"
              className="mt-1.5"
              aria-invalid={Boolean(state.fieldErrors?.website)}
            />
            <FieldError>{state.fieldErrors?.website}</FieldError>
          </div>
        </div>

        <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton pendingText={isEdit ? "Saving…" : "Creating…"}>
            {isEdit ? "Save changes" : "Create project"}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
