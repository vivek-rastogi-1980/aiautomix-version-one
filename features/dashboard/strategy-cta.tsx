"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { recordStrategyCtaClick } from "@/features/onboarding/actions";

/**
 * The "Book a Free AI Strategy Session" call to action.
 *
 * A client component for one reason: §19 requires STRATEGY_CTA_CLICKED to be
 * recorded on the CLICK, not on the render. A plain `<Link>` in the server
 * component would give us no click to observe, and recording at render time
 * would count every dashboard visit as intent — inflating the one conversion
 * rate this CTA exists to measure.
 *
 * The event is fired and then navigation happens regardless of its outcome:
 * an analytics write must never stand between a customer and the thing they
 * clicked. `recordStrategyCtaClick` swallows its own errors, and the
 * `catch` here is belt and braces for a transport failure.
 */
export function StrategyCtaLink({ hasBooking }: { hasBooking: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go() {
    startTransition(async () => {
      await recordStrategyCtaClick().catch(() => {});
      router.push("/strategy-session");
    });
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-fill-3 disabled:opacity-50"
    >
      <CalendarClock className="size-4" />
      {hasBooking ? "Book another session" : "Book a Free AI Strategy Session"}
    </button>
  );
}
