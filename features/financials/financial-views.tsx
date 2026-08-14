import { AlertTriangle, ExternalLink, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  formatBps,
  formatMoney,
  money,
  type CurrencyCode,
} from "@/features/financials/money";
import {
  ASSUMPTION_SOURCE_LABELS,
  ASSUMPTION_SOURCE_MEANING,
  COST_CATEGORY_LABELS,
  FUNDING_TYPE_LABELS,
  REVENUE_MODEL_FORMULA,
  RISK_LABELS,
  SCENARIO_LABELS,
  SUITABILITY_LABELS,
  isCostCategory,
  isFundingType,
  isRevenueModel,
  isScenario,
  type AssumptionSource,
  type RevenueModel,
  type Suitability,
} from "@/features/financials/types";
import type {
  FinancialAssumptionRow,
  FinancialCostRow,
  FinancialSourceRow,
  FundingOptionRow,
} from "@/types/database";

/**
 * The read-only financial views: dashboard, forecast, scenarios, costs,
 * funding and sources.
 *
 * Every figure rendered here came out of the deterministic engine and was
 * stored as a section row. Nothing in this file computes a total — it formats
 * minor units into a currency string and stops. The one arithmetic operation it
 * performs is turning a stored basis-point ratio into a percentage for display,
 * which is presentation, not calculation.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function m(minor: number | null | undefined, currency: CurrencyCode): string {
  if (minor === null || minor === undefined) return "—";
  return formatMoney(money(minor, currency));
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeHref(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

const SOURCE_BADGE: Record<
  AssumptionSource,
  "brand" | "active" | "completed" | "paused" | "neutral"
> = {
  USER: "brand",
  INHERITED_RESEARCH: "active",
  INHERITED_PLAN: "completed",
  INHERITED_COMPETITOR: "completed",
  AI: "paused",
  DEFAULT: "neutral",
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardFigures {
  currency: CurrencyCode;
  revenueMinor: number | null;
  grossProfitMinor: number | null;
  operatingProfitMinor: number | null;
  breakEvenMonth: number | null;
  breakEvenRevenueMinor: number | null;
  monthlyBurnMinor: number | null;
  runwayMonths: number | null;
  capitalRequiredMinor: number | null;
  grossMarginBps: number | null;
}

/**
 * The headline numbers.
 *
 * Currency is displayed on every single figure — the spec is explicit, and a
 * financial dashboard whose currency is implied is one a reader will
 * misinterpret exactly once, expensively.
 */
