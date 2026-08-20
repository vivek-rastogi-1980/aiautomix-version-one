import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import { getOrigin } from "@/lib/site";
import { recordLeadEvent } from "@/features/onboarding/provisioning";
import { emitCommunicationEvent } from "@/features/communications/service";
import type { CommunicationEvent } from "@/features/communications/events";

/**
 * The validation lifecycle's communication and analytics side-effects.
 *
 * ---------------------------------------------------------------------------
 * Why this is a separate module from the validator
 * ---------------------------------------------------------------------------
 * `business-validator.ts` has one job: turn an idea into a persisted report.
 * Growing three email calls and three analytics writes inside it would bury
 * that job, and would put the funnel's concerns inside a service that is also
 * used by callers who have nothing to do with the funnel.
 *
 * So the validator raises events and this module decides what they mean —
 * §9's `EVENT → COMMUNICATION SERVICE → TEMPLATE → PROVIDER → LOG`, with the
 * lead timeline written alongside so the admin funnel counters have something
 * to count.
 *
 * ---------------------------------------------------------------------------
 * Every function here is best-effort and silent on failure
 * ---------------------------------------------------------------------------
 * A validation that produced a real report must never be reported as failed
 * because an email bounced or a lead row could not be found. Nothing here
 * throws, and the validator calls all of it with `void`.
 *
 * If no template is ACTIVE for a trigger — the normal state after a fresh
 * migration — the send is skipped and logged as such. Nothing below assumes
 * mail actually goes out.
 */

/**
 * The lead belonging to the signed-in user, if there is one.
 *
 * Most validations have no lead behind them: a customer who registered
 * normally and used the validator has an account but never came through the
 * funnel. That is the common case, not an error, so a null result is silent.
 *
 * Read under the caller's own RLS via the "Users read their own lead" policy,
 * so this cannot see anyone else's row.
 */
async function currentUserLeadId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const user = await getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.id ?? null;
  } catch {
    return null;
  }
}

interface ValidationContext {
  ideaTitle: string;
  industry?: string | null;
  /** Present only once a report exists. */
  score?: number | null;
  reportId?: string | null;
}

/**
 * Raise one validation-lifecycle event.
 *
 * Writes the lead timeline first and the email second: the timeline is what
 * the admin funnel counts, and it should be recorded even when no template is
 * active to send anything.
 */
async function raise(
  event: Extract<
    CommunicationEvent,
    | "VALIDATION_STARTED"
    | "VALIDATION_COMPLETED"
    | "VALIDATION_FAILED"
    | "REPORT_READY"
  >,
  workspaceId: string,
  context: ValidationContext,
): Promise<void> {
  try {
    const user = await getUser();
    if (!user?.email) return;

    const leadId = await currentUserLeadId();
    if (leadId) await recordLeadEvent(leadId, event, {});

    const origin = await getOrigin();
    const reportUrl = context.reportId
      ? `${origin}/reports/${context.reportId}`
      : "";

    await emitCommunicationEvent(event, {
      recipientEmail: user.email,
      userId: user.id,
      workspaceId,
      leadId,
      variables: {
        "user.email": user.email,
        "business_idea.title": context.ideaTitle,
        "business_idea.industry": context.industry ?? "",
        "validation.score":
          typeof context.score === "number" ? String(context.score) : "",
        "validation.status": STATUS_WORD[event],
        // Empty rather than a broken link when there is no report yet. The
        // engine leaves an unfilled variable blank and refuses a non-http(s)
        // value outright, so a half-built URL cannot reach an inbox.
        "validation.report_url": reportUrl,
        "validation.pdf_url": reportUrl ? `${reportUrl}/pdf` : "",
        dashboard_url: `${origin}/dashboard`,
      },
    });
  } catch (error) {
    console.error("[onboarding] validation event failed", {
      event,
      message: error instanceof Error ? error.message : error,
    });
  }
}

const STATUS_WORD: Record<string, string> = {
  VALIDATION_STARTED: "In progress",
  VALIDATION_COMPLETED: "Completed",
  VALIDATION_FAILED: "Failed",
  REPORT_READY: "Completed",
};

export async function onValidationStarted(
  workspaceId: string,
  context: ValidationContext,
): Promise<void> {
  await raise("VALIDATION_STARTED", workspaceId, context);
}

/**
 * Completion raises TWO events.
 *
 * `VALIDATION_COMPLETED` is "we finished thinking"; `REPORT_READY` is "there is
 * something to read". They arrive together today, but they are genuinely
 * different facts — a future release that generates the PDF asynchronously will
 * separate them in time, and templates written against the wrong one would
 * then have to be rewritten. Both exist in the seeded template list, and an
 * operator activates whichever one they actually want to send.
 */
export async function onValidationCompleted(
  workspaceId: string,
  context: ValidationContext,
): Promise<void> {
  await raise("VALIDATION_COMPLETED", workspaceId, context);
  await raise("REPORT_READY", workspaceId, context);
}

export async function onValidationFailed(
  workspaceId: string,
  context: ValidationContext,
): Promise<void> {
  await raise("VALIDATION_FAILED", workspaceId, context);
}
