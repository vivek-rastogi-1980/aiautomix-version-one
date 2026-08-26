import "server-only";

import { after } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { claimLeadForCurrentUser } from "@/features/onboarding/provisioning";
import { emitCommunicationEvent } from "@/features/communications/service";
import { getUser } from "@/lib/auth/session";
import { getOrigin } from "@/lib/site";

/**
 * The handoff from "anonymous lead" to "customer with a workspace".
 *
 * ---------------------------------------------------------------------------
 * Why this step exists at all
 * ---------------------------------------------------------------------------
 * `provisioning.ts` explains the ordering the funnel deliberately uses:
 *
 *   submit → lead row + one-time link emailed   (anonymous, no AI spend)
 *   click  → session exists → workspace + claim  (verified)
 *
 * The first half was wired. The second half was not — `claimLeadForCurrentUser`
 * and `recordLeadEvent` existed and had no callers, so a visitor who submitted
 * an idea and clicked their link got an account and nothing else: no workspace
 * provisioned at activation time, no lead linked to their user id, and an admin
 * looking at the lead saw "not activated" forever. This is the missing half.
 *
 * ---------------------------------------------------------------------------
 * Everything here is best-effort
 * ---------------------------------------------------------------------------
 * It runs on the redirect that follows a successful `verifyOtp`. The session is
 * already established at that point — the account is real whatever happens
 * below. So a failure here costs sales attribution and a welcome email, never
 * the user's ability to sign in, and nothing in this module is allowed to
 * throw into the redirect path.
 *
 * The workspace is provisioned through `getWorkspaceContext`, which already
 * creates a personal workspace on first read. Reusing it rather than inserting
 * here keeps exactly one way for a workspace to come into existence.
 */

/**
 * Flag an account as needing a password, unless it already has one.
 *
 * `last_sign_in_at` cannot tell us whether a password exists — a magic-link
 * sign-in sets it too. So the decision is made from the profile itself: the
 * flag is raised only on a row that has never been through setup, which the
 * column's `false` default distinguishes from a completed setup only in
 * combination with the guard below.
 *
 * Best-effort. A failure here means the customer is not prompted for a
 * password, which is the pre-existing behaviour, not a regression.
 */
async function markPasswordSetupRequired(userId: string): Promise<void> {
  try {
    const supabase = await createClient();

    // `has_password` is not exposed by Supabase, so completion is tracked by
    // this application: once someone finishes setup the flag is cleared and a
    // later magic-link visit must not re-raise it. `password_set_at` would be
    // the cleaner signal if the provider offered one.
    const { data: profile } = await supabase
      .from("profiles")
      .select("password_setup_required, updated_at, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) return;

    // Only a freshly provisioned profile is flagged. A profile that has been
    // updated since creation has been through the product already.
    const untouched =
      profile.updated_at === profile.created_at ||
      profile.password_setup_required;

    if (!untouched) return;

    await supabase
      .from("profiles")
      .update({ password_setup_required: true })
      .eq("id", userId);
  } catch (error) {
    console.error("[onboarding] could not flag password setup", {
      message: error instanceof Error ? error.message : error,
    });
  }
}

/** The user's own lead, for when the claim was made on an earlier visit. */
async function existingLeadId(userId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Turn the captured lead into a real business idea the product can work on.
 *
 * Created as `draft`, NOT `processing`. Running the validator here would spend
 * AI credits on a redirect, outside the entitlement checks the validator's own
 * entry points apply — the cost-control rule the funnel was built around. The
 * dashboard shows the idea and offers the validation action; the spend stays a
 * decision somebody makes.
 *
 * Idempotent on the lead: if `leads.business_idea_id` is already set, this does
 * nothing, so a second activation cannot create a second idea.
 */
async function createIdeaFromLead(
  leadId: string,
  workspaceId: string,
  userId: string,
): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: lead } = await supabase
      .from("leads")
      .select(
        "message, industry, target_customer, target_market, business_stage, problem_solved, business_idea_id",
      )
      .eq("id", leadId)
      .maybeSingle();

    if (!lead || lead.business_idea_id) return;

    const text = (lead.message ?? "").trim();
    if (text.length === 0) return;

    // The first sentence makes a readable title; the full text is kept in the
    // payload so a later validation run has everything the visitor wrote.
    const title = (text.split(/(?<=[.!?])\s/)[0] ?? text).slice(0, 120).trim();

    const { data: idea } = await supabase
      .from("business_ideas")
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        project_id: null,
        title: title || "Business idea",
        payload_json: {
          businessName: title,
          description: text,
          industry: lead.industry ?? "",
          targetCustomer: lead.target_customer ?? "",
          targetMarket: lead.target_market ?? "",
          businessStage: lead.business_stage ?? "",
          problemSolved: lead.problem_solved ?? "",
          source: "idea-validation-funnel",
        },
        status: "draft",
      })
      .select("id")
      .maybeSingle();

    if (idea?.id) {
      await supabase
        .from("leads")
        .update({ business_idea_id: idea.id })
        .eq("id", leadId);
    }
  } catch (error) {
    // The account and workspace are real either way.
    console.error("[onboarding] could not create idea from lead", {
      message: error instanceof Error ? error.message : error,
    });
  }
}

