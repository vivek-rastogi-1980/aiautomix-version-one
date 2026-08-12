import type { Metadata } from "next";

import { requirePermission } from "@/features/admin/guard";
import { listAuditLogs } from "@/features/admin/data";
import { pageParams, first } from "@/features/admin/query";
import { redactJson } from "@/features/admin/redact";
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
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit logs" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Actions that exist today. Extending this needs a matching RPC. */
const ACTIONS = [
  "USER_SUSPENDED",
  "USER_RESTORED",
  "WORKSPACE_SUSPENDED",
  "WORKSPACE_RESTORED",
  "CREDIT_GRANTED",
  "CREDIT_ADJUSTED",
  "CREDIT_REFUNDED",
  "PLAN_UPDATED",
  "ENTITLEMENT_UPDATED",
];

/**
 * The immutable record of administrative action.
 *
 * There is no delete control on this page and no way to add one that would
 * work: `admin_audit_logs` has no UPDATE or DELETE policy, and a trigger
 * rejects both operations even for a connection that bypasses RLS entirely.
 * Retention is deliberately an out-of-band database operation requiring more
 * authority than the application ever holds.
 *
 * `before`/`after` snapshots pass through `redactJson`, which drops values
 * under key names implying a secret and rewrites credential-shaped strings.
 */
export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("audit.read");

  const sp = await searchParams;
  const params = pageParams(sp.page, sp.size);
  const action = first(sp.action);
  const entityType = first(sp.entity);

  const result = await listAuditLogs(params, {
    action: action || undefined,
    entityType: entityType || undefined,
  });

  return (
    <>
      <PageHeader
        title="Audit logs"
        description="Every sensitive admin action, permanently. Entries cannot be edited or deleted."
      />

      <FilterBar action="/admin/audit-logs">
        <Field label="Action">
          <SelectFilter
            name="action"
            defaultValue={action}
            options={[
              { value: "", label: "All" },
              ...ACTIONS.map((a) => ({ value: a, label: a })),
            ]}
          />
        </Field>
        <Field label="Entity type">
          <TextFilter
            name="entity"
            defaultValue={entityType}
            placeholder="user / workspace / plan"
          />
        </Field>
      </FilterBar>

      {result.rows.length === 0 ? (
        <EmptyState
          title="No audit entries."
          hint="Entries appear here as soon as an admin acts."
        />
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>Actor role</Th>
                <Th>Entity</Th>
                <Th>Reason</Th>
                <Th>Change</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((entry) => {
                const before = redactJson(entry.before_data);
                const after = redactJson(entry.after_data);
                const hasChange =
                  (before && Object.keys(before).length > 0) ||
                  (after && Object.keys(after).length > 0);

                return (
                  <tr key={entry.id} className="align-top hover:bg-fill-1">
                    <Td className="whitespace-nowrap text-muted">
                      {formatDateTime(entry.created_at)}
                    </Td>
                    <Td className="font-medium">{entry.action}</Td>
                    <Td>
                      <Badge variant="neutral">{entry.actor_role}</Badge>
                    </Td>
                    <Td className="text-muted">
                      {entry.entity_type}
                      {entry.entity_id ? (
                        <span className="block font-mono text-xs">
                          {entry.entity_id.slice(0, 13)}…
                        </span>
                      ) : null}
                    </Td>
                    <Td className="max-w-xs text-muted">
                      {entry.reason ?? "—"}
                    </Td>
                    <Td>
                      {hasChange ? (
                        <details>
                          <summary className="cursor-pointer text-sm text-accent">
                            View
                          </summary>
                          <pre className="mt-2 max-h-56 max-w-md overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-fill-1 p-2 text-xs">
                            {JSON.stringify({ before, after }, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-muted-strong">—</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>

          <Pagination
            page={result}
            basePath="/admin/audit-logs"
            params={{ action, entity: entityType, size: first(sp.size) }}
          />
        </>
      )}

      <Card className="mt-6 p-5">
        <p className="text-sm text-muted">
          This log is append-only at the database level. No admin role — not
          even super admin — can edit or delete an entry through the
          application, and a trigger rejects the attempt even on a connection
          that bypasses row level security.
        </p>
      </Card>
    </>
  );
}
