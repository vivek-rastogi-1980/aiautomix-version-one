import Link from "next/link";
import {
  CalendarClock,
  Download,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { formatBookingSlot } from "@/features/communications/booking-format";
import { StrategyCtaLink } from "@/features/dashboard/strategy-cta";
import type { DashboardFunnel } from "@/features/dashboard/funnel-data";

/**
 * The customer's funnel panel — what §8 and §9 ask the dashboard to say.
 *
 * A Server Component. The only client JavaScript on this panel is the strategy
 * CTA, which has to be a client component to record the click; everything else
 * renders on the server.
 *
 * ---------------------------------------------------------------------------
 * Actions appear only when they work
 * ---------------------------------------------------------------------------
 * §8: "Do not display actions that are not currently available." So "View
 * report" and "Download PDF" render only when a report row genuinely exists —
 * not when the idea merely claims to be complete. A disabled-looking button
 * that 404s is worse than no button, because it teaches the customer the
 * product is broken.
 *
 * The score is read from `validation_reports.score`, the value the validator
 * actually stored. Nothing here derives, estimates or defaults a score.
 */

const STATE_COPY: Record<
  DashboardFunnel["state"],
  {
    badge: string;
    variant: "brand" | "active" | "completed" | "archived";
    line: string;
    savedLine?: string;
  }
> = {
  PENDING: {
    badge: "Not started",
    variant: "brand",
    // Two different situations reach PENDING and they need different words.
    // `line` is for a customer with no idea at all; `savedLine` is for one
    // whose idea is saved but not yet validated. Showing "submit your business
    // idea" to somebody who just did exactly that is the single most confusing
    // thing this panel could say.
    line: "Submit your business idea and our AI will get to work on it.",
    savedLine:
      "Your idea is saved and ready. Start the AI validation whenever you are.",
  },
  RUNNING: {
    badge: "In progress",
    variant: "completed",
    line: "Your AI business validation is in progress. We will email you the moment it is ready.",
  },
  COMPLETED: {
    badge: "Ready",
    variant: "active",
    line: "Your validation report is ready.",
  },
  FAILED: {
    badge: "Failed",
    variant: "archived",
    line: "We couldn't complete your validation. Please try again.",
  },
};

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-0.5 break-words text-sm text-foreground">{value}</p>
    </div>
  );
}

export function IdeaPanel({ funnel }: { funnel: DashboardFunnel }) {
  const { idea, report, state, booking, leadContext } = funnel;
  const copy = STATE_COPY[state];

  // No idea yet: point at the validator rather than rendering an empty shell.
  if (!idea) {
    return (
      <Card className="p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Your business idea
        </h2>
        <p className="mt-1 text-sm text-muted">{copy.line}</p>
        <Link
          href="/validator"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-fill-5 px-4 py-2 text-sm font-medium text-foreground hover:bg-fill-6"
        >
          Validate an idea
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            {idea.title}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Submitted {formatDate(idea.created_at)}
          </p>
        </div>
        <Badge variant={copy.variant}>{copy.badge}</Badge>
      </div>

      {/* --- What they told us ------------------------------------------- */}
      {leadContext ? (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Industry" value={leadContext.industry} />
          <Field label="Target customer" value={leadContext.target_customer} />
          <Field label="Target market" value={leadContext.target_market} />
        </div>
      ) : null}

      {/* --- Status ------------------------------------------------------- */}
      <div
        className={cn(
          "mt-5 flex items-start gap-3 rounded-xl border p-4",
          state === "FAILED"
            ? "border-red-500/30 bg-red-500/[0.04]"
            : "border-line-strong bg-fill-1",
        )}
      >
        {state === "RUNNING" ? (
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-accent" />
        ) : null}
        <div className="min-w-0">
          <p className="text-sm text-foreground">
            {state === "PENDING" && copy.savedLine ? copy.savedLine : copy.line}
          </p>
          {state === "COMPLETED" && report ? (
            <p className="mt-3">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {report.score}
              </span>
              <span className="text-base text-muted">/100</span>
              <span className="ml-2 text-sm text-muted">validation score</span>
            </p>
          ) : null}
        </div>
      </div>

      {/* --- Actions ------------------------------------------------------
          Rendered only when the underlying thing exists. */}
      <div className="mt-5 flex flex-wrap gap-2">
        {report ? (
          <>
            <Link
              href={`/reports/${report.id}`}
              className="inline-flex items-center gap-2 rounded-full bg-fill-5 px-4 py-2 text-sm font-medium text-foreground hover:bg-fill-6"
            >
              <FileText className="size-4" /> View validation report
            </Link>
            <a
              href={`/api/reports/${report.id}/pdf`}
              className="inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-foreground hover:bg-fill-3"
            >
              <Download className="size-4" /> Download PDF
            </a>
          </>
        ) : null}

        {state === "PENDING" ? (
          <Link
            href="/validator"
            className="inline-flex items-center gap-2 rounded-full bg-fill-5 px-4 py-2 text-sm font-medium text-foreground hover:bg-fill-6"
          >
            <Sparkles className="size-4" /> Start AI validation
          </Link>
        ) : null}

        {state === "FAILED" ? (
          <Link
            href="/validator"
            className="inline-flex items-center gap-2 rounded-full bg-fill-5 px-4 py-2 text-sm font-medium text-foreground hover:bg-fill-6"
          >
            Try again
          </Link>
        ) : null}

        <StrategyCtaLink hasBooking={Boolean(booking)} />
      </div>

      {/* --- Existing booking --------------------------------------------- */}
      {booking ? (
        <div className="mt-5 rounded-xl border border-line-strong bg-fill-1 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Your strategy session
          </p>
          {(() => {
            const slot = formatBookingSlot(
              booking.scheduled_at,
              booking.timezone,
            );
            return (
              <p className="mt-1 text-sm text-foreground">
                <CalendarClock className="mr-1.5 inline size-4 text-accent" />
                {slot["booking.date"]} at {slot["booking.time"]} (
                {slot["booking.timezone"]}) ·{" "}
                <span className="text-muted">{booking.status}</span>
              </p>
            );
          })()}
          {booking.meeting_url ? (
            <p className="mt-1 break-all text-sm text-muted">
              {booking.meeting_url}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* --- Next steps ---------------------------------------------------- */}
      <ol className="mt-6 space-y-1.5 text-sm text-muted">
        <li className={report ? "text-foreground" : undefined}>
          1. Review your validation report
        </li>
        <li className={report ? "text-foreground" : undefined}>
          2. Download your report
        </li>
        <li className={booking ? "text-foreground" : undefined}>
          3. Book your free AI strategy session
        </li>
      </ol>
    </Card>
  );
}
