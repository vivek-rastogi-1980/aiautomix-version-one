import type { TimelineEntry } from "@/features/ai/renderer/types";

interface TimelineProps {
  entries: TimelineEntry[];
}

/** Timeline — sequential steps with timeframes (REPORT-DESIGN-SYSTEM.md). */
export function Timeline({ entries }: TimelineProps) {
  return (
    <ol className="relative flex flex-col gap-6 border-l border-white/[0.08] pl-6">
      {entries.map((entry, index) => (
        <li key={`${entry.title}-${index}`} className="relative">
          <span
            aria-hidden
            className="absolute -left-[31px] flex size-4 items-center justify-center rounded-full border-2 border-ink bg-brand-violet"
          />
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
              {entry.title}
            </h3>
            <span className="text-xs font-medium uppercase tracking-wide text-brand-cyan">
              {entry.timeframe}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {entry.description}
          </p>
        </li>
      ))}
    </ol>
  );
}
