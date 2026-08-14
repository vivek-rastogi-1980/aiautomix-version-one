import { BPS_SCALE, roundHalfAwayFromZero } from "@/features/financials/money";
import {
  CHANNELS,
  type Channel,
  type ChannelPriority,
} from "@/features/marketing/types";

/**
 * The channel prioritisation rubric.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists
 * ---------------------------------------------------------------------------
 * §10 forbids the thing every marketing tool does: printing "LinkedIn — 93%"
 * with nothing behind it. A percentage a model wrote is not a score, it is a
 * feeling with a decimal point.
 *
 * So the work is split the same way Phase 8 splits assumptions from arithmetic:
 *
 *   THE MODEL RATES.      For each channel it gives an integer 0–5 on each
 *                         dimension, with a written rationale, and it must say
 *                         what evidence the rating rests on.
 *   THIS FILE SCORES.     Fixed weights, integer arithmetic, one rounding step,
 *                         published thresholds. Same ratings in, same ranking
 *                         out, forever.
 *
 * The rubric below is therefore printable — and the report does print it. A
 * founder who disagrees with the ranking can look at which dimension carried it
 * and argue with a number they can see, which is the entire point.
 *
 * Pure module: no I/O, no clock, no randomness, no `server-only`.
 */

// ---------------------------------------------------------------------------
// The rubric
// ---------------------------------------------------------------------------

export const RATING_MIN = 0;
export const RATING_MAX = 5;

export interface ScoringDimension {
  key: ScoringDimensionKey;
  label: string;
  /** Share of the total score, in basis points. All weights sum to 10 000. */
  weightBps: number;
  /**
   * True when a HIGH rating is BAD.
   *
   * Cost and difficulty are rated as "how much of it there is", so a 5 on cost
   * means expensive. Inverting here rather than asking the model to rate
   * "cheapness" avoids the double-negative that makes raters disagree with
   * themselves.
   */
  inverted: boolean;
  /** Printed in the report so the reader knows what a 5 meant. */
  meaning: string;
}

export const SCORING_DIMENSION_KEYS = [
  "audience_fit",
  "intent",
  "business_model_fit",
  "evidence",
  "cost",
  "speed",
  "scalability",
  "difficulty",
] as const;

export type ScoringDimensionKey = (typeof SCORING_DIMENSION_KEYS)[number];

export const SCORING_MODEL: readonly ScoringDimension[] = [
  {
    key: "audience_fit",
    label: "Audience fit",
    weightBps: 2000,
    inverted: false,
    meaning: "5 = the ICP demonstrably spends time here.",
  },
  {
    key: "intent",
    label: "Purchase intent",
    weightBps: 1500,
    inverted: false,
    meaning: "5 = people arrive already looking to buy this.",
  },
  {
    key: "business_model_fit",
    label: "Business model fit",
    weightBps: 1500,
    inverted: false,
    meaning: "5 = the channel suits how this business actually sells.",
  },
  {
    key: "evidence",
    label: "Evidence strength",
    weightBps: 1500,
    inverted: false,
    meaning:
      "5 = cited sources or competitor data support this channel for this audience. 0 = nothing but assumption.",
  },
  {
    key: "cost",
    label: "Cost to run",
    weightBps: 1200,
    inverted: true,
    meaning: "5 = expensive. Inverted: cheaper scores higher.",
  },
  {
    key: "speed",
    label: "Speed to first result",
    weightBps: 1000,
    inverted: false,
    meaning: "5 = results within weeks. 1 = results within quarters.",
  },
  {
    key: "scalability",
    label: "Scalability",
    weightBps: 800,
    inverted: false,
    meaning: "5 = spending more reliably produces more.",
  },
  {
    key: "difficulty",
    label: "Execution difficulty",
    weightBps: 500,
    inverted: true,
    meaning: "5 = hard to execute well. Inverted: easier scores higher.",
  },
];

/** The weights must sum to exactly one whole. Asserted by the test suite. */
export const TOTAL_WEIGHT_BPS = SCORING_MODEL.reduce(
  (total, dimension) => total + dimension.weightBps,
  0,
);

/**
 * Thresholds, in basis points of the maximum achievable score.
 *
 * Published constants rather than percentile buckets: a percentile would mean
 * the top channel is always "primary" even when every channel scored badly,
 * which is exactly the flattery this feature is supposed to avoid.
 */
export const PRIORITY_THRESHOLDS_BPS: Record<
  Exclude<ChannelPriority, "NOT_RECOMMENDED">,
  number
> = {
  PRIMARY: 7000,
  SECONDARY: 5500,
  EXPERIMENTAL: 4000,
};

/**
 * At most two primary channels.
 *
 * §9: do not automatically recommend every channel. A team that has three
 * "primary" channels has none — this cap turns focus into a structural
 * property of the output rather than advice the report gives and then ignores.
 */
export const MAX_PRIMARY_CHANNELS = 2;

/**
 * A channel with no evidence behind it cannot be primary.
 *
 * It can still be worth trying, which is what EXPERIMENTAL is for. What it
 * cannot be is the thing a founder bets the quarter on because a model felt
 * confident about it.
 */
export const MIN_EVIDENCE_FOR_PRIMARY = 2;

// ---------------------------------------------------------------------------
// Inputs and outputs
// ---------------------------------------------------------------------------

export type ChannelRatings = Record<ScoringDimensionKey, number>;

export interface DimensionContribution {
  key: ScoringDimensionKey;
  label: string;
  /** What the model gave, 0–5, before inversion. */
  rating: number;
  /** After inversion. This is what was actually weighted. */
  effective: number;
  weightBps: number;
  inverted: boolean;
  /** This dimension's share of the final score, in basis points. */
  contributionBps: number;
}

