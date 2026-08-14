/**
 * Money and rate primitives for the financial engine.
 *
 * ---------------------------------------------------------------------------
 * Why not `number` with decimals
 * ---------------------------------------------------------------------------
 * `0.1 + 0.2 !== 0.3` in IEEE-754, and a forecast is thousands of additions.
 * The errors do not stay small: they accumulate across twelve months, three
 * scenarios and a break-even search, and they land in a figure somebody uses to
 * decide whether to start a business.
 *
 * So money is an INTEGER COUNT OF MINOR UNITS — paise, cents, pence — and never
 * anything else. `₹2,000.50` is `200050`. Every operation below is integer
 * arithmetic with one explicit rounding step at the end, so the same inputs
 * always produce the same outputs on every machine.
 *
 * `number` is safe here: `Number.MAX_SAFE_INTEGER` is 9.007e15, which in paise
 * is ₹90 trillion. A model that exceeds that has other problems. The database
 * stores these as `bigint`, and `assertSafeMinor` refuses anything that would
 * lose precision on the way back.
 *
 * Rates are BASIS POINTS — integers where 1 bp = 0.01%. A 12.5% growth rate is
 * `1250`. Same reason: a rate stored as `0.125` compounds its own error.
 */

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

/**
 * Currencies the engine knows how to format and scale.
 *
 * `minorUnits` is the exponent: 2 means 100 minor units per major unit. It is
 * declared per currency rather than assumed, because JPY has 0 and getting that
 * wrong would be a 100× error in a financial model.
 */
export const CURRENCIES = {
  INR: { code: "INR", symbol: "₹", minorUnits: 2, label: "Indian rupee" },
  USD: { code: "USD", symbol: "$", minorUnits: 2, label: "US dollar" },
  GBP: { code: "GBP", symbol: "£", minorUnits: 2, label: "Pound sterling" },
  EUR: { code: "EUR", symbol: "€", minorUnits: 2, label: "Euro" },
  AED: { code: "AED", symbol: "د.إ", minorUnits: 2, label: "UAE dirham" },
  SGD: { code: "SGD", symbol: "S$", minorUnits: 2, label: "Singapore dollar" },
  AUD: { code: "AUD", symbol: "A$", minorUnits: 2, label: "Australian dollar" },
  CAD: { code: "CAD", symbol: "C$", minorUnits: 2, label: "Canadian dollar" },
  JPY: { code: "JPY", symbol: "¥", minorUnits: 0, label: "Japanese yen" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && value in CURRENCIES;
}

/**
 * A money amount. The currency travels WITH the number, always.
 *
 * There is no bare-number money type in this feature on purpose: a figure whose
 * currency is implicit is a figure that will eventually be added to one in a
 * different currency, and the result will look plausible.
 */
export interface Money {
  /** Integer count of minor units. Never fractional. */
  minor: number;
  currency: CurrencyCode;
}

export function money(minor: number, currency: CurrencyCode): Money {
  return { minor: assertSafeMinor(Math.round(minor)), currency };
}

export function zero(currency: CurrencyCode): Money {
  return { minor: 0, currency };
}

/**
 * Refuse a value that cannot survive a round trip through `number`.
 *
 * Beyond `MAX_SAFE_INTEGER`, integers stop being exactly representable and
 * `x + 1 === x` becomes possible. Throwing is correct: a silently wrong balance
 * is worse than a failed calculation.
 */
export function assertSafeMinor(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("Money must be a finite number of minor units.");
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(
      `Money out of safe integer range: ${value}. Values beyond 2^53-1 minor units cannot be represented exactly.`,
    );
  }
  return value;
}

/** Adding two currencies is always a bug. Fail rather than produce a number. */
function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new TypeError(
      `Cannot combine ${a.currency} with ${b.currency}. Currency conversion is not performed by this engine.`,
    );
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor + b.minor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor - b.minor, a.currency);
}

export function sum(amounts: Money[], currency: CurrencyCode): Money {
  return amounts.reduce((total, amount) => add(total, amount), zero(currency));
}

export function negate(amount: Money): Money {
  return money(-amount.minor, amount.currency);
}

/** Multiply by a whole count — customers, months, units. */
export function multiply(amount: Money, factor: number): Money {
  if (!Number.isFinite(factor)) {
    throw new RangeError("Cannot multiply money by a non-finite factor.");
  }
  return money(amount.minor * factor, amount.currency);
}

export function isZero(amount: Money): boolean {
  return amount.minor === 0;
}

export function isNegative(amount: Money): boolean {
  return amount.minor < 0;
}

export function compare(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.minor - b.minor;
}

// ---------------------------------------------------------------------------
// Basis points
// ---------------------------------------------------------------------------

