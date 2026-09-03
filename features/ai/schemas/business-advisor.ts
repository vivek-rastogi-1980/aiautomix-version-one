import { z } from "zod";

/**
 * JSON contract for the `business-advisor` workflow (Phase 16).
 *
 * The Workflow Manager validates every model response against this before the
 * UI sees it, so a malformed answer is retried rather than rendered.
 *
 * ---------------------------------------------------------------------------
 * Why the answer is structured rather than a blob of text
 * ---------------------------------------------------------------------------
 * §9 and §27. A free-form reply renders as a wall of prose and gives the UI
 * nothing to hang a hierarchy on. Splitting it into answer / why / actions /
 * risks lets the page show the recommendation first and the reasoning second,
 * which is the order a busy founder reads in.
 *
 * It also has a second effect worth stating: `actions` being a typed list is
 * what makes "add this to my roadmap" possible at all. A recommendation buried
 * in a paragraph cannot become a task without the model being asked twice.
 *
 * ---------------------------------------------------------------------------
 * What it deliberately cannot say
 * ---------------------------------------------------------------------------
 * There is no field for a figure, a projection, a market size or a customer
 * count. The advisor reasons over context it was given; anything numeric it
 * wanted to assert would have to be invented, and the schema gives it nowhere
 * to put it. `missing_context` is the honest alternative — the model states
 * what it would need instead of guessing.
 */

const nonEmpty = z.string().trim().min(1);

export const ADVICE_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export type AdvicePriority = (typeof ADVICE_PRIORITIES)[number];

export const advisorActionSchema = z.object({
  /** Imperative and specific enough to become a roadmap task verbatim. */
  title: nonEmpty.max(200),
  /** Why this one, in terms of this customer's own situation. */
  reason: nonEmpty.max(600),
  priority: z.enum(ADVICE_PRIORITIES),
});

export const businessAdvisorResponseSchema = z.object({
  /** The direct answer to what was asked. Two or three sentences. */
  answer: nonEmpty.max(1500),
  /** The single recommendation, if the question warrants one. */
  recommendation: nonEmpty.max(600).optional(),
  /** Why it matters, grounded in the supplied context. */
  reasoning: nonEmpty.max(1000).optional(),
  priority: z.enum(ADVICE_PRIORITIES).optional(),
  /** Concrete next steps. Empty when the question was informational. */
  actions: z.array(advisorActionSchema).max(5).default([]),
  /** Risks worth naming before acting. */
  risks: z.array(nonEmpty.max(300)).max(5).default([]),
  /** What to measure to know whether it worked. */
  metrics: z.array(nonEmpty.max(200)).max(4).default([]),
  /**
   * What the advisor would need to answer better. §22 — offered, never
   * mandatory, and the UI treats it as a prompt rather than a blocker.
   */
  follow_up_question: nonEmpty.max(300).optional(),
  /**
   * Context the advisor did not have. This is the anti-fabrication valve: a
   * model that would otherwise invent a number is told to name the gap here.
   */
  missing_context: z.array(nonEmpty.max(200)).max(4).default([]),
});

export type BusinessAdvisorResponse = z.infer<
  typeof businessAdvisorResponseSchema
>;
