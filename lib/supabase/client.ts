import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";
import {
  SUPABASE_NOT_CONFIGURED_MESSAGE,
  getSupabaseKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";

/**
 * Browser-side Supabase client for Client Components.
 *
 * Reads the public env vars and throws a clear error if they are missing, so a
 * misconfigured deploy fails loudly rather than silently. The return type is
 * inferred so it stays in sync with the installed `@supabase/ssr` generics.
 *
 * NOTE: nothing imports this today, and that is the intended state rather than
 * an oversight. Every read runs in a Server Component and every mutation goes
 * through a Server Action, so no client component needs database access — which
 * is what keeps RLS the single enforcement point and stops query logic leaking
 * into the bundle. It is kept as the third of the documented `client / server /
 * middleware` trio for the cases that genuinely require it (realtime
 * subscriptions, client-side auth listeners). Reach for it only when server-side
 * access cannot express the requirement; being unused is a signal of health, so
 * do not delete it as dead code without checking this comment first.
 */
export function createClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();

  if (!url || !key) {
    throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);
  }

  return createBrowserClient<Database>(url, key);
}
