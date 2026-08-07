"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Optional footer (e.g. action buttons). */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Modal — accessible dialog overlay (UI-DESIGN-SYSTEM: Modal).
 *
 * Renders through a portal, closes on Escape, restores body scroll, and labels
 * itself for screen readers. Kept dependency-light (no Radix) to match the
 * current primitive set.
 *
 * Focus management is part of the dialog contract, not a nicety: `aria-modal`
 * tells assistive tech that everything outside is inert, so if Tab can still
 * reach the page behind, the announcement is a lie and a keyboard user ends up
 * typing into content they cannot see. This implements the three things that
 * makes true — move focus in on open, cycle Tab within the panel, and return
 * focus to whatever opened it on close, so the trigger is not lost.
 */

/** Tab-reachable elements, in DOM order. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");
function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const titleId = React.useId();
  const descId = React.useId();
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;

    // Captured before focus moves, so it is still the element that opened the
    // dialog rather than something inside it.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
          [],
      );

    // Land inside the dialog. Falls back to the panel itself (tabIndex={-1})
    // when the content has nothing focusable, so focus is never left behind on
    // the now-inert page.
    (focusable()[0] ?? panelRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = panelRef.current?.contains(active ?? null) ?? false;

      // Wrap at both ends, and pull focus back if it has drifted outside.
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9600] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
    >
      <div
        className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-lg rounded-3xl border border-white/[0.08] bg-surface p-6 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] focus:outline-none sm:p-7",
          className,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet"
        >
          <X className="size-5" />
        </button>
        <h2
          id={titleId}
          className="font-display text-xl font-bold tracking-tight text-foreground"
        >
          {title}
        </h2>
        {description ? (
          <p id={descId} className="mt-1.5 text-sm text-muted">
            {description}
          </p>
        ) : null}
        <div className="mt-5">{children}</div>
        {footer ? (
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export { Modal };
