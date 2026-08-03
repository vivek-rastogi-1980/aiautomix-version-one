import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/site";

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
      redirect(next);
    }
  }

  redirect("/login?error=invalid_link");
}
