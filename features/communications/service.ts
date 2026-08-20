import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  PROVIDER_ID,
  mailerConfigured,
  sendMail,
  type DeliveryResult,
} from "@/features/communications/mailer";
import {
  EVENT_TO_TRIGGER,
  type CommunicationEvent,
  type EmailTrigger,
} from "@/features/communications/events";
import {
  PREVIEW_CONTEXT,
  renderTemplate,
  validateTemplate,
  type TemplateContext,
} from "@/features/communications/template-engine";

/**
 * The communication service.
 *
 *   EVENT → TEMPLATE → PROVIDER → LOG
 *
 * One function raises an event; this resolves the active template, renders it
 * against a validated context, hands it to the provider, and records what
 * happened. Callers never touch a template or the provider directly.
 *
 * ---------------------------------------------------------------------------
 * Failure is a logged outcome, never a thrown exception
 * ---------------------------------------------------------------------------
 * `notifyNewLead` already established the rule this follows: the business fact
 * is committed before the email is attempted, so a missing API key, a provider
 * outage or a bounced send costs a notification and never the lead. Every path
 * here returns a result rather than throwing, and every path writes a log row —
 * including SKIPPED, because "we chose not to send" and "we tried and failed"
 * are different facts and support needs to tell them apart.
 *
 * ---------------------------------------------------------------------------
 * The provider lives in `mailer.ts`
 * ---------------------------------------------------------------------------
 * Delivery is SMTP through the business's own Hostinger mailbox. Nothing in
 * this file knows that: it renders a message and hands it over. The envelope
 * sender, the credentials, the timeouts and the error vocabulary are all the
 * mailer's business, which is what made replacing the previous HTTP provider a
 * change to one module rather than to every send path.
 */

export interface SendContext {
  /** Filled into the template. Only keys in the closed vocabulary are used. */
  variables: TemplateContext;
  recipientEmail: string;
  userId?: string | null;
  workspaceId?: string | null;
  leadId?: string | null;
  bookingId?: string | null;
  /** Admin test sends. Logged, but never attached to a lead's timeline. */
  isTest?: boolean;
}

export interface SendResult {
  status: "SENT" | "FAILED" | "SKIPPED";
  logId: string | null;
  trigger: EmailTrigger;
  subject: string | null;
  messageId: string | null;
  reason: string | null;
}

interface ActiveTemplate {
  templateId: string;
  versionId: string;
  version: number;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
}

/**
 * The ACTIVE template for a trigger, at its current version.
 *
 * Returns null when there is no active template — which is the normal state for
 * a freshly-migrated system, since migration 0019 seeds all fifteen as DRAFT.
 * Turning one on is a decision somebody makes after reading the copy.
 */
async function loadActiveTemplate(
  trigger: EmailTrigger,
): Promise<ActiveTemplate | null> {
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("email_templates")
    .select("id, current_version")
    .eq("trigger", trigger)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!template || template.current_version < 1) return null;

  const { data: version } = await supabase
    .from("email_template_versions")
    .select("id, version, subject, body_html, body_text")
    .eq("template_id", template.id)
    .eq("version", template.current_version)
    .maybeSingle();

  if (!version) return null;

  return {
    templateId: template.id,
    versionId: version.id,
    version: version.version,
    subject: version.subject,
    bodyHtml: version.body_html,
    bodyText: version.body_text,
  };
}

