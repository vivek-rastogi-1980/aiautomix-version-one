import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badge — small status pill (UI-DESIGN-SYSTEM: Badge). Used for project status
 * and other short labels.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-tight",
  {
    variants: {
      variant: {
        neutral: "border-white/10 bg-fill-2 text-muted",
        active: "border-brand-green/30 bg-brand-green/10 text-brand-green",
        paused: "border-accent-lime/30 bg-accent-lime/10 text-accent-lime",
        completed: "border-brand-cyan/30 bg-brand-cyan/10 text-accent",
        archived: "border-white/10 bg-fill-2 text-muted-strong",
        brand: "border-brand-violet/30 bg-brand-violet/10 text-brand-violet",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
