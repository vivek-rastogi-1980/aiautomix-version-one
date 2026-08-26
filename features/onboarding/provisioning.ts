import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Account and workspace provisioning.
 *
 * ---------------------------------------------------------------------------
 * Why this does not create the user itself
 * ---------------------------------------------------------------------------
 * Creating a Supabase auth user from the server means `auth.admin` — which
 * needs the SERVICE ROLE key. This codebase used to forbid that outright, and
 * relied on the provider to both mint the link and email it:
 *
 *   signInWithOtp({ email, shouldCreateUser: true })
 *
 * That failed in production, and failed silently. Supabase's built-in email
 * service allows two messages an hour; the funnel's real submissions came back
 * `over_email_send_rate_limit`, GoTrue rolled the whole request back — so the
 * account was never even created — and `inviteVisitor` swallowed the error and
 * reported success. Visitors got a confirmation email with no way in.
 *
 * `createActivationLink` inverts the responsibility. Supabase MINTS the link
 * (`generateLink` returns it and sends nothing); this application DELIVERS it,
 * over the same Hostinger SMTP that already carries every other message. One
 * email, one link, and no dependency on a mailer nobody configured.
 *
 * That does introduce a service-role client, which is a real reduction in the
 * blast radius this codebase used to guarantee. It is confined to
 * `lib/supabase/admin.ts`, it is used for this one call, and the smoke suites
 * now assert that no OTHER module reads the key — a narrower invariant than
 * "never", deliberately, and still an enforced one.
 *
 * No password is ever generated, transmitted or stored. Authentication remains
 * entirely Supabase Auth's business.
 *
 * ---------------------------------------------------------------------------
 * Why the workspace waits for activation
 * ---------------------------------------------------------------------------
 * Every write path in this application runs under the caller's own RLS. Before
 * the visitor clicks the link there is no session, so there is no identity to
 * own a workspace — the rows simply cannot be written honestly.
 *
 * That constraint turns out to be the right behaviour anyway. Provisioning a
 * workspace and starting an AI validation for an UNVERIFIED email address is an
 * open invitation: a script posting a thousand fake addresses would create a
 * thousand workspaces and a thousand AI bills. The brief's own §19 warns about
 * exactly this. Waiting for a verified click costs one extra step and closes
 * the hole.
 *
 * The ordering is therefore:
 *
 *   submit → lead row + one-time link emailed   (anonymous, no AI spend)
 *   click  → session exists → workspace + idea + validation   (verified)
 */

/**
 * Mint a one-time activation link for an address, WITHOUT sending anything.
 *
 * `generateLink` is a pure mint: it returns the token and dispatches no email.
 * The caller puts the resulting URL into a message this application sends
 * itself, which is the whole point — see the module header for why the
 * provider's own mailer stopped being trustworthy.
 *
 * ---------------------------------------------------------------------------
 * Why the returned `action_link` is NOT used
 * ---------------------------------------------------------------------------
 * `properties.action_link` points at GoTrue's own `/auth/v1/verify`, which
 * verifies the token and then redirects to the app with the resulting session
 * in the URL **fragment**. A fragment is never sent to a server, so
 * `/auth/confirm` — a Route Handler — sees no parameters at all and bounces the
 * visitor to `/login?error=invalid_link`. Confirmed by following a real link:
 * it consumed the token and landed on the error page.
 *
 * `properties.hashed_token` is the same credential in the form this
 * application's confirm route already accepts (`token_hash` + `type`, exchanged
 * server-side by `verifyOtp`). Building the URL here means:
 *
 *   - the session is established server-side, where the cookie can be set
 *   - the link points at our own domain, so nothing depends on Supabase's
 *     redirect allow-list. That allow-list held the `www` host while
 *     `NEXT_PUBLIC_SITE_URL` was the apex domain, and GoTrue does not reject a
 *     redirect that is missing from it — it silently substitutes the Site URL,
 *     dropping the path and skipping activation entirely.
 *
 * ---------------------------------------------------------------------------
 * Why the link lands on /register and NOT on /auth/confirm
 * ---------------------------------------------------------------------------
 * `/auth/confirm` verifies on GET. Verification is single-use, and a GET is the
 * one request nobody controls: Gmail, Outlook and corporate mail gateways all
 * prefetch links to scan them for malware. The scanner spends the token, and
 * the human who clicks a second later is told the link is invalid or expired —
 * which is exactly what customers reported.
 *
 * A second consumer made it worse: `generateLink` invalidates the previous
 * token for that user, so someone who submitted two forms found the first
 * email's link already dead.
 *
 * Landing on `/register` moves verification to the form POST. A prefetching
 * scanner renders a form and spends nothing; the token is exchanged only when a
 * person actually submits a password. The email address and name ride along so
 * the page can prefill them.
 *
 * ---------------------------------------------------------------------------
 * Two link types, because the user may or may not exist yet
 * ---------------------------------------------------------------------------
 * `magiclink` requires an existing user; `invite` creates one. Trying magic
 * link first and falling back handles a first-time visitor without a separate
 * existence check — which would be a race, and an enumeration oracle if its
 * result ever reached the response.
 *
 * Returns null on any failure. The lead is already committed, and the visitor
 * is told they can sign in from the login page.
 */
