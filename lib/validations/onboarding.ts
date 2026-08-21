import { z } from "zod";

import { cleanText } from "@/lib/validations/text";

/**
 * Public onboarding form validation.
 *
 * Runs on the server as the authority. The client copy saves a round trip; it
 * is not a control.
 *
 * ---------------------------------------------------------------------------
 * Which fields are required, and why so few
 * ---------------------------------------------------------------------------
 * The brief lists eleven fields for "Validate Your Idea" and then says, in the
 * same breath, "Do not request unnecessary information. Keep the first form
 * conversion-focused." Those pull in opposite directions, so the split here is:
 * REQUIRED is the minimum that makes the submission actionable — a name to
 * address them by, an email to reach them at, and the idea itself. Everything
 * else is collected but optional.
 *
 * A visitor who abandons at field nine is worth less than a visitor who
 * completes at field three and answers the rest in conversation.
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

export const BUSINESS_STAGES = [
  "idea",
  "prototype",
  "pre_revenue",
  "early_revenue",
  "growing",
] as const;

export const BUSINESS_STAGE_LABELS: Record<
  (typeof BUSINESS_STAGES)[number],
  string
> = {
  idea: "Just an idea",
  prototype: "Building a prototype",
  pre_revenue: "Launched, no revenue yet",
  early_revenue: "Some early revenue",
  growing: "Growing",
};

export const validateIdeaSchema = z.object({
  firstName: z.preprocess(
    cleanText,
    z
      .string()
      .trim()
      .min(1, "Please tell us your first name.")
      .max(80, "That name is too long."),
  ),
  lastName: optionalText(80),

  email: z.preprocess(
    cleanText,
    z
      .string()
      .trim()
      .min(1, "Please enter your email.")
      .email("Please enter a valid email address.")
      .max(254, "That email address is too long.")
      // Normalised once, here, so the idempotency key and the account lookup
      // agree about what "the same person" means.
      .transform((value) => value.toLowerCase()),
  ),

  // Permissive on purpose: the audience spans the US, UK, India, Australia and
  // Europe, and every strict phone pattern rejects a valid format somewhere.
  phone: optionalText(40),

  businessIdea: z.preprocess(
    cleanText,
    z
      .string()
      .trim()
      .min(20, "Tell us a little more — at least a sentence or two.")
      .max(4000, "Please keep this under 4000 characters."),
  ),

  industry: optionalText(200),
  targetCustomer: optionalText(1000),
  targetMarket: optionalText(200),
  businessStage: z
    .enum(BUSINESS_STAGES)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  problemSolved: optionalText(2000),
  website: optionalText(2048),

  // Attribution. All optional — absence is normal, not an error.
  landingPage: optionalText(2048),
  referrer: optionalText(2048),
  utmSource: optionalText(255),
  utmMedium: optionalText(255),
  utmCampaign: optionalText(255),
  utmTerm: optionalText(255),
  utmContent: optionalText(255),

  /**
   * Honeypot. Invisible to humans, irresistible to naive bots. Any value at all
   * means the submission is discarded — silently, so the bot cannot learn.
   */
  company_website: optionalText(200),
});

export type ValidateIdeaInput = z.infer<typeof validateIdeaSchema>;

/**
 * Booking a strategy session.
 *
 * `scheduledAt` is an absolute ISO instant; `timezone` is the visitor's IANA
 * zone, stored alongside so a confirmation can say "3pm your time" rather than
 * a UTC timestamp the reader has to convert in their head.
 */
export const bookingSchema = z.object({
  fullName: z.preprocess(
    cleanText,
    z.string().trim().min(1, "Please tell us your name.").max(200),
  ),
  email: z.preprocess(
    cleanText,
    z
      .string()
      .trim()
      .min(1, "Please enter your email.")
      .email("Please enter a valid email address.")
      .max(254)
      .transform((value) => value.toLowerCase()),
  ),
  phone: optionalText(40),

  scheduledAt: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Pick a valid time.")
    .refine(
      (value) => Date.parse(value) > Date.now(),
      "That time has already passed.",
    ),

  // Bounded rather than validated against the full IANA list: the list changes,
  // and a stored zone that no longer resolves is a display problem, not a
  // security one.
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(
      /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){0,2}$/,
      "That timezone is not valid.",
    )
    .default("UTC"),

  notes: optionalText(2000),
  // `leadId` is deliberately NOT accepted from the browser.
  //
  // It used to be, and `booking_create` trusted it: a caller could name any
  // lead id and have a BOOKING_CREATED event written onto that lead's timeline
  // and its status moved to STRATEGY_BOOKED. Admin -> Leads reads exactly those
  // rows, so forged activity was indistinguishable from real behaviour.
  //
  // The server now resolves the lead itself, from the authenticated session or
  // by capturing against the submitted email. Migration 0022 additionally
  // refuses an unowned lead id inside the function, because the RPC is
  // reachable directly over PostgREST and a schema is not a security boundary.

  company_website: optionalText(200),
});

export type BookingInput = z.infer<typeof bookingSchema>;
