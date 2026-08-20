import "server-only";

import { getWorkspaceContext } from "@/features/workspaces/data";
import {
  claimLeadForCurrentUser,
  recordLeadEvent,
} from "@/features/onboarding/provisioning";
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

    // Matching by email is not authorisation: the caller is authenticated by
    // `auth.uid()`, and they have just proven control of the address by
    // following a one-time link sent to it.
    const { leadId } = await claimLeadForCurrentUser(workspace.id);

    if (leadId) {
      // Fire-and-forget by contract — analytics must never fail a user action.
      await recordLeadEvent(leadId, "ACCOUNT_CREATED", {});
      await recordLeadEvent(leadId, "WORKSPACE_CREATED", {
        workspace_id: workspace.id,
      });
    }

    // Raised as an EVENT, not composed here: which template answers
    // USER_CREATED is `events.ts`'s business, and the copy is the admin panel's.
    // Skips silently and logs when no template is active or no provider is
    // configured — both normal states.
    void emitCommunicationEvent("USER_CREATED", {
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
