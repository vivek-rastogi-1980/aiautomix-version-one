"use client";

import { useTransition } from "react";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { setTheme } from "@/features/theme/actions";
import type { Theme } from "@/lib/theme";

/**
 * Light/dark switch for the signed-in surfaces.
 *
 * A button, not a checkbox: `aria-pressed` describes "light mode is on/off"
 * more honestly than a checked state, and screen readers announce the change
 * without needing a visible label.
 *
 * The optimistic class swap is intentional. The server action re-renders the
 * shell with the new markup, but that is a round trip; flipping the attribute
 * locally first makes the toggle feel immediate. Because the server is the
 * source of truth, a failed action simply leaves the next render correct.
 */
export function ThemeToggle({
  theme,
  className,
}: {
  theme: Theme;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      aria-pressed={theme === "light"}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      disabled={pending}
      onClick={() => {
        // Flip the attribute the CSS variables key off, so the change paints
        // before the server responds.
        const root = document.querySelector<HTMLElement>("[data-theme]");
        if (root) root.dataset.theme = next;
        start(() => {
          void setTheme(next);
        });
      }}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-fill-3 hover:text-foreground disabled:opacity-60",
        className,
      )}
    >
      {theme === "dark" ? (
        <Sun className="size-4.5" />
      ) : (
        <Moon className="size-4.5" />
      )}
    </button>
  );
}
