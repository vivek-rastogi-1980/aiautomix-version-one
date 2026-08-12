import type { Metadata } from "next";

import { requireAdmin } from "@/features/admin/guard";
import { AdminShell } from "@/features/admin/admin-shell";
import { ADMIN_NAV } from "@/features/admin/nav";
import { getTheme } from "@/lib/theme";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · AIAutomix Admin" },
  // The admin panel must never be indexed, and `robots.ts` also disallows
  // `/admin`. Two mechanisms because a stray crawler that ignores robots.txt
  // still honours the meta tag.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The admin area's security boundary.
 *
 * `requireAdmin()` runs before any child route renders, so every page under
 * `/admin` is gated whether or not it remembers to gate itself. Individual
 * pages still call `requirePermission()` for their specific grant — this layout
 * establishes *that you are staff*, not *what you may do*.
 *
 * Three independent layers protect this area, and none of them is the UI:
 *   1. `middleware.ts` redirects unauthenticated requests to `/login`.
 *   2. This layout resolves the admin role from `auth.uid()` server-side.
 *   3. RLS in migration 0008 returns no rows to a caller without the grant.
 *
 * Remove any one and the other two still hold.
 */
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, user, has } = await requireAdmin();
  const theme = await getTheme();

  // Filtered server-side: a link a role cannot use never reaches the browser,
  // so the nav does not disclose the shape of the panel to a lesser role.
  const nav = ADMIN_NAV.filter(
    (item) => !item.permission || has(item.permission),
  );

  return (
    <AdminShell
      role={role}
      email={user.email ?? ""}
      nav={[...nav]}
      theme={theme}
    >
      {children}
    </AdminShell>
  );
}
