import {
  add,
  applyBps,
  compoundCount,
  divide,
  money,
  multiply,
  negate,
  ratioBps,
  roundHalfAwayFromZero,
  subtract,
  sum,
  zero,
  type CurrencyCode,
  type Money,
} from "@/features/financials/money";
import {
  DEFAULT_HORIZON_MONTHS,
  MAX_HORIZON_MONTHS,
  isCogs,
  metricApplies,
  type CostCategory,
  type CostKind,
  type RevenueModel,
  type Scenario,
} from "@/features/financials/types";

/**
 * The deterministic financial calculation engine.
 *
 * ---------------------------------------------------------------------------
 * The one rule
 * ---------------------------------------------------------------------------
 * NO LANGUAGE MODEL PRODUCES ANY NUMBER IN THIS FILE. A model may propose the
 * assumptions that go in; every figure that comes out is computed here, by
 * integer arithmetic, from those inputs. Run it twice with the same inputs and
 * you get the same bytes out — which is what makes a forecast something a
 * founder can check rather than something they have to trust.
 *
 * That property is why this module is:
 *
 *   PURE       No I/O, no clock, no randomness, no `server-only`. It runs in a
 *              server action, in a test, and in the browser if it ever needs to.
 *   INTEGER    Money is minor units, rates are basis points. See `money.ts`.
 *   TOTAL      Every undefined result is `null`, never `NaN` or `Infinity`.
 *              A margin with no revenue behind it is undefined, not zero.
 *
 * The test suite pins it with fixed vectors computed by hand — 100 customers at
 * ₹2,000 is ₹200,000, written as a literal, not as a re-implementation of the
 * same formula.
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** One cost line. `amount` is per-occurrence, not annualised. */
export interface CostLine {
  category: CostCategory;
  kind: CostKind;
  label: string;
  amount: Money;
  /**
   * For RECURRING lines only: how many months between occurrences. 1 is
   * monthly, 12 is annual. Ignored for ONE_TIME.
   */
  everyMonths?: number;
}

/**
 * The drivers a revenue model needs.
 *
 * One shape covers all five families because they differ in *interpretation*,
 * not in arity: every one is "a count of things per month, times a price". The
 * labels differ (subscribers vs orders vs transactions) and marketplace applies
 * a take rate on top; the arithmetic shape is shared, which is why the engine
 * can be exhaustive over the union without five parallel code paths.
 */
export interface RevenueDrivers {
  model: RevenueModel;
  /** Units in month 1 — subscribers, clients, orders, transactions. */
  startingUnits: number;
  /** Compounding month-on-month growth in units, in basis points. */
  unitGrowthBps: number;
  /** Price per unit per month (or per order/transaction). */
  pricePerUnit: Money;
  /**
   * Monthly churn in basis points. Applied to the retained base BEFORE growth,
   * so growth is genuinely net new rather than gross additions.
   * Only meaningful for recurring models; ignored otherwise.
   */
  monthlyChurnBps: number;
  /** Marketplace only: the platform's cut of transaction value. */
  takeRateBps?: number;
  /** Cost of acquiring one unit. Drives CAC and the marketing spend line. */
  cacPerUnit?: Money;
  /** Variable cost per unit of revenue delivered, as a share of revenue. */
  cogsBps?: number;
}

