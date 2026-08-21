import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/features/profile/data";
import { BookingForm } from "@/features/onboarding/booking-form";

export const metadata: Metadata = { title: "Book a strategy session" };
export const dynamic = "force-dynamic";

/**
 * Admin -> dashboard -> "Book a Free AI Strategy Session".
 *
 * Authenticated only: `requireUser()` redirects a signed-out visitor to login.
 * The public site keeps its own entry point for people who have not signed up —
 * both post to the same `/api/onboarding/bookings`, so there is one booking
 * architecture rather than two.
 *
 * The name and email are prefilled from the profile purely as a convenience.
 * They are not the identity the server trusts: `booking_create` takes the user
 * from `auth.uid()` and the workspace from the membership table, and neither
 * can be influenced by what is typed here.
 */
export default async function StrategySessionPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to dashboard
      </Link>

      <BookingForm
        defaultName={profile?.full_name?.trim() ?? ""}
        defaultEmail={user.email ?? ""}
      />
    </div>
  );
}
