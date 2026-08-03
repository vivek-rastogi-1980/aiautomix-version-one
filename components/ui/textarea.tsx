import * as React from "react";

import { cn } from "@/lib/utils";

/** Textarea — multi-line variant of the Input primitive. */
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-24 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[15px] text-foreground shadow-sm transition-colors",
        "placeholder:text-muted-strong",
        "focus-visible:border-brand-violet/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-danger/70 aria-[invalid=true]:focus-visible:ring-danger/40",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
