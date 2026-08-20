/**
 * SMTP connectivity check.
 *
 * The smoke suite proves the transport is wired correctly. It cannot prove your
 * mailbox works — that needs a real connection to a real server with real
 * credentials, which is exactly the thing that fails at 9pm on launch day.
 *
 * So this connects, authenticates, and optionally sends one message:
 *
 *   npm run verify:email                     — connect and authenticate only
 *   npm run verify:email you@example.com     — and send a test to that address
 *
 * Reads `.env.local` the same way the application does. Prints no password, no
 * credential and no raw server response.
 *
 * Modelled on `scripts/research-live-check.tsx`: a deliberate, manually-invoked
 * check against a live third party, kept out of `npm test` so the suite stays
 * offline and deterministic.
 */

import nodemailer from "nodemailer";

import { mailerSender } from "@/features/communications/mailer";

const IMPLICIT_TLS_PORT = 465;

function main(): void {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const parsedPort = Number.parseInt(process.env.SMTP_PORT ?? "", 10);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 465;
  // Asked of the mailer rather than re-derived, so this prints what the
  // application will ACTUALLY send as. A second copy of the rule here is how a
  // check script ends up confidently reporting a value the app does not use.
  const configuredFrom = process.env.TRANSACTIONAL_EMAIL_FROM?.trim() || "";
  const from = mailerSender() ?? user;

  const recipient = process.argv[2];

  console.log("SMTP configuration");
  console.log(`  host      ${host ?? "(not set)"}`);
  console.log(
    `  port      ${port}${port === IMPLICIT_TLS_PORT ? " (implicit TLS)" : " (STARTTLS)"}`,
  );
  console.log(`  user      ${user ?? "(not set)"}`);
  console.log(`  password  ${pass ? "set" : "(not set)"}`);
  console.log(`  from      ${from ?? "(not set)"}`);
  if (configuredFrom && from && !configuredFrom.includes(addressOf(from))) {
    console.log("");
    console.log(
      `  NOTE  TRANSACTIONAL_EMAIL_FROM is "${configuredFrom}", but the mail`,
    );
    console.log(
      `        server only accepts the authenticated mailbox as the sender,`,
    );
    console.log(`        so mail is sent as "${from}" instead.`);
    console.log(
      `        To genuinely send as the other address, set SMTP_USER to it.`,
    );
  }
  console.log("");

  if (!host || !user || !pass) {
    console.log(
      "Not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env.local.",
    );
    console.log(
      "This is a supported state — the site runs and every send logs as SKIPPED.",
    );
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === IMPLICIT_TLS_PORT,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  void (async () => {
    try {
      // Connects, negotiates TLS and authenticates without sending anything.
      // This is the step that catches a wrong password or a blocked port.
      await transporter.verify();
      console.log("PASS  connected and authenticated");
    } catch (error) {
      console.log("FAIL  could not connect or authenticate");
      console.log(`      ${describe(error)}`);
      process.exit(1);
    }

    if (!recipient) {
      console.log("");
      console.log(
        "No recipient given, so nothing was sent. Pass an address to send a test:",
      );
      console.log("  npm run verify:email you@example.com");
      return;
    }

    try {
      const info = await transporter.sendMail({
        from,
        to: recipient,
        subject: "[TEST] AIAutoMix SMTP check",
        text:
          "This is a connectivity test from the AIAutoMix codebase.\n\n" +
          "If you are reading it, SMTP delivery works: the mailbox " +
          "authenticated, the envelope was accepted and the message arrived.\n\n" +
          "Nothing was recorded against a lead, a booking or a customer.\n",
      });
      console.log(`PASS  message accepted for ${recipient}`);
      console.log(`      message id ${info.messageId}`);
      console.log("");
      console.log(
        "Check the inbox AND the spam folder. Delivery to the server is not",
      );
      console.log(
        "delivery to the inbox — that needs SPF and DKIM on the domain.",
      );
    } catch (error) {
      console.log(`FAIL  the server rejected the message`);
      console.log(`      ${describe(error)}`);
      process.exit(1);
    }
  })();
}

/** The bare address out of "Display Name <address@host>". */
function addressOf(sender: string): string {
  const match = sender.match(/<\s*([^>]+)\s*>/);
  return (match ? match[1]! : sender).trim();
}

/**
 * A useful one-liner, without echoing the server's raw response.
 *
 * The common failures each have a specific cause worth naming, because the
 * generic text ("Invalid login") sends people to look at the wrong thing.
 */
function describe(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "EAUTH":
      return "Credentials rejected. SMTP_USER must be the FULL email address, and SMTP_PASS the mailbox password from hPanel → Emails — not your hPanel login.";
    case "ECONNECTION":
    case "ESOCKET":
      return "Could not reach the server. Check SMTP_HOST and SMTP_PORT, and whether your network blocks outbound SMTP.";
    case "ETIMEDOUT":
      return "Timed out. Port 465 is often blocked on home and office networks — try 587.";
    case "EENVELOPE":
      return "Sender or recipient rejected. TRANSACTIONAL_EMAIL_FROM must be a real mailbox on the domain you authenticated with.";
    default:
      return error instanceof Error
        ? error.message.slice(0, 200)
        : "Unknown failure.";
  }
}

main();
