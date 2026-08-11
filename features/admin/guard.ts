import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import {
  isAdminRole,
  roleHasPermission,
  permissionsFor,
  type AdminPermission,
  type AdminRole,
} from "@/features/admin/permissions";

/**
 * Server-side admin identity and authorization.
 *
 * `server-only` is not decoration: importing this from a Client Component is a
 * build error, which is what keeps the admin role out of the browser bundle.
 *
 * SPRINT-07.md: "The UI is never the security boundary." Nothing here hides a
 * button — hiding happens elsewhere, as a courtesy. What happens here is that a
 * request without the right grant does not get data, and a mutation without the
 * right grant is refused by the database even if this layer were bypassed
 * entirely.
 */

export interface AdminContext {
  user: User;
  role: AdminRole;
  permissions: readonly AdminPermission[];
  has: (permission: AdminPermission) => boolean;
}

/**
 * Resolve the caller's admin role from the database, or `null`.
 *
 * The role is read via the `admin_role()` RPC rather than by selecting from
 * `admin_users`, so the answer is derived from `auth.uid()` inside Postgres.
 * There is no code path where a client-supplied value influences it.
 */
export async function getAdminRole(): Promise<AdminRole | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_role");

  // Fail closed. A transport error, a misconfigured database or a missing
  // function must read as "not an admin", never as "probably fine".
  if (error) return null;
  return isAdminRole(data) ? data : null;
}

/** True only for an active member of `admin_users`. */
export async function isAdmin(): Promise<boolean> {
  return (await getAdminRole()) !== null;
}

/**
 * The admin context, or `null` when the caller is not staff.
 *
 * Use this when a page needs to *render something* for non-admins. When it
 * should not exist for them at all, use `requireAdmin`.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const user = await getUser();
  if (!user) return null;

  const role = await getAdminRole();
  if (!role) return null;

  const permissions = permissionsFor(role);
  return {
    user,
    role,
    permissions,
    has: (permission) => roleHasPermission(role, permission),
  };
}

/**
 * Guard for any admin surface: returns the context or redirects.
 *
 * A signed-out visitor goes to `/login`; a signed-in non-admin goes to
 * `/dashboard`. Neither sees any admin content: the redirect body is 26 bytes
 * and contains none of the panel's vocabulary (verified over HTTP).
 *
 * What this does NOT hide is the existence of the namespace. `/admin` answers
 * 307 where an unrouted path answers 404, so anyone can tell `/admin/*` is a
 * real protected area — and a signed-in non-admin can tell it apart from other
 * protected routes by which destination they are sent to. That is accepted
 * rather than fixed: the security property that matters is that no data crosses
 * the boundary, and obscuring the URL would buy nothing against an attacker who
 * can guess the word "admin" while making the redirect harder to reason about.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const user = await getUser();
  if (!user) redirect("/login?redirectTo=/admin");

  const context = await getAdminContext();
  if (!context) redirect("/dashboard");

  return context;
}

/**
 * Guard for a surface that needs a specific permission.
 *
 * Redirects to the admin home rather than erroring, because a SUPPORT user
 * following a link to a page they cannot use has done nothing wrong.
 */
export async function requirePermission(
  permission: AdminPermission,
): Promise<AdminContext> {
  const context = await requireAdmin();
  if (!context.has(permission)) redirect("/admin");
  return context;
}

/**
 * Assert a permission inside a Server Action, throwing rather than redirecting.
 *
 * Actions run in a POST, where a redirect would be the wrong shape; the caller
 * turns this into a form error. The database refuses the same operation
 * independently, so this is the fast, legible failure — not the only one.
 */
export async function assertPermission(
  context: AdminContext,
  permission: AdminPermission,
): Promise<void> {
  if (!context.has(permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}
