import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

/**
 * The mail transport. One SMTP connection, one place.
 *
 * ---------------------------------------------------------------------------
 * Why SMTP rather than a provider API
 * ---------------------------------------------------------------------------
 * This used to POST to Resend. SMTP replaces it because it needs no third-party
 * account at all: the platform sends through the same Hostinger mailbox the
 * business already owns and already reads. One fewer vendor, one fewer API key,
 * and the "from" address is a real inbox somebody can reply to.
 *
 * The trade is one dependency (`nodemailer`) for what was a single `fetch`.
 * Worth it — SMTP is a stateful, multi-step protocol with TLS negotiation, and
 * hand-rolling it would be considerably more code than the client it replaces,
 * with more ways to be subtly wrong.
 *
 * ---------------------------------------------------------------------------
 * Hostinger specifics, because they are the things that actually break
 * ---------------------------------------------------------------------------
 *   HOST    smtp.hostinger.com
 *   PORT    465 with implicit TLS (recommended), or 587 with STARTTLS
 *   USER    the FULL email address, not the local part — `info@example.com`,
 *           never `info`
 *   PASS    the mailbox password, set in hPanel → Emails. Not the hPanel
 *           account password.
 *
 * And the one that produces a silent, confusing failure: the sender must BE the
 * authenticated mailbox. Hostinger rejects a `from` that does not match
 * `SMTP_USER`, after a successful login — so it looks like an outage rather
 * than a typo. `senderFor` below pins the address to the authenticated mailbox
 * and keeps only the display name, so that mistake cannot silently swallow
 * every email.
 *
 * ---------------------------------------------------------------------------
 * Unconfigured is a supported state
 * ---------------------------------------------------------------------------
 * Exactly as before. With no SMTP credentials the site runs, leads still land
 * in Supabase, and every send resolves as SKIPPED rather than throwing. The
 * distinction between "we chose not to send" and "we tried and failed" is
 * load-bearing for support, so it survives the provider swap intact.
 */

export const PROVIDER_ID = "smtp";

/** Implicit TLS on 465; STARTTLS on 587 and anything else. */
const IMPLICIT_TLS_PORT = 465;

/**
 * How long to wait before giving up.
 *
 * SMTP is a conversation, and a wedged one blocks the request that started it.
 * `notifyNewLead` is awaited inside a public form POST, so an unbounded wait
 * here is a visitor watching a spinner because a mail server is slow. Ten
 * seconds to connect, twenty for the whole exchange; past that the lead is
 * already saved and the notification is not worth the wait.
 */
const CONNECTION_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 20_000;

export interface MailMessage {
  to: string;
  subject: string;
  /** At least one of `html` or `text` must be present. */
  html?: string | null;
  text?: string | null;
  replyTo?: string | null;
}

export type DeliveryResult =
  | { ok: true; messageId: string | null }
  | { ok: false; code: string; message: string; skipped?: boolean };

interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

/**
 * Read the SMTP settings, or null when the transport is not configured.
 *
 * Returns null if ANY of host, user or password is missing rather than
 * half-configuring: a transporter built from two of the three fails at connect
 * time with an error that looks like an outage instead of a missing setting.
 */
function settings(): SmtpSettings | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  const parsedPort = Number.parseInt(process.env.SMTP_PORT ?? "", 10);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 465;

  const configuredFrom =
    process.env.TRANSACTIONAL_EMAIL_FROM?.trim() ||
    process.env.LEAD_NOTIFICATION_FROM?.trim() ||
    "";

  return { host, port, user, pass, from: senderFor(configuredFrom, user) };
}

/**
 * Pin the sender address to the authenticated mailbox, keeping the display name.
 *
 * ---------------------------------------------------------------------------
 * The failure this exists to prevent
 * ---------------------------------------------------------------------------
 * Hostinger — and every other shared host — accepts a connection, authenticates
 * it, and THEN rejects the message if the From address is not the mailbox that
 * authenticated. Authenticate as `contact@` and send as `info@` and you get a
 * clean login followed by nothing arriving, which reads as "email is broken"
 * rather than as a one-word configuration mistake.
 *
 * It is a genuinely easy mistake: the two settings sit in different sections of
 * the env file and both look correct on their own.
 *
 * So the address is taken from `SMTP_USER` and only the display name is honoured
 * from the configured value:
 *
 *   SMTP_USER=contact@aiautomix.com
 *   TRANSACTIONAL_EMAIL_FROM=AIAutoMix <info@aiautomix.com>
 *   →  "AIAutoMix <contact@aiautomix.com>"
 *
 * Rewriting rather than failing is the right trade: the alternative is refusing
 * to send at all over a cosmetic field. But it is not done silently — the
 * override is warned about below, and the admin panel shows the address in use.
 *
 * To genuinely send as a different mailbox, authenticate as that mailbox: set
 * `SMTP_USER` to it. That is the only thing the mail server will accept, and no
 * amount of configuration here can change it.
 */
