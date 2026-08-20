import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePermission } from "@/features/admin/guard";
import {
  getLeadDetail,
  BOOKING_STATUS_BADGE,
  LEAD_STATUS_BADGE,
  LEAD_STATUS_LABELS,
  isBookingStatus,
  isLeadStatus,
} from "@/features/admin/leads";
import { EMAIL_STATUS_BADGE } from "@/features/admin/communications";
import {
  LeadNoteControl,
  LeadStatusControl,
  BookingStatusControls,
} from "@/features/admin/lead-controls";
import { PageHeader, EmptyState } from "@/features/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatBookingSlot } from "@/features/communications/booking-format";

export const metadata: Metadata = { title: "Lead" };
export const dynamic = "force-dynamic";

/**
 * One lead, everything about it.
 *
 * The three blocks below the contact card are each governed by a DIFFERENT
 * permission — `bookings.read` for sessions, `communications.read` for email
 * history — so each renders its own "not visible to your role" state rather
 * than the page failing as a whole. A SUPPORT agent answering "did my
 * confirmation arrive?" gets the email log; a role without that grant gets a
 * sentence explaining why the block is empty, which is more useful than an
 * empty block.
 *
 * §"Lead detail": do not expose sensitive authentication data. Nothing on this
 * page reads `auth.users`, and none of these tables has a column that could
 * hold a password, a token or a provider credential.
 */

