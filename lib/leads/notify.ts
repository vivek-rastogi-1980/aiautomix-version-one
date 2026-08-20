import "server-only";

import { escapeHtml } from "@/features/communications/template-engine";
import { sendMail } from "@/features/communications/mailer";
import type { LeadInput } from "@/lib/validations/lead";

/**
 * Email for a new lead — two of them, to two different people.
 *
 *   notifyNewLead   → the business ("someone enquired")
 *   acknowledgeLead → the visitor  ("we got your enquiry")
 *
 * Both go through `features/communications/mailer.ts`, which is SMTP to the
 * business's own Hostinger mailbox. This file composes copy; it does not know
 * or care how a message reaches an inbox.
 *
 * "Best-effort" is the important word. The lead is already committed to the
 * database before either runs, so a missing API key, a provider outage or a
 * bounced send costs a notification, never the lead itself. That ordering is
 * the whole reason the table exists: email is a convenience layer over durable
 * storage, not the system of record.
 *
 * Unconfigured is a supported state, not an error — the site runs fine without
 * SMTP credentials, and leads still arrive in Supabase.
 *
 * ---------------------------------------------------------------------------
 * Why the visitor acknowledgement lives here and not in the template system
 * ---------------------------------------------------------------------------
 * `features/communications/service.ts` is the richer path: DB-backed templates,
 * versioning, an audit log, admin-editable copy. It is also gated on migration
 * 0019 having been applied and a template having been switched to ACTIVE.
 *
 * This form is public and live now. An acknowledgement that depends on neither
 * is the difference between a visitor hearing back today and hearing back after
 * a migration lands. When the template system is available, `service.ts` should
 * supersede this — see the note in the route.
 *
 * The escaping, at least, is not duplicated: `escapeHtml` is imported from the
 * template engine so there is exactly one implementation of the rule that a
 * lead's own input must never become markup.
 */

/**
 * Where the business is told about a lead.
 *
 * The envelope SENDER is no longer decided here — it belongs to the mailer,
 * which defaults it to the authenticated mailbox because that is the only
 * address Hostinger will accept. Setting it in two places was how a send
 * started failing with a rejected envelope after a mailbox rename.
 */
const LEAD_INBOX =
  process.env.LEAD_NOTIFICATION_EMAIL ?? "contact@aiautomix.com";

const SOURCE_LABEL: Record<string, string> = {
  contact: "Contact form",
  "strategy-session": "Free AI Strategy Session",
  "idea-validation": "Business Idea Validation",
};

function row(label: string, value: string | undefined | null): string {
  if (!value) return "";
  return `${label}: ${value}\n`;
}

interface OutboundEmail {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * The single send, shared by both messages.
 *
 * Returns whether the send was accepted rather than throwing. Callers have
 * already persisted the lead and must not turn a captured lead into a 500
 * because an email did not go out.
 *
 * The failure detail comes back classified by the mailer, so an operator
 * reading the log sees `SMTP_AUTH_FAILED` — a fixable configuration mistake —
 * rather than a raw server response that may echo the envelope.
 */
async function sendEmail(
  message: OutboundEmail,
  context: string,
): Promise<boolean> {
  const result = await sendMail({
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html ?? null,
    replyTo: message.replyTo ?? null,
  });

  if (result.ok) return true;

  // Not configured is not a failure worth shouting about: it is the documented
  // state of a deployment that has not set SMTP credentials yet.
  if (!result.skipped) {
    console.error(`[leads] ${context} failed`, result.code);
  }
  return false;
}

/** Tells the business a lead arrived. */
export async function notifyNewLead(lead: LeadInput): Promise<void> {
  const label = SOURCE_LABEL[lead.source] ?? lead.source;

  // Plain text on purpose: it renders everywhere, cannot break, and carries no
  // markup that a lead's own input could escape into.
  const body =
    `New lead from the ${label}.\n\n` +
    row("Name", lead.name) +
    row("Email", lead.email) +
    row("Phone", lead.phone) +
    row("Company", lead.company) +
    row("Message", lead.message) +
    `\n--- Attribution ---\n` +
    row("Landing page", lead.landingPage) +
    row("Referrer", lead.referrer) +
    row("UTM source", lead.utmSource) +
    row("UTM medium", lead.utmMedium) +
    row("UTM campaign", lead.utmCampaign) +
    row("UTM term", lead.utmTerm) +
    row("UTM content", lead.utmContent);

  await sendEmail(
    {
      to: LEAD_INBOX,
      // Reply goes straight to the prospect rather than to the sender
      // identity, so responding is one click.
      replyTo: lead.email,
      subject: `New ${label} enquiry${lead.name ? ` — ${lead.name}` : ""}`,
      text: body,
    },
    "notification",
  );
}

/**
 * What the visitor is told, per form.
 *
 * Deliberately promises a follow-up rather than confirming a slot. The strategy
 * modal collects no date, time or timezone — it is a REQUEST for a session, not
 * a booking — so copy that said "your session is confirmed for..." would be
 * describing something that does not exist yet.
 */
const ACKNOWLEDGEMENT: Record<
  string,
  { subject: string; lead: string; next: string }
> = {
  "strategy-session": {
    subject: "We've got your AI strategy session request",
    lead: "Thanks for asking for a free AI strategy session.",
    next: "One of our team will email you within one business day to agree a time that suits you. If you have a preferred day or timezone, just reply to this message and tell us.",
  },
  "idea-validation": {
    subject: "We've received your business idea",
    lead: "Thanks for sending your idea over for validation.",
    next: "We will review it and come back to you within one business day with what we found.",
  },
  contact: {
    subject: "Thanks for getting in touch with AIAutoMix",
    lead: "Thanks for contacting us.",
    next: "We will read your message and reply within one business day.",
  },
};

/**
 * Tells the visitor their submission was received.
 *
 * Sent to the address the visitor typed, which is unverified input — hence the
 * escaping on every interpolated value, and hence nothing sensitive in the
 * body. Somebody can put another person's address into a public form, so this
 * message must be harmless to receive unexpectedly: it confirms an enquiry and
 * carries no account, no link that grants access, and no personal data beyond
 * the name that was typed.
 */
export async function acknowledgeLead(lead: LeadInput): Promise<void> {
  const copy = ACKNOWLEDGEMENT[lead.source] ?? ACKNOWLEDGEMENT["contact"]!;

  const firstName = (lead.name ?? "").trim().split(/\s+/)[0] ?? "";
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  const text =
    `${greeting}\n\n` +
    `${copy.lead}\n\n` +
    `${copy.next}\n\n` +
    `— The AIAutoMix team\n` +
    `${LEAD_INBOX}\n`;

  const html =
    `<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #1a1a1a; max-width: 560px;">` +
    `<p>${escapeHtml(greeting)}</p>` +
    `<p>${escapeHtml(copy.lead)}</p>` +
    `<p>${escapeHtml(copy.next)}</p>` +
    `<p style="color: #666; font-size: 14px;">— The AIAutoMix team<br>` +
    `<a href="mailto:${escapeHtml(LEAD_INBOX)}">${escapeHtml(LEAD_INBOX)}</a></p>` +
    `</div>`;

  await sendEmail(
    { to: lead.email, subject: copy.subject, text, html },
    "acknowledgement",
  );
}