export async function createActivationLink(
  email: string,
  redirectPath = "/dashboard",
  /** Prefills the name field so the visitor does not retype what they just gave. */
  fullName?: string | null,
): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) {
    console.error("[onboarding] no service key — cannot mint activation link");
    return null;
  }

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (!origin) {
    console.error("[onboarding] NEXT_PUBLIC_SITE_URL is unset — no link host");
    return null;
  }

  for (const type of ["magiclink", "invite"] as const) {
    const { data, error } = await admin.auth.admin.generateLink({
      type,
      email,
    });

    const hashedToken = data?.properties?.hashed_token;
    if (!error && hashedToken) {
      const url = new URL(`${origin}/register`);
      url.searchParams.set("token_hash", hashedToken);
      // `invite` and `magiclink` are both valid `EmailOtpType` values, and the
      // activation action passes whichever arrives straight to `verifyOtp`.
      url.searchParams.set("type", type);
      // Prefill only. The address the account is created for comes from the
      // TOKEN, never from this parameter — editing it in the URL changes what
      // the box displays and nothing else.
      url.searchParams.set("email", email);
      if (fullName?.trim()) url.searchParams.set("name", fullName.trim());
      url.searchParams.set("next", redirectPath);
      return url.toString();
    }

    if (error) {
      // Logged, never surfaced. The message distinguishes a registered address
      // from an unregistered one, which is the enumeration oracle this module
      // has always been careful not to hand out.
      console.error("[onboarding] activation link not minted", {
        type,
        status: error.status,
        message: error.message,
      });
    }
  }

  return null;
}

export interface ClaimResult {
  leadId: string | null;
  workspaceId: string;
}

/**
 * Attach the visitor's anonymous lead to their now-verified account.
 *
 * Runs AFTER activation, as the user, under their own RLS. The workspace comes
 * from `getWorkspaceContext`, which already provisions a personal workspace on
 * first read — so this reuses that path rather than adding a second way for a
 * workspace to come into existence.
 *
 * Matching the lead by email is not authorisation: the caller is authenticated
 * by `auth.uid()`, and the email is simply the join key to a row they have just
 * proven they control by following a one-time link to that address.
 */
export async function claimLeadForCurrentUser(
  workspaceId: string,
  businessIdeaId?: string | null,
): Promise<ClaimResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("lead_claim_for_user", {
    p_workspace_id: workspaceId,
    p_business_idea_id: businessIdeaId ?? null,
  });

  if (error) {
    // A failed claim must never block the user from reaching their dashboard.
    // The account and workspace are real; only the sales attribution is missing.
    console.error("[onboarding] lead claim failed", { message: error.message });
    return { leadId: null, workspaceId };
  }

  return {
    leadId: typeof data === "string" ? data : null,
    workspaceId,
  };
}

/**
 * Record a funnel event against a lead.
 *
 * Fire-and-forget by design: analytics must never be able to fail a user's
 * action. §16 wants the funnel measured, not the checkout broken.
 */
export async function recordLeadEvent(
  leadId: string,
  event: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("lead_record_event", {
      p_lead_id: leadId,
      p_event: event,
      p_metadata: metadata as never,
    });
  } catch (error) {
    console.error("[onboarding] could not record lead event", {
      event,
      error: error instanceof Error ? error.message : error,
    });
  }
}

/**
 * The idempotency key for a submission.
 *
 * Derived from the normalised email and the source, so the same person
 * submitting the same form twice collides on the unique index instead of
 * creating a second lead, a second invite and a second workspace.
 *
 * Deliberately NOT time-bucketed: a visitor who returns next week to correct a
 * typo should update the same lead, not start a parallel one that splits their
 * history across two rows an admin has to reconcile by eye.
 */
export function leadIdempotencyKey(email: string, source: string): string {
  return `lead:${source}:${email.trim().toLowerCase()}`;
}

/** The booking equivalent, keyed on the person and the slot they chose. */
export function bookingIdempotencyKey(
  email: string,
  scheduledAtIso: string,
): string {
  return `booking:${email.trim().toLowerCase()}:${scheduledAtIso}`;
}

