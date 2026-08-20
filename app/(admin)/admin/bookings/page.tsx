import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/features/admin/guard";
import {
  listBookings,
  BOOKING_STATUSES,
  BOOKING_STATUS_BADGE,
  isBookingStatus,
} from "@/features/admin/leads";
import { BookingStatusControls } from "@/features/admin/lead-controls";
import { pageParams, first, searchTerm } from "@/features/admin/query";
import {
  PageHeader,
  TableShell,
  Th,
  Td,
  EmptyState,
  Pagination,
  FilterBar,
  Field,
  SelectFilter,
  TextFilter,
} from "@/features/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatBookingSlot } from "@/features/communications/booking-format";

export const metadata: Metadata = { title: "Strategy sessions" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Admin → Strategy sessions.
 *
 * Every slot anyone has requested, and the controls to work it. Times are
 * rendered in the customer's own timezone rather than the operator's, because
 * this is the page somebody uses to send "see you at 3" — and the stored
 * instant plus their IANA zone is exactly the information needed to say that
 * correctly.
 *
 * §5 is explicit that this is not a calendar product. There is no availability
 * engine here and no recurrence: a booking is a requested slot with a
 * lifecycle, and this page is where that lifecycle is driven.
 */
export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { has } = await requirePermission("bookings.read");

  const sp = await searchParams;
  const params = pageParams(sp.page, sp.size);
  const search = searchTerm(sp.q);
  const status = first(sp.status);
  const upcoming = first(sp.when) === "upcoming";

  const result = await listBookings(params, { search, status, upcoming });

  return (
    <>
      <PageHeader
        title="Strategy sessions"
        description="Free AI strategy sessions, in the customer's own timezone."
      />

      <FilterBar action="/admin/bookings">
        <Field label="Search">
          <TextFilter
            name="q"
            defaultValue={first(sp.q)}
            placeholder="Name or email"
          />
        </Field>
        <Field label="Status">
          <SelectFilter
            name="status"
            defaultValue={status}
            options={[
              { value: "", label: "All" },
              ...BOOKING_STATUSES.map((value) => ({ value, label: value })),
            ]}
          />
        </Field>
        <Field label="When">
          <SelectFilter
            name="when"
            defaultValue={first(sp.when)}
            options={[
              { value: "", label: "Any time" },
              { value: "upcoming", label: "Upcoming only" },
            ]}
          />
        </Field>
      </FilterBar>

      {result.rows.length === 0 ? (
        <EmptyState
          title="No sessions match."
          hint="Sessions are created by the public booking form and by the dashboard CTA."
        />
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Status</Th>
                <Th>Lead</Th>
                {has("bookings.update") ? <Th>Actions</Th> : null}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((booking) => {
                const slot = formatBookingSlot(
                  booking.scheduled_at,
                  booking.timezone,
                );
                return (
                  <tr key={booking.id} className="align-top hover:bg-fill-1">
                    <Td className="whitespace-nowrap">
                      <span className="font-medium text-foreground">
                        {slot["booking.date"]}
                      </span>
                      <span className="block text-xs text-muted">
                        {slot["booking.time"]} · {slot["booking.timezone"]}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-medium text-foreground">
                        {booking.full_name}
                      </span>
                      <span className="block text-xs text-muted">
                        {booking.email}
                      </span>
                      {booking.phone ? (
                        <span className="block text-xs text-muted">
                          {booking.phone}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge
                        variant={
                          isBookingStatus(booking.status)
                            ? BOOKING_STATUS_BADGE[booking.status]
                            : "neutral"
                        }
                      >
                        {booking.status}
                      </Badge>
                    </Td>
                    <Td>
                      {booking.lead_id ? (
                        <Link
                          href={`/admin/leads/${booking.lead_id}`}
                          className="text-sm text-accent hover:underline"
                        >
                          Open lead →
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-strong">—</span>
                      )}
                    </Td>
                    {has("bookings.update") ? (
                      <Td>
                        <BookingStatusControls
                          bookingId={booking.id}
                          status={booking.status}
                        />
                      </Td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </TableShell>

          <Pagination
            page={result}
            basePath="/admin/bookings"
            params={{
              q: first(sp.q),
              status,
              when: first(sp.when),
              size: first(sp.size),
            }}
          />
        </>
      )}

      <Card className="mt-6 p-5">
        <p className="text-sm text-muted">
          Cancelling raises <code className="font-mono text-xs">
            BOOKING_CANCELLED
          </code>
          , which sends an email only if a template for that trigger is active.
          Confirming and completing send nothing — there is no template that
          says anything a customer needs at those moments, and wiring one that
          did nothing would only look like a feature.
        </p>
      </Card>
    </>
  );
}
