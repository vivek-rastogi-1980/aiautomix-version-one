"use client";

import { useActionState, useEffect } from "react";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormAlert } from "@/components/ui/form-message";
import { idleState } from "@/lib/forms/action-state";
import { deleteProjectAction } from "@/features/projects/actions";
import type { Project } from "@/types/database";

interface DeleteProjectDialogProps {
  project: Project | null;
  onClose: () => void;
}

export function DeleteProjectDialog({
  project,
  onClose,
}: DeleteProjectDialogProps) {
  const [state, formAction] = useActionState(deleteProjectAction, idleState);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  return (
    <Modal
      open={Boolean(project)}
      onClose={onClose}
      title="Delete project"
      description={
        project
          ? `“${project.name}” will be removed from your workspace. This can't be undone.`
          : undefined
      }
    >
      <form action={formAction} className="flex flex-col gap-4">
        {state.status === "error" ? (
          <FormAlert variant="error">{state.message}</FormAlert>
        ) : null}
        <input type="hidden" name="id" value={project?.id ?? ""} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton variant="danger" pendingText="Deleting…">
            Delete project
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
