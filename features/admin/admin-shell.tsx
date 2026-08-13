"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  Coins,
  DollarSign,
  HeartPulse,
  Layers,
  LayoutDashboard,
  Menu,
  Microscope,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  ToggleRight,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { AdminNavItem } from "@/features/admin/nav";
import {
  ROLE_BADGE,
  ROLE_LABELS,
  type AdminRole,
} from "@/features/admin/permissions";
import { ThemeToggle } from "@/features/theme/theme-toggle";
import type { Theme } from "@/lib/theme";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Building2,
  Sparkles,
  Microscope,
  Activity,
  Coins,
  DollarSign,
  Layers,
  ToggleRight,
  ScrollText,
  HeartPulse,
  Settings,
};

interface AdminShellProps {
  role: AdminRole;
  email: string;
  /** Already filtered by permission on the server. */
  nav: AdminNavItem[];
  /** Resolved server-side from the cookie, so the first paint is correct. */
  theme: Theme;
  children: ReactNode;
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5">
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-violet to-brand-pink">
        <ShieldCheck className="size-4.5 text-white" />
      </span>
      <span className="font-display text-base font-bold tracking-tight text-foreground">
        AIAutomix
        <span className="ml-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
          Admin
        </span>
      </span>
    </Link>
  );
}

function NavList({
  nav,
  onNavigate,
}: {
  nav: AdminNavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Admin">
      {nav.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        // `/admin` must only match exactly, or it would highlight for every
        // child route and the current section would be ambiguous.
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-fill-4 font-medium text-foreground"
                : "text-muted hover:bg-fill-2 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Breadcrumbs derived from the path, so no page has to pass them in. */
function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean); // ["admin", ...]

  if (parts.length <= 1) return null;

  const crumbs = parts.slice(1).map((segment, index) => {
    const href = `/admin/${parts.slice(1, index + 2).join("/")}`;
    const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment);
    const label = isId
      ? `${segment.slice(0, 8)}…`
      : segment.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
    return { href, label, last: index === parts.length - 2 };
  });

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm text-muted">
        <li>
          <Link href="/admin" className="hover:text-foreground">
            Admin
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden className="text-muted-strong">
              /
            </span>
            {crumb.last ? (
              <span className="truncate text-foreground">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="truncate hover:text-foreground"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function AdminShell({
  role,
  email,
  nav,
  theme,
  children,
}: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div data-theme={theme} className="min-h-screen bg-ink text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface/60 px-4 py-6 lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <div className="mt-8 flex-1 overflow-y-auto">
          <NavList nav={nav} />
        </div>
        <div className="mt-4 rounded-lg border border-line bg-fill-1 px-3 py-2.5">
          <p className="truncate text-xs text-muted" title={email}>
            {email}
          </p>
          <div className="mt-1.5">
            <Badge variant={ROLE_BADGE[role]}>{ROLE_LABELS[role]}</Badge>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="mt-3 px-3 text-xs text-muted hover:text-foreground"
        >
          ← Back to app
        </Link>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line bg-surface px-4 py-6">
            <div className="flex items-center justify-between px-2">
              <Brand />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-fill-3 hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-8 flex-1 overflow-y-auto">
              <NavList nav={nav} onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="mt-4 rounded-lg border border-line px-3 py-2.5">
              <p className="truncate text-xs text-muted">{email}</p>
              <div className="mt-1.5">
                <Badge variant={ROLE_BADGE[role]}>{ROLE_LABELS[role]}</Badge>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-line bg-ink/80 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-fill-3 hover:text-foreground lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle theme={theme} />
            <Badge variant={ROLE_BADGE[role]}>{ROLE_LABELS[role]}</Badge>
          </div>
        </header>

        <main className="px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
