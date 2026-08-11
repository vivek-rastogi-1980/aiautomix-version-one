import type { Metadata } from "next";
import Link from "next/link";

import { requirePermission } from "@/features/admin/guard";
import { listUsers } from "@/features/admin/data";
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

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requirePermission("users.read");

  const sp = await searchParams;
  const params = pageParams(sp.page, sp.size);
  const search = searchTerm(sp.q);
  const status = first(sp.status);

  const result = await listUsers(params, {
    search,
    status: status === "suspended" || status === "active" ? status : undefined,
  });

  return (
    <>
      <PageHeader
        title="Users"
        description="Every account on the platform. Read-only here; open a user to act."
      />

      <FilterBar action="/admin/users">
        <Field label="Search">
          <TextFilter
            name="q"
            defaultValue={first(sp.q)}
            placeholder="Name or company"
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
        <EmptyState
          title="No users match."
          hint={search ? "Try a different search term." : undefined}
        />
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Company</Th>
                <Th>Joined</Th>
                <Th>Status</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.02]">
                  <Td>
                    <span className="font-medium">
                      {user.full_name?.trim() || "—"}
                    </span>
                  </Td>
                  <Td className="text-muted">{user.company_name || "—"}</Td>
                  <Td className="text-muted">{formatDate(user.created_at)}</Td>
                  <Td>
                    {user.suspended_at ? (
                      <Badge variant="neutral">Suspended</Badge>
                    ) : (
                      <Badge variant="active">Active</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/admin/users/${user.id}`}
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
            basePath="/admin/users"
            params={{ q: first(sp.q), status, size: first(sp.size) }}
          />
        </>
      )}
    </>
  );
}
