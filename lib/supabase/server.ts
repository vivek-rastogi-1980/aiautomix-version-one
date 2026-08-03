import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import type { Database } from "@/types/database";
import {
  SUPABASE_NOT_CONFIGURED_MESSAGE,
  getSupabaseKey,
  getSupabaseUrl,
} from "@/lib/supabase/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Server-side Supabase client for Server Components, Server Actions and Route
 * Handlers. Session cookies are read from / written to the request via
 * `next/headers`; the middleware (`middleware.ts`) keeps them refreshed. The
 * return type is inferred so it tracks the installed `@supabase/ssr` generics.
 */
export async function createClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();

  if (!url || !key) {
    throw new Error(SUPABASE_NOT_CONFIGURED_MESSAGE);
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — the response is already
          // streaming, so cookie writes are a no-op here. The middleware
          // refreshes the session on the next request.
        }
      },
    },
  });
}
