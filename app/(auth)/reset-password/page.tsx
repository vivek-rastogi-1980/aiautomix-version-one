import type { Metadata } from "next";

import { AuthCard } from "@/features/auth/auth-card";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Set new password",
  description: "Choose a new password for your AIAutomix account.",
};

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Set a new password"
      description="Choose a strong password you don't use elsewhere."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
