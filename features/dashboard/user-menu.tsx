"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Settings, UserRound } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { signOutAction } from "@/features/auth/actions";

interface UserMenuProps {
  name: string;
  email: string;
  avatarUrl: string | null;
  initials: string;
}

export function UserMenu({ name, email, avatarUrl, initials }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    // Dismissing by clicking away is a pointer affordance with no keyboard
    // equivalent, so without Escape a keyboard user who opens this menu has no
    // way to close it — they can only tab through every item. The WAI-ARIA menu
    // pattern also expects focus to return to the trigger, otherwise it
    // restarts from the top of the document.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-full p-1 pr-3 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet"
      >
        <Avatar
          src={avatarUrl}
          alt={name}
          fallback={initials}
          className="size-9"
        />
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium leading-tight text-foreground">
            {name}
          </span>
          <span className="block max-w-[160px] truncate text-xs leading-tight text-muted">
            {email}
          </span>
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 overflow-hidden rounded-2xl border border-white/[0.08] bg-surface p-1.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]"
        >
          <div className="border-b border-white/[0.06] px-3 py-2.5 sm:hidden">
            <p className="text-sm font-medium text-foreground">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            <UserRound className="size-4" />
            Profile
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-foreground"
          >
            <Settings className="size-4" />
            Settings
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-danger-soft transition-colors hover:bg-danger/10"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
