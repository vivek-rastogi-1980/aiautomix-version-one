import type { LeadStatus } from "@/types/database";
import { LEAD_STATUSES } from "@/types/database";

/**
 * Lead and booking vocabulary shared by server pages and client controls.
 *
 * Deliberately NOT in `features/admin/leads.ts`, which is `server-only`: the
 * status dropdown in `lead-controls.tsx` is a Client Component and needs these
 * labels. Importing them from the data module would pull a Supabase server
 * client into the browser bundle — which `server-only` correctly refuses at
 * build time.
 *
 * So the split is along the line that matters: this file holds names and
 * colours and knows nothing about the database; the data module holds the
 * queries. Nothing here touches I/O, so it is safe on either side of the
 * boundary.
 */

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  STRATEGY_BOOKED: "Strategy booked",
  STRATEGY_COMPLETED: "Strategy completed",
  PROPOSAL: "Proposal",
  CUSTOMER: "Customer",
  LOST: "Lost",
};

/**
 * Badge colour per stage.
 *
 * Only `CUSTOMER` gets the "active" green. The point of a funnel list is that
 * an operator can find the won deals at a glance, and colouring six stages
 * differently would defeat that.
 */
export const LEAD_STATUS_BADGE: Record<
  LeadStatus,
  "brand" | "active" | "completed" | "neutral" | "archived"
> = {
  NEW: "brand",
  CONTACTED: "neutral",
  QUALIFIED: "completed",
  STRATEGY_BOOKED: "completed",
  STRATEGY_COMPLETED: "completed",
  PROPOSAL: "completed",
  CUSTOMER: "active",
  LOST: "archived",
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return (
    typeof value === "string" &&
    (LEAD_STATUSES as readonly string[]).includes(value)
  );
}

/** The five booking states from §"Booking states". Not four, not seven. */
export const BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export function isBookingStatus(value: unknown): value is BookingStatus {
  return (
    typeof value === "string" &&
    (BOOKING_STATUSES as readonly string[]).includes(value)
  );
}

export const BOOKING_STATUS_BADGE: Record<
  BookingStatus,
  "brand" | "active" | "completed" | "neutral" | "archived"
> = {
  PENDING: "brand",
  CONFIRMED: "completed",
  COMPLETED: "active",
  CANCELLED: "archived",
  NO_SHOW: "neutral",
};

export const EMAIL_STATUS_BADGE: Record<
  string,
  "brand" | "active" | "completed" | "neutral" | "archived"
> = {
  SENT: "active",
  QUEUED: "brand",
  FAILED: "archived",
  SKIPPED: "neutral",
};
