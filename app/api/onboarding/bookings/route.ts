import { after, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  logApiError,
} from "@/lib/api/response";
import { bookingSchema } from "@/lib/validations/onboarding";
import {
  bookingIdempotencyKey,
  createActivationLink,
  leadIdempotencyKey,
} from "@/features/onboarding/provisioning";
import { emitCommunicationEvent } from "@/features/communications/service";
import { formatBookingSlot } from "@/features/communications/booking-format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/onboarding/bookings — the secondary funnel's entry point.
 *
 * Book first, account later. A visitor who lands ready to talk should not have
 * to validate an idea before they can get a slot, so this creates a lead AND a
 * booking in one submission and sends the same activation link.
 *
 * The same protections as the idea endpoint: per-IP rate limit, honeypot,
 * server-side Zod, body cap, idempotency. Anonymous by design — `booking_create`
 * is granted to `anon` precisely so this funnel works before there is a session,
 * and it attaches the workspace automatically when there is one.
 *
 * A duplicate confirm click collides on (email, slot) and returns the existing
 * booking, so nobody ends up with two calls in the same half hour.
 */

const BOOKING_LIMIT = 5;
const BOOKING_WINDOW_MS = 10 * 60 * 1000;
const MAX_BODY_BYTES = 8 * 1024;

/** How long a session runs. Fixed — §5 says do not build a calendar product. */
const SESSION_MINUTES = 30;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Split a full name for the lead row. Best-effort: many names do not split. */
function splitName(fullName: string): { first: string; last: string | null } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0]!, last: null };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  const limit = rateLimit(`booking:${ip}`, BOOKING_LIMIT, BOOKING_WINDOW_MS);
  if (!limit.success) {
    return apiError(
      "RATE_LIMITED",
      "Too many booking attempts. Please try again shortly.",
      429,
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return apiError("INVALID_INPUT", "That submission is too large.", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return apiError("INVALID_INPUT", "That submission could not be read.", 400);
  }

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const input = parsed.data;

  if (input.company_website) {
    return apiSuccess({ booked: true, message: "Thanks — you are booked in." });
  }

  try {
    const supabase = await createClient();
    const scheduledAt = new Date(input.scheduledAt).toISOString();
    const { first, last } = splitName(input.fullName);

    // A booking always belongs to a lead, so the pipeline sees it. When the
    // visitor already has one (they validated an idea first) the idempotent
    // capture returns it rather than creating a second.
    // Resolved server-side, never taken from the request body. `lead_capture`
    // is idempotent on (email, source), so a returning visitor collides onto
    // their existing lead instead of creating a second one.
    let leadId: string | null = null;

    // A signed-in booker already has a lead. Reuse it.
    //
    // `lead_capture` keys on (source, email), so capturing here under
    // "strategy-session" produced a SECOND lead for anybody who had already
    // come through "idea-validation" — the same human counted twice in the
    // funnel, split across two rows in Admin -> Leads, with the original lead
    // left at NEW while the duplicate advanced to STRATEGY_BOOKED.
    //
    // Read under the caller's own RLS, so this can only find their own lead.
    {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: existing } = await supabase
          .from("leads")
          .select("id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        leadId = existing?.id ?? null;
      }
    }

    if (!leadId) {
      const { data: leadRows } = await supabase.rpc("lead_capture", {
        p_email: input.email,
        p_source: "strategy-session",
        p_idempotency_key: leadIdempotencyKey(input.email, "strategy-session"),
        p_first_name: first,
        p_last_name: last,
        p_phone: input.phone ?? null,
        p_message: input.notes ?? null,
      });
      leadId = leadRows?.length ? leadRows[0].lead_id : null;
    }

    const { data: rows, error } = await supabase.rpc("booking_create", {
      p_full_name: input.fullName,
      p_email: input.email,
      p_scheduled_at: scheduledAt,
      p_timezone: input.timezone,
      p_idempotency_key: bookingIdempotencyKey(input.email, scheduledAt),
      p_phone: input.phone ?? null,
      p_lead_id: leadId,
      p_duration: SESSION_MINUTES,
      p_notes: input.notes ?? null,
    });

    if (error || !rows?.length) {
      logApiError("POST /api/onboarding/bookings", error);
      return apiError(
        "SERVER_ERROR",
        "We could not book that slot just now. Please try again.",
        500,
      );
    }

    const bookingId = rows[0].booking_id;
    const wasExisting = rows[0].was_existing === true;

    // Durable write done. Everything below is best-effort.
    //
    // Minted, not sent: the link travels in the confirmation email this route
    // already sends over our own SMTP. Asking Supabase to send it hit a
    // two-per-hour cap in production and delivered nothing.
    const activationUrl = await createActivationLink(input.email, "/dashboard");

    // Formatted in the visitor's own zone, not sliced out of the UTC ISO
    // string. Slicing produced a confirmation reading "09:30, Asia/Kolkata"
    // for a 15:00 call — wrong by the offset while looking entirely
    // plausible, and first noticed when somebody misses the meeting.
    //
    // Sent inside `after` rather than as a floating promise: on Vercel the
    // invocation is frozen as soon as the response is returned, which killed
    // the SMTP send mid-flight and left no log row behind. See the same fix
    // and the production evidence in the validate-idea route.
    after(async () => {
      await emitCommunicationEvent("BOOKING_CREATED", {
        recipientEmail: input.email,
        leadId,
        bookingId,
        variables: {
          "user.first_name": first,
          "user.email": input.email,
          ...formatBookingSlot(scheduledAt, input.timezone),
          activation_url: activationUrl ?? "",
        },
      }).catch((sendError) => {
        logApiError("POST /api/onboarding/bookings (email)", sendError);
      });
    });

    return apiSuccess({
      booked: true,
      duplicate: wasExisting,
      bookingId,
      activationSent: activationUrl !== null,
      message: wasExisting
        ? "You already have this slot booked — we have not made a second booking."
        : "Your session is booked. Check your inbox for the confirmation.",
    });
  } catch (error) {
    logApiError("POST /api/onboarding/bookings", error);
    return apiError(
      "SERVER_ERROR",
      "We could not complete that just now. Please try again.",
      500,
    );
  }
}
