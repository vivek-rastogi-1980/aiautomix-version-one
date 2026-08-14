import {
  BPS_SCALE,
  applyBps,
  money,
  multiply,
  roundHalfAwayFromZero,
  zero,
  type CurrencyCode,
  type Money,
} from "@/features/financials/money";
import {
  BUDGET_SCENARIOS,
  type BudgetScenario,
  type Channel,
  type ClaimKind,
  type FunnelStageKey,
} from "@/features/marketing/types";
import type { ChannelScore } from "@/features/marketing/scoring";
import { allocationBps } from "@/features/marketing/scoring";

/**
 * Acquisition economics — the deterministic half of Phase 9.
 *
 * ---------------------------------------------------------------------------
 * The one rule, again
 * ---------------------------------------------------------------------------
 * NO LANGUAGE MODEL PRODUCES A NUMBER IN THIS FILE. §16 is explicit: the
 * arithmetic of allowable CAC, funnel volumes and budget belongs to a
 * calculation engine. A model may propose a conversion rate — that is an
 * assumption about the world, and it is labelled as one — but multiplying it
 * out is not a judgement call and must not be delegated to something that
 * cannot be relied upon to multiply.
 *
 * It reuses `features/financials/money.ts` rather than reimplementing money:
 * integer minor units, basis points, half-away-from-zero, one rounding step.
 * §38 forbids duplicating financial calculations, so unit economics arrive here
 * already computed by Phase 8 and this file only does the marketing layer on
 * top.
 *
 * Pure: no I/O, no clock, no randomness, no `server-only`.
 *
 * ---------------------------------------------------------------------------
 * A note on the word "target"
 * ---------------------------------------------------------------------------
 * `targetNewCustomers` is a TARGET — a number the business chooses. Everything
 * derived from it is therefore "what it would take", not "what will happen".
 * The report says so, because a required-volume figure read as a forecast is
 * how marketing plans acquire a confidence they never earned.
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface FunnelStepInput {
  from: FunnelStageKey;
  to: FunnelStageKey;
  /** Conversion from `from` to `to`, in basis points. 500 = 5%. */
  rateBps: number;
  /** Where the rate came from. Almost always ASSUMPTION, and printed as one. */
  kind: ClaimKind;
  rationale?: string;
}

export interface AcquisitionInput {
  currency: CurrencyCode;
  /** A TARGET chosen by the business, over `horizonMonths`. */
  targetNewCustomers: number;
  horizonMonths: number;
  /** From Phase 8's model. Revenue per customer per month. */
  monthlyRevenuePerCustomer: Money;
  /** From Phase 8's model. */
  grossMarginBps: number;
  /**
   * From Phase 8's model. `null` when churn is zero and the lifetime is
   * therefore unbounded — in which case LTV is not computed rather than
   * invented, exactly as in the financial engine.
   */
  customerLifetimeMonths: number | null;
  /** Policy: months of gross profit the business will spend to acquire one. */
  paybackMonths: number;
  /** Policy: the LTV:CAC ratio to hold, in basis points. 30 000 = 3.0x. */
  targetLtvToCacBps: number;
  /** Ordered top to bottom. The last step's `to` is the paying customer. */
  funnel: FunnelStepInput[];
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface ComputedFunnelStep extends FunnelStepInput {
  /** How many must enter this step to hit the target at the bottom. */
  requiredFrom: number;
  requiredTo: number;
}

export interface AcquisitionModel {
  currency: CurrencyCode;
  targetNewCustomers: number;
  horizonMonths: number;

  /** Revenue per customer per month, times the gross margin. */
  grossProfitPerMonth: Money;
  /** Null when the lifetime is unbounded. */
  lifetimeValue: Money | null;

  /** Gross profit over the payback window. */
  paybackAllowableCac: Money;
  /** LTV divided by the target ratio. Null when LTV is null. */
  ltvAllowableCac: Money | null;
  /** The lower of the two — the ceiling that actually binds. */
  allowableCac: Money;
  bindingConstraint: "payback" | "ltv_ratio";

  funnel: ComputedFunnelStep[];
  /** Volume needed at the very top. Null when a rate is zero. */
  requiredTopOfFunnel: number | null;
  /** Whole basis points, so very long funnels round to 0 or 1. See `oneCustomerPer`. */
  overallConversionBps: number | null;
  /** "One customer per N at the top of the funnel." The legible form. */
  oneCustomerPer: number | null;

