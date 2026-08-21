"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, Check } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { recordBookingStarted } from "@/features/onboarding/actions";

/**
 * The authenticated booking experience.
 *
 * ---------------------------------------------------------------------------
 * Not a calendar product
 * ---------------------------------------------------------------------------
 * §11 is explicit: do not build a full calendar SaaS. There is no availability
 * engine in this system — no staff calendars, no busy/free data, nothing to
 * query. So this offers a fixed grid of weekday slots and is honest about what
 * that means: the slot is a REQUEST, confirmed by a human afterwards, and the
 * copy says so rather than implying a guaranteed appointment.
 *
 * Inventing an availability API here would be inventing data.
 *
 * ---------------------------------------------------------------------------
 * Identity
 * ---------------------------------------------------------------------------
 * This form posts a name, an email, a slot and a timezone. It does NOT post a
 * user id, a workspace id or a lead id — the server derives all three from the
 * session, and migration 0022 refuses an unowned lead id inside the database
 * even if the endpoint were called directly.
 *
 * ---------------------------------------------------------------------------
 * Double submission
 * ---------------------------------------------------------------------------
 * Three layers, because a double-booked customer is a real support cost:
 *   1. the button disables while the request is in flight
 *   2. the server derives an idempotency key from (email, slot), so a retry
 *      collides instead of creating a second booking
 *   3. the database has a unique index on that key
 * A refresh or a rapid double-click therefore returns the SAME booking.
 */

const SESSION_MINUTES = 30;

/** Slots offered per day. Local to the visitor's own timezone. */
const TIMES = [
  { label: "9:00 AM", hour: 9 },
  { label: "10:00 AM", hour: 10 },
  { label: "11:00 AM", hour: 11 },
  { label: "2:00 PM", hour: 14 },
  { label: "3:00 PM", hour: 15 },
  { label: "4:00 PM", hour: 16 },
];

interface BookingResult {
  booked: boolean;
  duplicate: boolean;
  bookingId: string | null;
  message: string;
}

/** The next `count` weekdays, starting tomorrow. */
function upcomingDays(count: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (days.length < count) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days.push(new Date(cursor));
  }
  return days;
}

