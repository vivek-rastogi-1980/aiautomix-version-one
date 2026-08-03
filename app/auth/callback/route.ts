import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/site";

/**
 * PKCE / code-exchange handler. Supabase links that carry a `?code=` param land
 * here; we exchange it for a session cookie and redirect onward. Kept alongside
 * `/auth/confirm` (token_hash flow) so both Supabase email templates work.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"), "/dashboard");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    }
  }

  redirect("/login?error=invalid_link");
}