const EVENT_LABELS: Record<string, string> = {
  LEAD_CREATED: "Lead created",
  IDEA_SUBMITTED: "Idea submitted",
  ACCOUNT_INVITED: "Activation link sent",
  ACCOUNT_CREATED: "Account activated",
  WORKSPACE_CREATED: "Workspace created",
  VALIDATION_STARTED: "Validation started",
  VALIDATION_COMPLETED: "Validation completed",
  VALIDATION_FAILED: "Validation failed",
  REPORT_READY: "Report ready",
  REPORT_VIEWED: "Report viewed",
  REPORT_DOWNLOADED: "Report downloaded",
  STRATEGY_CTA_CLICKED: "Clicked strategy session",
  BOOKING_STARTED: "Started booking",
  BOOKING_CREATED: "Session booked",
  BOOKING_CANCELLED: "Session cancelled",
  BOOKING_COMPLETED: "Session completed",
  STATUS_CHANGED: "Stage changed",
  NOTE_ADDED: "Note",
  EMAIL_SENT: "Email sent",
  LEAD_QUALIFIED: "Qualified",
};

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </span>
      <span className="whitespace-pre-wrap break-words text-sm text-foreground">
        {value}
      </span>
    </div>
  );
}

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { has } = await requirePermission("leads.read");
  const { id } = await params;

  const detail = await getLeadDetail(id);
  if (!detail) notFound();

  const { lead, events, bookings, emails } = detail;
  const name =
    [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() ||
    lead.name ||
    lead.email;

  return (
    <>
      <PageHeader
        title={name}
        description={`${lead.source} · created ${formatDate(lead.created_at)}`}
        actions={
          <Badge
            variant={
              isLeadStatus(lead.status)
                ? LEAD_STATUS_BADGE[lead.status]
                : "neutral"
            }
          >
            {isLeadStatus(lead.status)
              ? LEAD_STATUS_LABELS[lead.status]
              : lead.status}
          </Badge>
        }
      />

      <Link
        href="/admin/leads"
        className="mb-6 inline-block text-sm text-accent hover:underline"
      >
        ← All leads
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* --- Contact and idea ------------------------------------------- */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="p-5">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Contact
            </h2>
            <div className="mt-2 divide-y divide-line">
              <Row label="Email" value={lead.email} />
              <Row label="Phone" value={lead.phone} />
              <Row label="Company" value={lead.company} />
              <Row label="Website" value={lead.website} />
              <Row
                label="Account"
                value={
                  lead.user_id
                    ? "Activated — the visitor followed the link and has a session"
                    : "Not activated. No workspace, no idea and no AI spend until they do."
                }
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              What they told us
            </h2>
            <div className="mt-2 divide-y divide-line">
              <Row label="Business idea" value={lead.message} />
              <Row label="Industry" value={lead.industry} />
              <Row label="Target customer" value={lead.target_customer} />
              <Row label="Target market" value={lead.target_market} />
              <Row label="Stage" value={lead.business_stage} />
              <Row label="Problem being solved" value={lead.problem_solved} />
            </div>
            {!lead.message &&
            !lead.industry &&
            !lead.target_customer &&
            !lead.problem_solved ? (
              <p className="mt-2 text-sm text-muted">
                Nothing beyond contact details — this lead came from a form that
                does not ask about the business.
              </p>
            ) : null}
          </Card>

          {/* --- Attribution --------------------------------------------- */}
          {lead.utm_source ||
          lead.utm_medium ||
          lead.utm_campaign ||
          lead.landing_page ||
          lead.referrer ? (
            <Card className="p-5">
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                Where they came from
              </h2>
              <div className="mt-2 divide-y divide-line">
                <Row label="Landing page" value={lead.landing_page} />
                <Row label="Referrer" value={lead.referrer} />
                <Row label="UTM source" value={lead.utm_source} />
                <Row label="UTM medium" value={lead.utm_medium} />
                <Row label="UTM campaign" value={lead.utm_campaign} />
                <Row label="UTM term" value={lead.utm_term} />
                <Row label="UTM content" value={lead.utm_content} />
              </div>
            </Card>
          ) : null}

          {/* --- Strategy sessions ---------------------------------------- */}
          <Card className="p-5">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Strategy sessions
            </h2>
            {!has("bookings.read") ? (
              <p className="mt-2 text-sm text-muted">
                Not visible to your role. Seeing sessions needs{" "}
                <code className="font-mono text-xs">bookings.read</code>.
              </p>
            ) : bookings.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No session booked yet.</p>
            ) : (
              <div className="mt-3 divide-y divide-line">
                {bookings.map((booking) => {
                  const slot = formatBookingSlot(
                    booking.scheduled_at,
                    booking.timezone,
                  );
                  return (
                    <div key={booking.id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {slot["booking.date"]} at {slot["booking.time"]}
                          </p>
                          <p className="text-xs text-muted">
                            {slot["booking.timezone"]} ·{" "}
                            {booking.duration_minutes} minutes
                          </p>
                        </div>
                        <Badge
                          variant={
                            isBookingStatus(booking.status)
                              ? BOOKING_STATUS_BADGE[booking.status]
                              : "neutral"
                          }
                        >
                          {booking.status}
                        </Badge>
                      </div>
                      {booking.meeting_url ? (
                        <p className="mt-1 break-all text-xs text-muted">
                          {booking.meeting_url}
                        </p>
                      ) : null}
                      {booking.notes ? (
                        <p className="mt-1 text-sm text-muted">
                          {booking.notes}
                        </p>
                      ) : null}
                      {has("bookings.update") ? (
                        <div className="mt-3">
                          <BookingStatusControls
                            bookingId={booking.id}
                            status={booking.status}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* --- Email history -------------------------------------------- */}
          <Card className="p-5">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Email history
            </h2>
            {!has("communications.read") ? (
              <p className="mt-2 text-sm text-muted">
                Not visible to your role. Seeing what was sent needs{" "}
                <code className="font-mono text-xs">communications.read</code>.
              </p>
            ) : emails.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                Nothing has been sent to this lead yet. An email is only logged
                once something raises the event for it.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-line">
                {emails.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">
                        {log.subject ?? log.trigger ?? "—"}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDateTime(log.created_at)} → {log.recipient_email}
                      </p>
                      {log.error_message ? (
                        <p className="mt-0.5 text-xs text-muted-strong">
                          {log.error_message}
                        </p>
                      ) : null}
                    </div>
                    <Badge
                      variant={EMAIL_STATUS_BADGE[log.status] ?? "neutral"}
                    >
                      {log.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* --- Sidebar: stage, note, timeline ----------------------------- */}
        <div className="flex flex-col gap-6">
          {has("leads.update") ? (
            <>
              <Card className="p-5">
                <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                  Move this lead
                </h2>
                <div className="mt-3">
                  <LeadStatusControl
                    leadId={lead.id}
                    current={isLeadStatus(lead.status) ? lead.status : "NEW"}
                  />
                </div>
              </Card>

              <Card className="p-5">
                <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                  Add a note
                </h2>
                <div className="mt-3">
                  <LeadNoteControl leadId={lead.id} />
                </div>
              </Card>
            </>
          ) : null}

          <Card className="p-5">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Timeline
            </h2>
            <p className="mt-1 text-sm text-muted">
              How this lead got where it is. Append-only.
            </p>
            {events.length === 0 ? (
              <EmptyState title="Nothing recorded yet." />
            ) : (
              <ol className="mt-3 divide-y divide-line">
                {events.map((event) => (
                  <li key={event.id} className="py-3">
                    <p className="text-sm font-medium text-foreground">
                      {EVENT_LABELS[event.event] ?? event.event}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(event.created_at)}
                    </p>
                    {event.previous_status && event.new_status ? (
                      <p className="mt-1 text-xs text-muted">
                        {event.previous_status} → {event.new_status}
                      </p>
                    ) : null}
                    {event.note ? (
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">
                        {event.note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
