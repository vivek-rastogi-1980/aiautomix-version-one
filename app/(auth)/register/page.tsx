import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/auth-card";
import { RegisterForm } from "@/features/auth/register-form";
import { safeRedirectPath } from "@/lib/site";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your AIAutomix account.",
};

/**
 * Registration, and the landing page for funnel activation emails.
 *
 * Reading the token here and NOT verifying it is the point. Verification is
 * single-use and mail providers prefetch links to scan them, so a token spent
 * on GET is gone before the recipient clicks. `activateAccountAction` exchanges
 * it on submit instead. See `features/auth/actions.ts`.
 *
 * Every value below is untrusted display data. The account is resolved from the
 * token by `verifyOtp`; the email and name parameters only decide what the
 * fields show. `safeRedirectPath` still constrains `next`, because that one
 * does become a redirect.
 */

/** Trim display values so a long query string cannot stretch the layout. */
function display(value: string | string[] | undefined, max: number): string {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const tokenHash = display(params["token_hash"], 512);
  const tokenType = display(params["type"], 32);
  const activating = Boolean(tokenHash && tokenType);

  return (
    <AuthCard
      title={activating ? "Choose your password" : "Create your account"}
      description={
        activating
          ? "Your workspace is ready. Set a password so you can sign in any time."
          : "Start building with AIAutomix in minutes."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-accent hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm
        tokenHash={tokenHash || undefined}
        tokenType={tokenType || undefined}
        defaultEmail={display(params["email"], 254)}
        defaultName={display(params["name"], 120)}
        next={safeRedirectPath(
          typeof params["next"] === "string" ? params["next"] : null,
        )}
      />
    </AuthCard>
  );
}