/** Write the log row. Never throws — a failed log must not mask a failed send. */
async function record(args: {
  trigger: EmailTrigger;
  status: "SENT" | "FAILED" | "SKIPPED";
  context: SendContext;
  template: ActiveTemplate | null;
  subject: string | null;
  messageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("email_log_record", {
      p_recipient: args.context.recipientEmail,
      p_status: args.status,
      p_trigger: args.trigger,
      p_template_id: args.template?.templateId ?? null,
      p_version_id: args.template?.versionId ?? null,
      p_subject: args.subject,
      p_provider: PROVIDER_ID,
      p_message_id: args.messageId,
      p_error_code: args.errorCode,
      p_error_message: args.errorMessage,
      p_user_id: args.context.userId ?? null,
      p_workspace_id: args.context.workspaceId ?? null,
      p_lead_id: args.context.leadId ?? null,
      p_booking_id: args.context.bookingId ?? null,
      p_is_test: args.context.isTest === true,
    });
    return typeof data === "string" ? data : null;
  } catch (error) {
    console.error("[communications] could not write email log", {
      trigger: args.trigger,
      status: args.status,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

/**
 * Hand a rendered message to the transport.
 *
 * Kept as its own function even though it is now a thin adapter: it is the one
 * place that decides what the send paths below see, so the "unconfigured"
 * result and the shape of a failure stay in a single spot rather than being
 * re-derived at each call site.
 *
 * An absent SMTP configuration is a supported state, not an error — the site
 * runs without it and the log says SKIPPED rather than pretending.
 */
async function deliver(
  to: string,
  subject: string,
  html: string,
  text: string | null,
): Promise<DeliveryResult> {
  return sendMail({ to, subject, html, text });
}

/**
 * Send the email for a trigger.
 *
 * The order is: resolve → validate → render → deliver → log. Validation runs
 * again at send time even though it ran at save time, because the variable
 * vocabulary can tighten between the two and a template that references a
 * retired variable must not go out with a hole in it.
 */
export async function sendTemplatedEmail(
  trigger: EmailTrigger,
  context: SendContext,
): Promise<SendResult> {
  const template = await loadActiveTemplate(trigger);

  if (!template) {
    const logId = await record({
      trigger,
      status: "SKIPPED",
      context,
      template: null,
      subject: null,
      messageId: null,
      errorCode: "NO_ACTIVE_TEMPLATE",
      errorMessage: `No active template for ${trigger}.`,
    });
    return {
      status: "SKIPPED",
      logId,
      trigger,
      subject: null,
      messageId: null,
      reason: `No active template for ${trigger}. Activate one in Admin → Communications.`,
    };
  }

  const subjectCheck = validateTemplate(template.subject);
  const bodyCheck = validateTemplate(template.bodyHtml);

  if (!subjectCheck.ok || !bodyCheck.ok) {
    const issues = [...subjectCheck.issues, ...bodyCheck.issues]
      .map((issue) => issue.message)
      .join(" ");
    const logId = await record({
      trigger,
      status: "FAILED",
      context,
      template,
      subject: null,
      messageId: null,
      errorCode: "INVALID_TEMPLATE",
      errorMessage: issues,
    });
    return {
      status: "FAILED",
      logId,
      trigger,
      subject: null,
      messageId: null,
      reason: issues,
    };
  }

  const subject = renderTemplate(template.subject, context.variables, {
    html: false,
  }).output;
  const html = renderTemplate(template.bodyHtml, context.variables, {
    html: true,
  }).output;
  const text = template.bodyText
    ? renderTemplate(template.bodyText, context.variables, { html: false })
        .output
    : null;

  const delivery = await deliver(context.recipientEmail, subject, html, text);

  if (delivery.ok) {
    const logId = await record({
      trigger,
      status: "SENT",
      context,
      template,
      subject,
      messageId: delivery.messageId,
      errorCode: null,
      errorMessage: null,
    });
    return {
      status: "SENT",
      logId,
      trigger,
      subject,
      messageId: delivery.messageId,
      reason: null,
    };
  }

  const status = delivery.skipped ? "SKIPPED" : "FAILED";
  const logId = await record({
    trigger,
    status,
    context,
    template,
    subject,
    messageId: null,
    errorCode: delivery.code,
    errorMessage: delivery.message,
  });

  return {
    status,
    logId,
    trigger,
    subject,
    messageId: null,
    reason: delivery.message,
  };
}

/**
 * Raise a domain event.
 *
 * The entry point every caller should use. A UI raises `BOOKING_CREATED` and
 * knows nothing about which template answers it — which is the whole point of
 * §9, and what makes changing the copy a one-place edit.
 */
export async function emitCommunicationEvent(
  event: CommunicationEvent,
  context: SendContext,
): Promise<SendResult> {
  return sendTemplatedEmail(EVENT_TO_TRIGGER[event], context);
}

/**
 * Send an admin test of one specific template version.
 *
 * Deliberately NOT `sendTemplatedEmail`. Four things have to be different, and
 * every one of them is a rule from §"Send test email":
 *
 *   1. It renders the template the admin is LOOKING AT, resolved by id, rather
 *      than whichever template is ACTIVE for that trigger. Testing a draft you
 *      cannot see is not a test, and it is drafts that need testing.
 *
 *   2. It fills from `PREVIEW_CONTEXT` — obviously fictional sample data. A
 *      test must never carry a real customer's business idea or score into an
 *      operator's inbox.
 *
 *   3. The subject is prefixed `[TEST]`, so a message that reaches a shared
 *      inbox cannot be mistaken for something a customer received.
 *
 *   4. It raises no event, writes no `lead_events` row and attaches to no lead
 *      or booking. The log row carries `is_test = true`, which is what keeps
 *      test sends out of the delivery list and out of the funnel counters.
 *
 * Like every other path here it returns a result and never throws.
 */
export async function sendTemplateTest(
  templateId: string,
  recipientEmail: string,
): Promise<SendResult> {
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("email_templates")
    .select("id, trigger, current_version")
    .eq("id", templateId)
    .maybeSingle();

  if (!template || template.current_version < 1) {
    return {
      status: "FAILED",
      logId: null,
      trigger: (template?.trigger ?? "GENERAL_NOTIFICATION") as EmailTrigger,
      subject: null,
      messageId: null,
      reason:
        "Save a subject and body for this template before sending a test.",
    };
  }

  const { data: version } = await supabase
    .from("email_template_versions")
    .select("id, version, subject, body_html, body_text")
    .eq("template_id", templateId)
    .eq("version", template.current_version)
    .maybeSingle();

  if (!version) {
    return {
      status: "FAILED",
      logId: null,
      trigger: template.trigger as EmailTrigger,
      subject: null,
      messageId: null,
      reason: "That version could not be read.",
    };
  }

  const trigger = template.trigger as EmailTrigger;
  const active: ActiveTemplate = {
    templateId: template.id,
    versionId: version.id,
    version: version.version,
    subject: version.subject,
    bodyHtml: version.body_html,
    bodyText: version.body_text,
  };

  const subjectCheck = validateTemplate(active.subject);
  const bodyCheck = validateTemplate(active.bodyHtml);
  if (!subjectCheck.ok || !bodyCheck.ok) {
    const issues = [...subjectCheck.issues, ...bodyCheck.issues]
      .map((issue) => issue.message)
      .join(" ");
    return {
      status: "FAILED",
      logId: null,
      trigger,
      subject: null,
      messageId: null,
      reason: issues,
    };
  }

  const context: SendContext = {
    recipientEmail,
    variables: PREVIEW_CONTEXT,
    isTest: true,
  };

  const subject = `[TEST] ${
    renderTemplate(active.subject, PREVIEW_CONTEXT, { html: false }).output
  }`;
  const html = renderTemplate(active.bodyHtml, PREVIEW_CONTEXT, {
    html: true,
  }).output;
  const text = active.bodyText
    ? renderTemplate(active.bodyText, PREVIEW_CONTEXT, { html: false }).output
    : null;

  const delivery = await deliver(recipientEmail, subject, html, text);

  if (delivery.ok) {
    const logId = await record({
      trigger,
      status: "SENT",
      context,
      template: active,
      subject,
      messageId: delivery.messageId,
      errorCode: null,
      errorMessage: null,
    });
    return {
      status: "SENT",
      logId,
      trigger,
      subject,
      messageId: delivery.messageId,
      reason: null,
    };
  }

  const status = delivery.skipped ? "SKIPPED" : "FAILED";
  const logId = await record({
    trigger,
    status,
    context,
    template: active,
    subject,
    messageId: null,
    errorCode: delivery.code,
    errorMessage: delivery.message,
  });

  return {
    status,
    logId,
    trigger,
    subject,
    messageId: null,
    reason: delivery.message,
  };
}

/**
 * Is a provider configured at all? Surfaced in the admin UI, never the secret.
 *
 * Delegates rather than reading an env var directly, so there is exactly one
 * definition of "configured" and the admin panel cannot disagree with the code
 * that actually sends.
 */
export function emailProviderConfigured(): boolean {
  return mailerConfigured();
}
