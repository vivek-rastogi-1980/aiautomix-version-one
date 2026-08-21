import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { BusinessIdea, ValidationReport } from "@/types/database";

/**
 * The customer's own funnel state, for the dashboard.
 *
 * ---------------------------------------------------------------------------
 * Reuse, not a second model
 * ---------------------------------------------------------------------------
 * Everything here reads tables that already existed: `business_ideas` (0002),
 * `validation_reports` (0002), `bookings` and `leads` (0019). No new table, no
 * derived status column, no cached score. The dashboard shows what the
 * validation engine actually produced, which is why a stale or invented score
 * cannot appear on it.
 *
 * Every query is scoped by `user_id` AND runs under the caller's own RLS. The
 * explicit filter is not the security boundary — the policies are — but a
 * forgotten filter would then return nothing rather than someone else's data.
 *
 * ---------------------------------------------------------------------------
 * Where the status comes from
 * ---------------------------------------------------------------------------
 * `business_ideas.status` is the authority: the validator sets `processing` on
 * insert, `completed` once the report is stored, `failed` in its catch block.
 * The dashboard maps those to the four states §9 asks for rather than guessing
 * from the presence of a report — an idea can be `failed` and have no report,
 * and "no report yet" is not the same fact as "the run failed".
 */

export type ValidationState = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface DashboardFunnel {
  /** The customer's most recent idea, or null if they have never submitted one. */
  idea: BusinessIdea | null;
  /** The report for that idea, when one exists. */
  report: ValidationReport | null;
  state: ValidationState;
  /** Their most recent booking, whatever its status. */
  booking: {
    id: string;
    scheduled_at: string;
    timezone: string;
    status: string;
    meeting_url: string | null;
  } | null;
  /** Fields the visitor gave at capture that the idea row does not carry. */
  leadContext: {
    industry: string | null;
    target_customer: string | null;
    target_market: string | null;
  } | null;
}

function stateFor(
  idea: BusinessIdea | null,
  report: ValidationReport | null,
): ValidationState {
  if (!idea) return "PENDING";
  switch (idea.status) {
    case "completed":
      // Completed without a stored report is not a success the customer can
      // act on, so it is reported as still running rather than offering a
      // "View report" button that would 404.
      return report ? "COMPLETED" : "RUNNING";
    case "failed":
      return "FAILED";
    case "processing":
      return "RUNNING";
    default:
      return "PENDING";
  }
}

export async function getDashboardFunnel(
  userId: string,
): Promise<DashboardFunnel> {
  const supabase = await createClient();

  const { data: idea } = await supabase
    .from("business_ideas")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [reportResult, bookingResult, leadResult] = await Promise.all([
    idea
      ? supabase
          .from("validation_reports")
          .select("*")
          .eq("business_idea_id", idea.id)
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("bookings")
      .select("id, scheduled_at, timezone, status, meeting_url")
      .eq("user_id", userId)
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // The capture form asks for industry and target market; the idea row does
    // not have columns for them. Read from the lead so the dashboard can show
    // what the customer actually told us.
    supabase
      .from("leads")
      .select("industry, target_customer, target_market")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const report = (reportResult.data as ValidationReport | null) ?? null;

  return {
    idea: (idea as BusinessIdea | null) ?? null,
    report,
    state: stateFor((idea as BusinessIdea | null) ?? null, report),
    booking: bookingResult.data ?? null,
    leadContext: leadResult.data ?? null,
  };
}
