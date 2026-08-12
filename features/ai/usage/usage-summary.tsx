import { Card } from "@/components/ui/card";
import { formatCostUsd } from "@/features/ai/usage/pricing";
import type { UsageSummary } from "@/features/ai/usage/data";
import { formatDuration, formatTokens } from "@/lib/format";

interface UsageSummaryPanelProps {
  summary: UsageSummary;
}

interface StatProps {
  label: string;
  value: string;
  hint?: string;
}

function Stat({ label, value, hint }: StatProps) {
  return (
    <Card className="p-5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-strong">
        {label}
      </dt>
      <dd className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground tabular-nums">
        {value}
      </dd>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

/**
 * Usage metrics panel (USAGE-TRACKING-SPEC.md).
 *
 * Surfaces the numbers billing and analytics will need later — runs, tokens,
 * estimated cost and reliability — per user and per workflow.
 */
export function UsageSummaryPanel({ summary }: UsageSummaryPanelProps) {
  const { totals, byWorkflow, windowDays } = summary;
  const successRate =
    totals.runs > 0 ? Math.round((totals.successes / totals.runs) * 100) : null;

  return (
    <section aria-labelledby="usage-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="usage-heading"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Usage
        </h2>
        <p className="text-sm text-muted">Last {windowDays} days</p>
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Runs"
          value={totals.runs.toLocaleString("en-US")}
          hint={
            successRate === null
              ? "No runs yet"
              : `${successRate}% succeeded · ${totals.failures} failed`
          }
        />
        <Stat
          label="Tokens"
          value={formatTokens(totals.totalTokens)}
          hint={`${formatTokens(totals.promptTokens)} in · ${formatTokens(totals.outputTokens)} out`}
        />
        <Stat
          label="Estimated cost"
          value={formatCostUsd(totals.estimatedCostUsd)}
          hint="List prices — indicative only"
        />
        <Stat
          label="Average run"
          value={formatDuration(totals.averageDurationMs)}
          hint="Successful runs"
        />
      </dl>

      {byWorkflow.length > 0 ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">Usage by workflow</caption>
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted-strong">
                <th scope="col" className="px-5 py-3 font-medium">
                  Workflow
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  Runs
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  Failed
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  Tokens
                </th>
                <th scope="col" className="px-5 py-3 text-right font-medium">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {byWorkflow.map((entry) => (
                <tr
                  key={entry.workflow}
                  className="border-b border-line last:border-0"
                >
                  <th
                    scope="row"
                    className="px-5 py-3 font-medium text-foreground"
                  >
                    {entry.label}
                  </th>
                  <td className="px-5 py-3 text-right tabular-nums text-muted">
                    {entry.runs}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted">
                    {entry.failures}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted">
                    {formatTokens(entry.totalTokens)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted">
                    {formatCostUsd(entry.estimatedCostUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </section>
  );
}
