"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getOrigin, safeRedirectPath } from "@/lib/site";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import {
  type ActionState,
  errorState,
  successState,
  zodFieldErrors,
} from "@/lib/forms/action-state";

/** Sign in with email + password. */
export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return errorState(
      "Please fix the errors below.",
      zodFieldErrors(parsed.error),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return errorState("Invalid email or password.");
  }

  const destination = safeRedirectPath(formData.get("redirectTo") as string);
  revalidatePath("/", "layout");
  redirect(destination);
}

/** Register a new account; sends a verification email. */
export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return errorState(
      "Please fix the errors below.",
      zodFieldErrors(parsed.error),
    );
  }

  const origin = await getOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) {
    return errorState(error.message);
  }

  // If the session is created immediately, email confirmation is disabled — go
  // straight to the dashboard. Otherwise route to the "check your inbox" screen.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

/** Send a password-reset email. Always reports success to avoid account enumeration. */
export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return errorState(
      "Please fix the errors below.",
      zodFieldErrors(parsed.error),
    );
  }

  const origin = await getOrigin();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });

  return successState(
    "If an account exists for that email, we've sent a reset link.",
  );
}

/** Set a new password (called from the recovery-link session). */
export async function updatePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return errorState("Your reset link has expired. Please request a new one.");
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return errorState(error.message);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Sign out and return to the login screen. */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * First-run password setup.
 *
 * ---------------------------------------------------------------------------
 * Why this is separate from `updatePasswordAction`
 * ---------------------------------------------------------------------------
 * That one serves the reset-link flow: somebody who already had a password and
 * has forgotten it. This one serves an account provisioned by the funnel, which
 * has never had a password at all — the visitor submitted an idea, Supabase
 * created the user and emailed a one-time link, and clicking it gave them a
 * session without them ever choosing a credential.
 *
 * The distinction matters because of what happens afterwards: this clears
 * `password_setup_required`, which is the flag that stops the dashboard
 * redirecting them straight back here. Folding the two together would mean
 * every password reset also touched that flag for no reason.
 *
 * The password itself goes only to Supabase Auth via `updateUser`. It is never
 * logged, never stored by this application, and never echoed in an error — the
 * provider's own message is surfaced only when it is about validity, and it
 * never contains the value.
 */
export async function completePasswordSetupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session means the one-time link has expired. Say so plainly and point
  // at the recovery path rather than failing with a generic error.
  if (!user) {
    return errorState(
      "Your session has expired. Please use the link in your email again, or reset your password.",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return errorState(error.message);
  }

  // Only cleared AFTER the password is genuinely set. Clearing it first would
  // let a failed update leave somebody with no password and no prompt to
  // choose one — locked out the moment their link expires.
  //
  // Runs under the caller's own RLS through "users update own profile", so this
  // can only ever clear the flag on the row belonging to the signed-in user.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ password_setup_required: false })
    .eq("id", user.id);

  if (profileError) {
    // The password IS set, so the customer is not blocked in any real sense —
    // they would simply be asked again. Logged rather than surfaced.
    console.error("[auth] could not clear password_setup_required", {
      code: profileError.code,
    });
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
