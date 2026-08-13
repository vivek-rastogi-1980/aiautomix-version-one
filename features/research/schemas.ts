import { z } from "zod";

import { RESEARCH_DEPTHS } from "@/features/research/types";

/**
 * Input contracts for the Market Research product layer.
 *
 * These validate what a *user* submits. They are a separate concern from
 * `features/research/stages/contracts.ts`, which validates what a *model*
 * returns — different trust model, different failure mode, so deliberately not
 * merged.
 *
 * Every length here has a matching `check` constraint in migration 0009. The
 * database is the enforcement point; this layer exists so a user gets a
 * sentence under the field instead of a constraint violation.
 */

/** Trim, then treat "" as absent. Optional text fields arrive as "" from FormData. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => (value === "" ? undefined : value))
    .optional();

const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional()
  .refine(
    (value) =>
      value === undefined || z.string().uuid().safeParse(value).success,
    "That is not a valid id.",
  );

/** At most ten questions, because each one widens every downstream prompt. */
export const MAX_RESEARCH_QUESTIONS = 10;
export const MAX_QUESTION_LENGTH = 300;

export const researchQuestionsSchema = z
  .array(z.string().trim().min(1).max(MAX_QUESTION_LENGTH))
  .max(
    MAX_RESEARCH_QUESTIONS,
    `Ask at most ${MAX_RESEARCH_QUESTIONS} research questions.`,
  );

export const createResearchSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give the research a title of at least 3 characters.")
    .max(200, "The title must be 200 characters or fewer."),

  scope: optionalText(4000, "The research goal"),
  industry: optionalText(200, "The industry"),
  geography: optionalText(200, "The geography"),
  targetCustomer: optionalText(1000, "The target customer"),
  businessModel: optionalText(1000, "The business model"),

  /**
   * Posted as one textarea, one question per line. Splitting here rather than
   * in the component keeps the parsing rule on the server, where it is also
   * what the action enforces.
   */
  questions: z
    .string()
    .max(3000, "That is too much text for the questions field.")
    .transform((raw) =>
      raw
        .split("\n")
        .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, "").trim())
        .filter(Boolean)
        .slice(0, MAX_RESEARCH_QUESTIONS)
        .map((line) => line.slice(0, MAX_QUESTION_LENGTH)),
    )
    .pipe(researchQuestionsSchema),

  depth: z.enum(RESEARCH_DEPTHS, {
    errorMap: () => ({ message: "Choose Basic, Standard or Deep." }),
  }),

  /**
   * Provenance. Validated as a uuid here and re-checked against the workspace
   * inside `research_create_request` — a client-supplied id is never trusted to
   * belong where it claims.
   */
  businessIdeaId: optionalUuid,
  businessPlanId: optionalUuid,
});

export type CreateResearchInput = z.infer<typeof createResearchSchema>;
