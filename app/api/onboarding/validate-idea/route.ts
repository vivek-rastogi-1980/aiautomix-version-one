import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  apiError,
  apiSuccess,
  apiValidationError,
  logApiError,
} from "@/lib/api/response";
import { validateIdeaSchema } from "@/lib/validations/onboarding";
import {
  inviteVisitor,
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
    const supabase = await createClient();

    // Idempotent capture. A resubmitted form collides on the unique key and
    // returns the existing lead rather than creating a second one.
    const { data: rows, error } = await supabase.rpc("lead_capture", {
      p_email: input.email,
      p_source: "idea-validation",
      p_idempotency_key: leadIdempotencyKey(input.email, "idea-validation"),
      p_first_name: input.firstName,
      p_last_name: input.lastName ?? null,
      p_phone: input.phone ?? null,
      p_message: input.businessIdea,
      p_industry: input.industry ?? null,
      p_target_customer: input.targetCustomer ?? null,
      p_target_market: input.targetMarket ?? null,
      p_business_stage: input.businessStage ?? null,
      p_problem_solved: input.problemSolved ?? null,
      p_website: input.website ?? null,
      p_landing_page: input.landingPage ?? null,
      p_referrer: input.referrer ?? null,
      p_utm_source: input.utmSource ?? null,
      p_utm_medium: input.utmMedium ?? null,
      p_utm_campaign: input.utmCampaign ?? null,
      p_utm_term: input.utmTerm ?? null,
      p_utm_content: input.utmContent ?? null,
    });

    if (error || !rows?.length) {
      logApiError("POST /api/onboarding/validate-idea", error);
      return apiError(
        "SERVER_ERROR",
        "We could not record your idea just now. Please try again.",
        500,
      );
    }

    const leadId = rows[0].lead_id;
    const wasExisting = rows[0].was_existing === true;

    // The durable write is done. Everything after this point is best-effort and
    // must not be able to fail the submission.
    const invite = await inviteVisitor(input.email, "/dashboard");

    // Fire the confirmation. Skips silently when no template is active or no
    // provider is configured — both normal states — and logs either way.
    void emitCommunicationEvent("IDEA_SUBMITTED", {
      recipientEmail: input.email,
      leadId,
      variables: {
        "user.first_name": input.firstName,
        "user.email": input.email,
        "business_idea.title": input.businessIdea.slice(0, 120),
        "business_idea.industry": input.industry ?? "",
      },
    }).catch((sendError) => {
      logApiError("POST /api/onboarding/validate-idea (email)", sendError);
    });

    return apiSuccess({
      received: true,
      duplicate: wasExisting,
      activationSent: invite.invited,
      message: invite.invited
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
