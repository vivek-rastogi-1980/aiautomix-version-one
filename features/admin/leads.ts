import "server-only";

import { createClient } from "@/lib/supabase/server";
import { paged, type PageParams, type Paged } from "@/features/admin/query";
import type {
  BookingRow,
  EmailLogRow,
  Lead,
  LeadEventRow,
} from "@/types/database";
import {
  isBookingStatus,
  isLeadStatus,
} from "@/features/admin/lead-vocabulary";

/**
 * Read-side data access for Admin → Leads and Admin → Bookings.
 *
 * Same contract as `features/admin/data.ts`: every query runs as the signed-in
 * admin's own session, there is no service-role client, and the cross-customer
 * reach comes entirely from the `admin_has('leads.read')` /
 * `admin_has('bookings.read')` policies in migration 0019.
 *
 * The practical consequence is worth restating because it is what makes the
 * admin panel safe to extend: a caller who reaches these functions without the
 * grant gets an EMPTY RESULT, not data. A forgotten `requirePermission()`
 * upstream renders a blank page rather than leaking a customer's business idea.
 *
 * Every function swallows its error and returns an empty shape. That is
 * deliberate for a read: an operator seeing "no leads" and checking their role
 * is a better failure than a 500 page mid-incident, and the error is still in
 * the server log.
 */

/**
 * The presentation vocabulary lives in `lead-vocabulary.ts`, which is not
 * `server-only`, because the client-side status controls need the labels. It is
 * re-exported here so a page importing from this module still gets everything
 * it needs in one import.
 */
export {
  BOOKING_STATUSES,
  BOOKING_STATUS_BADGE,
  LEAD_STATUS_BADGE,
  LEAD_STATUS_LABELS,
  isBookingStatus,
  isLeadStatus,
  type BookingStatus,
} from "@/features/admin/lead-vocabulary";

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export interface LeadListFilters {
  search?: string;
  status?: string;
  source?: string;
}

/**
 * The lead list.
 *
 * Ordered by `last_activity_at` first, falling back to `created_at`, because
 * the question an operator opens this page with is "what moved?" rather than
 * "what is oldest". `nullsFirst: false` keeps never-touched leads below the
 * ones with a timeline.
 */
export async function listLeads(
  params: PageParams,
  filters: LeadListFilters = {},
): Promise<Paged<Lead>> {
  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(params.from, params.to);

  if (filters.search) {
    // `escapeSearch` has already neutralised the PostgREST filter grammar, so
    // the term cannot change the shape of this `or`, only its value.
    query = query.or(
      `email.ilike.%${filters.search}%,` +
        `first_name.ilike.%${filters.search}%,` +
        `last_name.ilike.%${filters.search}%,` +
        `name.ilike.%${filters.search}%,` +
        `company.ilike.%${filters.search}%`,
    );
  }
  if (filters.status && isLeadStatus(filters.status)) {
    query = query.eq("status", filters.status);
  }
  if (filters.source) {
    query = query.eq("source", filters.source);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error("[admin] lead list failed", error.message);
    return paged<Lead>([], 0, params);
  }

  return paged<Lead>(data ?? [], count ?? 0, params);
}

/** The distinct sources present, for the filter dropdown. */
export async function leadSources(): Promise<string[]> {
  const supabase = await createClient();
  // Capped: this feeds a `<select>`, and an unbounded distinct scan on a table
  // that only grows is the kind of query that is fine until it is not.
  const { data } = await supabase
    .from("leads")
    .select("source")
    .order("created_at", { ascending: false })
    .limit(500);

  return [...new Set((data ?? []).map((row) => row.source))].sort();
}

export interface LeadDetail {
  lead: Lead;
  events: LeadEventRow[];
  bookings: BookingRow[];
  /** Empty unless the caller also holds `communications.read`. */
  emails: EmailLogRow[];
}

/**
 * Everything an admin needs to work one lead.
 *
 * Four reads rather than one nested select: `bookings` and `email_logs` are
 * governed by DIFFERENT permissions from `leads`, so joining them would mean a
 * SUPPORT user's whole page failing when one block is denied. Fetched
 * separately, each block simply comes back empty and the rest of the page
 * still answers the question the operator came with.
 *
 * §"Lead detail" — "Do not expose sensitive authentication data." Nothing here
 * reads `auth.users`, and no column on any of these tables holds a password, a
 * token or a provider credential.
 */
