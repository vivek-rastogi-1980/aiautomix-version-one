import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/features/admin/guard";
import { listWorkspaces } from "@/features/admin/data";
import { pageParams, searchTerm, first } from "@/features/admin/query";
import {
  PageHeader,
  TableShell,
  Th,
  Td,
  EmptyState,
  Pagination,
  FilterBar,
  Field,
  TextFilter,
  SelectFilter,
} from "@/features/admin/ui";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Workspaces" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("workspaces.read");

  const sp = await searchParams;
  const params = pageParams(sp.page, sp.size);
  const search = searchTerm(sp.q);
  const status = first(sp.status);

  const result = await listWorkspaces(params, {
    search,
    status: status === "suspended" || status === "active" ? status : undefined,
  });

  return (
    <>
      <PageHeader
        title="Workspaces"
        description="Every workspace, with its owner, plan and status."
      />

      <FilterBar action="/admin/workspaces">
        <Field label="Search">
          <TextFilter
            name="q"
            defaultValue={first(sp.q)}
            placeholder="Name or slug"
          />
        </Field>
        <Field label="Status">
          <SelectFilter
            name="status"
            defaultValue={status}
            options={[
              { value: "", label: "All" },
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
            ]}
          />
        </Field>
      </FilterBar>

      {result.rows.length === 0 ? (
        <EmptyState title="No workspaces match." />
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Slug</Th>
                <Th>Type</Th>
                <Th>Created</Th>
                <Th>Status</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((workspace) => (
                <tr key={workspace.id} className="hover:bg-white/[0.02]">
                  <Td>
                    <span className="font-medium">{workspace.name}</span>
                  </Td>
                  <Td className="font-mono text-xs text-muted">
                    {workspace.slug}
                  </Td>
                  <Td className="text-muted">
                    {workspace.is_personal ? "Personal" : "Shared"}
                  </Td>
                  <Td className="text-muted">
                    {formatDate(workspace.created_at)}
                  </Td>
                  <Td>
                    {workspace.suspended_at ? (
                      <Badge variant="neutral">Suspended</Badge>
                    ) : (
                      <Badge variant="active">Active</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/admin/workspaces/${workspace.id}`}
                      className="text-sm text-brand-cyan hover:underline"
                    >
                      Open
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>

          <Pagination
            page={result}
            basePath="/admin/workspaces"
            params={{ q: first(sp.q), status, size: first(sp.size) }}
          />
        </>
      )}
    </>
  );
}
