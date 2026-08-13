import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CLAIM_KIND_MEANING,
  DIMENSION_LABELS,
  displayValue,
  isAbsentValue,
  isComparisonDimension,
  type ClaimKind,
  type ComparisonDimension,
} from "@/features/competitors/types";
import type { CompetitorRow } from "@/types/database";

/**
 * The feature comparison matrix.
 *
 * Responsive by structure rather than by overflow: a real `<table>` on desktop,
 * and one card per dimension on mobile. The spec forbids horizontal scrolling,
 * and a five-column table cannot be made to fit a phone by scrolling it — the
 * only honest options are to reflow it or to drop columns, and dropping columns
 * from a comparison defeats the point.
 *
 * Cells are text, never scores. "Two-way calendar sync" tells a reader
 * something; "8/10" tells them a number somebody made up. Every cell carries
 * its claim kind as a word, so a competitor's marketing copy is never rendered
 * indistinguishably from an independent observation.
 */

interface MatrixCell {
  domain?: unknown;
  value?: unknown;
  kind?: unknown;
}

interface MatrixRow {
  dimension?: unknown;
  cells?: MatrixCell[];
  ownBusiness?: unknown;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function kindOf(value: unknown): ClaimKind {
  return value === "STATED" || value === "OBSERVED" || value === "RECOMMENDED"
    ? value
    : "INFERRED";
}

export interface ComparisonMatrixProps {
  /** `structured_content.matrix` from the `feature_comparison` section. */
  matrix: unknown;
  competitors: CompetitorRow[];
  /** The user's own business, shown as the last column. */
  ownBusinessLabel: string;
}

export function ComparisonMatrix({
  matrix,
  competitors,
  ownBusinessLabel,
}: ComparisonMatrixProps) {
  const rows: { dimension: ComparisonDimension; row: MatrixRow }[] = (
    Array.isArray(matrix) ? (matrix as MatrixRow[]) : []
  )
    .filter((row) => isComparisonDimension(row?.dimension))
    .map((row) => ({
      dimension: row.dimension as ComparisonDimension,
      row,
    }));

  if (rows.length === 0) {
    return (
      <Card className="px-6 py-10 text-center">
        <p className="font-display text-base font-bold text-foreground">
          No comparison could be built
        </p>
        <p className="mt-1 text-sm text-muted">
          A dimension is only included when there is evidence for most of the
          competitors on it. None reached that bar, so no table is shown rather
          than one that looks researched and is not.
        </p>
      </Card>
    );
  }

  // Only competitors that actually appear in the matrix become columns.
  const domains = new Set<string>();
  for (const { row } of rows) {
    for (const cell of row.cells ?? []) {
      const domain = str(cell?.domain);
      if (domain) domains.add(domain);
    }
  }

  const columns = competitors.filter((competitor) =>
    domains.has(competitor.canonical_domain),
  );

  const cellFor = (row: MatrixRow, domain: string): MatrixCell | undefined =>
    (row.cells ?? []).find((cell) => str(cell?.domain) === domain);

  return (
    <div className="flex flex-col gap-4">
      {/* --- Desktop: a real table ------------------------------------- */}
      <div className="hidden lg:block">
        <Card className="overflow-hidden p-0">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Feature comparison across {columns.length} competitors and your
              business. Each cell is labelled with whether it is stated by the
              competitor, observed in a source, or inferred by AIAutoMix.
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-strong"
                >
                  Dimension
                </th>
                {columns.map((competitor) => (
                  <th
                    key={competitor.id}
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold text-foreground"
                  >
                    {competitor.name}
                  </th>
                ))}
                <th
                  scope="col"
                  className="border-l border-line bg-brand-violet/5 px-4 py-3 text-left text-xs font-semibold text-brand-violet"
                >
                  {ownBusinessLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ dimension, row }) => (
                <tr key={dimension} className="border-b border-line last:border-0">
                  <th
                    scope="row"
                    className="px-4 py-3 text-left align-top text-sm font-medium text-foreground"
                  >
                    {DIMENSION_LABELS[dimension]}
                  </th>
                  {columns.map((competitor) => {
                    const cell = cellFor(row, competitor.canonical_domain);
                    const value = str(cell?.value);
                    return (
                      <td
                        key={competitor.id}
                        className="px-4 py-3 align-top text-sm"
                      >
                        <CellValue value={value} kind={kindOf(cell?.kind)} />
                      </td>
                    );
                  })}
                  <td className="border-l border-line bg-brand-violet/5 px-4 py-3 align-top text-sm">
                    <CellValue
                      value={str(row.ownBusiness)}
                      kind="INFERRED"
                      own
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* --- Mobile and tablet: one card per dimension ------------------- */}
      <div className="flex flex-col gap-3 lg:hidden">
        {rows.map(({ dimension, row }) => (
          <Card key={dimension} className="p-4">
            <h3 className="font-display text-sm font-bold tracking-tight text-foreground">
              {DIMENSION_LABELS[dimension]}
            </h3>
            <dl className="mt-3 flex flex-col gap-2.5">
              {columns.map((competitor) => {
                const cell = cellFor(row, competitor.canonical_domain);
                return (
                  <div key={competitor.id}>
                    <dt className="text-xs font-semibold text-muted-strong">
                      {competitor.name}
                    </dt>
                    <dd className="mt-0.5 text-sm">
                      <CellValue
                        value={str(cell?.value)}
                        kind={kindOf(cell?.kind)}
                      />
                    </dd>
                  </div>
                );
              })}
              <div className="rounded-lg border border-brand-violet/30 bg-brand-violet/5 px-3 py-2">
                <dt className="text-xs font-semibold text-brand-violet">
                  {ownBusinessLabel}
                </dt>
                <dd className="mt-0.5 text-sm">
                  <CellValue
                    value={str(row.ownBusiness)}
                    kind="INFERRED"
                    own
                  />
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-strong">
        Every cell is labelled: <strong>STATED</strong> is the competitor&apos;s
        own claim, <strong>OBSERVED</strong> is visible in a cited source, and{" "}
        <strong>INFERRED</strong> is AIAutoMix&apos;s reading of the evidence.
        Your own column is AIAutoMix&apos;s reading of your brief.
      </p>
    </div>
  );
}

function CellValue({
  value,
  kind,
  own = false,
}: {
  value: string | null;
  kind: ClaimKind;
  own?: boolean;
}) {
  if (!value || isAbsentValue(value)) {
    return (
      <span className="text-xs text-muted-strong">{displayValue(value)}</span>
    );
  }

  return (
    <span className="flex flex-col gap-1">
      {!own ? (
        <span
          className="text-[10px] font-semibold uppercase tracking-tight text-muted-strong"
          title={CLAIM_KIND_MEANING[kind]}
        >
          {kind}
        </span>
      ) : null}
      <span className={cn("text-muted", own ? "text-foreground" : null)}>
        {value}
      </span>
    </span>
  );
}