/** What a capture returned, whichever path produced it. */
export interface CaptureResult {
  leadId: string | null;
  wasExisting: boolean;
  /** True when the full funnel RPC was unavailable and the fallback ran. */
  degraded: boolean;
  /**
   * Did the lead actually reach the database?
   *
   * Separate from `leadId` because the degraded path CANNOT return an id — the
   * table has no SELECT policy — yet the row is really there. Without this
   * flag a caller has no way to tell "saved, id unreadable" from "not saved",
   * and the safe-looking reading of a null id is the wrong one: it reports
   * success for a lead that was never written.
   */
  saved: boolean;
}

/**
 * Arguments for a lead capture. A subset of what `lead_capture` accepts —
 * the fields the public forms actually collect.
 */
export interface CaptureInput {
  email: string;
  source: string;
  idempotencyKey: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  message?: string | null;
  industry?: string | null;
  targetCustomer?: string | null;
  targetMarket?: string | null;
  businessStage?: string | null;
  problemSolved?: string | null;
  website?: string | null;
  landingPage?: string | null;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
}

/**
 * Capture a lead, and never lose one.
 *
 * ---------------------------------------------------------------------------
 * Why there are two paths
 * ---------------------------------------------------------------------------
 * The funnel calls `lead_capture` (migration 0019), which is idempotent, links
 * the lead to a user and writes a timeline. That is the right path and the one
 * this prefers.
 *
 * But a migration is applied by a human, and until somebody runs it the
 * function does not exist. PostgREST answers `PGRST202`, the route returns 500,
 * and the visitor is told to try again — losing a real lead over a deployment
 * step. That is the wrong trade: the columns 0019 adds are a convenience, the
 * lead itself is irreplaceable.
 *
 * So a missing function degrades to a plain INSERT against the pre-0019
 * `leads` shape, which every environment has had since migration 0005. The
 * visitor is captured either way, and the moment the migration lands the
 * primary path resumes with no code change.
 *
 * `degraded` is returned rather than hidden, so the caller can skip the parts
 * of the funnel that genuinely cannot work yet instead of pretending.
 *
 * Only a MISSING FUNCTION degrades. Any other database error is a real failure
 * and is reported as one — a fallback that swallows every error would turn a
 * broken database into silent data loss, which is the bug this exists to
 * prevent.
 */
export async function captureLead(input: CaptureInput): Promise<CaptureResult> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase.rpc("lead_capture", {
    p_email: input.email,
    p_source: input.source,
    p_idempotency_key: input.idempotencyKey,
    p_first_name: input.firstName ?? null,
    p_last_name: input.lastName ?? null,
    p_phone: input.phone ?? null,
    p_message: input.message ?? null,
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

  if (!error && rows?.length) {
    return {
      leadId: rows[0].lead_id,
      wasExisting: rows[0].was_existing === true,
      degraded: false,
      saved: true,
    };
  }

  // PGRST202 is PostgREST for "no such function". Anything else is a genuine
  // failure and must not be papered over.
  const missingFunction =
    error?.code === "PGRST202" || /lead_capture/.test(error?.message ?? "");

  if (!missingFunction) {
    console.error("[onboarding] lead capture failed", {
      code: error?.code,
      message: error?.message,
    });
    return { leadId: null, wasExisting: false, degraded: false, saved: false };
  }

  console.warn(
    "[onboarding] lead_capture is unavailable — migration 0019 has not been " +
      "applied to this database. Falling back to a direct insert so the lead " +
      "is not lost. Account provisioning and the lead timeline are skipped " +
      "until the migration is applied.",
  );

  // The pre-0019 column set only. `first_name`, `industry` and the rest do not
  // exist yet, so the name is recombined into the single `name` column.
  const fullName = [input.firstName, input.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  // No `.select()`. `leads` grants anon INSERT and deliberately has NO SELECT
  // policy, so asking for the row back turns the statement into
  // `INSERT ... RETURNING`, which RLS refuses — failing the whole insert with
  // 42501 and losing the lead. `POST /api/leads` has always inserted without a
  // select for exactly this reason.
  const { error: insertError } = await supabase.from("leads").insert({
    email: input.email,
    source: input.source,
    name: fullName || null,
    phone: input.phone ?? null,
    message: input.message ?? null,
    landing_page: input.landingPage ?? null,
    referrer: input.referrer ?? null,
    utm_source: input.utmSource ?? null,
    utm_medium: input.utmMedium ?? null,
    utm_campaign: input.utmCampaign ?? null,
    utm_term: input.utmTerm ?? null,
    utm_content: input.utmContent ?? null,
  });

  if (insertError) {
    console.error("[onboarding] fallback lead insert failed", {
      code: insertError.code,
    });
    return { leadId: null, wasExisting: false, degraded: true, saved: false };
  }

  // The row exists but its id is unreadable by design — see above. Nothing
  // downstream of the fallback needs it: the timeline and the account link are
  // precisely the things that require migration 0019.
  return { leadId: null, wasExisting: false, degraded: true, saved: true };
}
