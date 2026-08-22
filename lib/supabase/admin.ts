import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { getSupabaseUrl } from "@/lib/supabase/env";

/**
 * The service-role client.
 *
 * ---------------------------------------------------------------------------
 * Read this before adding a second caller
 * ---------------------------------------------------------------------------
 * This key bypasses RLS completely. Every policy in the schema — workspace
 * membership, lead ownership, admin permissions — stops applying the moment a
 * query goes through here. That is the entire reason the rest of the
 * application uses `lib/supabase/server`'s cookie-bound client instead, and
 * why this module has exactly one legitimate use today: generating an account
 * activation link so the application can deliver it over its own SMTP.
 *
 * If you are reaching for this to make a query "just work", the query is
 * failing because a policy says it should. Fix the policy or add a
 * `security definer` function with a narrow, audited signature — do not widen
 * the blast radius of the service key.
 *
 * `server-only` makes an accidental client import a build error rather than a
 * leaked key. The key is never read at module scope, so an unconfigured
 * environment fails where it is used rather than breaking every import of
 * anything that transitively pulls this in.
 */

/**
 * Returns the admin client, or null when the service key is not configured.
 *
 * Null rather than a throw: the site runs without a service key, and the one
 * caller degrades to a slower path instead of failing a customer's submission.
 */
export function createAdminClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createSupabaseClient<Database>(url, key, {
    auth: {
      // No session to persist and nothing to refresh: this client is used for
      // one call and discarded. Persisting would also mean writing the
      // service-role session somewhere, which is exactly what must not happen.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
