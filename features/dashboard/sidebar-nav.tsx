"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  CreditCard,
  Stethoscope,
  FileText,
  FolderKanban,
  LayoutDashboard,
  NotebookPen,
  Settings,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/validator", label: "Idea Validator", icon: Sparkles },
  { href: "/plans", label: "Business Plans", icon: NotebookPen },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/ai/history", label: "AI activity", icon: Activity },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/workspace", label: "Workspace", icon: Building2 },
  { href: "/usage", label: "Usage & plan", icon: CreditCard },
  { href: "/diagnostics", label: "Diagnostics", icon: Stethoscope },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarNavProps {
  /** Called after a link is clicked (used to close the mobile drawer). */
  onNavigate?: () => void;
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Dashboard">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-violet/15 text-foreground"
                : "text-muted hover:bg-white/[0.04] hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-[18px] shrink-0",
                active ? "text-brand-violet" : "text-muted-strong",
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
