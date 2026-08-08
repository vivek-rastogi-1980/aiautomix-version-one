import "server-only";

import type { LeadInput } from "@/lib/validations/lead";

/**
 * Best-effort email notification for a new lead.
 *
 * Uses Resend's REST API through `fetch` rather than its SDK — one less
 * dependency for what is a single POST, and nothing here needs the SDK's
 * surface.
 *
 * "Best-effort" is the important word. The lead is already committed to the
 * database before this runs, so a missing API key, a provider outage or a
 * bounced send costs a notification, never the lead itself. That ordering is
 * the whole reason the table exists: email is a convenience layer over durable
 * storage, not the system of record.
 *
 * Unconfigured is a supported state, not an error — the site runs fine without
 * `RESEND_API_KEY`, and leads still arrive in Supabase.
 */

const LEAD_INBOX =
  process.env.LEAD_NOTIFICATION_EMAIL ?? "contact@aiautomix.com";
const FROM_ADDRESS =
  process.env.LEAD_NOTIFICATION_FROM ?? "AIAutoMix <onboarding@resend.dev>";

const SOURCE_LABEL: Record<string, string> = {
  contact: "Contact form",
  "strategy-session": "Free AI Strategy Session",
  "idea-validation": "Business Idea Validation",
};

function row(label: string, value: string | undefined | null): string {
  if (!value) return "";
  return `${label}: ${value}\n`;
}

export async function notifyNewLead(lead: LeadInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

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

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [LEAD_INBOX],
        // Reply goes straight to the prospect rather than to the sender
        // identity, so responding is one click.
        reply_to: lead.email,
        subject: `New ${label} enquiry${lead.name ? ` — ${lead.name}` : ""}`,
        text: body,
      }),
    });

    if (!response.ok) {
      console.error(
        "[leads] notification failed",
        response.status,
        await response.text().catch(() => ""),
      );
    }
  } catch (error) {
    // Never rethrow: the caller has already persisted the lead, and a failed
    // notification must not turn a captured lead into a 500 for the visitor.
    console.error("[leads] notification threw", error);
  }
}
