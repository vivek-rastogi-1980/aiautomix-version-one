/**
 * The communication event model.
 *
 * ---------------------------------------------------------------------------
 * Why events rather than `sendEmail()` calls
 * ---------------------------------------------------------------------------
 * §9 forbids hard-coding email sending into UI components, and the reason shows
 * up the first time somebody needs to change what a booking confirmation says:
 * with direct calls, that means finding every place a booking can be created.
 * With events, it means editing one template.
 *
 *   EVENT → COMMUNICATION SERVICE → TEMPLATE → PROVIDER → LOG
 *
 * The mapping below is the only place that knows which template answers which
 * event. A UI raises an event and stops caring.
 *
 * ---------------------------------------------------------------------------
 * Wired vs. declared
 * ---------------------------------------------------------------------------
 * §"Email template types" says: only implement triggers the application can
 * actually support, and do not pretend an automation exists if it has not been
 * wired. So each event carries `wired`, and the admin template list shows it.
 * A trigger marked `false` has a template and no caller — the honest state for
 * the two reminders, which need a scheduler this phase does not build.
 */

export const COMMUNICATION_EVENTS = [
  "USER_CREATED",
  "IDEA_SUBMITTED",
  "VALIDATION_STARTED",
  "VALIDATION_COMPLETED",
  "VALIDATION_FAILED",
  "REPORT_READY",
  "BOOKING_CREATED",
  "BOOKING_CANCELLED",
  "BOOKING_RESCHEDULED",
  "BOOKING_COMPLETED",
] as const;

export type CommunicationEvent = (typeof COMMUNICATION_EVENTS)[number];

export const EMAIL_TRIGGERS = [
  "ACCOUNT_WELCOME",
  "ACCOUNT_ACTIVATION",
  "IDEA_SUBMITTED",
  "VALIDATION_STARTED",
  "VALIDATION_COMPLETED",
  "VALIDATION_FAILED",
  "REPORT_READY",
  "STRATEGY_SESSION_INVITATION",
  "BOOKING_CONFIRMATION",
  "BOOKING_REMINDER_24H",
  "BOOKING_REMINDER_1H",
  "BOOKING_CANCELLED",
  "BOOKING_RESCHEDULED",
  "PASSWORD_RESET",
  "GENERAL_NOTIFICATION",
] as const;

export type EmailTrigger = (typeof EMAIL_TRIGGERS)[number];

export function isEmailTrigger(value: unknown): value is EmailTrigger {
  return (
    typeof value === "string" &&
    (EMAIL_TRIGGERS as readonly string[]).includes(value)
  );
}

/** Which template answers which event. The single source of that mapping. */
export const EVENT_TO_TRIGGER: Record<CommunicationEvent, EmailTrigger> = {
  USER_CREATED: "ACCOUNT_WELCOME",
  IDEA_SUBMITTED: "IDEA_SUBMITTED",
  VALIDATION_STARTED: "VALIDATION_STARTED",
  VALIDATION_COMPLETED: "VALIDATION_COMPLETED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  REPORT_READY: "REPORT_READY",
  BOOKING_CREATED: "BOOKING_CONFIRMATION",
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  BOOKING_RESCHEDULED: "BOOKING_RESCHEDULED",
  BOOKING_COMPLETED: "GENERAL_NOTIFICATION",
};

export interface TriggerStatus {
  trigger: EmailTrigger;
  label: string;
  /** True when something in this codebase actually raises it. */
  wired: boolean;
  /** Where it is raised from, or why it is not. Shown in the admin list. */
  note: string;
}

/**
 * The honest wiring table.
 *
 * Verified by the smoke suite against the actual call sites, so it cannot drift
 * into optimism — a trigger claimed as wired must be raised somewhere in the
 * source, and one claimed unwired must not be.
 */
