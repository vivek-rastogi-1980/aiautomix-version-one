import type { ZodError } from "zod";

/**
 * Consistent result shape returned by every Server Action and consumed by the
 * client forms via `useActionState`. Mirrors the API-STANDARDS "consistent
 * error format": a status flag, a human message, and per-field errors.
 */
export interface ActionState {
  status: "idle" | "success" | "error";
  message?: string;
  /** Field name -> first validation message, for inline form errors. */
  fieldErrors?: Record<string, string>;
}

export const idleState: ActionState = { status: "idle" };

export function successState(message?: string): ActionState {
  return { status: "success", message };
}

export function errorState(
  message: string,
  fieldErrors?: Record<string, string>,
): ActionState {
  return { status: "error", message, fieldErrors };
}

/** Flatten a Zod error into `{ field: firstMessage }` for form display. */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}