function senderFor(configured: string, user: string): string {
  if (!configured) return user;

  // "Display Name <address@host>" or a bare address.
  const match = configured.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  const displayName = match ? match[1]!.replace(/^"|"$/g, "").trim() : "";
  const address = (match ? match[2]! : configured).trim();

  if (address.toLowerCase() === user.toLowerCase()) return configured;

  warnOnce(
    `[mail] TRANSACTIONAL_EMAIL_FROM is "${address}" but SMTP_USER is "${user}". ` +
      `The mail server only accepts the authenticated mailbox as the sender, so ` +
      `mail is being sent as "${user}" instead. To send as "${address}", set ` +
      `SMTP_USER to that mailbox.`,
  );

  return displayName ? `${displayName} <${user}>` : user;
}

/**
 * Warn about a misconfiguration once, not once per email.
 *
 * A warning repeated on every send is a warning nobody reads, and this one
 * fires on a path that can run hundreds of times an hour.
 */
const warned = new Set<string>();
function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

/** Is the transport configured at all? Env presence only — never the value. */
export function mailerConfigured(): boolean {
  return settings() !== null;
}

/** The `from` header in use, for display in the admin panel. Never the password. */
export function mailerSender(): string | null {
  return settings()?.from ?? null;
}

/**
 * The cached transporter.
 *
 * Built once and reused: constructing one per send means a fresh TCP connection
 * and TLS handshake for every email, which is the difference between a
 * confirmation going out in 200ms and in two seconds.
 *
 * Deliberately NOT pooled. A pool keeps sockets open between sends, which is
 * right for a long-lived server and wrong for a serverless runtime that may
 * freeze the process mid-connection and resume holding a dead socket. Without
 * the pool, nodemailer opens and closes per send and both deployment shapes
 * behave the same — a small cost for not having a failure mode that only
 * appears in production.
 */
let cached: { transporter: Transporter; signature: string } | null = null;

function transporterFor(config: SmtpSettings): Transporter {
  // Rebuild if the credentials changed under us (a redeployed env var). The
  // signature excludes the password so it never sits in memory twice.
  const signature = `${config.host}:${config.port}:${config.user}`;
  if (cached && cached.signature === signature) return cached.transporter;

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // Implicit TLS on 465. On 587 nodemailer negotiates STARTTLS and will
    // refuse to continue in plaintext if the server does not offer it, so this
    // is not a downgrade path.
    secure: config.port === IMPLICIT_TLS_PORT,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });

  cached = { transporter, signature };
  return transporter;
}

/**
 * Turn a nodemailer failure into a stable code and a safe message.
 *
 * Two reasons this is not just `error.message`. The message is written to
 * `email_logs.error_message`, which is capped at 2000 characters and read by
 * support — so it needs to be short and actionable. And a raw SMTP error can
 * quote the server's response verbatim, which may echo the envelope, so it is
 * truncated rather than passed through whole.
 *
 * The codes are the ones worth telling apart. `EAUTH` in particular is almost
 * always a real, fixable configuration mistake rather than an outage, and
 * saying so saves an hour of looking at the wrong thing.
 */
function classify(error: unknown): { code: string; message: string } {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "EAUTH":
      return {
        code: "SMTP_AUTH_FAILED",
        message:
          "The mail server rejected the credentials. Check SMTP_USER is the full email address and SMTP_PASS is the mailbox password.",
      };
    case "ECONNECTION":
    case "ESOCKET":
      return {
        code: "SMTP_CONNECTION_FAILED",
        message:
          "Could not reach the mail server. Check SMTP_HOST and SMTP_PORT, and that outbound SMTP is not blocked.",
      };
    case "ETIMEDOUT":
      return {
        code: "SMTP_TIMEOUT",
        message: "The mail server did not respond in time.",
      };
    case "EENVELOPE":
      return {
        code: "SMTP_ENVELOPE_REJECTED",
        message:
          "The mail server rejected the sender or the recipient. The from address must be a real mailbox on the authenticated domain.",
      };
    default:
      return {
        code: code ? `SMTP_${code}`.slice(0, 60) : "SMTP_ERROR",
        message:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "The message could not be sent.",
      };
  }
}

/**
 * Send one message.
 *
 * Returns a result rather than throwing, in every case. Callers have already
 * committed the business fact — the lead, the booking, the report — before
 * reaching here, and none of them may turn a saved record into a failed request
 * because mail did not go out.
 */
export async function sendMail(message: MailMessage): Promise<DeliveryResult> {
  const config = settings();

  if (!config) {
    return {
      ok: false,
      code: "PROVIDER_NOT_CONFIGURED",
      message:
        "No email provider is configured, so nothing was sent. Set SMTP_HOST, SMTP_USER and SMTP_PASS to enable delivery.",
      skipped: true,
    };
  }

  if (!message.html && !message.text) {
    return {
      ok: false,
      code: "EMPTY_MESSAGE",
      message: "The message had no body, so it was not sent.",
    };
  }

  try {
    const info = await transporterFor(config).sendMail({
      from: config.from,
      to: message.to,
      subject: message.subject,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      ...(message.text ? { text: message.text } : {}),
      ...(message.html ? { html: message.html } : {}),
    });

    return {
      ok: true,
      messageId: typeof info.messageId === "string" ? info.messageId : null,
    };
  } catch (error) {
    const classified = classify(error);
    // Logged for operators with the code only. The full error can quote the
    // server's response, which may echo the envelope — that belongs nowhere
    // near a log line that gets pasted into a chat.
    console.error("[mail] send failed", classified.code);
    return { ok: false, ...classified };
  }
}
