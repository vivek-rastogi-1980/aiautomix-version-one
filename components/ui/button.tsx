import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button — the AIAutomix action primitive.
 *
 * Variants are derived from the design system's brand palette (see
 * tailwind.config.ts). The migrated marketing pages keep their original inline
 * styles for pixel fidelity; this primitive is the reusable, accessible button
 * for any new UI built on top of the scaffold.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-display font-semibold tracking-tight transition-[transform,filter,background,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-gradient text-ink shadow-[0_10px_30px_-10px_rgba(124,92,255,0.6)] hover:brightness-110 hover:shadow-[0_14px_38px_-10px_rgba(124,92,255,0.75)]",
        lime: "bg-accent-lime text-accent-dark hover:brightness-105",
        secondary:
          "bg-surface text-foreground border border-white/10 hover:border-white/20 hover:bg-fill-2",
        outline:
          "border border-brand-violet/60 text-foreground hover:bg-brand-violet/10",
        ghost: "text-foreground hover:bg-fill-3",
        danger: "bg-danger text-ink hover:bg-danger-soft",
        link: "text-accent underline-offset-4 hover:underline rounded-none px-0",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-[15px]",
        lg: "h-14 px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
