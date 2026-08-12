import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Input — the AIAutomix text field primitive (UI-DESIGN-SYSTEM: Input).
 * Dark surface, subtle border, brand-violet focus ring.
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-white/10 bg-fill-1 px-4 text-[15px] text-foreground shadow-sm transition-colors",
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
Input.displayName = "Input";

export { Input };