export interface ChannelScore {
  channel: Channel;
  /** 0–10 000. 10 000 means a 5 on every dimension. */
  scoreBps: number;
  priority: ChannelPriority;
  contributions: DimensionContribution[];
  /** Set when a rule overrode the raw threshold, so the report can say why. */
  priorityNote: string | null;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Clamp a rating into the rubric's range. Out-of-range input is a bug, not data. */
export function clampRating(value: number): number {
  if (!Number.isFinite(value)) return RATING_MIN;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(value)));
}

/**
 * Score one channel.
 *
 * Integer arithmetic with a single rounding step at the end, for the same
 * reason the financial engine works that way: rounding each contribution and
 * then summing gives a different number from summing and rounding once, and
 * only one of those is reproducible.
 */
export function scoreChannel(
  channel: Channel,
  ratings: ChannelRatings,
): ChannelScore {
  const maxWeighted = RATING_MAX * TOTAL_WEIGHT_BPS;

  const contributions: DimensionContribution[] = SCORING_MODEL.map(
    (dimension) => {
      const rating = clampRating(ratings[dimension.key]);
      const effective = dimension.inverted ? RATING_MAX - rating : rating;
      return {
        key: dimension.key,
        label: dimension.label,
        rating,
        effective,
        weightBps: dimension.weightBps,
        inverted: dimension.inverted,
        contributionBps: roundHalfAwayFromZero(
          effective * dimension.weightBps * BPS_SCALE,
          maxWeighted,
        ),
      };
    },
  );

  const weighted = contributions.reduce(
    (total, contribution) =>
      total + contribution.effective * contribution.weightBps,
    0,
  );

  const scoreBps = roundHalfAwayFromZero(weighted * BPS_SCALE, maxWeighted);

  return {
    channel,
    scoreBps,
    priority: rawPriority(scoreBps),
    contributions,
    priorityNote: null,
  };
}

/** The threshold lookup, before any of the override rules run. */
export function rawPriority(scoreBps: number): ChannelPriority {
  if (scoreBps >= PRIORITY_THRESHOLDS_BPS.PRIMARY) return "PRIMARY";
  if (scoreBps >= PRIORITY_THRESHOLDS_BPS.SECONDARY) return "SECONDARY";
  if (scoreBps >= PRIORITY_THRESHOLDS_BPS.EXPERIMENTAL) return "EXPERIMENTAL";
  return "NOT_RECOMMENDED";
}

/**
 * Score and rank a set of channels.
 *
 * Deterministic ordering: by score descending, then by the rubric's own channel
 * order for ties. Two channels that score identically must always come back in
 * the same order or the report changes between renders for no reason.
 *
 * Then two override rules run, in this order, and both annotate themselves:
 *
 *   1. NO EVIDENCE, NO PRIMARY.  A channel rated below `MIN_EVIDENCE_FOR_PRIMARY`
 *      on evidence is capped at EXPERIMENTAL however well it scored elsewhere.
 *   2. AT MOST TWO PRIMARIES.    Beyond the cap, primaries demote to SECONDARY.
 */
export function rankChannels(
  ratingsByChannel: Partial<Record<Channel, ChannelRatings>>,
): ChannelScore[] {
  const scored = (Object.keys(ratingsByChannel) as Channel[])
    .filter((channel) => Boolean(ratingsByChannel[channel]))
    .map((channel) => scoreChannel(channel, ratingsByChannel[channel]!));

  scored.sort((a, b) => {
    if (b.scoreBps !== a.scoreBps) return b.scoreBps - a.scoreBps;
    return CHANNELS.indexOf(a.channel) - CHANNELS.indexOf(b.channel);
  });

  let primariesUsed = 0;

  for (const entry of scored) {
    const evidence = entry.contributions.find(
      (contribution) => contribution.key === "evidence",
    );

    if (
      entry.priority === "PRIMARY" &&
      (evidence?.rating ?? 0) < MIN_EVIDENCE_FOR_PRIMARY
    ) {
      entry.priority = "EXPERIMENTAL";
      entry.priorityNote =
        "Scored well but rests on assumption rather than evidence, so it is worth testing, not betting on.";
      continue;
    }

    if (entry.priority === "PRIMARY") {
      if (primariesUsed >= MAX_PRIMARY_CHANNELS) {
        entry.priority = "SECONDARY";
        entry.priorityNote = `Above the primary threshold, but only ${MAX_PRIMARY_CHANNELS} channels can be primary at once.`;
      } else {
        primariesUsed += 1;
      }
    }
  }

  return scored;
}

/**
 * Each channel's share of a budget, in basis points.
 *
 * Allocation follows the scores of the channels actually being run, so the
 * money goes where the rubric said to go. Remainder from integer division is
 * given to the top-ranked channel, which keeps the shares summing to exactly
 * 10 000 without a floating-point fudge.
 *
 * Returns an empty list when no channel is worth funding — an honest answer,
 * and better than spreading a budget across channels the rubric rejected.
 */
export function allocationBps(
  scores: ChannelScore[],
): { channel: Channel; shareBps: number }[] {
  const funded = scores.filter(
    (entry) => entry.priority !== "NOT_RECOMMENDED" && entry.scoreBps > 0,
  );
  if (funded.length === 0) return [];

  const total = funded.reduce((sum, entry) => sum + entry.scoreBps, 0);
  if (total <= 0) return [];

  const shares = funded.map((entry) => ({
    channel: entry.channel,
    shareBps: roundHalfAwayFromZero(entry.scoreBps * BPS_SCALE, total),
  }));

  const assigned = shares.reduce((sum, share) => sum + share.shareBps, 0);
  const remainder = BPS_SCALE - assigned;
  if (remainder !== 0 && shares.length > 0) {
    shares[0].shareBps += remainder;
  }

  return shares;
}
