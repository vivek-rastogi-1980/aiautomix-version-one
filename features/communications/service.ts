import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  EVENT_TO_TRIGGER,
  type CommunicationEvent,
  type EmailTrigger,
} from "@/features/communications/events";
import {
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
 * Delivery is UNVERIFIED in this release
 * ---------------------------------------------------------------------------
 * `RESEND_API_KEY` is not configured in this environment. Everything below runs
 * and logs, and the provider call returns SKIPPED rather than SENT. Nothing in
 * this codebase has been observed to deliver a message to a real inbox.
 */

const PROVIDER_ID = "resend";

/** Where transactional mail comes from. Overridable per environment. */
const FROM_ADDRESS =
  process.env.TRANSACTIONAL_EMAIL_FROM ??
  process.env.LEAD_NOTIFICATION_FROM ??
  "AIAutoMix <onboarding@resend.dev>";

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
 * Hand a rendered message to the provider.
 *
 * Kept behind one function so a future provider swap touches nothing else, and
 * so the "unconfigured" path is in exactly one place. An absent API key is a
 * supported state, not an error — the site runs without it and the log says
 * SKIPPED rather than pretending.
 */
async function deliver(
  to: string,
  subject: string,
  html: string,
  text: string | null,
): Promise<
  | { ok: true; messageId: string | null }
  | { ok: false; code: string; message: string; skipped?: boolean }
> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      code: "PROVIDER_NOT_CONFIGURED",
      message:
        "No email provider is configured, so nothing was sent. Set RESEND_API_KEY to enable delivery.",
      skipped: true,
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject,
        html,
        ...(text ? { text } : {}),
      }),
    });

    if (!response.ok) {
      // The provider's body may echo the recipient; the status code is enough
      // for support and carries nothing personal into the log.
      return {
        ok: false,
        code: `PROVIDER_${response.status}`,
        message: `The email provider rejected the message (HTTP ${response.status}).`,
      };
    }

    const payload = (await response.json()) as { id?: unknown };
    return {
      ok: true,
      messageId: typeof payload?.id === "string" ? payload.id : null,
    };
  } catch (error) {
    return {
      ok: false,
      code: "NETWORK_ERROR",
      message:
        error instanceof Error
          ? error.message.slice(0, 300)
          : "The provider could not be reached.",
    };
  }
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

/** Is a provider configured at all? Surfaced in the admin UI, never the key. */
export function emailProviderConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
