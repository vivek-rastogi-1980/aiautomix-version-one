import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/features/admin/guard";
import {
  listEmailLogs,
  EMAIL_STATUS_BADGE,
} from "@/features/admin/communications";
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
import { Card } from "@/components/ui/card";
import { EMAIL_STATUSES, EMAIL_TRIGGERS } from "@/features/communications/events";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Delivery log" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Admin → Communications → Delivery log.
 *
 * ---------------------------------------------------------------------------
 * Four statuses, and why SKIPPED is not a failure
 * ---------------------------------------------------------------------------
 *   SENT     the provider accepted it
 *   FAILED   we tried and the attempt did not work
 *   SKIPPED  we deliberately did not try — no template is active for the
 *            trigger, or no provider is configured
 *   QUEUED   accepted for sending but not yet resolved
 *
 * Collapsing SKIPPED into FAILED would be the easy simplification and the wrong
 * one: an operator investigating "the customer never got their confirmation"
 * needs to know whether the system broke or whether nobody had switched the
 * template on. Those have different fixes.
 *
 * ---------------------------------------------------------------------------
 * What is NOT here
 * ---------------------------------------------------------------------------
 * The message body. It is reproducible from the template version plus the
 * context, and storing it would duplicate personal data into a second table
 * with a second retention story for no operational gain. The rendered subject
 * is kept, because that is what the customer sees in their inbox list and it is
 * what support gets asked about.
 *
 * No column on `email_logs` can hold a provider credential — §8.
 */
export default async function AdminEmailLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("communications.read");

  const sp = await searchParams;
  const params = pageParams(sp.page, sp.size);
  const search = searchTerm(sp.q);
  const status = first(sp.status);
  const trigger = first(sp.trigger);
  const includeTests = first(sp.tests) === "1";

  const result = await listEmailLogs(params, {
    search,
    status,
    trigger,
    includeTests,
  });

  return (
    <>
      <PageHeader
        title="Delivery log"
        description="What was sent, to whom, from which template version."
        actions={
          <Link
            href="/admin/communications"
            className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-foreground hover:bg-fill-3"
          >
            ← Templates
          </Link>
        }
      />

      <FilterBar action="/admin/communications/logs">
        <Field label="Recipient">
          <TextFilter
            name="q"
            defaultValue={first(sp.q)}
            placeholder="Email address"
          />
        </Field>
        <Field label="Status">
          <SelectFilter
            name="status"
            defaultValue={status}
            options={[
              { value: "", label: "All" },
              ...EMAIL_STATUSES.map((value) => ({ value, label: value })),
            ]}
          />
        </Field>
        <Field label="Trigger">
          <SelectFilter
            name="trigger"
            defaultValue={trigger}
            options={[
              { value: "", label: "All" },
              ...EMAIL_TRIGGERS.map((value) => ({ value, label: value })),
            ]}
          />
        </Field>
        <Field label="Test sends">
          <SelectFilter
            name="tests"
            defaultValue={first(sp.tests)}
            options={[
              { value: "", label: "Hidden" },
              { value: "1", label: "Included" },
            ]}
          />
        </Field>
      </FilterBar>

      {result.rows.length === 0 ? (
        <EmptyState
          title="No delivery attempts match."
          hint="An email is only logged once something raises the event for it."
        />
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Recipient</Th>
                <Th>Subject</Th>
                <Th>Trigger</Th>
                <Th>Status</Th>
                <Th>Provider</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((log) => (
                <tr key={log.id} className="align-top hover:bg-fill-1">
                  <Td className="whitespace-nowrap text-muted">
                    {formatDateTime(log.created_at)}
                  </Td>
                  <Td>
                    <span className="text-foreground">
                      {log.recipient_email}
                    </span>
                    {log.is_test ? (
                      <Badge variant="neutral" className="ml-2">
                        test
                      </Badge>
                    ) : null}
                    {log.lead_id ? (
                      <Link
                        href={`/admin/leads/${log.lead_id}`}
                        className="block text-xs text-accent hover:underline"
                      >
                        Open lead →
                      </Link>
                    ) : null}
                  </Td>
                  <Td className="max-w-sm text-muted">{log.subject ?? "—"}</Td>
                  <Td className="font-mono text-xs text-muted">
                    {log.trigger ?? "—"}
                  </Td>
                  <Td>
                    <Badge variant={EMAIL_STATUS_BADGE[log.status] ?? "neutral"}>
                      {log.status}
                    </Badge>
                    {log.error_message ? (
                      <span className="mt-1 block max-w-xs text-xs text-muted">
                        {log.error_message}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-muted">
                    {log.provider ?? "—"}
                    {log.provider_message_id ? (
                      <span className="block font-mono text-xs text-muted-strong">
                        {log.provider_message_id.slice(0, 16)}…
                      </span>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>

          <Pagination
            page={result}
            basePath="/admin/communications/logs"
            params={{
              q: first(sp.q),
              status,
              trigger,
              tests: first(sp.tests),
              size: first(sp.size),
            }}
          />
        </>
      )}

      <Card className="mt-6 p-5">
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground">Skipped</span> is not a
          failure. It means the system deliberately did not attempt a send —
          usually because no template is active for that trigger, or because no
          provider is configured. That distinction is why the customer&rsquo;s
          missing confirmation can be diagnosed without guessing.
        </p>
        <p className="mt-2 text-sm text-muted">
          Message bodies are not stored. The rendered subject is, because that
          is what the recipient sees in their inbox and what support gets asked
          about.
        </p>
      </Card>
    </>
  );
}
