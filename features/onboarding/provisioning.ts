import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Account and workspace provisioning.
 *
 * ---------------------------------------------------------------------------
 * Why this does not create the user itself
 * ---------------------------------------------------------------------------
 * Creating a Supabase auth user from the server normally means
 * `auth.admin.createUser` — which needs the SERVICE ROLE key. This codebase has
 * an absolute, repeatedly-tested rule that no service-role client exists
 * anywhere: five smoke suites assert `!/service_role/` across the feature
 * source. Introducing one here to save a click would quietly remove the
 * property that every other phase was built to preserve.
 *
 * So provisioning uses the provider's own mechanism instead:
 *
 *   signInWithOtp({ email, shouldCreateUser: true })
 *
 * Supabase creates the user and emails a one-time link. No password is ever
 * generated, transmitted or stored — which is exactly what the brief asks for
 * ("ACCOUNT CREATED → SECURE ACTIVATION LINK → USER CREATES THEIR PASSWORD"),
 * and it needs nothing but the anon key.
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

export interface InviteResult {
  ok: boolean;
  /** True when the provider accepted the request and dispatched a link. */
  invited: boolean;
  message: string;
}

/**
 * Ask the auth provider to create the account and email an activation link.
 *
 * Always reports success to the caller regardless of whether the address was
 * already registered. That is deliberate and matches `requestPasswordResetAction`
 * in this codebase: a public form that answers "that email already has an
 * account" differently from "it does not" is an account-enumeration oracle.
 */
export async function inviteVisitor(
  email: string,
  redirectPath = "/dashboard",
): Promise<InviteResult> {
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: origin
        ? `${origin}/auth/confirm?next=${encodeURIComponent(redirectPath)}`
        : undefined,
    },
  });

  if (error) {
    // Logged for operators, never surfaced: the message can distinguish a
    // registered address from an unregistered one.
    console.error("[onboarding] activation link not sent", {
      code: error.status,
      message: error.message,
    });
    return {
      ok: false,
      invited: false,
      message:
        "Your idea was received. We could not send the activation email just now — you can sign in from the login page at any time.",
    };
  }

  return {
    ok: true,
    invited: true,
    message:
      "Check your inbox — we have sent a secure link to open your workspace. No password needed.",
  };
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
