import { after, type NextRequest } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  logApiError,
} from "@/lib/api/response";
import { validateIdeaSchema } from "@/lib/validations/onboarding";
import {
  captureLead,
  createActivationLink,
  leadIdempotencyKey,
} from "@/features/onboarding/provisioning";
import { emitCommunicationEvent } from "@/features/communications/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/onboarding/validate-idea — the primary funnel's entry point.
 *
 * ---------------------------------------------------------------------------
 * Deliberately NOT wrapped in withApiAuth
 * ---------------------------------------------------------------------------
 * The whole premise is that an anonymous visitor uses this. That makes it one
 * of only two unauthenticated writes in the application, so every protection
 * `withApiAuth` would have supplied is spelled out here instead — the same
 * shape `POST /api/leads` already established:
 *
 *   - rate limited per IP, since there is no user to limit
 *   - a honeypot field bots fill and humans cannot see
 *   - server-side Zod as the authority, not the client's copy
 *   - a hard body-size cap applied BEFORE parsing
 *   - idempotency, so a double-submit collides instead of duplicating
 *
 * ---------------------------------------------------------------------------
 * What it does NOT do, and why
 * ---------------------------------------------------------------------------
 * It creates no workspace, no business idea and no AI validation. All three
 * need a verified email: provisioning for an unverified address would let a
 * script turn this endpoint into a bill. The visitor gets a lead row and a
 * one-time activation link; everything else happens once they click it.
 *
 * It also returns FAST. The lead is committed, the invite is dispatched, and
 * the response goes back — §24. Email is attempted after the durable write, so
 * a provider outage costs a notification and never the lead.
 */

/** 5 submissions per IP per 10 minutes. Generous for a human, hostile to a script. */
const SUBMIT_LIMIT = 5;
const SUBMIT_WINDOW_MS = 10 * 60 * 1000;

/** Reject oversized bodies before parsing rather than after. */
const MAX_BODY_BYTES = 16 * 1024;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  const limit = rateLimit(`onboarding:${ip}`, SUBMIT_LIMIT, SUBMIT_WINDOW_MS);
  if (!limit.success) {
    return apiError(
      "RATE_LIMITED",
      "Too many submissions. Please try again shortly.",
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

  const parsed = validateIdeaSchema.safeParse(body);
  if (!parsed.success) {
    return apiValidationError(parsed.error);
  }

  const input = parsed.data;

  // The honeypot. Answered as a success so a bot learns nothing from the
  // response, but nothing is written.
  if (input.company_website) {
    return apiSuccess({
      received: true,
      activationSent: false,
      message: "Thanks — we have your idea.",
    });
  }

  try {
    // Idempotent capture. A resubmitted form collides on the unique key and
    // returns the existing lead rather than creating a second one.
    //
    // `captureLead` degrades to a plain insert when migration 0019 has not been
    // applied, so a visitor is never lost to a pending deployment step. It
    // reports which path ran; the funnel skips what genuinely cannot work yet
    // rather than claiming otherwise.
    const capture = await captureLead({
      email: input.email,
      source: "idea-validation",
      idempotencyKey: leadIdempotencyKey(input.email, "idea-validation"),
      firstName: input.firstName,
      lastName: input.lastName ?? null,
      phone: input.phone ?? null,
      message: input.businessIdea,
      industry: input.industry ?? null,
      targetCustomer: input.targetCustomer ?? null,
      targetMarket: input.targetMarket ?? null,
      businessStage: input.businessStage ?? null,
      problemSolved: input.problemSolved ?? null,
      website: input.website ?? null,
      landingPage: input.landingPage ?? null,
      referrer: input.referrer ?? null,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      utmTerm: input.utmTerm ?? null,
      utmContent: input.utmContent ?? null,
    });

    // `saved`, not `leadId`: the degraded path cannot read an id back, so
    // keying off the id would report failure for a lead that was written — and,
    // worse, report success for one that was not.
    if (!capture.saved) {
      logApiError("POST /api/onboarding/validate-idea", null);
      return apiError(
        "SERVER_ERROR",
        "We could not record your idea just now. Please try again.",
        500,
      );
    }

    const leadId = capture.leadId;
    const wasExisting = capture.wasExisting;

    // The durable write is done. Everything after this point is best-effort and
    // must not be able to fail the submission.
    //
    // Minted here, delivered below in our own email. This used to call
    // `inviteVisitor`, which asked Supabase to both mint AND send — and
    // Supabase's built-in mailer allows two messages an hour, so in production
    // it returned `over_email_send_rate_limit`, created no account, and the
    // visitor received a confirmation with no link in it.
    const activationUrl = await createActivationLink(input.email, "/dashboard");

    // Fire the confirmation AFTER the response, not alongside it.
    //
    // This used to be a floating `void` promise. Locally that works, because
    // the Node process keeps running once the response is written. On Vercel
    // it does not: the function is frozen the moment the response is returned,
    // so the SMTP connection never completes and the log row is never written.
    // Verified against production — an identical submission produced a lead
    // and zero `email_logs` rows, while the same request locally produced both.
    //
    // `after` is the supported way to say "do this once the response is sent"
    // and keeps the invocation alive until it settles.
    after(async () => {
      await emitCommunicationEvent("IDEA_SUBMITTED", {
        recipientEmail: input.email,
        leadId,
        variables: {
          "user.first_name": input.firstName,
          "user.email": input.email,
          "business_idea.title": input.businessIdea.slice(0, 120),
          "business_idea.industry": input.industry ?? "",
          activation_url: activationUrl ?? "",
        },
      }).catch((sendError) => {
        logApiError("POST /api/onboarding/validate-idea (email)", sendError);
      });
    });

    return apiSuccess({
      received: true,
      duplicate: wasExisting,
      activationSent: activationUrl !== null,
      message: activationUrl
        ? "Check your inbox — we have sent a secure link to open your workspace. No password needed."
        : "Your idea was received. You can sign in from the login page at any time.",
    });
  } catch (error) {
    logApiError("POST /api/onboarding/validate-idea", error);
    // Never leak a stack trace, a database error or a provider detail. §20.
    return apiError(
      "SERVER_ERROR",
      "We could not complete that just now. Please try again.",
      500,
    );
  }
}