export async function getLeadDetail(
  leadId: string,
): Promise<LeadDetail | null> {
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return null;

  const [eventsResult, bookingsResult, emailsResult] = await Promise.all([
    supabase
      .from("lead_events")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("bookings")
      .select("*")
      .eq("lead_id", leadId)
      .order("scheduled_at", { ascending: false }),
    supabase
      .from("email_logs")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    lead,
    events: eventsResult.data ?? [],
    bookings: bookingsResult.data ?? [],
    emails: emailsResult.data ?? [],
  };
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export interface BookingListFilters {
  search?: string;
  status?: string;
  upcoming?: boolean;
}

export async function listBookings(
  params: PageParams,
  filters: BookingListFilters = {},
): Promise<Paged<BookingRow>> {
  const supabase = await createClient();

  let query = supabase
    .from("bookings")
    .select("*", { count: "exact" })
    .order("scheduled_at", { ascending: false })
    .range(params.from, params.to);

  if (filters.search) {
    query = query.or(
      `email.ilike.%${filters.search}%,full_name.ilike.%${filters.search}%`,
    );
  }
  if (filters.status && isBookingStatus(filters.status)) {
    query = query.eq("status", filters.status);
  }
  if (filters.upcoming) {
    query = query.gte("scheduled_at", new Date().toISOString());
  }

  const { data, count, error } = await query;
  if (error) {
    console.error("[admin] booking list failed", error.message);
    return paged<BookingRow>([], 0, params);
  }

  return paged<BookingRow>(data ?? [], count ?? 0, params);
}

// ---------------------------------------------------------------------------
// Funnel metrics
// ---------------------------------------------------------------------------

/**
 * The counters behind Admin → Dashboard → Funnel.
 *
 * Counted in SQL by `admin_funnel_stats`, which gates each block on its own
 * permission and omits the keys a role cannot see. The UI reads a missing key
 * as "Unavailable" rather than zero — the same contract every other stat block
 * on that page already uses, and the reason `Stat` distinguishes the two.
 */
export async function getFunnelStats(): Promise<Record<
  string,
  number | string
> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_funnel_stats", {
    p_since: null,
  });

  if (error) {
    console.error("[admin] funnel stats unavailable", error.message);
    return null;
  }
  return (data as Record<string, number | string> | null) ?? null;
}

// ---------------------------------------------------------------------------
// Command center (Phase 12)
// ---------------------------------------------------------------------------

/** One workflow's slice of AI spend. Money arrives as text, never a float. */
export interface WorkflowUsage {
  workflow: string;
  requests: number;
  failures: number;
  tokens: number;
  /** Decimal string. Format it; never do arithmetic on it in JavaScript. */
  cost: string;
}

/**
 * Aggregates for the Super Admin command center.
 *
 * Backed by `admin_command_center_stats` (migration 0024), which counts
 * everything in SQL and gates each block on its own permission. A key the
 * caller may not see is ABSENT from the object rather than zero, and the `Stat`
 * component turns that into "Unavailable" — because `0 leads` and `you cannot
 * see leads` are different facts and an operator acting on the wrong one makes
 * a bad decision.
 *
 * Returns null on error, which the page also renders as unavailable. A metrics
 * failure must not take the admin panel down during the incident it is there
 * to help diagnose.
 */
export async function getCommandCenterStats(): Promise<Record<
  string,
  unknown
> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_command_center_stats", {
    p_since: null,
  });

  if (error) {
    console.error("[admin] command center stats unavailable", error.message);
    return null;
  }
  return (data as Record<string, unknown> | null) ?? null;
}

/** The funnel, in journey order, with drop-off between consecutive stages. */
export interface FunnelStage {
  key: string;
  label: string;
  count: number | null;
  /** Percentage of the FIRST stage that reached this one. */
  ofTop: number | null;
  /** Percentage lost between the previous stage and this one. */
  dropOff: number | null;
}

const FUNNEL_ORDER: { key: string; label: string }[] = [
  { key: "stage_lead_created", label: "Lead created" },
  { key: "stage_idea_submitted", label: "Idea submitted" },
  { key: "stage_account_activated", label: "Account activated" },
  { key: "stage_validated", label: "Validation completed" },
  { key: "stage_report_viewed", label: "Report viewed" },
  { key: "stage_report_downloaded", label: "Report downloaded" },
  { key: "stage_cta_clicked", label: "Strategy CTA clicked" },
  { key: "stage_booking_created", label: "Booking created" },
  { key: "stage_booking_completed", label: "Session completed" },
];

/**
 * Shape the raw counters into an ordered funnel.
 *
 * Percentages are computed here rather than in SQL because they are pure
 * presentation of numbers the database already produced — no row is loaded to
 * derive them. Division by zero yields null, not 0%: an empty funnel has no
 * conversion rate, and printing 0% would read as a collapse rather than an
 * absence of traffic.
 */
export function buildFunnel(
  stats: Record<string, unknown> | null,
): FunnelStage[] {
  const value = (key: string): number | null => {
    const raw = stats?.[key];
    return typeof raw === "number" ? raw : null;
  };

  const top = value(FUNNEL_ORDER[0]!.key);

  return FUNNEL_ORDER.map((stage, index) => {
    const count = value(stage.key);
    const previous = index === 0 ? null : value(FUNNEL_ORDER[index - 1]!.key);

    return {
      key: stage.key,
      label: stage.label,
      count,
      ofTop:
        count !== null && top !== null && top > 0
          ? Math.round((count / top) * 1000) / 10
          : null,
      dropOff:
        count !== null && previous !== null && previous > 0
          ? Math.round((1 - count / previous) * 1000) / 10
          : null,
    };
  });
}
