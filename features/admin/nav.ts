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
/**
 * Navigation sections.
 *
 * Sixteen ungrouped links is a list you scan rather than navigate. The order
 * follows how an operator actually thinks about the platform — who the
 * customers are, what the business is doing, what the AI cost, what we said to
 * people, who did what, and whether anything is on fire.
 */
export const ADMIN_NAV_SECTIONS = [
  "Overview",
  "Customers",
  "Business",
  "AI platform",
  "Communications",
  "Security",
  "System",
] as const;

export type AdminNavSection = (typeof ADMIN_NAV_SECTIONS)[number];

export interface AdminNavItem {
  /** Which group this appears under in the sidebar. */
  section: AdminNavSection;
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
    section: "Overview",
    label: "Dashboard",
    icon: "LayoutDashboard",
    description: "Platform KPIs and recent activity.",
  },
  {
    href: "/admin/users",
    section: "Customers",
    label: "Users",
    permission: "users.read",
    icon: "Users",
    description: "Search accounts, memberships and status.",
  },
  {
    href: "/admin/workspaces",
    section: "Customers",
    label: "Workspaces",
    permission: "workspaces.read",
    icon: "Building2",
    description: "Owners, members, plan, credits and usage.",
  },
  {
    href: "/admin/ai",
    section: "AI platform",
    label: "AI operations",
    permission: "ai.read",
    icon: "Sparkles",
    description: "Requests, failures, models and tokens.",
  },
  {
    href: "/admin/research",
    section: "AI platform",
    label: "Research ops",
    // The same grant that governs the research tables' admin SELECT policies in
    // migration 0009 — a role that can read the rows can read the monitoring.
    permission: "ai.read",
    icon: "Microscope",
    description: "Runs, stages, failures and evidence counts.",
  },
  {
    href: "/admin/leads",
    section: "Business",
    label: "Leads",
    permission: "leads.read",
    icon: "UserPlus",
    description: "The funnel: who asked, and where they got to.",
  },
  {
    href: "/admin/bookings",
    section: "Business",
    label: "Strategy sessions",
    permission: "bookings.read",
    icon: "CalendarClock",
    description: "Requested slots and their lifecycle.",
  },
  {
    href: "/admin/communications",
    section: "Communications",
    label: "Communications",
    permission: "communications.read",
    icon: "Mail",
    description: "Email templates, versions and the delivery log.",
  },
  {
    href: "/admin/usage",
    section: "AI platform",
    label: "Usage",
    permission: "usage.read",
    icon: "Activity",
    description: "Consumption across the platform.",
  },
  {
    href: "/admin/costs",
    section: "AI platform",
    label: "Cost analytics",
    permission: "usage.read",
    icon: "DollarSign",
    description: "Spend by day, provider, model, workflow and workspace.",
  },
  {
    href: "/admin/credits",
    section: "AI platform",
    label: "Credits",
    permission: "credits.read",
    icon: "Coins",
    description: "Balances and the ledger.",
  },
  {
    href: "/admin/plans",
    section: "Business",
    label: "Plans",
    permission: "plans.read",
    icon: "Layers",
    description: "Commercial plan catalog.",
  },
  {
    href: "/admin/entitlements",
    section: "Business",
    label: "Entitlements",
    permission: "entitlements.read",
    icon: "ToggleRight",
    description: "What each plan includes.",
  },
  {
    href: "/admin/audit-logs",
    section: "Security",
    label: "Audit logs",
    permission: "audit.read",
    icon: "ScrollText",
    description: "Immutable record of admin actions.",
  },
  {
    href: "/admin/system-health",
    section: "System",
    label: "System health",
    permission: "system.read",
    icon: "HeartPulse",
    description: "Application, database and AI provider.",
  },
  {
    href: "/admin/settings",
    section: "Security",
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
