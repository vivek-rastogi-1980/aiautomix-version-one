"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getExecutionAccess } from "@/features/execution/permissions";
import { ACTION_TYPES, type ActionType } from "@/features/execution/types";
import {
  getActionDefinition,
  requiresApproval,
  validateActionInput,
} from "@/features/execution/registry";
import {
  errorState,
  successState,
  zodFieldErrors,
  type ActionState as FormState,
} from "@/lib/forms/action-state";
import { createClient } from "@/lib/supabase/server";

/**
 * Business Execution Server Actions.
 *
 * Mutations that are a normal form submission live here. The four operations
 * that a client drives one at a time and needs a structured result from —
 * approve, execute, retry, cancel — are API routes instead, because the UI
 * needs the outcome (external id, duration, whether it was deduplicated) rather
 * than a redirect.
 *
 * Note what is absent: there is no action anywhere that sets `status` directly,
 * sets `approved_by`, or supplies a retry count. Those move only through the
 * state machine and the server, which is what makes the approval gate a gate
 * rather than a suggestion.
 */

const createPlanSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give the plan a title of at least 3 characters.")
    .max(200, "The title must be 200 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  gtmProjectId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  businessPlanId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export async function createExecutionPlanAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { workspace, entitled, canCreate } = await getExecutionAccess();

  if (!entitled) {
    return errorState(
      "Your current plan does not include Business Execution. Upgrade to turn strategy into actions.",
    );
  }
  if (!canCreate) {
    return errorState("Your role in this workspace is read-only.");
  }

  const parsed = createPlanSchema.safeParse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    gtmProjectId: formData.get("gtmProjectId") ?? "",
    businessPlanId: formData.get("businessPlanId") ?? "",
  });

  if (!parsed.success) {
    return errorState(
      "Check the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }

  const supabase = await createClient();
  const { data: planId, error } = await supabase.rpc("execution_create_plan", {
    p_workspace_id: workspace.id,
    p_title: parsed.data.title,
    p_description: parsed.data.description ?? null,
    p_gtm_project_id: parsed.data.gtmProjectId ?? null,
    p_business_plan_id: parsed.data.businessPlanId ?? null,
  });

  if (error || typeof planId !== "string") {
    return errorState(error?.message ?? "The plan could not be created.");
  }

  revalidatePath("/execution");
  redirect(`/execution/${planId}`);
}

const addActionSchema = z.object({
  planId: z.string().uuid(),
  actionType: z.enum(ACTION_TYPES),
  title: z.string().trim().min(3).max(300),
  description: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  /** JSON, validated against the action type's registered schema below. */
  input: z.string().max(50_000),
});

/**
 * Add an action to a plan.
 *
 * The two things this does that matter:
 *
 *   IT VALIDATES THE INPUT against the registry, so an action cannot be stored
 *   in a shape its provider will not understand. Discovering that at dispatch
 *   would mean a failure after an approval was already spent.
 *
 *   IT DERIVES `approval_required` from the registry's side-effect field. The
 *   form does not send it, and there is no parameter for a caller to override
 *   it with. A client that could set `approval_required: false` on a publishing
 *   action would have found the approval bypass §28 asks us to look for.
 */
export async function addExecutionActionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { entitled, canCreate } = await getExecutionAccess();

  if (!entitled) {
    return errorState("Your current plan does not include Business Execution.");
  }
  if (!canCreate) {
    return errorState("Your role in this workspace is read-only.");
  }

  const parsed = addActionSchema.safeParse({
    planId: formData.get("planId") ?? "",
    actionType: formData.get("actionType") ?? "",
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    input: formData.get("input") ?? "{}",
  });

  if (!parsed.success) {
    return errorState(
      "Check the highlighted fields.",
      zodFieldErrors(parsed.error),
    );
  }

  let rawInput: unknown;
  try {
    rawInput = JSON.parse(parsed.data.input);
  } catch {
    return errorState("The action input is not valid JSON.");
  }

  const actionType: ActionType = parsed.data.actionType;
  const validated = validateActionInput(actionType, rawInput);

  if (!validated.ok) {
    return errorState(
      `This action's input does not match what ${getActionDefinition(actionType).displayName} needs: ${validated.issues
        .map((issue) => `${issue.path || "input"} — ${issue.message}`)
        .join("; ")}`,
    );
  }

  const definition = getActionDefinition(actionType);

  const supabase = await createClient();
  const { error } = await supabase.rpc("execution_add_action", {
    p_plan_id: parsed.data.planId,
    p_action_type: actionType,
    p_title: parsed.data.title,
    p_description: parsed.data.description ?? null,
    p_input: validated.value as never,
    p_expected_output: {} as never,
    // Derived, never accepted from the client.
    p_approval_required: requiresApproval(definition),
    p_provider: definition.provider,
    p_display_order: 0,
    p_revision_of: null,
  });

  if (error) {
    return errorState(error.message);
  }

  revalidatePath(`/execution/${parsed.data.planId}`);
  return successState("Action added as a draft.");
}

/*
 * There is deliberately no Server Action that changes an action's status.
 *
 * Every state change goes through an API route — `/transition`, `/approve`,
 * `/execute`, `/retry`, `/cancel` — because each applies a different part of
 * the authorisation pipeline and the client needs the structured outcome back.
 * A Server Action that also moved state would be a second path to the thing
 * this phase exists to control, and the second path is always the one that gets
 * the check wrong.
 */

const planStatusSchema = z.object({
  planId: z.string().uuid(),
  status: z.enum(["ACTIVE", "PAUSED", "CANCELLED"]),
});

/**
 * Pause, resume or cancel a plan. §27.
 *
 * Pausing the plan rather than each action is the useful granularity: the thing
 * a founder wants when something looks wrong is "stop everything", not "stop
 * these six things one at a time". A paused plan refuses execution for every
 * action under it, enforced in SQL as well as here.
 */
export async function setExecutionPlanStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { entitled, canCreate } = await getExecutionAccess();

  if (!entitled) {
    return errorState("Your current plan does not include Business Execution.");
  }
  if (!canCreate) {
    return errorState("Your role in this workspace is read-only.");
  }

  const parsed = planStatusSchema.safeParse({
    planId: formData.get("planId") ?? "",
    status: formData.get("status") ?? "",
  });

  if (!parsed.success) {
    return errorState("That is not a status this plan can take.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("execution_set_plan_status", {
    p_plan_id: parsed.data.planId,
    p_status: parsed.data.status,
  });

  if (error) return errorState(error.message);

  revalidatePath(`/execution/${parsed.data.planId}`);
  revalidatePath("/execution");

  return successState(
    parsed.data.status === "PAUSED"
      ? "Plan paused. No action in it can run until you resume it."
      : parsed.data.status === "ACTIVE"
        ? "Plan resumed."
        : "Plan cancelled.",
  );
}