export interface FinancialModelInput {
  currency: CurrencyCode;
  /** Months to project. Defaults to 12; hard-capped so the loop is bounded. */
  horizonMonths?: number;
  /** Cash on hand at month 0, before any one-time spend. */
  openingCash: Money;
  costs: CostLine[];
  revenue: RevenueDrivers;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface MonthRow {
  /** 1-based. */
  month: number;
  units: number;
  newUnits: number;
  churnedUnits: number;
  revenue: Money;
  cogs: Money;
  grossProfit: Money;
  /** Recurring costs that are not COGS, plus acquisition spend. */
  operatingExpenses: Money;
  operatingProfit: Money;
  /** One-time costs fall entirely in month 1. */
  oneTimeCosts: Money;
  netCashFlow: Money;
  openingCash: Money;
  closingCash: Money;
  /** Gross profit / revenue, in basis points. Null before any revenue. */
  grossMarginBps: number | null;
}

export interface UnitEconomics {
  /** Average revenue per unit per month. */
  arpu: Money | null;
  cac: Money | null;
  /**
   * Lifetime value. Only computed for models with churn — see
   * `metricApplies`. Null where the concept does not apply.
   */
  ltv: Money | null;
  grossMarginBps: number | null;
  contributionMarginBps: number | null;
  /** Months of contribution needed to repay CAC. Null when never. */
  cacPaybackMonths: number | null;
  /** LTV:CAC as a ratio in basis points (30000 = 3.0x). */
  ltvToCacBps: number | null;
  monthlyChurnBps: number;
  /** Metrics deliberately not computed for this model, and why. */
  notApplicable: string[];
}

export interface BreakEven {
  /** Monthly revenue at which operating profit reaches zero. */
  revenue: Money | null;
  /** Units needed at the current price to reach that revenue. */
  units: number | null;
  /** First month whose operating profit is >= 0, from the forecast. */
  month: number | null;
  /** Fixed monthly costs used in the calculation. */
  fixedMonthlyCosts: Money;
  contributionMarginBps: number | null;
  /** Set when contribution margin is <= 0, so break-even is unreachable. */
  unreachableReason: string | null;
}

export interface CashFlowSummary {
  openingCash: Money;
  closingCash: Money;
  lowestCash: Money;
  lowestCashMonth: number;
  /** Average monthly net outflow across months that were cash-negative. */
  averageMonthlyBurn: Money;
  /** Months until cash runs out at the observed burn. Null if never. */
  runwayMonths: number | null;
  /** First month with negative closing cash. Null if it never happens. */
  firstNegativeMonth: number | null;
  /**
   * The most cash the business is ever "down" from its starting position.
   * This is the capital the founder actually has to find.
   */
  peakFundingRequirement: Money;
}

export interface FinancialModel {
  currency: CurrencyCode;
  horizonMonths: number;
  months: MonthRow[];
  unitEconomics: UnitEconomics;
  breakEven: BreakEven;
  cashFlow: CashFlowSummary;
  totals: {
    revenue: Money;
    cogs: Money;
    grossProfit: Money;
    operatingExpenses: Money;
    operatingProfit: Money;
    oneTimeCosts: Money;
  };
}

// ---------------------------------------------------------------------------
// Cost helpers
// ---------------------------------------------------------------------------

/**
 * The monthly amount a recurring line contributes.
 *
 * An annual line (`everyMonths: 12`) is spread evenly rather than charged in
 * one month. That is a modelling choice and a defensible one for a planning
 * forecast — but it means the cash-flow view smooths a lumpy real-world
 * payment, which the report states rather than hides.
 */
export function monthlyAmount(line: CostLine): Money {
  if (line.kind === "ONE_TIME") return zero(line.amount.currency);
  const every = line.everyMonths && line.everyMonths > 0 ? line.everyMonths : 1;
  return every === 1 ? line.amount : divide(line.amount, every);
}

/** Recurring costs that scale with revenue. */
export function monthlyCogsCosts(
  costs: CostLine[],
  currency: CurrencyCode,
): Money {
  return sum(
    costs
      .filter((l) => l.kind === "RECURRING" && isCogs(l.category))
      .map(monthlyAmount),
    currency,
  );
}

/** Recurring costs that do not scale with revenue — the fixed base. */
export function monthlyFixedCosts(
  costs: CostLine[],
  currency: CurrencyCode,
): Money {
  return sum(
    costs
      .filter((l) => l.kind === "RECURRING" && !isCogs(l.category))
      .map(monthlyAmount),
    currency,
  );
}

export function totalOneTimeCosts(
  costs: CostLine[],
  currency: CurrencyCode,
): Money {
  return sum(
    costs.filter((l) => l.kind === "ONE_TIME").map((l) => l.amount),
    currency,
  );
}

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

/**
 * Revenue for a month, by model family.
 *
 * Exhaustive over `RevenueModel`: adding a family without handling it here is a
 * compile error, not a silent zero.
 */
export function revenueFor(
  drivers: RevenueDrivers,
  units: number,
  currency: CurrencyCode,
): Money {
  const gross = multiply(drivers.pricePerUnit, units);

  switch (drivers.model) {
    case "MARKETPLACE": {
      // The platform earns the take rate on gross merchandise value, not GMV.
      const takeRate = drivers.takeRateBps ?? 0;
      return applyBps(gross, takeRate);
    }
    case "SUBSCRIPTION":
    case "SERVICES":
    case "ECOMMERCE":
    case "ONE_TIME_SALES":
      return gross;
  }

  // Unreachable while the switch is exhaustive; kept so a future family cannot
  // fall through to an implicit undefined.
  return zero(currency);
}

/**
 * The unit base for each month.
 *
 * Churn is applied to the retained base BEFORE growth is added, so
 * `unitGrowthBps` describes genuine net additions rather than gross signups
 * that churn immediately cancels. For non-recurring models churn is ignored,
 * because "orders churning" is not a thing.
 */
export function projectUnits(
  drivers: RevenueDrivers,
  horizonMonths: number,
): { units: number; newUnits: number; churnedUnits: number }[] {
  const recurring =
    drivers.model === "SUBSCRIPTION" || drivers.model === "SERVICES";

  const rows: { units: number; newUnits: number; churnedUnits: number }[] = [];
  let previous = 0;

  for (let month = 1; month <= horizonMonths; month += 1) {
    if (month === 1) {
      const units = Math.max(0, Math.round(drivers.startingUnits));
      rows.push({ units, newUnits: units, churnedUnits: 0 });
      previous = units;
      continue;
    }

    const churned = recurring
      ? roundHalfAwayFromZero(previous * drivers.monthlyChurnBps, 10_000)
      : 0;
    const retained = Math.max(0, previous - churned);

    // Growth applies to the retained base for recurring models, and to the
    // previous period's volume for transactional ones.
    const base = recurring ? retained : previous;
    const grown = compoundCount(base, drivers.unitGrowthBps, 1);
    const units = Math.max(0, grown);
    const newUnits = Math.max(0, units - retained);

    rows.push({ units, newUnits, churnedUnits: churned });
    previous = units;
  }

  return rows;
}

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

/**
 * Build the whole model: forecast, unit economics, break-even and cash flow.
 *
 * Deterministic and total. Every division guards its denominator, and every
 * undefined result is `null`.
 */
export function buildFinancialModel(
  input: FinancialModelInput,
): FinancialModel {
  const currency = input.currency;
  const horizonMonths = Math.min(
    Math.max(1, Math.round(input.horizonMonths ?? DEFAULT_HORIZON_MONTHS)),
    MAX_HORIZON_MONTHS,
  );

  const fixedMonthly = monthlyFixedCosts(input.costs, currency);
  const cogsMonthlyFixed = monthlyCogsCosts(input.costs, currency);
  const oneTime = totalOneTimeCosts(input.costs, currency);

  const unitRows = projectUnits(input.revenue, horizonMonths);
  const cogsBps = input.revenue.cogsBps ?? 0;
  const cac = input.revenue.cacPerUnit ?? zero(currency);

  const months: MonthRow[] = [];
  let cash = input.openingCash;

  for (let index = 0; index < unitRows.length; index += 1) {
    const month = index + 1;
    const { units, newUnits, churnedUnits } = unitRows[index];

    const revenue = revenueFor(input.revenue, units, currency);

    // COGS is the variable share of revenue plus any fixed COGS-category lines.
    const cogs = add(applyBps(revenue, cogsBps), cogsMonthlyFixed);
    const grossProfit = subtract(revenue, cogs);

    // Acquisition spend is a real operating cost and belongs in the forecast,
    // not only in the CAC metric.
    const acquisitionSpend = multiply(cac, newUnits);
    const operatingExpenses = add(fixedMonthly, acquisitionSpend);
    const operatingProfit = subtract(grossProfit, operatingExpenses);

    // One-time costs land entirely in month 1.
    const oneTimeThisMonth = month === 1 ? oneTime : zero(currency);
    const netCashFlow = subtract(operatingProfit, oneTimeThisMonth);

    const openingCash = cash;
    const closingCash = add(openingCash, netCashFlow);
    cash = closingCash;

    months.push({
      month,
      units,
      newUnits,
      churnedUnits,
      revenue,
      cogs,
      grossProfit,
      operatingExpenses,
      operatingProfit,
      oneTimeCosts: oneTimeThisMonth,
      netCashFlow,
      openingCash,
      closingCash,
      grossMarginBps: ratioBps(grossProfit, revenue),
    });
  }

  const totals = {
    revenue: sum(
      months.map((m) => m.revenue),
      currency,
    ),
    cogs: sum(
      months.map((m) => m.cogs),
      currency,
    ),
    grossProfit: sum(
      months.map((m) => m.grossProfit),
      currency,
    ),
    operatingExpenses: sum(
      months.map((m) => m.operatingExpenses),
      currency,
    ),
    operatingProfit: sum(
      months.map((m) => m.operatingProfit),
      currency,
    ),
    oneTimeCosts: oneTime,
  };

  const unitEconomics = computeUnitEconomics(input, months, {
    fixedMonthly,
    cogsBps,
    cac,
  });

  const breakEven = computeBreakEven(input, months, {
    fixedMonthly,
    contributionMarginBps: unitEconomics.contributionMarginBps,
  });

  const cashFlow = computeCashFlow(months, input.openingCash, currency);

  return {
    currency,
    horizonMonths,
    months,
    unitEconomics,
    breakEven,
    cashFlow,
    totals,
  };
}

// ---------------------------------------------------------------------------
// Unit economics
// ---------------------------------------------------------------------------

function computeUnitEconomics(
  input: FinancialModelInput,
  months: MonthRow[],
  ctx: { fixedMonthly: Money; cogsBps: number; cac: Money },
): UnitEconomics {
  const currency = input.currency;
  const model = input.revenue.model;
  const notApplicable: string[] = [];

  // ARPU from the first month with any units, so a zero-unit launch month does
  // not make ARPU undefined for a business that clearly has a price.
  const firstActive = months.find((m) => m.units > 0);
  const arpu =
    firstActive && firstActive.units > 0
      ? divide(firstActive.revenue, firstActive.units)
      : null;

  const grossMarginBps =
    firstActive !== undefined
      ? ratioBps(firstActive.grossProfit, firstActive.revenue)
      : null;

  // Contribution margin: gross margin less the per-unit acquisition cost,
  // expressed against revenue per unit.
  const contributionMarginBps =
    arpu !== null && arpu.minor > 0
      ? ratioBps(subtract(applyBps(arpu, grossMarginBps ?? 0), ctx.cac), arpu)
      : null;

  const cac = ctx.cac.minor > 0 ? ctx.cac : null;

  // --- LTV -----------------------------------------------------------------
  // Only for models where a customer has a lifetime. `metricApplies` is the
  // single place that decides, so the report and the engine agree.
  let ltv: Money | null = null;
  const churn = input.revenue.monthlyChurnBps;
  if (!metricApplies(model, "ltv")) {
    notApplicable.push(
      "LTV is not calculated: this business model has no recurring customer lifetime.",
    );
  } else if (churn <= 0) {
    notApplicable.push(
      "LTV is not calculated: with zero churn the customer lifetime is unbounded, so any figure would be arbitrary.",
    );
  } else if (arpu !== null) {
    // LTV = ARPU x gross margin / churn. Lifetime in months is 1/churn, so the
    // division is by the churn rate expressed in basis points.
    const grossPerMonth = applyBps(arpu, grossMarginBps ?? 0);
    ltv = money(
      roundHalfAwayFromZero(grossPerMonth.minor * 10_000, churn),
      currency,
    );
  }

  // --- CAC payback ---------------------------------------------------------
  let cacPaybackMonths: number | null = null;
  if (cac !== null && arpu !== null) {
    const monthlyContribution = subtract(
      applyBps(arpu, grossMarginBps ?? 0),
      zero(currency),
    );
    if (monthlyContribution.minor > 0) {
      cacPaybackMonths = Math.ceil(cac.minor / monthlyContribution.minor);
    }
  }

  const ltvToCacBps =
    ltv !== null && cac !== null && cac.minor > 0
      ? roundHalfAwayFromZero(ltv.minor * 10_000, cac.minor)
      : null;

  if (!metricApplies(model, "churn")) {
    notApplicable.push(
      "Churn is not modelled: this business model has no recurring subscription base.",
    );
  }

  return {
    arpu,
    cac,
    ltv,
    grossMarginBps,
    contributionMarginBps,
    cacPaybackMonths,
    ltvToCacBps,
    monthlyChurnBps: churn,
    notApplicable,
  };
}

// ---------------------------------------------------------------------------
// Break-even
// ---------------------------------------------------------------------------

function computeBreakEven(
  input: FinancialModelInput,
  months: MonthRow[],
  ctx: { fixedMonthly: Money; contributionMarginBps: number | null },
): BreakEven {
  const currency = input.currency;
  const cm = ctx.contributionMarginBps;

  // The first month the forecast actually turns a profit. Read from the
  // computed rows rather than solved for, so it can never disagree with the
  // table a user is looking at.
  const month = months.find((m) => m.operatingProfit.minor >= 0)?.month ?? null;

  if (cm === null || cm <= 0) {
    return {
      revenue: null,
      units: null,
      month,
      fixedMonthlyCosts: ctx.fixedMonthly,
      contributionMarginBps: cm,
      unreachableReason:
        cm === null
          ? "Break-even cannot be calculated without a revenue assumption."
          : "Each additional sale loses money at these assumptions, so no volume reaches break-even. Raise price, cut variable cost, or cut acquisition cost.",
    };
  }

  // Break-even revenue = fixed costs / contribution margin.
  const revenue = money(
    roundHalfAwayFromZero(ctx.fixedMonthly.minor * 10_000, cm),
    currency,
  );

  // Units at the current price. For a marketplace the "price" is the take, so
  // the same division holds once revenue-per-unit is used rather than GMV.
  const revenuePerUnit = revenueFor(input.revenue, 1, currency);
  const units =
    revenuePerUnit.minor > 0
      ? Math.ceil(revenue.minor / revenuePerUnit.minor)
      : null;

  return {
    revenue,
    units,
    month,
    fixedMonthlyCosts: ctx.fixedMonthly,
    contributionMarginBps: cm,
    unreachableReason: null,
  };
}

// ---------------------------------------------------------------------------
// Cash flow
// ---------------------------------------------------------------------------

function computeCashFlow(
  months: MonthRow[],
  openingCash: Money,
  currency: CurrencyCode,
): CashFlowSummary {
  if (months.length === 0) {
    return {
      openingCash,
      closingCash: openingCash,
      lowestCash: openingCash,
      lowestCashMonth: 0,
      averageMonthlyBurn: zero(currency),
      runwayMonths: null,
      firstNegativeMonth: null,
      peakFundingRequirement: zero(currency),
    };
  }

  let lowest = months[0].closingCash;
  let lowestMonth = months[0].month;
  for (const row of months) {
    if (row.closingCash.minor < lowest.minor) {
      lowest = row.closingCash;
      lowestMonth = row.month;
    }
  }

  const burnMonths = months.filter((m) => m.netCashFlow.minor < 0);
  const totalBurn = sum(
    burnMonths.map((m) => negate(m.netCashFlow)),
    currency,
  );
  const averageMonthlyBurn =
    burnMonths.length > 0
      ? divide(totalBurn, burnMonths.length)
      : zero(currency);

  const firstNegativeMonth =
    months.find((m) => m.closingCash.minor < 0)?.month ?? null;

  // Runway from the observed average burn. Null when the business is not
  // burning — "infinite runway" is a claim, "not burning" is a fact.
  const runwayMonths =
    averageMonthlyBurn.minor > 0
      ? Math.max(0, Math.floor(openingCash.minor / averageMonthlyBurn.minor))
      : null;

  // The deepest the balance ever goes below where it started. That is the
  // capital actually required, and it is usually larger than the closing loss.
  const deficit = subtract(openingCash, lowest);
  const peakFundingRequirement = deficit.minor > 0 ? deficit : zero(currency);

  return {
    openingCash,
    closingCash: months[months.length - 1].closingCash,
    lowestCash: lowest,
    lowestCashMonth: lowestMonth,
    averageMonthlyBurn,
    runwayMonths,
    firstNegativeMonth,
    peakFundingRequirement,
  };
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

/**
 * How each scenario adjusts the BASE assumptions.
 *
 * The spec forbids multiplying the final profit by a percentage, and this is
 * why: each scenario changes *assumptions* — growth, churn, price, COGS,
 * acquisition cost — and the whole model is then recalculated from scratch. A
 * conservative case with the same unit economics as the base case would be
 * theatre.
 *
 * The deltas are basis-point adjustments, fixed and visible, so a reader can
 * see exactly what "conservative" meant.
 */
export const SCENARIO_ADJUSTMENTS: Record<
  Scenario,
  {
    unitGrowthDeltaBps: number;
    churnDeltaBps: number;
    priceDeltaBps: number;
    cogsDeltaBps: number;
    cacDeltaBps: number;
    startingUnitsDeltaBps: number;
  }
> = {
  CONSERVATIVE: {
    unitGrowthDeltaBps: -500,
    churnDeltaBps: +200,
    priceDeltaBps: -1000,
    cogsDeltaBps: +500,
    cacDeltaBps: +2500,
    startingUnitsDeltaBps: -3000,
  },
  BASE: {
    unitGrowthDeltaBps: 0,
    churnDeltaBps: 0,
    priceDeltaBps: 0,
    cogsDeltaBps: 0,
    cacDeltaBps: 0,
    startingUnitsDeltaBps: 0,
  },
  OPTIMISTIC: {
    unitGrowthDeltaBps: +500,
    churnDeltaBps: -100,
    priceDeltaBps: +500,
    cogsDeltaBps: -300,
    cacDeltaBps: -1500,
    startingUnitsDeltaBps: +2500,
  },
};

/** Apply a scenario's adjustments to the base input. Pure. */
export function applyScenario(
  input: FinancialModelInput,
  scenario: Scenario,
): FinancialModelInput {
  const adj = SCENARIO_ADJUSTMENTS[scenario];
  const revenue = input.revenue;

  const scalePrice = (amount: Money): Money =>
    add(amount, applyBps(amount, adj.priceDeltaBps));
  const scaleCac = (amount: Money): Money =>
    add(amount, applyBps(amount, adj.cacDeltaBps));

  return {
    ...input,
    revenue: {
      ...revenue,
      // Rates float but never go negative: a negative churn rate would be a
      // model that spontaneously gains customers it never acquired.
      startingUnits: Math.max(
        0,
        compoundCount(revenue.startingUnits, adj.startingUnitsDeltaBps, 1),
      ),
      unitGrowthBps: Math.max(
        0,
        revenue.unitGrowthBps + adj.unitGrowthDeltaBps,
      ),
      monthlyChurnBps: Math.max(0, revenue.monthlyChurnBps + adj.churnDeltaBps),
      pricePerUnit: scalePrice(revenue.pricePerUnit),
      cogsBps: Math.max(0, (revenue.cogsBps ?? 0) + adj.cogsDeltaBps),
      ...(revenue.cacPerUnit
        ? { cacPerUnit: scaleCac(revenue.cacPerUnit) }
        : {}),
    },
  };
}

export interface ScenarioResult {
  scenario: Scenario;
  /** The adjustments applied, so the report can show what changed. */
  adjustments: (typeof SCENARIO_ADJUSTMENTS)[Scenario];
  model: FinancialModel;
}

/**
 * All three scenarios, each fully recalculated.
 *
 * Not "base times 0.8" — every scenario runs the same engine over adjusted
 * assumptions, so its margins, break-even and runway are internally consistent
 * with its own inputs.
 */
export function buildScenarios(
  input: FinancialModelInput,
  scenarios: readonly Scenario[] = ["CONSERVATIVE", "BASE", "OPTIMISTIC"],
): ScenarioResult[] {
  return scenarios.map((scenario) => ({
    scenario,
    adjustments: SCENARIO_ADJUSTMENTS[scenario],
    model: buildFinancialModel(applyScenario(input, scenario)),
  }));
}

// ---------------------------------------------------------------------------
// Capital requirement
// ---------------------------------------------------------------------------

/**
 * What the founder actually has to raise or contribute.
 *
 * One-time costs plus the deepest operating deficit, less whatever cash they
 * already have. Computed from the model rather than asked of anyone.
 */
export function capitalRequirement(model: FinancialModel): Money {
  const currency = model.currency;
  const deficit = model.cashFlow.peakFundingRequirement;
  const available = model.cashFlow.openingCash;

  // The peak requirement already includes one-time costs, because they hit the
  // cash balance in month 1 and therefore push the trough down.
  const shortfall = subtract(deficit, available);
  return shortfall.minor > 0 ? shortfall : zero(currency);
}
