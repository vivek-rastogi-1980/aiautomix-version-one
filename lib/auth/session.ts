import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Returns the current authenticated user, or `null`. Uses `getUser()` which
 * verifies the token against Supabase Auth (never trust the raw cookie).
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Guards a Server Component / Server Action: returns the user or redirects to
 * `/login`. The middleware already blocks unauthenticated navigation, but this
 * makes the guarantee explicit (and types `user` as non-null) at each call site.
 */
export async function requireUser(redirectTo = "/login"): Promise<User> {
  const user = await getUser();
  if (!user) {
    redirect(redirectTo);
  }
  return user;
}
