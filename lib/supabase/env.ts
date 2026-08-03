/**
 * Resolves the Supabase browser-safe credentials from the environment.
 *
 * Accepts both the legacy anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) and the
 * newer publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `sb_publishable_…`).
 * Next.js inlines every literal `process.env.NEXT_PUBLIC_*` access at build
 * time, so both reads are safe in client and server bundles alike.
 */
export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function getSupabaseKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

/** Shared "not configured" message pointing at the env vars. */
export const SUPABASE_NOT_CONFIGURED_MESSAGE =
  "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) — see .env.example.";
