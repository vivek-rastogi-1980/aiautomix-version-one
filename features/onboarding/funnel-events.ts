import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";

/**
 * Funnel event recording for the authenticated half of the journey.
 *
 * ---------------------------------------------------------------------------
 * What this is for
 * ---------------------------------------------------------------------------
 * `lead_events` is the timeline behind Admin -> Leads and the conversion rates
 * on the admin dashboard. The anonymous half of the funnel writes to it from
 * `lead_capture`; this is the authenticated half — the events that only exist
 * once somebody is signed in and doing something:
 *
 *   REPORT_VIEWED  REPORT_DOWNLOADED  STRATEGY_CTA_CLICKED
 *   BOOKING_STARTED  BOOKING_CREATED  BOOKING_COMPLETED
 *
 * Before this existed those counters could only ever read zero, which made the
 * "Report -> strategy booked" conversion rate meaningless rather than merely
 * empty.
 *
 * ---------------------------------------------------------------------------
 * Only real actions, never a render
 * ---------------------------------------------------------------------------
 * §19 is explicit: do not generate events from page rendering. So each call
 * site places the call AFTER the thing has actually happened and been
 * authorised — after the report row is confirmed to belong to the caller,
 * after the PDF is confirmed renderable, after `booking_create` returns.
 *
 * A prefetch, a metadata request, a crawler or an unauthorised attempt reaches
 * none of those points, and so records nothing.
 *
 * ---------------------------------------------------------------------------
 * Silent by design
 * ---------------------------------------------------------------------------
 * Analytics must never be able to fail a user's action — the same contract
 * `recordLeadEvent` already documents. Every function here swallows its errors:
 * a customer reading their report must not see an error because a timeline row
 * could not be written.
 *
 * A user with no lead behind them (someone who registered normally rather than
 * through the funnel) records nothing at all, silently. That is the common
 * case, not a fault.
 */

/** The authenticated-side events. Constrained by the CHECK in migration 0019. */
export type FunnelEvent =
  | "REPORT_VIEWED"
  | "REPORT_DOWNLOADED"
  | "STRATEGY_CTA_CLICKED"
  | "BOOKING_STARTED"
  | "BOOKING_CREATED"
  | "BOOKING_COMPLETED";

/**
 * The signed-in user's lead, if the funnel produced one.
 *
 * Read under the caller's own RLS through the "Users read their own lead"
 * policy, so it can only ever see their row. Newest first, because a person who
 * came back and submitted a second idea should have activity attributed to the
 * lead they are currently working.
 */
async function currentLeadId(): Promise<string | null> {
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

/**
 * Record one funnel event against the signed-in user's lead.
 *
 * Goes through `lead_record_event`, which re-checks in Postgres that the caller
 * either owns the lead or holds `leads.update`. So this cannot be used to write
 * onto somebody else's timeline even if the id were wrong.
 */
export async function recordFunnelEvent(
  event: FunnelEvent,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const leadId = await currentLeadId();
    if (!leadId) return;

    const supabase = await createClient();
    await supabase.rpc("lead_record_event", {
      p_lead_id: leadId,
      p_event: event,
      p_note: null,
      p_metadata: metadata as never,
    });
  } catch (error) {
    console.error("[funnel] could not record event", {
      event,
      message: error instanceof Error ? error.message : error,
    });
  }
}
