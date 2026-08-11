import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePermission } from "@/features/admin/guard";
import { getUserDetail, listAuditLogs } from "@/features/admin/data";
import { pageParams } from "@/features/admin/query";
import { PageHeader } from "@/features/admin/ui";
import { UserSuspendControl } from "@/features/admin/user-controls";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS as WORKSPACE_ROLE_LABELS } from "@/features/workspaces/roles";
import type { WorkspaceRole } from "@/types/database";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "User" };
export const dynamic = "force-dynamic";

export default async function AdminUserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("users.read");
  const { id } = await params;

  const detail = await getUserDetail(id);
  if (!detail?.profile) notFound();

  const { profile, memberships } = detail;

  // The audit history for this specific user, so an operator can see what has
  // already been done before doing anything else.
  const history = context.has("audit.read")
    ? await listAuditLogs(pageParams("1", "10"), {
        entityType: "user",
        entityId: id,
      })
    : null;

  const suspended = Boolean(profile.suspended_at);

  return (
    <>
      <PageHeader
        title={profile.full_name?.trim() || "Unnamed user"}
        description={profile.company_name || undefined}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="p-6">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Account
            </h2>
            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">
                  Status
                </dt>
                <dd className="mt-1">
                  {suspended ? (
                    <Badge variant="neutral">Suspended</Badge>
                  ) : (
                    <Badge variant="active">Active</Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">
                  Joined
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {formatDate(profile.created_at)}
                </dd>
              </div>
              {suspended ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wider text-muted">
                    Suspended
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {formatDateTime(profile.suspended_at as string)}
                    {profile.suspended_reason
                      ? ` — ${profile.suspended_reason}`
                      : ""}
                  </dd>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wider text-muted">
                  User ID
                </dt>
                <dd className="mt-1 font-mono text-xs text-muted">
                  {profile.id}
                </dd>
              </div>
            </dl>

            {/*
              The email address is deliberately absent. It lives in `auth.users`,
              which has no admin read policy — Supabase's auth schema is not
              exposed to the anon/authenticated roles at all. Surfacing it would
              have meant either a service-role client (rejected, see migration
              0008) or opening up the auth schema. Neither is worth it for a
              field the panel does not need to operate.
            */}
            <p className="mt-4 text-xs text-muted-strong">
              Email is not shown: it lives in the Supabase auth schema, which
              this panel deliberately cannot read.
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Workspace memberships
            </h2>
            {memberships.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                This user belongs to no workspaces.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-white/[0.06]">
                {memberships.map((membership) => (
                  <li
                    key={membership.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      {membership.workspace ? (
                        <Link
                          href={`/admin/workspaces/${membership.workspace.id}`}
                          className="truncate text-sm font-medium text-brand-cyan hover:underline"
                        >
                          {membership.workspace.name}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted">
                          Workspace unavailable
                        </span>
                      )}
                      <p className="text-xs text-muted">
                        joined {formatDate(membership.created_at)}
                      </p>
                    </div>
                    <Badge variant="neutral">
                      {WORKSPACE_ROLE_LABELS[
                        membership.role as WorkspaceRole
                      ] ?? membership.role}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {history ? (
            <Card className="p-6">
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                Admin actions on this user
              </h2>
              {history.rows.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Nothing recorded.</p>
              ) : (
                <ul className="mt-4 divide-y divide-white/[0.06]">
                  {history.rows.map((entry) => (
                    <li key={entry.id} className="py-3">
                      <p className="text-sm font-medium text-foreground">
                        {entry.action}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDateTime(entry.created_at)} · {entry.actor_role}
                        {entry.reason ? ` · ${entry.reason}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>

        {/* --- Actions --------------------------------------------------- */}
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Actions
            </h2>
            {context.has("users.manage") ? (
              <div className="mt-4">
                <UserSuspendControl userId={profile.id} suspended={suspended} />
                <p className="mt-4 text-xs text-muted-strong">
                  Suspension is reversible and never deletes data. Account
                  deletion is not available from this panel.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Your role is read-only for users.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
