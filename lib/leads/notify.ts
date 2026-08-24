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
 * message must be harmless to receive unexpectedly.
 *
 * ---------------------------------------------------------------------------
 * On the activation link
 * ---------------------------------------------------------------------------
 * This used to carry "no link that grants access", for the reason above. It now
 * carries one for the two funnel sources, and that is safe for the same reason
 * a magic link is: the link reaches ONLY the address it authenticates. Typing
 * somebody else's address into the form emails THEM a way into their own
 * workspace — it hands the sender nothing.
 *
 * The alternative was worse. The homepage forms are the ones most visitors
 * actually use, and they sent this acknowledgement with no way in at all, while
 * `/validate-your-idea` sent a proper activation email. The same submission got
 * two different outcomes depending on which page it came from.
 *
 * The contact form still gets no link. Somebody asking a question has not asked
 * for an account, and provisioning one uninvited is not an acknowledgement.
 */
export async function acknowledgeLead(
  lead: LeadInput,
  /** Only supplied for funnel sources; contact enquiries never get one. */
  activationUrl?: string | null,
): Promise<void> {
  const copy = ACKNOWLEDGEMENT[lead.source] ?? ACKNOWLEDGEMENT["contact"]!;

  const firstName = (lead.name ?? "").trim().split(/\s+/)[0] ?? "";
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  // Empty when the mint failed, or when this is a contact enquiry. The message
  // still has to read as a complete acknowledgement without it — a dead button
  // is worse than no button.
  const linkText = activationUrl
    ? `Open your workspace and choose a password:\n${activationUrl}\n\n` +
      `The link can only be used once. If it has expired by the time you ` +
      `get to it, request a new one from the login page.\n\n`
    : "";

  const linkHtml = activationUrl
    ? `<p style="margin: 28px 0;"><a href="${escapeHtml(activationUrl)}" ` +
      `style="background: #5b5bd6; color: #ffffff; text-decoration: none; ` +
      `padding: 12px 22px; border-radius: 8px; display: inline-block; ` +
      `font-weight: 600;">Open my workspace and set a password</a></p>` +
      `<p style="color: #666; font-size: 14px; word-break: break-all;">` +
      `If the button does not work, paste this into your browser:<br>` +
      `${escapeHtml(activationUrl)}</p>` +
      `<p style="color: #666; font-size: 14px;">The link can only be used ` +
      `once. If it has expired by the time you get to it, request a new one ` +
      `from the login page.</p>`
    : "";

  const text =
    `${greeting}\n\n` +
    `${copy.lead}\n\n` +
    `${linkText}` +
    `${copy.next}\n\n` +
    `— The AIAutoMix team\n` +
    `${LEAD_INBOX}\n`;

  const html =
    `<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #1a1a1a; max-width: 560px;">` +
    `<p>${escapeHtml(greeting)}</p>` +
    `<p>${escapeHtml(copy.lead)}</p>` +
    `${linkHtml}` +
    `<p>${escapeHtml(copy.next)}</p>` +
    `<p style="color: #666; font-size: 14px;">— The AIAutoMix team<br>` +
    `<a href="mailto:${escapeHtml(LEAD_INBOX)}">${escapeHtml(LEAD_INBOX)}</a></p>` +
    `</div>`;

  await sendEmail(
    { to: lead.email, subject: copy.subject, text, html },
    "acknowledgement",
  );
}
