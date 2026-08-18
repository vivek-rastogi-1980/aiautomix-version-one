/**
 * Admin RBAC vocabulary and the role -> permission matrix.
 *
 * ---------------------------------------------------------------------------
 * Where authorization actually happens
 * ---------------------------------------------------------------------------
 * In the database. `admin_has(permission)` (migration 0008) reads the
 * `admin_role_permissions` table and every RLS policy and every privileged
 * function consults it. A request that reaches Postgres without the right grant
 * gets no rows and no effect, regardless of what any TypeScript here believes.
 *
 * This file is the *mirror*: it exists so the UI can hide controls a user
 * cannot use, and so server code can fail fast with a clear message instead of
 * a silent empty result. If the two ever disagree, the SQL wins and this file
 * is the bug — the same relationship `features/workspaces/roles.ts` has with
 * migration 0004.
 *
 * `scripts/admin-smoke.tsx` asserts that this matrix matches the rows seeded in
 * migration 0008 exactly, in both directions, so the mirror cannot drift
 * unnoticed.
 *
 * ADMIN-SECURITY-SPEC.md: "Never authorize based on email." There is no email
 * anywhere in this module, and no hardcoded user list. Admin identity comes
 * only from a row in `admin_users`.
 */

/** The four roles from ADMIN-RBAC-SPEC.md. */
export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "SUPPORT",
  "ANALYST",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** The fourteen permissions. Adding one here also requires a migration. */
export const ADMIN_PERMISSIONS = [
  "users.read",
  "users.manage",
  "workspaces.read",
  "workspaces.manage",
  "ai.read",
  "usage.read",
  "credits.read",
  "credits.adjust",
  "plans.read",
  "plans.manage",
  "entitlements.read",
  "entitlements.manage",
  "audit.read",
  "system.read",
  // Migration 0019 — client onboarding. Added to the existing matrix rather
  // than a parallel system, so `admin_has()` and every RLS policy in the
  // platform keep working unchanged.
  "leads.read",
  "leads.update",
  "bookings.read",
  "bookings.update",
  "communications.read",
  "communications.write",
  // Separated from `communications.write` on purpose: writing a template is an
  // internal act, sending a test is the one communications action that leaves
  // the building.
  "communications.send_test",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/**
 * The matrix, mirroring the seed in migration 0008.
 *
 * Least privilege, deny by default — a role holds exactly what is listed.
 *
 *   ANALYST     Read-only analytics. Deliberately has NO `users.read` and no
 *               `credits.read`: analysing platform usage does not require
 *               customer PII or sight of individual money movements.
 *   SUPPORT     Customer-facing reads, including PII and balances, so an agent
 *               can answer "what happened to my account?". No mutations.
 *   ADMIN       Full operations. Excludes `plans.manage` and
 *               `entitlements.manage` — changing prices or what a plan includes
 *               is a platform-wide commercial act, not an operational one.
 *   SUPER_ADMIN Everything.
 */
export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  ANALYST: [
    "workspaces.read",
    "ai.read",
    "usage.read",
    "plans.read",
    "entitlements.read",
    "system.read",
  ],
  SUPPORT: [
    "users.read",
    "workspaces.read",
    "ai.read",
    "usage.read",
    "credits.read",
    "plans.read",
    "entitlements.read",
    // Reads only. An agent answering "what happened to my booking?" needs to
    // see it; changing a lead's lifecycle is a sales decision, not support.
    "leads.read",
    "bookings.read",
    "communications.read",
  ],
  ADMIN: [
    "users.read",
    "users.manage",
    "workspaces.read",
    "workspaces.manage",
    "ai.read",
    "usage.read",
    "credits.read",
    "credits.adjust",
    "plans.read",
    "entitlements.read",
    "audit.read",
    "system.read",
    // Migration 0019. ADMIN runs the funnel: reads and works leads, manages
    // bookings, and authors communications.
    "leads.read",
    "leads.update",
    "bookings.read",
    "bookings.update",
    "communications.read",
    "communications.write",
    "communications.send_test",
  ],
  SUPER_ADMIN: [...ADMIN_PERMISSIONS],
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  SUPPORT: "Support",
  ANALYST: "Analyst",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Full administrative access, including plans and entitlements.",
  ADMIN: "Operational management. Cannot change plans or entitlements.",
  SUPPORT: "Read-only customer support access. Cannot change anything.",
  ANALYST: "Read-only analytics. No customer PII, no credit visibility.",
};

/** Badge variants from `components/ui/badge`. */
export const ROLE_BADGE: Record<
  AdminRole,
  "brand" | "active" | "completed" | "neutral"
> = {
  SUPER_ADMIN: "brand",
  ADMIN: "active",
  SUPPORT: "completed",
  ANALYST: "neutral",
};

export function isAdminRole(value: unknown): value is AdminRole {
  return (
    typeof value === "string" &&
    (ADMIN_ROLES as readonly string[]).includes(value)
  );
}

export function isAdminPermission(value: unknown): value is AdminPermission {
  return (
    typeof value === "string" &&
    (ADMIN_PERMISSIONS as readonly string[]).includes(value)
  );
}

/**
 * Does `role` hold `permission`?
 *
 * Deny by default at every step: an unknown role, a null role, or a permission
 * string outside the union all return false. Authorization is a positive
 * lookup, never the absence of a denial — so a typo in a permission name fails
 * closed rather than accidentally granting.
 */
export function roleHasPermission(
  role: AdminRole | null | undefined,
  permission: AdminPermission,
): boolean {
  if (!role || !isAdminRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Every permission a role holds — used to build the UI's visible surface. */
export function permissionsFor(
  role: AdminRole | null | undefined,
): readonly AdminPermission[] {
  if (!role || !isAdminRole(role)) return [];
  return ROLE_PERMISSIONS[role];
}
