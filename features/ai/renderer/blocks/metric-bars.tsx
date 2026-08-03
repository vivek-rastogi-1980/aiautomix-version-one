import { TONE_BAR, valueTone } from "@/features/ai/renderer/tone";
import type { MetricEntry } from "@/features/ai/renderer/types";

interface MetricBarsProps {
  entries: MetricEntry[];
}

/**
 * MetricBars — labelled 0–100 bars, optionally showing each entry's weight.
 * Used for score breakdowns and any other per-category rating.
 */
export function MetricBars({ entries }: MetricBarsProps) {
  return (
    <dl className="flex flex-col gap-4">
      {entries.map((entry) => (
        <div key={entry.key}>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm font-medium text-foreground/90">
              {entry.label}
              {entry.weight !== undefined ? (
                <span className="ml-2 text-xs text-muted-strong">
                  {entry.weight}% weight
                </span>
              ) : null}
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">
              {entry.value}
              <span className="text-muted-strong">/100</span>
            </dd>
          </div>
          <div
            className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]"
            role="img"
            aria-label={`${entry.label}: ${entry.value} out of 100`}
          >
            <div
              className={`h-full rounded-full ${TONE_BAR[valueTone(entry.value)]}`}
              style={{ width: `${entry.value}%` }}
            />
          </div>
        </div>
      ))}
    </dl>
  );
}
