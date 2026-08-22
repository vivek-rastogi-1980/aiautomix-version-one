import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthCard } from "@/features/auth/auth-card";
import { PasswordSetupForm } from "@/features/auth/password-setup-form";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/features/profile/data";

export const metadata: Metadata = {
  title: "Create your password",
  description: "Choose a password for your AIAutomix account.",
};

export const dynamic = "force-dynamic";

/**
 * First-run password setup.
 *
 * Reached two ways: redirected here by the dashboard layout when
 * `password_setup_required` is set, or navigated to deliberately by somebody
 * who wants to change their password.
 *
 * Requires a session — there is nothing to set a password ON without one. A
 * signed-out visitor goes to login rather than seeing a form that cannot work.
 *
 * Somebody who has already chosen a password and lands here is sent to the
 * dashboard: this screen exists to unblock people, not to nag them. Changing an
 * existing password is the reset flow, which verifies ownership by email.
 */
export default async function ChangePasswordPage() {
  const user = await requireUser("/login?redirectTo=%2Fchange-password");
  const profile = await getProfile(user.id);

  if (profile && !profile.password_setup_required) {
    redirect("/dashboard");
  }

  return (
    <AuthCard
      title="Create your password"
      description="Your account is ready. Choose a password so you can sign in any time — your one-time link will expire."
    >
      <PasswordSetupForm />
    </AuthCard>
  );
}