export const TRIGGER_STATUS: Record<EmailTrigger, TriggerStatus> = {
  ACCOUNT_WELCOME: {
    trigger: "ACCOUNT_WELCOME",
    label: "Welcome",
    wired: true,
    note: "Raised by features/onboarding/activation.ts when a visitor follows their one-time link and their workspace is provisioned.",
  },
  ACCOUNT_ACTIVATION: {
    trigger: "ACCOUNT_ACTIVATION",
    label: "Account activation",
    wired: false,
    note: "Sent by Supabase Auth itself as a one-time link, not by this template. Editing it here has no effect — change it in the Supabase email settings.",
  },
  IDEA_SUBMITTED: {
    trigger: "IDEA_SUBMITTED",
    label: "Idea received",
    wired: true,
    note: "Raised by POST /api/onboarding/validate-idea when the lead is committed.",
  },
  VALIDATION_STARTED: {
    trigger: "VALIDATION_STARTED",
    label: "Validation started",
    wired: true,
    note: "Raised by the business validator once the idea row is committed and the run begins.",
  },
  VALIDATION_COMPLETED: {
    trigger: "VALIDATION_COMPLETED",
    label: "Validation complete",
    wired: true,
    note: "Raised by the business validator once the report is durably stored.",
  },
  VALIDATION_FAILED: {
    trigger: "VALIDATION_FAILED",
    label: "Validation failed",
    wired: true,
    note: "Raised by the business validator when the workflow errors and the idea is marked failed.",
  },
  REPORT_READY: {
    trigger: "REPORT_READY",
    label: "Report ready",
    wired: true,
    note: "Raised alongside validation completion. A separate trigger because a future async PDF step will separate the two in time.",
  },
  STRATEGY_SESSION_INVITATION: {
    trigger: "STRATEGY_SESSION_INVITATION",
    label: "Strategy session invitation",
    wired: false,
    note: "No automatic caller. Intended for an admin to send deliberately once a lead is qualified.",
  },
  BOOKING_CONFIRMATION: {
    trigger: "BOOKING_CONFIRMATION",
    label: "Booking confirmed",
    wired: true,
    note: "Raised by POST /api/onboarding/bookings when the slot is committed.",
  },
  BOOKING_REMINDER_24H: {
    trigger: "BOOKING_REMINDER_24H",
    label: "Reminder — 24 hours",
    wired: false,
    note: "Needs a scheduler. Nothing in this release runs on a timer, so this template exists but never fires.",
  },
  BOOKING_REMINDER_1H: {
    trigger: "BOOKING_REMINDER_1H",
    label: "Reminder — 1 hour",
    wired: false,
    note: "Needs a scheduler. Nothing in this release runs on a timer, so this template exists but never fires.",
  },
  BOOKING_CANCELLED: {
    trigger: "BOOKING_CANCELLED",
    label: "Booking cancelled",
    wired: true,
    note: "Raised by the admin booking control when a session moves to CANCELLED.",
  },
  BOOKING_RESCHEDULED: {
    trigger: "BOOKING_RESCHEDULED",
    label: "Booking rescheduled",
    wired: false,
    note: "Rescheduling is not implemented in this release — a customer cancels and books again.",
  },
  PASSWORD_RESET: {
    trigger: "PASSWORD_RESET",
    label: "Password reset",
    wired: false,
    note: "Sent by Supabase Auth itself. Editing it here has no effect.",
  },
  GENERAL_NOTIFICATION: {
    trigger: "GENERAL_NOTIFICATION",
    label: "General notification",
    wired: false,
    note: "BOOKING_COMPLETED maps here, but nothing raises that event: completing a session changes its status and writes the lead timeline without sending anything. There is no message a customer needs at that moment, and wiring one to make this look wired would be the pretence this column exists to prevent.",
  },
};

/** Triggers that this codebase actually raises. Asserted by the test suite. */
export function wiredTriggers(): EmailTrigger[] {
  return EMAIL_TRIGGERS.filter((trigger) => TRIGGER_STATUS[trigger].wired);
}

export const EMAIL_STATUSES = ["QUEUED", "SENT", "FAILED", "SKIPPED"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const TEMPLATE_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export function isTemplateStatus(value: unknown): value is TemplateStatus {
  return (
    typeof value === "string" &&
    (TEMPLATE_STATUSES as readonly string[]).includes(value)
  );
}
