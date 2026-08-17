import { NextResponse } from "next/server";

import { getUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/status — is this visitor signed in?
 *
 * ---------------------------------------------------------------------------
 * Why this exists rather than the header just importing the Supabase client
 * ---------------------------------------------------------------------------
 * The marketing header needs one boolean. Resolving it with the Supabase
 * browser client pulled `@supabase/ssr` and its dependencies into the shared
 * bundle for every public page — measured at roughly +68 kB of JavaScript on
 * pages whose whole job is to load fast for a stranger. Sixty-eight kilobytes
 * to decide between the words "Log in" and "Log out" is the wrong trade.
 *
 * So the question is asked of the server, which already has the session in a
 * cookie, and the answer is a boolean. The marketing pages stay statically
 * rendered; only this tiny endpoint is dynamic.
 *
 * ---------------------------------------------------------------------------
 * What it deliberately does not return
 * ---------------------------------------------------------------------------
 * No id, no email, no role, no token — nothing that would turn a header hint
 * into an information-disclosure endpoint. A caller learns exactly what it
 * would learn by looking at its own cookie jar, and nothing else.
 */
export async function GET(): Promise<NextResponse> {
  const user = await getUser();

  return NextResponse.json(
    { signedIn: user !== null },
    {
      headers: {
        // Per-visitor and never shared: a cached "signed in" served to the next
        // visitor would show a stranger a Log out button.
        "Cache-Control": "private, no-store",
      },
    },
  );
}
