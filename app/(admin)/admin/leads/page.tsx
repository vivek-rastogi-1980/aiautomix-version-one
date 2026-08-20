import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/features/admin/guard";
import {
  listLeads,
  leadSources,
  LEAD_STATUS_BADGE,
  LEAD_STATUS_LABELS,
  isLeadStatus,
} from "@/features/admin/leads";
import { pageParams, first, searchTerm } from "@/features/admin/query";
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
  TextFilter,
} from "@/features/admin/ui";
import { Badge } from "@/components/ui/badge";
import { LEAD_STATUSES } from "@/types/database";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Admin → Leads.
 *
 * The working list for the funnel. Ordered by last activity rather than by
 * creation date, because the question this page answers is "what moved?" — a
 * lead that came in three weeks ago and booked a session this morning belongs
 * at the top, not on page four.
 *
 * `requirePermission('leads.read')` runs before anything is read, and the
 * `admin_has('leads.read')` policy from migration 0019 refuses the rows
 * independently. Removing the guard would produce an empty table, not a leak.
 */
export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { has } = await requirePermission("leads.read");

  const sp = await searchParams;
  const params = pageParams(sp.page, sp.size);
  const search = searchTerm(sp.q);
  const status = first(sp.status);
  const source = first(sp.source);

  const [result, sources] = await Promise.all([
    listLeads(params, { search, status, source }),
    leadSources(),
  ]);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Everyone who has asked for something, and where each of them has got to."
      />

      <FilterBar action="/admin/leads">
        <Field label="Search">
          <TextFilter
            name="q"
            defaultValue={first(sp.q)}
            placeholder="Name, email or company"
          />
        </Field>
        <Field label="Stage">
          <SelectFilter
            name="status"
            defaultValue={status}
            options={[
              { value: "", label: "All stages" },
              ...LEAD_STATUSES.map((value) => ({
                value,
                label: LEAD_STATUS_LABELS[value],
              })),
            ]}
          />
        </Field>
        <Field label="Source">
          <SelectFilter
            name="source"
            defaultValue={source}
            options={[
              { value: "", label: "All sources" },
              ...sources.map((value) => ({ value, label: value })),
            ]}
          />
        </Field>
      </FilterBar>

      {result.rows.length === 0 ? (
        <EmptyState
          title="No leads match."
          hint="Leads arrive from the idea form, the strategy session form and the contact form."
        />
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>Contact</Th>
                <Th>Source</Th>
                <Th>Stage</Th>
                <Th>Account</Th>
                <Th>Created</Th>
                <Th>Last activity</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((lead) => {
                const name =
                  [lead.first_name, lead.last_name]
                    .filter(Boolean)
                    .join(" ")
                    .trim() ||
                  lead.name ||
                  "—";

                return (
                  <tr key={lead.id} className="align-top hover:bg-fill-1">
                    <Td>
                      <Link
                        href={`/admin/leads/${lead.id}`}
                        className="font-medium text-foreground hover:text-accent"
                      >
                        {name}
                      </Link>
                      <span className="block text-xs text-muted">
                        {lead.email}
                      </span>
                    </Td>
                    <Td className="text-muted">{lead.source}</Td>
                    <Td>
                      <Badge
                        variant={
                          isLeadStatus(lead.status)
                            ? LEAD_STATUS_BADGE[lead.status]
                            : "neutral"
                        }
                      >
                        {isLeadStatus(lead.status)
                          ? LEAD_STATUS_LABELS[lead.status]
                          : lead.status}
                      </Badge>
                    </Td>
                    <Td className="text-muted">
                      {lead.user_id ? "Activated" : "Not yet"}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      {formatDate(lead.created_at)}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      {lead.last_activity_at
                        ? formatDateTime(lead.last_activity_at)
                        : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>

          <Pagination
            page={result}
            basePath="/admin/leads"
            params={{
              q: first(sp.q),
              status,
              source,
              size: first(sp.size),
            }}
          />
        </>
      )}

      {!has("leads.update") ? (
        <p className="mt-6 text-sm text-muted">
          You can read leads but not change them. Moving a lead through the
          lifecycle needs <code className="font-mono text-xs">leads.update</code>
          .
        </p>
      ) : null}
    </>
  );
}
