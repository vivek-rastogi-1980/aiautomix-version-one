"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getOrigin } from "@/lib/site";
import {
  updateEmailSchema,
  updatePasswordSchema,
} from "@/lib/validations/profile";
import {
  type ActionState,
  errorState,
  successState,
  zodFieldErrors,
} from "@/lib/forms/action-state";

/** Change the account email (Supabase emails a confirmation link to the new address). */
export async function updateEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = updateEmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return errorState(
      "Please fix the errors below.",
      zodFieldErrors(parsed.error),
    );
  }

  const origin = await getOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${origin}/auth/confirm?next=/settings` },
  );

  if (error) {
    return errorState(error.message);
  }

  return successState(
    "Check your inbox — confirm the change from the link we sent to your new address.",
  );
}

/** Change the account password for a signed-in user. */
export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return errorState(
      "Please fix the errors below.",
      zodFieldErrors(parsed.error),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return errorState(error.message);
  }

  revalidatePath("/settings");
  return successState("Password updated.");
}
