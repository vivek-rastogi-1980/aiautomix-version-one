import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FunnelStage, WorkflowUsage } from "@/features/admin/leads";

/**
 * Command center panels: the lead funnel, and AI spend per workflow.
 *
 * Server Components — no client JavaScript. Both render numbers the database
 * already aggregated; nothing here sums, averages or converts anything.
 *
 * ---------------------------------------------------------------------------
 * "Unavailable" is a real state and it is not zero
 * ---------------------------------------------------------------------------
 * Every count can be `null`, which happens when the caller's role cannot see
 * that block. It renders as an em dash and a note, never as `0`. An operator
 * who reads "0 bookings" when they simply lack `bookings.read` will conclude
 * the funnel is broken and go looking for a bug that does not exist.
 */

function pct(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

export function FunnelPanel({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0]?.count ?? null;
  const visible = stages.some((stage) => stage.count !== null);

  if (!visible) {
    return (
      <Card className="p-5">
        <p className="text-sm font-medium text-foreground">
          Funnel not visible to your role.
        </p>
        <p className="mt-1 text-sm text-muted">
          Seeing the funnel needs{" "}
          <code className="font-mono text-xs">leads.read</code>.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-2">
        {stages.map((stage, index) => {
          // Bar width is share of the FIRST stage, so the shape of the funnel
          // is visible at a glance. A stage with no data gets no bar rather
          // than a zero-width one, which would look like total drop-off.
          const width =
            stage.count !== null && top !== null && top > 0
              ? Math.max((stage.count / top) * 100, 1.5)
              : null;

          // Worth flagging: more than half the people who reached the previous
          // step did not reach this one.
          const severe = stage.dropOff !== null && stage.dropOff >= 50;

          return (
            // Stacks on mobile. A fixed 176px label beside a bar and two
            // fixed columns overflowed a 375px viewport by 34px, pushing the
            // whole admin page sideways.
            <div
              key={stage.key}
              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="w-full truncate text-sm text-muted sm:w-44 sm:shrink-0">
                {stage.label}
              </span>

              <div className="flex min-w-0 items-center gap-2 sm:flex-1 sm:gap-3">
                <div className="relative h-8 min-w-0 flex-1 overflow-hidden rounded-lg bg-fill-1">
                  {width !== null ? (
                    <div
                      className="h-full rounded-lg bg-brand-violet/25"
                      style={{ width: `${width}%` }}
                    />
                  ) : null}
                  <span className="absolute inset-y-0 left-3 flex items-center text-sm font-medium text-foreground">
                    {stage.count === null
                      ? "—"
                      : stage.count.toLocaleString("en-US")}
                  </span>
                </div>

                <span className="w-12 shrink-0 text-right text-sm text-muted sm:w-16">
                  {pct(stage.ofTop)}
                </span>

                <span
                  className={cn(
                    "w-14 shrink-0 text-right text-sm sm:w-24",
                    severe ? "text-red-300" : "text-muted-strong",
                  )}
                  title={
                    index === 0
                      ? undefined
                      : "Share of the previous stage that did not reach this one"
                  }
                >
                  {index === 0 || stage.dropOff === null
                    ? ""
                    : `-${stage.dropOff}%`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-strong">
        Counted per lead, not per event — someone who opens their report four
        times is one lead that reached &ldquo;report viewed&rdquo;. Middle
        column is share of all leads; right column is drop-off from the previous
        stage. A stage only appears once something writes its event, so an
        uninstrumented step reads as zero rather than being estimated.
      </p>
    </Card>
  );
}

/**
 * AI spend and failures per workflow.
 *
 * `cost` arrives as a decimal STRING from `numeric` and is printed as-is. It is
 * never parsed to a float — §8 of the brief, and the reason the SQL returns
 * text in the first place.
 */
export function WorkflowUsagePanel({ rows }: { rows: WorkflowUsage[] }) {
  if (rows.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted">
          No AI usage recorded in this period, or your role cannot see it.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr>
              {["Workflow", "Requests", "Failed", "Tokens", "Cost (USD)"].map(
                (heading, index) => (
                  <th
                    key={heading}
                    scope="col"
                    className={cn(
                      "border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted",
                      index === 0 ? "text-left" : "text-right",
                    )}
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.workflow} className="hover:bg-fill-1">
                <td className="border-b border-line px-4 py-3 font-medium text-foreground">
                  {row.workflow}
                </td>
                <td className="border-b border-line px-4 py-3 text-right text-muted">
                  {row.requests.toLocaleString("en-US")}
                </td>
                <td
                  className={cn(
                    "border-b border-line px-4 py-3 text-right",
                    row.failures > 0 ? "text-red-300" : "text-muted",
                  )}
                >
                  {row.failures.toLocaleString("en-US")}
                </td>
                <td className="border-b border-line px-4 py-3 text-right text-muted">
                  {row.tokens.toLocaleString("en-US")}
                </td>
                <td className="border-b border-line px-4 py-3 text-right font-medium text-foreground">
                  ${row.cost}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
