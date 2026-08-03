import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

/**
 * Fetch the current user's profile row. RLS guarantees a user can only read
 * their own row, so this is safe to call with the session's user id.
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data ?? null;
}