export interface ActivationResult {
  workspaceId: string | null;
  leadId: string | null;
}

export async function completeActivation(): Promise<ActivationResult> {
  try {
    const user = await getUser();
    if (!user) return { workspaceId: null, leadId: null };

    // Provisions the personal workspace on first call, returns the existing
    // one afterwards. Idempotent, so a user clicking their link twice does not
    // get two workspaces.
    const { workspace } = await getWorkspaceContext(user.id);
    const origin = await getOrigin();

    // This account was created by the funnel, so the person has never chosen a
    // password. Flag it so the dashboard requires one before letting them in —
    // otherwise the day their one-time link expires they have no way to sign
    // in at all.
    //
    // Only set when it is not already false-by-choice: somebody who has been
    // through this once and set a password must not be asked again on a second
    // magic-link visit.
    await markPasswordSetupRequired(user.id);

    // Matching by email is not authorisation: the caller is authenticated by
    // `auth.uid()`, and they have just proven control of the address by
    // following a one-time link sent to it.
    // `lead_claim_for_user` only matches an UNCLAIMED lead, so it returns null
    // on a second activation. That is correct for claiming, but it used to skip
    // everything below with it — meaning a re-activation did no work at all and
    // a lead claimed before the idea step existed could never acquire one.
    // Falling back to the already-claimed lead makes activation idempotent
    // rather than merely safe to repeat.
    const { leadId: claimedId } = await claimLeadForCurrentUser(workspace.id);
    const leadId = claimedId ?? (await existingLeadId(user.id));

    if (leadId) {
      // ACCOUNT_CREATED and WORKSPACE_CREATED are deliberately NOT written
      // here. `lead_claim_for_user` inserts both in the same transaction that
      // claims the lead, and it is the only writer: it runs `security definer`
      // and fires exactly once, on the claim that returns a lead id.
      //
      // They used to be recorded again here behind a read-your-own-timeline
      // guard, which cannot work for the people it was written for —
      // `lead_events` is selectable by admins only, so a customer's guard read
      // comes back empty and writes a second copy of both events. Re-activation
      // (a link followed twice, a refresh) stays safe without the guard: the
      // claim returns null the second time and inserts nothing, and the
      // fallback below only re-finds a lead whose events the RPC already wrote.

      // Carry the submitted idea into the product.
      //
      // Without this the visitor activates, lands on the dashboard, and is
      // asked to "submit your business idea" — the exact thing they just did.
      // The capture form writes to `leads`; nothing was moving it into
      // `business_ideas`, which is what the dashboard, the validator and the
      // report engine all read.
      await createIdeaFromLead(leadId, workspace.id, user.id);
    }

    // Raised as an EVENT, not composed here: which template answers
    // USER_CREATED is `events.ts`'s business, and the copy is the admin panel's.
    // Skips silently and logs when no template is active or no provider is
    // configured — both normal states.
    // Inside `after`, so the send outlives the redirect. This is the tail of
    // `/auth/confirm`, which responds with a 307 the instant activation
    // returns; a floating promise is cut off there on Vercel and the welcome
    // email silently never goes out.
    after(async () => {
      await emitCommunicationEvent("USER_CREATED", {
        recipientEmail: user.email ?? "",
        userId: user.id,
        workspaceId: workspace.id,
        leadId,
        variables: {
          "user.email": user.email ?? "",
          "user.first_name": firstNameFor(user.user_metadata),
          "workspace.name": workspace.name,
          dashboard_url: `${origin}/dashboard`,
        },
      }).catch((error) => {
        console.error("[onboarding] welcome email failed", error);
      });
    });

    return { workspaceId: workspace.id, leadId };
  } catch (error) {
    // The session is already established. A broken claim must not turn a
    // successful activation into a failed sign-in.
    console.error("[onboarding] activation handoff failed", {
      message: error instanceof Error ? error.message : error,
    });
    return { workspaceId: null, leadId: null };
  }
}

/**
 * A usable first name, or an empty string.
 *
 * Empty rather than "there": the template engine leaves an unfilled variable
 * blank and the copy can be written to read correctly either way, whereas a
 * hardcoded fallback here would override a greeting an admin has deliberately
 * worded. The local part of an email is never used — "j.smith92, your
 * workspace is ready" is worse than no name at all.
 */
function firstNameFor(metadata: Record<string, unknown> | undefined): string {
  const candidate =
    typeof metadata?.["first_name"] === "string"
      ? (metadata["first_name"] as string)
      : typeof metadata?.["full_name"] === "string"
        ? (metadata["full_name"] as string)
        : "";

  return candidate.trim().split(/\s+/)[0] ?? "";
}
