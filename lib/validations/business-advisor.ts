import { z } from "zod";

/**
 * Input contract for the `business-advisor` workflow (Phase 16).
 *
 * ---------------------------------------------------------------------------
 * The context is a rendered string, not a nested object
 * ---------------------------------------------------------------------------
 * The Prompt Registry substitutes `{{placeholder}}` variables with strings, so
 * the assembled business context is serialised once, by the server, into a
 * compact block the prompt embeds. Doing it here rather than in the prompt file
 * keeps the shape in one place and means the model always sees the same layout
 * regardless of which parts of a customer's account exist.
 *
 * ---------------------------------------------------------------------------
 * `question` is customer text and is treated as such
 * ---------------------------------------------------------------------------
 * It is bounded, and the prompt wraps it in explicit delimiters so a question
 * containing instructions ("ignore your rules and...") reads as the customer's
 * words rather than as developer intent. The platform's existing prompt
 * assembly already fences user input the same way for the validator.
 */

export const ADVISOR_QUESTION_MAX = 1000;

export const businessAdvisorInputSchema = z.object({
  question: z
    .string()
    .trim()
    .min(5, "Ask a question of at least a few words")
    .max(ADVISOR_QUESTION_MAX, "That question is too long"),

  /** Compact JSON block assembled server-side by `features/advisor/context`. */
  businessContext: z.string().min(2).max(12_000),

  /**
   * Recent turns, already trimmed by the caller. §19: history is capped rather
   * than replayed in full, because an advisor conversation that grows without
   * bound turns every later question into an expensive one.
   */
  conversationContext: z.string().max(6_000).optional(),

  /** Which parts of the business the context actually contains. */
  availabilityNote: z.string().max(500),
});

export type BusinessAdvisorInput = z.infer<typeof businessAdvisorInputSchema>;

export function toAdvisorPromptVariables(
  input: BusinessAdvisorInput,
): Record<string, string> {
  return {
    question: input.question,
    businessContext: input.businessContext,
    conversationContext: input.conversationContext ?? "",
    availabilityNote: input.availabilityNote,
  };
}