export function FinancialDashboard({
  figures,
  horizonMonths,
}: {
  figures: DashboardFigures;
  horizonMonths: number;
}) {
  const {
    currency,
    revenueMinor,
    grossProfitMinor,
    operatingProfitMinor,
    breakEvenMonth,
    monthlyBurnMinor,
    runwayMonths,
    capitalRequiredMinor,
    grossMarginBps,
  } = figures;

  return (
    <section
      aria-labelledby="dashboard-heading"
      className="flex flex-col gap-4"
    >
      <div>
        <h2
          id="dashboard-heading"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Headline figures
        </h2>
        <p className="text-sm text-muted">
          Calculated over {horizonMonths} months, in {currency}. Every figure is
          derived from the assumptions below — change one and these change.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label={`Revenue (${horizonMonths}m)`}
          value={m(revenueMinor, currency)}
        />
        <Metric
          label="Gross profit"
          value={m(grossProfitMinor, currency)}
          sub={
            grossMarginBps !== null
              ? `${formatBps(grossMarginBps)} margin`
              : undefined
          }
        />
        <Metric
          label="Operating profit"
          value={m(operatingProfitMinor, currency)}
          tone={
            operatingProfitMinor !== null && operatingProfitMinor < 0
              ? "negative"
              : undefined
          }
        />
        <Metric
          label="Break-even"
          value={
            breakEvenMonth !== null ? `Month ${breakEvenMonth}` : "Not reached"
          }
          sub={
            breakEvenMonth === null
              ? `within ${horizonMonths} months`
              : undefined
          }
          tone={breakEvenMonth === null ? "negative" : undefined}
        />
        <Metric label="Monthly burn" value={m(monthlyBurnMinor, currency)} />
        <Metric
          label="Runway"
          value={
            runwayMonths !== null ? `${runwayMonths} months` : "Not burning"
          }
        />
        <Metric
          label="Capital required"
          value={m(capitalRequiredMinor, currency)}
          sub="Deepest cash shortfall"
        />
        <Metric label="Currency" value={currency} />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "negative";
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-display text-xl font-bold tracking-tight",
          tone === "negative" ? "text-danger-soft" : "text-foreground",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

/**
 * The assumptions table.
 *
 * Each row shows WHERE THE NUMBER CAME FROM as a word, not a colour. That badge
 * is the whole point of the feature: a founder must be able to see at a glance
 * which figures they chose, which came from evidence, and which a model simply
 * proposed — because the last group is where the forecast is weakest.
 */
export function AssumptionsPanel({
  assumptions,
  currency,
  children,
}: {
  assumptions: FinancialAssumptionRow[];
  currency: CurrencyCode;
  /** The edit control, injected by the page so this stays a server component. */
  children?: (assumption: FinancialAssumptionRow) => React.ReactNode;
}) {
  if (assumptions.length === 0) {
    return (
      <Card className="px-6 py-10 text-center">
        <p className="font-display text-base font-bold text-foreground">
          No assumptions yet
        </p>
        <p className="mt-1 text-sm text-muted">
          The planning and revenue stages propose them. Every figure in the
          forecast will trace back to one.
        </p>
      </Card>
    );
  }

  const aiCount = assumptions.filter((a) => a.source === "AI").length;

  return (
    <section
      aria-labelledby="assumptions-heading"
      className="flex flex-col gap-4"
    >
      <div>
        <h2
          id="assumptions-heading"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Assumptions
        </h2>
        <p className="text-sm text-muted">
          Every calculated figure derives from these. Changing one changes the
          whole forecast.
        </p>
      </div>

      {aiCount > 0 ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-accent-lime/30 bg-accent-lime/10 px-4 py-3 text-sm text-accent-lime"
        >
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>
            {aiCount} of these {aiCount === 1 ? "was" : "were"} proposed by
            AIAutoMix rather than entered by you or drawn from evidence. They
            are the weakest points in the forecast — check them first.
          </span>
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {assumptions.map((assumption) => {
          const source = (assumption.source ?? "AI") as AssumptionSource;
          const isMoney = assumption.unit === "money";
          const display = isMoney
            ? m(assumption.value_minor, currency)
            : assumption.unit === "bps"
              ? formatBps(assumption.value_int)
              : String(assumption.value_int ?? "—");

          return (
            <li key={assumption.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold tracking-tight text-foreground">
                      {assumption.label}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted-strong">
                      {assumption.key}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-bold text-foreground">
                      {display}
                    </span>
                    <Badge
                      variant={SOURCE_BADGE[source]}
                      title={ASSUMPTION_SOURCE_MEANING[source]}
                    >
                      {ASSUMPTION_SOURCE_LABELS[source]}
                    </Badge>
                  </div>
                </div>

                {assumption.rationale ? (
                  <p className="mt-2 text-sm text-muted">
                    {assumption.rationale}
                  </p>
                ) : null}

                {assumption.evidence_url &&
                safeHref(assumption.evidence_url) ? (
                  <p className="mt-2 text-xs">
                    <a
                      href={safeHref(assumption.evidence_url)!}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline"
                    >
                      Supporting evidence
                      <ExternalLink className="size-3" aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </p>
                ) : null}

                {children ? (
                  <div className="mt-3">{children(assumption)}</div>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

export function CostsPanel({
  costs,
  currency,
}: {
  costs: FinancialCostRow[];
  currency: CurrencyCode;
}) {
  if (costs.length === 0) return null;

  const oneTime = costs.filter((c) => c.kind === "ONE_TIME");
  const recurring = costs.filter((c) => c.kind === "RECURRING");

  return (
    <section aria-labelledby="costs-heading" className="flex flex-col gap-4">
      <h2
        id="costs-heading"
        className="font-display text-lg font-bold tracking-tight text-foreground"
      >
        Costs
      </h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CostGroup
          title="One-time (startup)"
          lines={oneTime}
          currency={currency}
        />
        <CostGroup title="Recurring" lines={recurring} currency={currency} />
      </div>
    </section>
  );
}

function CostGroup({
  title,
  lines,
  currency,
}: {
  title: string;
  lines: FinancialCostRow[];
  currency: CurrencyCode;
}) {
  return (
    <Card className="p-5">
      <h3 className="font-display text-sm font-bold tracking-tight text-foreground">
        {title}
      </h3>
      {lines.length === 0 ? (
        <p className="mt-2 text-sm text-muted-strong">None recorded.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line pb-2 text-sm last:border-0 last:pb-0"
            >
              <span className="min-w-0">
                <span className="text-foreground">{line.label}</span>
                <span className="ml-2 text-xs text-muted-strong">
                  {isCostCategory(line.category)
                    ? COST_CATEGORY_LABELS[line.category]
                    : line.category}
                  {line.kind === "RECURRING" && line.every_months > 1
                    ? ` · every ${line.every_months} months`
                    : ""}
                </span>
              </span>
              <span className="font-medium text-foreground">
                {m(line.amount_minor, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------------

/**
 * The month-by-month forecast.
 *
 * A real table on desktop and stacked cards below `lg` — the spec forbids
 * horizontal overflow, and eleven columns cannot be made to fit a phone by
 * scrolling.
 */
export function ForecastTable({
  content,
  currency,
}: {
  content: Record<string, unknown> | undefined;
  currency: CurrencyCode;
}) {
  const months = Array.isArray(content?.months)
    ? (content.months as Record<string, unknown>[])
    : [];

  if (months.length === 0) {
    return (
      <Card className="px-6 py-10 text-center">
        <p className="font-display text-base font-bold text-foreground">
          No forecast yet
        </p>
        <p className="mt-1 text-sm text-muted">
          Run the cash flow &amp; break-even stage. It is calculated from your
          assumptions and costs nothing.
        </p>
      </Card>
    );
  }

  const columns = [
    { key: "units", label: "Units", money: false },
    { key: "revenueMinor", label: "Revenue", money: true },
    { key: "cogsMinor", label: "COGS", money: true },
    { key: "grossProfitMinor", label: "Gross profit", money: true },
    { key: "operatingExpensesMinor", label: "Opex", money: true },
    { key: "operatingProfitMinor", label: "Op. profit", money: true },
    { key: "netCashFlowMinor", label: "Net cash", money: true },
    { key: "closingCashMinor", label: "Closing cash", money: true },
  ] as const;

  return (
    <section aria-labelledby="forecast-heading" className="flex flex-col gap-4">
      <div>
        <h2
          id="forecast-heading"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Forecast
        </h2>
        <p className="text-sm text-muted">
          {months.length} months, all figures in {currency}. Calculated from the
          assumptions — not a prediction of what will happen.
        </p>
      </div>

      {/* Desktop */}
      <Card className="hidden overflow-hidden p-0 lg:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Monthly financial forecast in {currency}, calculated from stored
            assumptions.
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th
                scope="col"
                className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-strong"
              >
                Month
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-strong"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((row, index) => {
              return (
                <tr key={index} className="border-b border-line last:border-0">
                  <th
                    scope="row"
                    className="px-3 py-2 text-left text-sm font-medium text-foreground"
                  >
                    {String(row.month ?? index + 1)}
                  </th>
                  {columns.map((column) => {
                    const raw = num(row[column.key]);
                    const negative = raw !== null && raw < 0;
                    return (
                      <td
                        key={column.key}
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          negative ? "text-danger-soft" : "text-muted",
                        )}
                      >
                        {column.money
                          ? m(raw, currency)
                          : (raw?.toLocaleString("en-US") ?? "—")}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Mobile and tablet */}
      <div className="flex flex-col gap-3 lg:hidden">
        {months.map((row, index) => (
          <Card key={index} className="p-4">
            <h3 className="font-display text-sm font-bold tracking-tight text-foreground">
              Month {String(row.month ?? index + 1)}
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {columns.map((column) => {
                const raw = num(row[column.key]);
                const negative = raw !== null && raw < 0;
                return (
                  <div key={column.key} className="flex justify-between gap-2">
                    <dt className="text-muted-strong">{column.label}</dt>
                    <dd
                      className={cn(
                        "tabular-nums",
                        negative ? "text-danger-soft" : "text-muted",
                      )}
                    >
                      {column.money
                        ? m(raw, currency)
                        : (raw?.toLocaleString("en-US") ?? "—")}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

/**
 * Conservative / base / optimistic.
 *
 * The adjustments are printed beside each scenario. The spec forbids
 * multiplying profit by a percentage, and showing exactly which assumptions
 * moved is how a reader can tell that this is a recalculation rather than a
 * rescaling.
 */
export function ScenariosPanel({
  content,
  currency,
}: {
  content: Record<string, unknown> | undefined;
  currency: CurrencyCode;
}) {
  const rows = Array.isArray(content?.scenarios)
    ? (content.scenarios as Record<string, unknown>[])
    : [];

  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="scenarios-heading"
      className="flex flex-col gap-4"
    >
      <div>
        <h2
          id="scenarios-heading"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Scenarios
        </h2>
        <p className="text-sm text-muted">
          Each scenario changes the underlying assumptions and recalculates the
          whole model. None of them scales the base result.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {rows.map((row, index) => {
          const key = String(row.scenario ?? "");
          const label = isScenario(key) ? SCENARIO_LABELS[key] : key;
          const adjustments = (row.adjustments ?? {}) as Record<string, number>;

          return (
            <Card
              key={index}
              className={cn(
                "p-5",
                key === "BASE" ? "border-brand-violet/40" : null,
              )}
            >
              <h3 className="font-display text-base font-bold tracking-tight text-foreground">
                {label}
              </h3>

              <dl className="mt-3 flex flex-col gap-1.5 text-sm">
                <Row
                  label="Revenue"
                  value={m(num(row.totalRevenueMinor), currency)}
                />
                <Row
                  label="Operating profit"
                  value={m(num(row.totalOperatingProfitMinor), currency)}
                  negative={(num(row.totalOperatingProfitMinor) ?? 0) < 0}
                />
                <Row
                  label="Gross margin"
                  value={formatBps(num(row.grossMarginBps))}
                />
                <Row
                  label="Break-even"
                  value={
                    num(row.breakEvenMonth) !== null
                      ? `Month ${num(row.breakEvenMonth)}`
                      : "Not reached"
                  }
                />
                <Row
                  label="Runway"
                  value={
                    num(row.runwayMonths) !== null
                      ? `${num(row.runwayMonths)} months`
                      : "Not burning"
                  }
                />
                <Row
                  label="Capital required"
                  value={m(num(row.capitalRequiredMinor), currency)}
                />
              </dl>

              {/* What "conservative" actually meant, in numbers. */}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-muted-strong">
                  Assumptions changed
                </summary>
                <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-muted">
                  {Object.entries(adjustments).map(([name, delta]) => (
                    <li key={name} className="flex justify-between gap-2">
                      <span>{name.replace(/DeltaBps$/, "")}</span>
                      <span className="tabular-nums">
                        {delta > 0 ? "+" : ""}
                        {formatBps(delta)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  negative,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-strong">{label}</dt>
      <dd
        className={cn(
          "font-medium tabular-nums",
          negative ? "text-danger-soft" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Break-even and unit economics
// ---------------------------------------------------------------------------

export function BreakEvenPanel({
  breakEven,
  unitEconomics,
  currency,
  revenueModel,
}: {
  breakEven: Record<string, unknown> | undefined;
  unitEconomics: Record<string, unknown> | undefined;
  currency: CurrencyCode;
  revenueModel: string;
}) {
  if (!breakEven && !unitEconomics) return null;

  const unreachable =
    typeof breakEven?.unreachableReason === "string"
      ? breakEven.unreachableReason
      : null;

  const notApplicable = Array.isArray(unitEconomics?.notApplicable)
    ? (unitEconomics.notApplicable as string[])
    : [];

  return (
    <section
      aria-labelledby="economics-heading"
      className="flex flex-col gap-4"
    >
      <h2
        id="economics-heading"
        className="font-display text-lg font-bold tracking-tight text-foreground"
      >
        Unit economics &amp; break-even
      </h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display text-sm font-bold tracking-tight text-foreground">
            Unit economics
          </h3>
          <p className="mt-1 text-xs text-muted-strong">
            {isRevenueModel(revenueModel)
              ? REVENUE_MODEL_FORMULA[revenueModel as RevenueModel]
              : revenueModel}
          </p>
          <dl className="mt-3 flex flex-col gap-1.5 text-sm">
            <Row
              label="ARPU"
              value={m(num(unitEconomics?.arpuMinor), currency)}
            />
            <Row
              label="CAC"
              value={m(num(unitEconomics?.cacMinor), currency)}
            />
            <Row
              label="LTV"
              value={m(num(unitEconomics?.ltvMinor), currency)}
            />
            <Row
              label="Gross margin"
              value={formatBps(num(unitEconomics?.grossMarginBps))}
            />
            <Row
              label="Contribution margin"
              value={formatBps(num(unitEconomics?.contributionMarginBps))}
            />
            <Row
              label="CAC payback"
              value={
                num(unitEconomics?.cacPaybackMonths) !== null
                  ? `${num(unitEconomics?.cacPaybackMonths)} months`
                  : "—"
              }
            />
            <Row
              label="LTV : CAC"
              value={
                num(unitEconomics?.ltvToCacBps) !== null
                  ? `${(num(unitEconomics?.ltvToCacBps)! / 10000).toFixed(1)}x`
                  : "—"
              }
            />
          </dl>

          {/* A metric deliberately not computed, and why. More useful than a
              blank cell, and far more useful than a meaningless number. */}
          {notApplicable.length > 0 ? (
            <div className="mt-4 flex gap-2 rounded-lg border border-line bg-fill-2 px-3 py-2">
              <Info
                className="mt-0.5 size-3.5 shrink-0 text-muted-strong"
                aria-hidden="true"
              />
              <ul className="flex flex-col gap-1 text-xs text-muted">
                {notApplicable.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-sm font-bold tracking-tight text-foreground">
            Break-even
          </h3>
          {unreachable ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger-soft">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>{unreachable}</span>
            </p>
          ) : (
            <dl className="mt-3 flex flex-col gap-1.5 text-sm">
              <Row
                label="Break-even revenue"
                value={m(num(breakEven?.revenueMinor), currency)}
              />
              <Row
                label="Break-even units"
                value={num(breakEven?.units)?.toLocaleString("en-US") ?? "—"}
              />
              <Row
                label="Break-even month"
                value={
                  num(breakEven?.month) !== null
                    ? `Month ${num(breakEven?.month)}`
                    : "Not within the horizon"
                }
              />
              <Row
                label="Fixed monthly costs"
                value={m(num(breakEven?.fixedMonthlyCostsMinor), currency)}
              />
              <Row
                label="Contribution margin"
                value={formatBps(num(breakEven?.contributionMarginBps))}
              />
            </dl>
          )}
          <p className="mt-3 text-xs text-muted-strong">
            Break-even revenue = fixed monthly costs ÷ contribution margin.
          </p>
        </Card>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Funding
// ---------------------------------------------------------------------------

const SUITABILITY_BADGE: Record<
  Suitability,
  "active" | "completed" | "neutral"
> = {
  STRONG: "active",
  POSSIBLE: "completed",
  UNLIKELY: "neutral",
};

/**
 * Funding options.
 *
 * Three rules visible on every card: the amount range is shown only where the
 * provider published one, the source link is shown so eligibility can be
 * checked at the source, and suitability is explicitly labelled as AIAutoMix's
 * judgement rather than a decision anybody has made.
 */
export function FundingPanel({
  options,
  sources,
  currency,
}: {
  options: FundingOptionRow[];
  sources: FinancialSourceRow[];
  currency: CurrencyCode;
}) {
  if (options.length === 0) {
    return (
      <Card className="px-6 py-10 text-center">
        <p className="font-display text-base font-bold text-foreground">
          No funding options recorded
        </p>
        <p className="mt-1 text-sm text-muted">
          The funding stage searches the web and keeps only programmes a real
          search result backs.
        </p>
      </Card>
    );
  }

  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return (
    <section aria-labelledby="funding-heading" className="flex flex-col gap-4">
      <div>
        <h2
          id="funding-heading"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Funding options
        </h2>
        <p className="text-sm text-muted">
          Suitability is AIAutoMix&apos;s judgement of fit, not a decision by
          any provider. Check eligibility at the source before applying.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {options.map((option) => {
          const type = isFundingType(option.funding_type)
            ? option.funding_type
            : null;
          const suitability = (option.suitability ?? "POSSIBLE") as Suitability;
          const source = option.source_id
            ? sourceById.get(option.source_id)
            : undefined;
          const href = safeHref(option.application_url ?? source?.url ?? null);

          const hasRange =
            option.amount_min_minor !== null ||
            option.amount_max_minor !== null;

          return (
            <li key={option.id}>
              <Card className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-bold tracking-tight text-foreground">
                      {option.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted">
                      {option.provider ? `${option.provider} · ` : ""}
                      {type ? FUNDING_TYPE_LABELS[type] : option.funding_type}
                      {option.geography ? ` · ${option.geography}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={SUITABILITY_BADGE[suitability]}
                    title="AIAutoMix's read of fit, based on your capital requirement and stage."
                  >
                    {SUITABILITY_LABELS[suitability]}
                  </Badge>
                </div>

                <p className="mt-3 text-sm text-muted">
                  <span className="font-semibold text-foreground">
                    Amount:{" "}
                  </span>
                  {hasRange
                    ? `${m(option.amount_min_minor, currency)} – ${m(option.amount_max_minor, currency)}`
                    : "Not publicly disclosed"}
                </p>

                {option.eligibility ? (
                  <p className="mt-2 text-sm text-muted">
                    <span className="font-semibold text-foreground">
                      Eligibility:{" "}
                    </span>
                    {option.eligibility}
                  </p>
                ) : null}

                {option.terms ? (
                  <p className="mt-2 text-sm text-muted">
                    <span className="font-semibold text-foreground">
                      Terms:{" "}
                    </span>
                    {option.terms}
                  </p>
                ) : null}

                {option.suitability_rationale ? (
                  <p className="mt-2 border-l-2 border-line pl-3 text-sm text-muted">
                    {option.suitability_rationale}
                  </p>
                ) : null}

                <p className="mt-3 text-xs text-muted-strong">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline"
                    >
                      {source?.publisher || source?.title || "Source"}
                      <ExternalLink className="size-3" aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : option.funding_type === "BOOTSTRAP" ? (
                    "No external source — this is your own capital."
                  ) : (
                    "No source recorded for this option."
                  )}
                  {source?.retrieved_at
                    ? ` · retrieved ${formatDate(source.retrieved_at)}`
                    : ""}
                </p>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Risks
// ---------------------------------------------------------------------------

export function RisksPanel({
  content,
}: {
  content: Record<string, unknown> | undefined;
}) {
  const risks = Array.isArray(content?.risks)
    ? (content.risks as Record<string, unknown>[])
    : [];

  if (risks.length === 0) return null;

  const severityBadge: Record<string, "archived" | "paused" | "neutral"> = {
    high: "archived",
    medium: "paused",
    low: "neutral",
  };

  return (
    <section aria-labelledby="risks-heading" className="flex flex-col gap-4">
      <h2
        id="risks-heading"
        className="font-display text-lg font-bold tracking-tight text-foreground"
      >
        Financial risks
      </h2>
      <ul className="flex flex-col gap-3">
        {risks.map((risk, index) => {
          const kind = String(risk.kind ?? "");
          const severity = String(risk.severity ?? "low");
          return (
            <li key={index}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={severityBadge[severity] ?? "neutral"}>
                    {severity} severity
                  </Badge>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
                    {RISK_LABELS[kind as keyof typeof RISK_LABELS] ?? kind}
                  </span>
                  {/* Traceability: which assumption drives this risk. */}
                  {typeof risk.assumptionKey === "string" &&
                  risk.assumptionKey ? (
                    <span className="font-mono text-xs text-muted-strong">
                      {risk.assumptionKey}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {String(risk.summary ?? "")}
                </p>
                {typeof risk.mitigation === "string" && risk.mitigation ? (
                  <p className="mt-1.5 text-sm text-muted">
                    <span className="font-semibold">Mitigation: </span>
                    {risk.mitigation}
                  </p>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
