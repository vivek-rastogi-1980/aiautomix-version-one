import type { Metadata } from "next";

import { requireAdmin } from "@/features/admin/guard";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/features/admin/ui";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ADMIN_PERMISSIONS,
  ROLE_BADGE,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  ADMIN_ROLES,
  type AdminRole,
} from "@/features/admin/permissions";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/**
 * Your role, the full RBAC matrix, and the staff directory.
 *
 * There is no control here to grant or revoke an admin role, and that is
 * deliberate. `admin_users` has no INSERT/UPDATE/DELETE policy, so promotion is
 * a database operation performed with credentials the application does not
 * hold. An admin panel that can mint admins turns one compromised session into
 * permanent, self-sustaining access; requiring a separate, more privileged
 * channel means the blast radius of a stolen cookie stops at what that role can
 * already do.
 */
export default async function AdminSettingsPage() {
  const context = await requireAdmin();
  const supabase = await createClient();

  // Visible to any admin: knowing who else holds authority is part of being
  // able to review it.
  const { data: staff } = await supabase
    .from("admin_users")
    .select("*")
    .order("role", { ascending: true });

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your access, the permission matrix and the staff directory."
      />

      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Your access
          </h2>
          <div className="mt-3 flex items-center gap-3">
            <Badge variant={ROLE_BADGE[context.role]}>
              {ROLE_LABELS[context.role]}
            </Badge>
            <span className="text-sm text-muted">
              {ROLE_DESCRIPTIONS[context.role]}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {context.permissions.map((permission) => (
              <code
                key={permission}
                className="rounded bg-fill-3 px-2 py-1 text-xs text-foreground"
              >
                {permission}
              </code>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Permission matrix
          </h2>
          <p className="mt-1 text-sm text-muted">
            Defined once, in the database. Both this page and every row level
            security policy read the same grants.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="border-b border-line px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted"
                  >
                    Permission
                  </th>
                  {ADMIN_ROLES.map((role) => (
                    <th
                      key={role}
                      scope="col"
                      className="border-b border-line px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted"
                    >
                      {ROLE_LABELS[role as AdminRole]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ADMIN_PERMISSIONS.map((permission) => (
                  <tr key={permission}>
                    <th
                      scope="row"
                      className="border-b border-line px-3 py-2 text-left font-mono text-xs font-normal text-foreground"
                    >
                      {permission}
                    </th>
                    {ADMIN_ROLES.map((role) => {
                      const held =
                        ROLE_PERMISSIONS[role as AdminRole].includes(
                          permission,
                        );
                      return (
                        <td
                          key={role}
                          className="border-b border-line px-3 py-2 text-center"
                        >
                          {held ? (
                            <span className="text-accent" aria-label="granted">
                              ✓
                            </span>
                          ) : (
                            <span
                              className="text-muted-strong"
                              aria-label="denied"
                            >
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Staff
          </h2>
          {!staff || staff.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No admin accounts found.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {staff.map((member) => (
                <li
                  key={member.user_id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-foreground">
                      {member.user_id}
                      {member.user_id === context.user.id ? (
                        <span className="ml-2 text-muted">(you)</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted">
                      since {formatDate(member.created_at)}
                      {member.note ? ` · ${member.note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!member.is_active ? (
                      <Badge variant="neutral">inactive</Badge>
                    ) : null}
                    <Badge
                      variant={
                        ROLE_BADGE[member.role as AdminRole] ?? "neutral"
                      }
                    >
                      {ROLE_LABELS[member.role as AdminRole] ?? member.role}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 rounded-lg border border-line bg-fill-1 p-4">
            <p className="text-sm text-muted">
              Admin roles cannot be granted from this panel. `admin_users` has
              no write policy, so promotion requires direct database access —
              one compromised admin session cannot create another admin.
            </p>
            <p className="mt-2 text-sm text-muted">
              To grant access, run against the database:
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-ink/60 p-3 text-xs text-foreground">
              {`insert into public.admin_users (user_id, role)
values ('<auth.users id>', 'SUPER_ADMIN');`}
            </pre>
          </div>
        </Card>
      </div>
    </>
  );
}
