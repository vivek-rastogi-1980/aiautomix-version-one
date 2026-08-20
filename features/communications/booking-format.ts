/**
 * Rendering a booking slot for a human.
 *
 * ---------------------------------------------------------------------------
 * The bug this exists to prevent
 * ---------------------------------------------------------------------------
 * `bookings` stores an absolute instant (`scheduled_at`) alongside the
 * visitor's IANA zone. The obvious way to fill `{{booking.date}}` and
 * `{{booking.time}}` is to slice the ISO string:
 *
 *   when.toISOString().slice(11, 16)   →  "09:30"
 *
 * That is the time in UTC. Putting it next to `{{booking.timezone}}` produces a
 * confirmation reading "09:30, Asia/Kolkata" for a call that happens at 15:00
 * their time — a message that is wrong by five and a half hours while looking
 * completely reasonable, and whose first symptom is somebody missing a meeting.
 *
 * `Intl.DateTimeFormat` does the conversion properly, including the DST rules
 * for the date in question, which is the other half of why hand-rolled offset
 * arithmetic does not survive contact with March.
 *
 * A plain module: no I/O, no clock of its own, pure functions.
 */

export interface BookingSlotStrings {
  "booking.date": string;
  "booking.time": string;
  "booking.timezone": string;
}

/**
 * Format an instant in the booking's own timezone.
 *
 * An unknown or malformed zone falls back to UTC and says so, rather than
 * throwing. This runs on the path that sends a confirmation for a booking that
 * has already been committed; a `RangeError` here would cost the customer their
 * confirmation over a bad string in one column.
 */
export function formatBookingSlot(
  scheduledAtIso: string,
  timezone: string,
): BookingSlotStrings {
  const when = new Date(scheduledAtIso);

  if (Number.isNaN(when.getTime())) {
    return {
      "booking.date": "",
      "booking.time": "",
      "booking.timezone": timezone,
    };
  }

  const zone = isUsableTimeZone(timezone) ? timezone : "UTC";

  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(when);

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(when);

  return {
    "booking.date": date,
    "booking.time": time,
    "booking.timezone": zone,
  };
}

/** Does the runtime recognise this IANA zone? */
function isUsableTimeZone(timezone: string): boolean {
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
