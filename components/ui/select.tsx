import * as React from "react";

import { cn } from "@/lib/utils";

/** Select — native styled select matching the Input primitive. */
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[15px] text-foreground shadow-sm transition-colors",
        "focus-visible:border-brand-violet/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "[&>option]:bg-surface [&>option]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export { Select };
