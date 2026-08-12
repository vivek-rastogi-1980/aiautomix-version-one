import { cn } from "@/lib/utils";

/** Skeleton — neutral loading placeholder block. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-xl bg-fill-3", className)}
      {...props}
    />
  );
}