/** 1 basis point = 0.01%. 100% = 10 000 bp. */
export const BPS_SCALE = 10_000;

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/**
 * Apply a rate to a money amount.
 *
 * Rounds half away from zero, deterministically, in one step at the end. This
 * is the ONLY place rounding happens in a rate application, which is what makes
 * the whole engine reproducible.
 */
export function applyBps(amount: Money, bps: number): Money {
  if (!Number.isInteger(bps)) {
    throw new TypeError("Basis points must be an integer.");
  }
  const product = amount.minor * bps;
  return money(roundHalfAwayFromZero(product, BPS_SCALE), amount.currency);
}

/**
 * Integer division with half-away-from-zero rounding.
 *
 * `Math.round` rounds half UP, which is asymmetric for negatives:
 * `Math.round(-0.5)` is `-0`, not `-1`. In a cash-flow model that would make
 * losses round differently from profits — a small, systematic, invisible bias.
 */
export function roundHalfAwayFromZero(
  numerator: number,
  denominator: number,
): number {
  if (denominator === 0) throw new RangeError("Division by zero.");
  const sign = Math.sign(numerator) * Math.sign(denominator) || 1;
  const quotient = Math.abs(numerator) / Math.abs(denominator);
  return sign * Math.round(quotient);
}

/**
 * A ratio of two money amounts, in basis points.
 *
 * Returns `null` rather than `0`, `Infinity` or `NaN` when the denominator is
 * zero. A margin with no revenue behind it is undefined, not zero percent, and
 * printing "0% margin" for a pre-revenue month would be a lie the reader acts
 * on.
 */
export function ratioBps(numerator: Money, denominator: Money): number | null {
  assertSameCurrency(numerator, denominator);
  if (denominator.minor === 0) return null;
  return roundHalfAwayFromZero(numerator.minor * BPS_SCALE, denominator.minor);
}

/** Divide money into `n` equal parts. Used for annual → monthly costs. */
export function divide(amount: Money, divisor: number): Money {
  if (!Number.isFinite(divisor) || divisor === 0) {
    throw new RangeError("Cannot divide money by zero or a non-finite value.");
  }
  return money(roundHalfAwayFromZero(amount.minor, divisor), amount.currency);
}

/**
 * Compound growth over `periods`, applied one period at a time.
 *
 * Deliberately iterative rather than `base * (1 + r)^n`: the power form uses
 * floating-point exponentiation, and rounding once at the end produces a
 * different number from rounding each month. Every downstream month reads the
 * previous month's ROUNDED figure, so the iteration is what actually matches
 * the forecast table a user sees.
 */
export function compound(base: Money, bps: number, periods: number): Money {
  if (!Number.isInteger(periods) || periods < 0) {
    throw new RangeError("Periods must be a non-negative integer.");
  }
  let current = base;
  for (let i = 0; i < periods; i += 1) {
    current = add(current, applyBps(current, bps));
  }
  return current;
}

/** The same compounding for a plain count, e.g. customers. */
export function compoundCount(
  base: number,
  bps: number,
  periods: number,
): number {
  let current = Math.round(base);
  for (let i = 0; i < periods; i += 1) {
    current = current + roundHalfAwayFromZero(current * bps, BPS_SCALE);
  }
  return current;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format for display. Never used as an input to further arithmetic.
 *
 * `Intl.NumberFormat` with an explicit locale so a server render and a client
 * hydration produce identical strings — the same reason `lib/format.ts` pins
 * its time zone.
 */
export function formatMoney(
  amount: Money,
  options: { compact?: boolean } = {},
): string {
  const meta = CURRENCIES[amount.currency];
  const major = amount.minor / 10 ** meta.minorUnits;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: amount.currency,
    minimumFractionDigits: options.compact ? 0 : meta.minorUnits,
    maximumFractionDigits: options.compact ? 0 : meta.minorUnits,
    notation: options.compact ? "compact" : "standard",
  }).format(major);
}

/** Basis points as a percentage string, or an em dash when undefined. */
export function formatBps(bps: number | null, digits = 1): string {
  if (bps === null) return "—";
  return `${(bps / 100).toFixed(digits)}%`;
}

/** Parse a user-entered major-unit amount into minor units. */
export function parseMajor(
  input: string | number,
  currency: CurrencyCode,
): Money | null {
  const raw = typeof input === "number" ? String(input) : input;
  const cleaned = raw.replace(/[,\s]/g, "").trim();
  if (!cleaned || !/^-?\d*\.?\d*$/.test(cleaned)) return null;

  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;

  const scale = 10 ** CURRENCIES[currency].minorUnits;
  // Rounded immediately: the float exists only for the length of this line.
  return money(Math.round(value * scale), currency);
}
