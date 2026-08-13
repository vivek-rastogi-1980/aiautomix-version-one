import type { AdminPermission } from "@/features/admin/permissions";

/**
 * Admin navigation.
 *
 * Each entry declares the permission it needs. The shell filters the list by
 * the caller's grants, so a SUPPORT user never sees a link to a page that would
 * bounce them.
 *
 * This is a usability measure, not a security one. Every route named here runs
 * its own `requirePermission()` server-side, and the underlying tables refuse
 * the read regardless. Typing the URL directly gets a redirect, not a page —
 * SPRINT-07.md: "Do not rely on hidden navigation."
 */
export interface AdminNavItem {
  href: string;
  label: string;
  /** Omit for entries every admin may see. */
  permission?: AdminPermission;
  /** Lucide icon name, resolved in the client shell. */
  icon: string;
  description: string;
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: "LayoutDashboard",
    description: "Platform KPIs and recent activity.",
  },
  {
    href: "/admin/users",
    label: "Users",
    permission: "users.read",
    icon: "Users",
    description: "Search accounts, memberships and status.",
  },
  {
    href: "/admin/workspaces",
    label: "Workspaces",
    permission: "workspaces.read",
    icon: "Building2",
    description: "Owners, members, plan, credits and usage.",
  },
  {
    href: "/admin/ai",
    label: "AI operations",
    permission: "ai.read",
    icon: "Sparkles",
    description: "Requests, failures, models and tokens.",
  },
  {
    href: "/admin/research",
    label: "Research ops",
    // The same grant that governs the research tables' admin SELECT policies in
    // migration 0009 — a role that can read the rows can read the monitoring.
    permission: "ai.read",
    icon: "Microscope",
    description: "Runs, stages, failures and evidence counts.",
  },
  {
    href: "/admin/usage",
    label: "Usage",
    permission: "usage.read",
    icon: "Activity",
    description: "Consumption across the platform.",
  },
  {
    href: "/admin/costs",
    label: "Cost analytics",
    permission: "usage.read",
    icon: "DollarSign",
    description: "Spend by day, provider, model, workflow and workspace.",
  },
  {
    href: "/admin/credits",
    label: "Credits",
    permission: "credits.read",
    icon: "Coins",
    description: "Balances and the ledger.",
  },
  {
    href: "/admin/plans",
    label: "Plans",
    permission: "plans.read",
    icon: "Layers",
    description: "Commercial plan catalog.",
  },
  {
    href: "/admin/entitlements",
    label: "Entitlements",
    permission: "entitlements.read",
    icon: "ToggleRight",
    description: "What each plan includes.",
  },
  {
    href: "/admin/audit-logs",
    label: "Audit logs",
    permission: "audit.read",
    icon: "ScrollText",
    description: "Immutable record of admin actions.",
  },
  {
    href: "/admin/system-health",
    label: "System health",
    permission: "system.read",
    icon: "HeartPulse",
    description: "Application, database and AI provider.",
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: "Settings",
    description: "Your admin role and staff directory.",
  },
] as const;

/** Breadcrumb label for a path segment, falling back to a humanised slug. */
export function segmentLabel(segment: string): string {
  const match = ADMIN_NAV.find((item) => item.href === `/admin/${segment}`);
  if (match) return match.label;
  return segment.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
