import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  /** Anchor target for the report's section navigation. */
  id?: string;
}

/**
 * InsightCard — the standard titled block wrapping every report section
 * (REPORT-DESIGN-SYSTEM.md).
 */
export function InsightCard({
  title,
  icon: Icon,
  children,
  className,
  id,
}: InsightCardProps) {
  return (
    <Card id={id} className={cn("scroll-mt-24 p-6 sm:p-7", className)}>
      <div className="flex items-center gap-2.5">
        {Icon ? (
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-violet/15 text-brand-violet">
            <Icon className="size-[18px]" />
          </span>
        ) : null}
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          {title}
        </h2>
      </div>
      <div className="mt-4 text-[15px] leading-relaxed text-muted">
        {children}
      </div>
    </Card>
  );
}
