import { ShieldAlert, ThumbsUp, TrendingUp, TriangleAlert } from "lucide-react";

import type { SwotContent } from "@/features/ai/renderer/types";
import { cn } from "@/lib/utils";

interface SwotGridProps {
  content: SwotContent;
}

const QUADRANTS = [
  {
    key: "strengths",
    label: "Strengths",
    icon: ThumbsUp,
    accent: "text-brand-green",
    dot: "bg-brand-green",
    surface: "border-brand-green/25 bg-brand-green/[0.06]",
  },
  {
    key: "weaknesses",
    label: "Weaknesses",
    icon: TriangleAlert,
    accent: "text-danger-soft",
    dot: "bg-danger-soft",
    surface: "border-danger/25 bg-danger/[0.06]",
  },
  {
    key: "opportunities",
    label: "Opportunities",
    icon: TrendingUp,
    accent: "text-brand-cyan",
    dot: "bg-brand-cyan",
    surface: "border-brand-cyan/25 bg-brand-cyan/[0.06]",
  },
  {
    key: "threats",
    label: "Threats",
    icon: ShieldAlert,
    accent: "text-brand-magenta",
    dot: "bg-brand-magenta",
    surface: "border-brand-magenta/25 bg-brand-magenta/[0.06]",
  },
] as const;

/** SWOTGrid — four-quadrant SWOT layout (REPORT-DESIGN-SYSTEM.md). */
export function SwotGrid({ content }: SwotGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {QUADRANTS.map(({ key, label, icon: Icon, accent, dot, surface }) => (
        <section
          key={key}
          className={cn("rounded-2xl border p-5", surface)}
          aria-labelledby={`swot-${key}`}
        >
          <h3
            id={`swot-${key}`}
            className={cn(
              "flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide",
              accent,
            )}
          >
            <Icon className="size-4" />
            {label}
          </h3>
          <ul className="mt-3 flex flex-col gap-2">
            {content[key].map((item, index) => (
              <li
                key={`${key}-${index}`}
                className="flex gap-2 text-sm leading-relaxed text-muted"
              >
                <span
                  aria-hidden
                  className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", dot)}
                />
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
