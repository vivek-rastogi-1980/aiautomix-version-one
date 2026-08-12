"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { SidebarNav } from "@/features/dashboard/sidebar-nav";
import { UserMenu } from "@/features/dashboard/user-menu";
import { ThemeToggle } from "@/features/theme/theme-toggle";
import type { Theme } from "@/lib/theme";

interface DashboardShellProps {
  user: {
    name: string;
    email: string;
    avatarUrl: string | null;
    initials: string;
  };
  /** Resolved server-side from the cookie, so the first paint is correct. */
  theme: Theme;
  children: ReactNode;
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/logo-ice2.png"
        alt="AIAutomix"
        className="size-8 object-contain"
      />
      <span className="font-display text-base font-bold tracking-tight text-foreground">
        AIAutomix
      </span>
    </Link>
  );
}

export function DashboardShell({ user, theme, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    // `data-theme` is what the CSS variables key off. It sits here rather than
    // on <html> so the marketing pages — which never render this shell — keep
    // their hand-tuned dark styling regardless of the preference.
    <div data-theme={theme} className="min-h-screen bg-ink text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface/60 px-4 py-6 lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <div className="mt-8">
          <SidebarNav />
        </div>
      </aside>

      {/* Mobile drawer */}
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
            <div className="mt-8">
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className={cn("flex min-h-screen flex-col lg:pl-64")}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-ink/75 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-fill-3 hover:text-foreground lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <div className="lg:hidden">
              <Brand />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle theme={theme} />
            <UserMenu {...user} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
