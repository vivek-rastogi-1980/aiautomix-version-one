import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/features/admin/guard";
import { listAiUsage, getAiFacets } from "@/features/admin/data";
import { pageParams, first } from "@/features/admin/query";
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
  DateFilter,
} from "@/features/admin/ui";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatDuration } from "@/lib/format";

export const metadata: Metadata = { title: "AI operations" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * AI request monitoring.
 *
 * This list shows only metadata — workflow, model, status, tokens, duration,
 * cost. No prompt or response content appears here; that is on the detail page,
 * behind redaction. A list view is skimmed and screenshotted, so it is the
 * wrong place for customer content even when the reader is authorised to see it.
 */
export default async function AdminAiPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("ai.read");

  const sp = await searchParams;
  const params = pageParams(sp.page, sp.size);

  const status = first(sp.status);
  const workflow = first(sp.workflow);
  const model = first(sp.model);
  const from = first(sp.from);
  const to = first(sp.to);

  const [result, facets] = await Promise.all([
    listAiUsage(params, {
      status: status === "success" || status === "failed" ? status : undefined,
      workflow: workflow || undefined,
      model: model || undefined,
      // A date input gives `YYYY-MM-DD`; widen `to` to the end of that day so
      // "from 1 Aug to 1 Aug" includes the whole day rather than midnight only.
      since: from ? new Date(`${from}T00:00:00Z`).toISOString() : undefined,
      until: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
    }),
    getAiFacets(),
  ]);

  return (
    <>
      <PageHeader
        title="AI operations"
        description="Every AI request across the platform. Metadata only — open a request for detail."
      />

      <FilterBar action="/admin/ai">
        <Field label="Status">
          <SelectFilter
            name="status"
            defaultValue={status}
            options={[
              { value: "", label: "All" },
              { value: "success", label: "Success" },
              { value: "failed", label: "Failed" },
            ]}
          />
        </Field>
        <Field label="Workflow">
          <SelectFilter
            name="workflow"
            defaultValue={workflow}
            options={[
              { value: "", label: "All" },
              ...facets.workflows.map((w) => ({ value: w, label: w })),
            ]}
          />
        </Field>
        <Field label="Model">
          <SelectFilter
            name="model"
            defaultValue={model}
            options={[
              { value: "", label: "All" },
              ...facets.models.map((m) => ({ value: m, label: m })),
            ]}
          />
        </Field>
        <Field label="From">
          <DateFilter name="from" defaultValue={from} />
        </Field>
        <Field label="To">
          <DateFilter name="to" defaultValue={to} />
        </Field>
      </FilterBar>

      {result.rows.length === 0 ? (
        <EmptyState title="No AI requests match these filters." />
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Workflow</Th>
                <Th>Model</Th>
                <Th>Status</Th>
                <Th>Tokens</Th>
                <Th>Duration</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((event) => (
                <tr key={event.id} className="hover:bg-white/[0.02]">
                  <Td className="whitespace-nowrap text-muted">
                    {formatDateTime(event.created_at)}
                  </Td>
                  <Td className="font-medium">{event.workflow}</Td>
                  <Td className="text-muted">{event.model}</Td>
                  <Td>
                    <Badge
                      variant={
                        event.status === "success" ? "active" : "neutral"
                      }
                    >
                      {event.status}
                    </Badge>
                  </Td>
                  <Td className="text-muted">
                    {event.total_tokens?.toLocaleString("en-US") ?? "—"}
                  </Td>
                  <Td className="text-muted">
                    {event.duration_ms
                      ? formatDuration(event.duration_ms)
                      : "—"}
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/admin/ai/${event.id}`}
                      className="text-sm text-brand-cyan hover:underline"
                    >
                      Detail
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>

          <Pagination
            page={result}
            basePath="/admin/ai"
            params={{ status, workflow, model, from, to, size: first(sp.size) }}
          />
        </>
      )}
    </>
  );
}
