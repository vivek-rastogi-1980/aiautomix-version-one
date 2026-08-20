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
