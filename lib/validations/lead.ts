import { z } from "zod";

import { cleanText } from "@/lib/validations/text";

/**
 * Public lead form validation.
 *
 * Runs on the server as the authority — the client copy is a convenience that
 * saves a round trip, not a control. Anything posted directly to the endpoint
 * still passes through this.
 *
 * Only `email` is required. Every additional mandatory field measurably costs
 * conversions, and a lead with a working email is already actionable.
 */

const optionalText = (max: number) =>
  z.preprocess(
    cleanText,
    z
      .string()
      .trim()
      .max(max, `Please keep this under ${max} characters.`)
      .optional()
      .or(z.literal("")),
  );

export const LEAD_SOURCES = [
  "contact",
  "strategy-session",
  "idea-validation",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const leadSchema = z.object({
  name: optionalText(120),
  email: z.preprocess(
    cleanText,
    z
      .string()
      .trim()
      .min(1, "Please enter your email.")
      .email("Please enter a valid email address.")
      .max(254, "That email address is too long."),
  ),
  // Kept permissive on purpose: the audience spans the US, UK, Canada,
  // Australia, Europe and India, and every strict phone regex rejects a valid
  // international format somewhere. Length-bounded rather than pattern-matched.
  phone: optionalText(40),
  company: optionalText(160),
  message: optionalText(4000),

  source: z.enum(LEAD_SOURCES),

  // Attribution — all optional, absence is normal.
  landingPage: optionalText(2048),
  referrer: optionalText(2048),
  utmSource: optionalText(255),
  utmMedium: optionalText(255),
  utmCampaign: optionalText(255),
  utmTerm: optionalText(255),
  utmContent: optionalText(255),

  /**
   * Honeypot. Hidden from users, so a human always submits it empty; naive bots
   * fill every field they find.
   *
   * Note this deliberately *accepts* a filled value rather than rejecting it.
   * An earlier version used `.max(0)`, which failed validation and returned a
   * 422 naming `website` as the offending field — handing a bot the exact
   * information needed to avoid the trap next time. Validation passes; the
   * route inspects the value and silently discards the submission with a normal
   * success response instead.
   */
  website: z.string().max(500).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;
