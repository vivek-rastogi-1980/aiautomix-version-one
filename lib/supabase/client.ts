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
 */
export function createClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();

  if (!url || !key) {
    throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);
  }

  return createBrowserClient<Database>(url, key);
}
