import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

import { AuthCard } from "@/features/auth/auth-card";

export const metadata: Metadata = {
  title: "Verify your email",
  description: "Confirm your email address to activate your AIAutomix account.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <AuthCard
      title="Check your inbox"
      footer={
        <>
          Already confirmed?{" "}
          <Link
            href="/login"
            className="font-medium text-accent hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <div className="flex flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
          <MailCheck className="size-7" />
        </span>
        <p className="mt-4 text-sm text-muted">
          We&apos;ve sent a verification link
          {email ? (
            <>
              {" "}
              to <span className="font-medium text-foreground">{email}</span>
            </>
          ) : null}
          . Click the link in that email to activate your account and sign in.
        </p>
        <p className="mt-3 text-xs text-muted-strong">
          Can&apos;t find it? Check your spam folder.
        </p>
      </div>
    </AuthCard>
  );
}
