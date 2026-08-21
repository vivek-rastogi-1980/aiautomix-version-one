"use server";

import { recordFunnelEvent } from "@/features/onboarding/funnel-events";

/**
 * Server Actions for funnel events raised by client components.
 *
 * Thin on purpose. The recording rule, the lead lookup and the
 * never-throw contract all live in `funnel-events.ts`; these exist only
 * because a Client Component cannot import a `server-only` module directly.
 *
 * No input is accepted from the browser. The lead is resolved server-side from
 * `auth.uid()`, so a caller cannot name someone else's lead — the same reason
 * the booking route derives identity from the session rather than the body.
 */

export async function recordStrategyCtaClick(): Promise<void> {
  await recordFunnelEvent("STRATEGY_CTA_CLICKED", { surface: "dashboard" });
}

export async function recordBookingStarted(): Promise<void> {
  await recordFunnelEvent("BOOKING_STARTED", { surface: "strategy-session" });
}