  /** Target customers times the allowable CAC. */
  budget: Money;
  /** Stated limits of this model, printed rather than hidden. */
  notes: string[];
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/** Round a positive quotient up. You cannot half-reach a prospect. */
function ceilDiv(numerator: number, denominator: number): number {
  return Math.ceil(numerator / denominator);
}

/**
 * Walk the funnel backwards from the customer target.
 *
 * Bottom-up, because the target is a count of customers and every stage above
 * it is derived. Each step rounds UP: needing 166.7 demos means needing 167.
 *
 * A zero rate makes the target unreachable, and the function says so by
 * returning `null` for the top rather than dividing by zero or quietly
 * dropping the step.
 */
export function backSolveFunnel(
  funnel: FunnelStepInput[],
  targetNewCustomers: number,
): { steps: ComputedFunnelStep[]; requiredTop: number | null } {
  const target = Math.max(0, Math.round(targetNewCustomers));

  if (funnel.length === 0) {
    return { steps: [], requiredTop: target };
  }

  const steps: ComputedFunnelStep[] = new Array(funnel.length);
  let downstream = target;
  let unreachable = false;

  for (let index = funnel.length - 1; index >= 0; index -= 1) {
    const step = funnel[index];
    const rate = Math.max(0, Math.min(BPS_SCALE, Math.round(step.rateBps)));

    if (rate <= 0) {
      unreachable = true;
      steps[index] = {
        ...step,
        rateBps: rate,
        requiredFrom: 0,
        requiredTo: downstream,
      };
      downstream = 0;
      continue;
    }

    const requiredFrom = ceilDiv(downstream * BPS_SCALE, rate);
    steps[index] = {
      ...step,
      rateBps: rate,
      requiredFrom,
      requiredTo: downstream,
    };
    downstream = requiredFrom;
  }

  return { steps, requiredTop: unreachable ? null : downstream };
}

/**
 * Build the acquisition model.
 *
 * Two independent ceilings on CAC are computed and the LOWER one wins:
 *
 *   PAYBACK    How much gross profit the customer produces inside the payback
 *              window. This is a cash constraint — spend more and you are
 *              funding growth from somewhere else.
 *   LTV RATIO  Lifetime value divided by the ratio the business wants to hold.
 *              This is a quality constraint.
 *
 * Reporting only one of them is how a plan ends up defensible on the metric it
 * happened to choose. Reporting both, and naming which binds, is not.
 */
export function buildAcquisitionModel(
  input: AcquisitionInput,
): AcquisitionModel {
  const currency = input.currency;
  const notes: string[] = [];

  const grossProfitPerMonth = applyBps(
    input.monthlyRevenuePerCustomer,
    input.grossMarginBps,
  );

  const lifetimeValue =
    input.customerLifetimeMonths !== null && input.customerLifetimeMonths > 0
      ? multiply(grossProfitPerMonth, Math.round(input.customerLifetimeMonths))
      : null;

  if (lifetimeValue === null) {
    notes.push(
      "Lifetime value is not calculated: the financial model reports no bounded customer lifetime, so any figure would be arbitrary.",
    );
  }

  const paybackMonths = Math.max(1, Math.round(input.paybackMonths));
  const paybackAllowableCac = multiply(grossProfitPerMonth, paybackMonths);

  const ltvAllowableCac =
    lifetimeValue !== null && input.targetLtvToCacBps > 0
      ? money(
          roundHalfAwayFromZero(
            lifetimeValue.minor * BPS_SCALE,
            input.targetLtvToCacBps,
          ),
          currency,
        )
      : null;

  const bindingConstraint: "payback" | "ltv_ratio" =
    ltvAllowableCac !== null &&
    ltvAllowableCac.minor < paybackAllowableCac.minor
      ? "ltv_ratio"
      : "payback";

  const allowableCac =
    bindingConstraint === "ltv_ratio" && ltvAllowableCac !== null
      ? ltvAllowableCac
      : paybackAllowableCac;

  const { steps, requiredTop } = backSolveFunnel(
    input.funnel,
    input.targetNewCustomers,
  );

  const target = Math.max(0, Math.round(input.targetNewCustomers));

  if (requiredTop === null) {
    notes.push(
      "One conversion step is zero, so no volume at the top of the funnel reaches the target. Fix that step before budgeting.",
    );
  }

  const overallConversionBps =
    requiredTop !== null && requiredTop > 0
      ? roundHalfAwayFromZero(target * BPS_SCALE, requiredTop)
      : null;

  const oneCustomerPer =
    requiredTop !== null && target > 0
      ? roundHalfAwayFromZero(requiredTop, target)
      : null;

  // At or below one basis point the percentage carries no information: 0.01%
  // and 0.006% render identically and both read as "roughly zero". The
  // "one customer per N" form says the same thing legibly.
  if (overallConversionBps !== null && overallConversionBps <= 1) {
    notes.push(
      "End-to-end conversion rounds to a basis point or less. Read the 'one customer per' figure instead — it is the same number without the rounding.",
    );
  }

  const budget = multiply(allowableCac, target);

  notes.push(
    "The customer count is a target chosen by the business, not a forecast. Every volume above it is what the target would require, not what will happen.",
  );

  return {
    currency,
    targetNewCustomers: target,
    horizonMonths: Math.max(1, Math.round(input.horizonMonths)),
    grossProfitPerMonth,
    lifetimeValue,
    paybackAllowableCac,
    ltvAllowableCac,
    allowableCac,
    bindingConstraint,
    funnel: steps,
    requiredTopOfFunnel: requiredTop,
    overallConversionBps,
    oneCustomerPer,
    budget,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

/**
 * How each budget scenario adjusts the ASSUMPTIONS.
 *
 * As in Phase 8, a scenario is not the base case multiplied by a mood. It
 * changes the two things a marketing plan is actually uncertain about — how
 * well the funnel converts, and how ambitious the target is — and the whole
 * model is then recalculated.
 *
 * Allowable CAC is deliberately NOT adjusted: it falls out of margin, payback
 * and lifetime, none of which a marketing scenario changes. A conservative
 * scenario that quietly lowered the CAC ceiling would be answering a financial
 * question with a marketing opinion.
 */
export const ACQUISITION_SCENARIO_ADJUSTMENTS: Record<
  BudgetScenario,
  { conversionDeltaBps: number; targetDeltaBps: number }
> = {
  CONSERVATIVE: { conversionDeltaBps: -3000, targetDeltaBps: -2500 },
  BASE: { conversionDeltaBps: 0, targetDeltaBps: 0 },
  AGGRESSIVE: { conversionDeltaBps: +1000, targetDeltaBps: +5000 },
};

/** Apply a relative basis-point delta, clamped into [0, 10 000]. */
function adjustRate(rateBps: number, deltaBps: number): number {
  const adjusted =
    rateBps + roundHalfAwayFromZero(rateBps * deltaBps, BPS_SCALE);
  return Math.max(0, Math.min(BPS_SCALE, adjusted));
}

export function applyAcquisitionScenario(
  input: AcquisitionInput,
  scenario: BudgetScenario,
): AcquisitionInput {
  const adjustment = ACQUISITION_SCENARIO_ADJUSTMENTS[scenario];

  return {
    ...input,
    targetNewCustomers: Math.max(
      0,
      input.targetNewCustomers +
        roundHalfAwayFromZero(
          input.targetNewCustomers * adjustment.targetDeltaBps,
          BPS_SCALE,
        ),
    ),
    funnel: input.funnel.map((step) => ({
      ...step,
      rateBps: adjustRate(step.rateBps, adjustment.conversionDeltaBps),
    })),
  };
}

export interface AcquisitionScenarioResult {
  scenario: BudgetScenario;
  adjustments: (typeof ACQUISITION_SCENARIO_ADJUSTMENTS)[BudgetScenario];
  model: AcquisitionModel;
}

/** All three scenarios, each fully recalculated from adjusted assumptions. */
export function buildAcquisitionScenarios(
  input: AcquisitionInput,
  scenarios: readonly BudgetScenario[] = BUDGET_SCENARIOS,
): AcquisitionScenarioResult[] {
  return scenarios.map((scenario) => ({
    scenario,
    adjustments: ACQUISITION_SCENARIO_ADJUSTMENTS[scenario],
    model: buildAcquisitionModel(applyAcquisitionScenario(input, scenario)),
  }));
}

// ---------------------------------------------------------------------------
// Channel allocation
// ---------------------------------------------------------------------------

export interface ChannelBudgetLine {
  channel: Channel;
  shareBps: number;
  amount: Money;
}

/**
 * Split a budget across channels by their rubric scores.
 *
 * The remainder from integer division goes to the top-ranked channel, so the
 * lines sum to the total EXACTLY. A budget whose parts do not add up to the
 * whole is the first thing a finance reviewer notices and the last thing they
 * forgive.
 */
export function splitBudgetByChannel(
  total: Money,
  scores: ChannelScore[],
): ChannelBudgetLine[] {
  const shares = allocationBps(scores);
  if (shares.length === 0) return [];

  const lines: ChannelBudgetLine[] = shares.map((share) => ({
    channel: share.channel,
    shareBps: share.shareBps,
    amount: applyBps(total, share.shareBps),
  }));

  const assigned = lines.reduce((sum, line) => sum + line.amount.minor, 0);
  const remainder = total.minor - assigned;
  if (remainder !== 0 && lines.length > 0) {
    lines[0] = {
      ...lines[0],
      amount: money(lines[0].amount.minor + remainder, total.currency),
    };
  }

  return lines;
}

/**
 * How many customers a given spend could buy at the allowable ceiling.
 *
 * The inverse question to the one above, and the one a founder with a fixed
 * budget actually asks. Returns zero rather than infinity when the ceiling is
 * zero, because "unlimited customers" is never the right answer.
 */
export function customersForBudget(budget: Money, allowableCac: Money): number {
  if (allowableCac.minor <= 0) return 0;
  return Math.floor(budget.minor / allowableCac.minor);
}

/** A convenience for the UI: is this plan inside its own CAC ceiling? */
export function withinCeiling(plannedCac: Money, allowableCac: Money): boolean {
  return plannedCac.minor <= allowableCac.minor;
}

/** Zero-budget helper, so callers never construct a bare `{minor:0}`. */
export function noBudget(currency: CurrencyCode): Money {
  return zero(currency);
}
