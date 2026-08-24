import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { acknowledgeLead, notifyNewLead } from "@/lib/leads/notify";
import { rateLimit } from "@/lib/rate-limit";
import { leadSchema } from "@/lib/validations/lead";
import { createActivationLink } from "@/features/onboarding/provisioning";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  logApiError,
} from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/leads — public lead capture.
 *
 * Deliberately NOT wrapped in `withApiAuth`: this is a marketing form, and the
 * whole point is that an anonymous visitor can use it. That makes it the only
 * unauthenticated write in the application, so the protections that `withApiAuth`
 * would have supplied are spelled out here instead:
 *
 *   - rate limited per IP rather than per user, since there is no user
 *   - a honeypot field that bots fill and humans cannot see
 *   - server-side Zod validation as the authority, not the client's copy
 *   - a hard body-size cap before parsing
 *
 * RLS allows anonymous INSERT on `leads` and grants no SELECT to anon or
 * authenticated, so this endpoint can write a lead but nothing reachable from
 * the browser can read the table back.
 */

/**
 * Sources that mean "this person wants to use the product", as opposed to
 * "this person has a question". Only these are sent an activation link.
 *
 * Kept as a set here rather than a flag on the request: the client chooses the
 * source string, so treating it as a switch the browser can flip would let any
 * caller turn a contact enquiry into an account provisioning request.
 */
const FUNNEL_SOURCES = new Set(["idea-validation", "strategy-session"]);

/** 5 submissions per IP per 10 minutes. Generous for a human, hostile to a script. */
const LEAD_LIMIT = 5;
const LEAD_WINDOW_MS = 10 * 60 * 1000;

/** Reject oversized bodies before parsing rather than after. */
const MAX_BODY_BYTES = 16 * 1024;

/**
 * Vercel sets `x-forwarded-for`; the left-most entry is the client. Falls back
 * to a shared bucket, which is deliberately conservative — if the header is
 * missing, unattributable traffic shares one limit rather than bypassing it.
 */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  const limit = rateLimit(`leads:${ip}`, LEAD_LIMIT, LEAD_WINDOW_MS);
  if (!limit.success) {
    const response = apiError(
      "RATE_LIMITED",
      "Too many submissions. Please try again shortly.",
      429,
    );
    response.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return response;
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return apiError("PAYLOAD_TOO_LARGE", "That submission is too large.", 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const lead = parsed.data;

  // Honeypot tripped. Return the success shape: telling a bot it was detected
  // only tells it which field to leave alone next time.
  if (lead.website) {
    return apiSuccess({ received: true }, 201);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("leads").insert({
      email: lead.email,
      source: lead.source,
      name: lead.name || null,
      phone: lead.phone || null,
      company: lead.company || null,
      message: lead.message || null,
      landing_page: lead.landingPage || null,
      referrer: lead.referrer || null,
      utm_source: lead.utmSource || null,
      utm_medium: lead.utmMedium || null,
      utm_campaign: lead.utmCampaign || null,
      utm_term: lead.utmTerm || null,
      utm_content: lead.utmContent || null,
    });

    if (error) {
      logApiError("POST /api/leads", error);
      return apiError(
        "INTERNAL_ERROR",
        "We couldn't save that. Please try again, or email contact@aiautomix.com.",
        500,
      );
    }

    // Two emails, two audiences: the business is told a lead arrived, and the
    // visitor is told we received it. Until this was added the visitor got
    // nothing at all — their address was used only as the notification's
    // reply-to, so people submitted the form and heard silence.
    //
    // Concurrent because they are independent; one round-trip of latency
    // instead of two. `allSettled` because neither may affect the other, and
    // both already swallow their own errors — this is belt and braces so a
    // captured lead can never be reported as failed over an email.
    //
    // Awaited so failures land in this request's trace rather than after the
    // response has been sent, where a serverless runtime may freeze first.
    //
    // When migration 0019 is applied and a template is ACTIVE, the visitor
    // half should move to `features/communications/service.ts` for editable
    // copy and a delivery log. See the note in `lib/leads/notify.ts`.
    //
    // The activation link is minted for funnel sources only.
    //
    // This endpoint serves both the marketing forms AND the two homepage
    // funnel modals, and that difference had been invisible: a visitor who
    // used the homepage "Validate your business idea" modal got an
    // acknowledgement with no way into the product, while the identical
    // submission on `/validate-your-idea` got a proper activation link. Same
    // intent, same person, two different outcomes decided by which page they
    // happened to be on.
    //
    // A contact enquiry is genuinely different and still gets no link —
    // somebody asking a question has not asked for an account.
    const activationUrl = FUNNEL_SOURCES.has(lead.source)
      ? await createActivationLink(lead.email, "/dashboard")
      : null;

    await Promise.allSettled([
      notifyNewLead(lead),
      acknowledgeLead(lead, activationUrl),
    ]);

    return apiSuccess({ received: true }, 201);
  } catch (error) {
    logApiError("POST /api/leads", error);
    return apiError(
      "INTERNAL_ERROR",
      "We couldn't save that. Please try again, or email contact@aiautomix.com.",
      500,
    );
  }
}
