import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/site";
import { completeActivation } from "@/features/onboarding/activation";

/**
 * Email confirmation / recovery handler.
 *
 * Supabase email links point here with `token_hash` + `type`. We verify the
 * OTP (which establishes the session cookie) and redirect onward. Used for both
 * sign-up email verification and password recovery.
 *
 * `redirect()` from `next/navigation` is used so the session cookies written by
 * the Supabase server client are flushed onto the redirect response.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeRedirectPath(searchParams.get("next"), "/dashboard");

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      // The session now exists, which is the first moment the funnel can
      // honestly provision anything: `completeActivation` creates the personal
      // workspace, links the anonymous lead to this user, records the timeline
      // events and raises USER_CREATED.
      //
      // Skipped for `recovery`, which is a password reset arriving at the same
      // handler. Somebody resetting their password is not activating, and
      // sending them a welcome email would be wrong.
      //
      // Awaited so the workspace exists before `/dashboard` renders — a
      // fire-and-forget here races the redirect and the user lands on a page
      // that provisions a workspace a second time. It never throws: every
      // failure inside is caught and logged, so a broken claim cannot turn a
      // valid link into `invalid_link`.
      if (type !== "recovery") {
        await completeActivation();
      }
      redirect(next);
    }
  }

  redirect("/login?error=invalid_link");
}
