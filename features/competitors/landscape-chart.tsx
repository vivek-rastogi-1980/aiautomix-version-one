import { Card } from "@/components/ui/card";
import type { CompetitorRow } from "@/types/database";

/**
 * The competitive landscape: price level against feature breadth.
 *
 * Two rules make this drawable at all.
 *
 *   IT IS DRAWN ONLY WHEN THE ANALYSIS SAYS IT CAN BE. The analysis stage sets
 *   `landscapeAvailable` and returns placements only where it could position a
 *   competitor on both axes from evidence. When it cannot, this component
 *   prints why instead of plotting. A chart is the most persuasive form an
 *   unsupported claim can take, so an invented one is worse than none.
 *
 *   IT IS LABELLED AS OPINION. Both axes are AIAutoMix's own reading of the
 *   evidence, on a relative 0-100 scale with no units. The caption says so, and
 *   every point carries the stated basis for its placement — so a reader can
 *   disagree with a specific placement rather than having to trust the picture.
 *
 * Rendered as inline SVG with a text table beneath it: the table is not a
 * fallback, it is the accessible presentation of the same data, and it is what
 * a screen reader and a printed page get.
 */

interface LandscapePoint {
  domain?: unknown;
  priceLevel?: unknown;
  featureBreadth?: unknown;
  basis?: unknown;
}

function num(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
    ? value
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function LandscapeChart({
  landscape,
  available,
  competitors,
}: {
  landscape: unknown;
  available: boolean;
  competitors: CompetitorRow[];
}) {
  const points = (
    Array.isArray(landscape) ? (landscape as LandscapePoint[]) : []
  )
    .map((point) => {
      const domain = str(point?.domain);
      const price = num(point?.priceLevel);
      const breadth = num(point?.featureBreadth);
      if (!domain || price === null || breadth === null) return null;
      const competitor = competitors.find((c) => c.canonical_domain === domain);
      return {
        domain,
        name: competitor?.name ?? domain,
        price,
        breadth,
        basis: str(point?.basis) ?? "Basis not stated.",
      };
    })
    .filter((point): point is NonNullable<typeof point> => point !== null);

  if (!available || points.length < 2) {
    return (
      <Card className="px-6 py-10 text-center">
        <p className="font-display text-base font-bold text-foreground">
          Insufficient reliable data for visualization
        </p>
        <p className="mt-1 mx-auto max-w-md text-sm text-muted">
          Placing competitors on a chart needs a defensible reading of both
          price and feature breadth for at least two of them. The evidence
          gathered did not support that, so the comparison table above is the
          honest version of this picture.
        </p>
      </Card>
    );
  }

  // Plot geometry. Padding leaves room for the axis labels.
  const W = 520;
  const H = 360;
  const PAD = 44;
  const x = (value: number) => PAD + (value / 100) * (W - PAD * 2);
  // SVG y grows downward; higher feature breadth should sit higher.
  const y = (value: number) => H - PAD - (value / 100) * (H - PAD * 2);

  return (
    <Card className="p-5 sm:p-6">
      <h3 className="font-display text-base font-bold tracking-tight text-foreground">
        Competitive landscape
      </h3>
      <p className="mt-1 text-sm text-muted">
        AIAutoMix analysis based on available evidence. Both axes are relative
        readings on a 0–100 scale, not measured values, and not market truth.
      </p>

      <div className="mt-4 overflow-hidden">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full max-w-[560px]"
          role="img"
          aria-label={`Scatter plot placing ${points.length} competitors by AIAutoMix's relative reading of price level and feature breadth. The same data is listed in the table below.`}
        >
          {/* Axes */}
          <line
            x1={PAD}
            y1={H - PAD}
            x2={W - PAD}
            y2={H - PAD}
            stroke="currentColor"
            className="text-line-strong"
            strokeWidth={1}
          />
          <line
            x1={PAD}
            y1={PAD}
            x2={PAD}
            y2={H - PAD}
            stroke="currentColor"
            className="text-line-strong"
            strokeWidth={1}
          />

          <text
            x={W / 2}
            y={H - 10}
            textAnchor="middle"
            className="fill-current text-[11px] text-muted"
          >
            Price level (relative) →
          </text>
          <text
            x={-H / 2}
            y={14}
            textAnchor="middle"
            transform="rotate(-90)"
            className="fill-current text-[11px] text-muted"
          >
            Feature breadth (relative) →
          </text>

          {points.map((point, index) => (
            <g key={point.domain}>
              <circle
                cx={x(point.price)}
                cy={y(point.breadth)}
                r={7}
                className="fill-brand-violet/70 stroke-brand-violet"
                strokeWidth={1.5}
              />
              <text
                x={x(point.price)}
                y={y(point.breadth) - 12}
                textAnchor="middle"
                className="fill-current text-[10px] font-semibold text-foreground"
              >
                {index + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* The accessible presentation of the same data — and the place a reader
          can check why any given point sits where it does. */}
      <ol className="mt-4 flex flex-col gap-2">
        {points.map((point, index) => (
          <li key={point.domain} className="flex gap-3 text-sm">
            <span className="shrink-0 font-semibold tabular-nums text-muted-strong">
              {index + 1}.
            </span>
            <span className="min-w-0">
              <span className="font-medium text-foreground">{point.name}</span>
              <span className="ml-2 text-xs text-muted-strong">
                price {point.price} · breadth {point.breadth}
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {point.basis}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