export function BookingForm({
  defaultName,
  defaultEmail,
}: {
  defaultName: string;
  defaultEmail: string;
}) {
  const days = useMemo(() => upcomingDays(10), []);
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const [fullName, setFullName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [dayIndex, setDayIndex] = useState(0);
  const [hour, setHour] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BookingResult | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * §19 BOOKING_STARTED — the workflow was opened, which is a different fact
   * from the CTA being clicked (that fires on the dashboard) and from a booking
   * being created. Fires once per mount, and only for a real page open.
   */
  useEffect(() => {
    void recordBookingStarted().catch(() => {});
  }, []);

  const selectedDay = days[dayIndex];
  const canSubmit =
    !pending &&
    hour !== null &&
    fullName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  function submit() {
    if (!canSubmit || !selectedDay || hour === null) return;

    const when = new Date(selectedDay);
    when.setHours(hour, 0, 0, 0);

    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/onboarding/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            notes: notes.trim() || undefined,
            scheduledAt: when.toISOString(),
            timezone,
          }),
        });
        const payload = await response.json().catch(() => null);

        if (response.ok && payload?.success) {
          setResult(payload.data as BookingResult);
          return;
        }
        // Never surface a database or provider message. §"BOOKING UX".
        setError(
          payload?.error?.message ??
            "We couldn't create your booking. Please select another available time.",
        );
      } catch {
        setError(
          "We couldn't create your booking. Please select another available time.",
        );
      }
    });
  }

  // --- Confirmation --------------------------------------------------------
  if (result?.booked) {
    const when = selectedDay ? new Date(selectedDay) : null;
    if (when && hour !== null) when.setHours(hour, 0, 0, 0);

    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-green/15 text-brand-green">
            <Check className="size-5" />
          </span>
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
            {result.duplicate
              ? "You already have this session booked"
              : "Your strategy session is booked."}
          </h2>
        </div>

        <div className="mt-5 rounded-xl border border-line-strong bg-fill-1 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            When
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {when
              ? new Intl.DateTimeFormat("en-GB", {
                  timeZone: timezone,
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(when)
              : "—"}
          </p>
          <p className="text-sm text-muted">
            {when
              ? new Intl.DateTimeFormat("en-GB", {
                  timeZone: timezone,
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                }).format(when)
              : ""}{" "}
            ({timezone}) · {SESSION_MINUTES} minutes
          </p>
          <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted">
            Status
          </p>
          <p className="mt-0.5 text-sm text-foreground">Pending confirmation</p>
        </div>

        <p className="mt-4 text-sm text-muted">
          {result.message ||
            "We will email you a confirmation, and the joining link before the session."}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="rounded-full bg-fill-5 px-4 py-2 text-sm font-medium text-foreground hover:bg-fill-6"
          >
            Back to dashboard
          </Link>
        </div>
      </Card>
    );
  }

  // --- Booking form --------------------------------------------------------
  return (
    <Card className="p-6">
      <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
        Book your Free AI Strategy Session
      </h2>
      <p className="mt-1 text-sm text-muted">
        A {SESSION_MINUTES}-minute conversation about what to build first. Pick
        a slot that suits you and we will confirm it by email.
      </p>

      {/* --- Date ---------------------------------------------------------- */}
      <p className="mt-6 text-xs font-medium uppercase tracking-wider text-muted">
        Choose a day
      </p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
        {days.map((day, index) => (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => setDayIndex(index)}
            className={cn(
              "shrink-0 rounded-xl border px-4 py-3 text-center transition-colors",
              index === dayIndex
                ? "border-brand-violet bg-brand-violet/10 text-foreground"
                : "border-line-strong text-muted hover:bg-fill-3",
            )}
          >
            <span className="block text-xs uppercase tracking-wider">
              {new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(
                day,
              )}
            </span>
            <span className="block text-lg font-semibold">{day.getDate()}</span>
            <span className="block text-xs">
              {new Intl.DateTimeFormat("en-GB", { month: "short" }).format(day)}
            </span>
          </button>
        ))}
      </div>

      {/* --- Time ---------------------------------------------------------- */}
      <p className="mt-5 text-xs font-medium uppercase tracking-wider text-muted">
        Choose a time · {timezone}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TIMES.map((slot) => (
          <button
            key={slot.hour}
            type="button"
            onClick={() => setHour(slot.hour)}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
              hour === slot.hour
                ? "border-brand-violet bg-brand-violet/10 text-foreground"
                : "border-line-strong text-muted hover:bg-fill-3",
            )}
          >
            {slot.label}
          </button>
        ))}
      </div>

      {/* --- Details -------------------------------------------------------- */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">
            Full name
          </span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="h-10 rounded-lg border border-line-strong bg-fill-1 px-3 text-sm text-foreground focus:border-brand-violet focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-10 rounded-lg border border-line-strong bg-fill-1 px-3 text-sm text-foreground focus:border-brand-violet focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">
            Phone (optional)
          </span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="h-10 rounded-lg border border-line-strong bg-fill-1 px-3 text-sm text-foreground focus:border-brand-violet focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">
            What would you like to cover? (optional)
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="rounded-lg border border-line-strong bg-fill-1 px-3 py-2 text-sm text-foreground focus:border-brand-violet focus:outline-none"
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-fill-5 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-fill-6 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CalendarClock className="size-4" />
        {pending ? "Booking…" : "Confirm my session"}
      </button>

      <p className="mt-3 text-xs text-muted-strong">
        These are requested slots, not a live calendar. We confirm every session
        by email, usually within one business day.
      </p>
    </Card>
  );
}
