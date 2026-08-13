import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/features/admin/guard";
import { first } from "@/features/admin/query";
import {
  getCostBreakdown,
  formatCost,
  isCostDimension,
  COST_DIMENSIONS,
  DIMENSION_LABELS,
  type CostBreakdown,
} from "@/features/admin/cost-ops";
import {
  PageHeader,
  Stat,
  TableShell,
  Th,
  Td,
  EmptyState,
  FilterBar,
  Field,
  DateFilter,
} from "@/features/admin/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cost analytics" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Windows offered as one-click presets, alongside the explicit date fields. */
const WINDOWS = [
  { key: "1", label: "Today" },
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
] as const;

/**
 * Where the money goes.
 *
 * Every figure on this page is summed by `admin_cost_breakdown` in Postgres.
 * Nothing here aggregates the AI log — see `features/admin/cost-ops.ts` for why
 * that matters: past PostgREST's row cap a JavaScript sum would return a
 * plausible but short total, and somebody would price against it.
 *
 * The selected window is always displayed, because a cost figure without its
 * period is not a number an operator can act on.
 */
export default async function AdminCostsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("usage.read");

  const sp = await searchParams;

  const rawDimension = first(sp.by);
  const dimension = isCostDimension(rawDimension) ? rawDimension : "day";

  const windowDays = first(sp.window);
  const fromParam = first(sp.from);
  const toParam = first(sp.to);

  // Explicit dates win over the preset; otherwise a preset (default 30 days).
  const days = Number.parseInt(windowDays ?? "30", 10);
  const presetDays =
    Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 30;

  const since = fromParam
    ? new Date(`${fromParam}T00:00:00Z`)
    : new Date(Date.now() - presetDays * 24 * 60 * 60 * 1000);
  const until = toParam ? new Date(`${toParam}T23:59:59.999Z`) : new Date();

  const breakdown = await getCostBreakdown(dimension, since, until);

  const rangeLabel = `${since.toISOString().slice(0, 10)} → ${until
    .toISOString()
    .slice(0, 10)} (UTC)`;

  const preserved = {
    by: dimension,
    window: fromParam ? undefined : windowDays,
    from: fromParam,
    to: toParam,
  };

  return (
    <>
      <PageHeader
        title="Cost analytics"
        description="AI spend and consumption, aggregated in SQL."
      />

      {/* The window is stated, not implied. */}
      <p className="mb-4 text-sm text-muted">
        Showing{" "}
        <span className="font-semibold text-foreground">{rangeLabel}</span>
        {fromParam ? " — custom range" : ` — last ${presetDays} days`}.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {WINDOWS.map((window) => (
          <Link
            key={window.key}
            href={`/admin/costs?by=${dimension}&window=${window.key}`}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              !fromParam && (windowDays ?? "30") === window.key
                ? "border-brand-violet bg-brand-violet/15 text-foreground"
                : "border-line-strong text-muted hover:bg-fill-3 hover:text-foreground",
            )}
          >
            {window.label}
          </Link>
        ))}
      </div>

      <FilterBar action="/admin/costs">
        <input type="hidden" name="by" value={dimension} />
        <Field label="From">
          <DateFilter name="from" defaultValue={fromParam} />
        </Field>
        <Field label="To">
          <DateFilter name="to" defaultValue={toParam} />
        </Field>
      </FilterBar>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Estimated AI cost"
          value={formatCost(breakdown.totalCost)}
          sub="Provider estimate — not billed revenue"
        />
        <Stat label="AI requests" value={breakdown.totalRequests} />
        <Stat label="Tokens" value={breakdown.totalTokens} />
      </div>

      {/* Dimension switcher. Plain links, so every view is shareable. */}
      <nav aria-label="Cost dimension" className="mb-4 flex flex-wrap gap-2">
        {COST_DIMENSIONS.map((key) => (
          <Link
            key={key}
            href={`/admin/costs?${new URLSearchParams(
              Object.entries({ ...preserved, by: key }).filter(
                (entry): entry is [string, string] => Boolean(entry[1]),
              ),
            ).toString()}`}
            aria-current={key === dimension ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              key === dimension
                ? "border-brand-violet bg-brand-violet/15 text-foreground"
                : "border-line-strong text-muted hover:bg-fill-3 hover:text-foreground",
            )}
          >
            {DIMENSION_LABELS[key]}
          </Link>
        ))}
      </nav>

      {breakdown.rows.length === 0 ? (
        <EmptyState
          title="No AI usage in this period."
          hint="Cost appears once a workflow runs against a provider."
        />
      ) : (
        <CostTable breakdown={breakdown} />
      )}

      <p className="mt-6 text-xs text-muted-strong">
        Costs are the provider&apos;s own estimate recorded per request. They
        are not invoiced amounts and do not represent revenue or margin.
      </p>
    </>
  );
}

function CostTable({ breakdown }: { breakdown: CostBreakdown }) {
  // A share bar, drawn against the largest row on screen. Purely relative — it
  // makes the shape of the spend readable without implying a second metric.
  const max = breakdown.rows.reduce(
    (peak, row) => Math.max(peak, Number(row.cost || 0)),
    0,
  );

  return (
    <TableShell>
      <thead>
        <tr>
          <Th>{DIMENSION_LABELS[breakdown.dimension].replace("By ", "")}</Th>
          <Th>Requests</Th>
          <Th>Failures</Th>
          <Th>Tokens</Th>
          <Th>Estimated cost</Th>
          <Th>Share</Th>
        </tr>
      </thead>
      <tbody>
        {breakdown.rows.map((row) => {
          const cost = Number(row.cost || 0);
          const share = max > 0 ? Math.round((cost / max) * 100) : 0;

          return (
            <tr key={row.key} className="hover:bg-fill-1">
              <Td className="max-w-[260px] truncate font-medium">
                {row.label}
              </Td>
              <Td className="text-muted">
                {row.requests.toLocaleString("en-US")}
              </Td>
              <Td
                className={cn(
                  row.failures > 0 ? "text-danger-soft" : "text-muted",
                )}
              >
                {row.failures.toLocaleString("en-US")}
              </Td>
              <Td className="text-muted">
                {row.tokens.toLocaleString("en-US")}
              </Td>
              <Td className="text-muted">{formatCost(row.cost)}</Td>
              <Td>
                {/* The percentage is written out beside the bar — the bar is
                    reinforcement, never the only way to read the value. */}
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-24 overflow-hidden rounded-full bg-fill-3"
                  >
                    <span
                      className="block h-full rounded-full bg-brand-gradient"
                      style={{ width: `${share}%` }}
                    />
                  </span>
                  <span className="text-xs tabular-nums text-muted-strong">
                    {share}%
                  </span>
                </span>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </TableShell>
  );
}
