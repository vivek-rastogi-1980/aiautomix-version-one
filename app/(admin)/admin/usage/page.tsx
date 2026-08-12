import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/features/admin/guard";
import { listAiUsage, getPlatformStats } from "@/features/admin/data";
import { pageParams, first } from "@/features/admin/query";
import {
  PageHeader,
  Stat,
  TableShell,
  Th,
  Td,
  EmptyState,
  Pagination,
  FilterBar,
  Field,
  DateFilter,
} from "@/features/admin/ui";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Usage" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Platform consumption.
 *
 * Distinct from `/admin/ai`, which is a request-level operational view for
 * debugging. This page answers "how much is being used, and what is it
 * costing" — the same events, aggregated.
 */
export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("usage.read");

  const sp = await searchParams;
  const params = pageParams(sp.page, sp.size);
  const from = first(sp.from);
  const to = first(sp.to);

  const since = from ? new Date(`${from}T00:00:00Z`) : undefined;

  const [stats, events] = await Promise.all([
    getPlatformStats(since),
    listAiUsage(params, {
      since: since?.toISOString(),
      until: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
    }),
  ]);

  const num = (key: string): number | null => {
    const value = stats?.[key];
    return typeof value === "number" ? value : null;
  };

  const cost = stats?.["estimated_cost"];

  return (
    <>
      <PageHeader
        title="Usage"
        description="Consumption across every workspace."
      />

      <FilterBar action="/admin/usage">
        <Field label="From">
          <DateFilter name="from" defaultValue={from} />
        </Field>
        <Field label="To">
          <DateFilter name="to" defaultValue={to} />
        </Field>
      </FilterBar>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="AI requests" value={num("ai_requests")} />
        <Stat
          label="Failures"
          value={num("ai_failures")}
          sub={
            num("ai_requests") && num("ai_failures") !== null
              ? `${(((num("ai_failures") ?? 0) / (num("ai_requests") || 1)) * 100).toFixed(1)}% of runs`
              : undefined
          }
        />
        <Stat label="Tokens" value={num("total_tokens")} />
        <Stat
          label="Estimated cost"
          value={
            typeof cost === "number" || typeof cost === "string"
              ? `$${Number(cost).toFixed(4)}`
              : null
          }
          sub="Provider estimate"
        />
      </div>

      {events.rows.length === 0 ? (
        <EmptyState title="No usage in this period." />
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Workflow</Th>
                <Th>Model</Th>
                <Th>Tokens</Th>
                <Th>Cost</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {events.rows.map((event) => (
                <tr key={event.id} className="hover:bg-fill-1">
                  <Td className="whitespace-nowrap text-muted">
                    {formatDateTime(event.created_at)}
                  </Td>
                  <Td className="font-medium">{event.workflow}</Td>
                  <Td className="text-muted">{event.model}</Td>
                  <Td className="text-muted">
                    {event.total_tokens?.toLocaleString("en-US") ?? "—"}
                  </Td>
                  <Td className="text-muted">
                    {event.estimated_cost_usd !== null &&
                    event.estimated_cost_usd !== undefined
                      ? `$${Number(event.estimated_cost_usd).toFixed(6)}`
                      : "—"}
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/admin/ai/${event.id}`}
                      className="text-sm text-accent hover:underline"
                    >
                      Detail
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
          <Pagination
            page={events}
            basePath="/admin/usage"
            params={{ from, to, size: first(sp.size) }}
          />
        </>
      )}
    </>
  );
}
