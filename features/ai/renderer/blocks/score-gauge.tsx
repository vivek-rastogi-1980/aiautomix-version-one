import { TONE_HEX, TONE_TEXT } from "@/features/ai/renderer/tone";
import type { ReportTone } from "@/features/ai/renderer/types";
import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  /** 0–100. */
  value: number;
  /** Band name shown under the number, e.g. "Strong". */
  label?: string;
  tone?: ReportTone;
  size?: "sm" | "lg";
  className?: string;
}

/**
 * ScoreGauge — circular 0–100 indicator (REPORT-DESIGN-SYSTEM.md).
 *
 * Banding is the caller's decision: a workflow supplies the tone and label with
 * its score, so the gauge works for any 0–100 metric without embedding one
 * product's thresholds. Rendered as inline SVG, so it needs no client JS.
 */
export function ScoreGauge({
  value,
  label,
  tone = "neutral",
  size = "lg",
  className,
}: ScoreGaugeProps) {
  const dimension = size === "lg" ? 168 : 96;
  const strokeWidth = size === "lg" ? 12 : 8;
  const radius = (dimension - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(value, 0), 100);
  const progress = (clamped / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: dimension, height: dimension }}
      role="img"
      aria-label={`Score ${value} out of 100${label ? ` — ${label}` : ""}`}
    >
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
        aria-hidden
      >
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke={TONE_HEX[tone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference - progress}`}
          transform={`rotate(-90 ${dimension / 2} ${dimension / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-display font-bold leading-none tracking-tight",
            size === "lg" ? "text-4xl" : "text-2xl",
            TONE_TEXT[tone],
          )}
        >
          {value}
        </span>
        {size === "lg" && label ? (
          <span className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}
