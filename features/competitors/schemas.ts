import { z } from "zod";

import { COMPETITOR_DEPTHS } from "@/features/competitors/types";

/**
 * Input contracts for the Competitor Intelligence product layer.
 *
 * These validate what a *user* submits — a separate concern from
 * `features/competitors/stages/contracts.ts`, which validates what a *model*
 * returns. Different trust model, different failure mode, so deliberately not
 * merged.
 *
 * Every length here has a matching `check` constraint in migration 0014. The
 * database is the enforcement point; this layer exists so a user gets a
 * sentence under the field instead of a constraint violation.
 */

/** Trim, then treat "" as absent. Optional fields arrive as "" from FormData. */
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

export const MAX_KNOWN_COMPETITORS = 10;
export const MAX_COMPETITOR_NAME_LENGTH = 200;

export const createCompetitorProjectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give the project a title of at least 3 characters.")
    .max(200, "The title must be 200 characters or fewer."),

  description: optionalText(4000, "The business description"),
  category: optionalText(200, "The category"),
  geography: optionalText(200, "The geography"),
  targetCustomer: optionalText(1000, "The target customer"),
  customerProblem: optionalText(2000, "The customer problem"),
  businessModel: optionalText(1000, "The business model"),

  /**
   * Competitors the user already knows about, one per line.
   *
   * These are hints for the search, not facts. Every one still goes through
   * discovery and verification like any other candidate — a name a user typed
   * is no more evidence than a name a model produced.
   */
  knownCompetitors: z
    .string()
    .max(2000, "That is too much text for the known-competitors field.")
    .transform((raw) =>
      raw
        .split("\n")
        .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, "").trim())
        .filter(Boolean)
        .slice(0, MAX_KNOWN_COMPETITORS)
        .map((line) => line.slice(0, MAX_COMPETITOR_NAME_LENGTH)),
    )
    .pipe(
      z
        .array(z.string().trim().min(1).max(MAX_COMPETITOR_NAME_LENGTH))
        .max(
          MAX_KNOWN_COMPETITORS,
          `List at most ${MAX_KNOWN_COMPETITORS} known competitors.`,
        ),
    ),

  depth: z.enum(COMPETITOR_DEPTHS, {
    errorMap: () => ({ message: "Choose Basic, Standard or Deep." }),
  }),

  /**
   * Provenance. Validated as a uuid here and re-checked against the workspace
   * inside `competitor_create_project` — a client-supplied id is never trusted
   * to belong where it claims.
   */
  businessIdeaId: optionalUuid,
  businessPlanId: optionalUuid,
});

export type CreateCompetitorProjectInput = z.infer<
  typeof createCompetitorProjectSchema
>;
