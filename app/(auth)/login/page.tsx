import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/auth-card";
import { LoginForm } from "@/features/auth/login-form";
import { FormAlert } from "@/components/ui/form-message";
import { safeRedirectPath } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your AIAutomix dashboard.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const { redirectTo, error } = await searchParams;

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to continue to your dashboard."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-accent hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      {error === "invalid_link" ? (
        <div className="mb-4">
          <FormAlert variant="error">
            That link is invalid or has expired. Please try again.
          </FormAlert>
        </div>
      ) : null}
      <LoginForm redirectTo={safeRedirectPath(redirectTo)} />
    </AuthCard>
  );
}
