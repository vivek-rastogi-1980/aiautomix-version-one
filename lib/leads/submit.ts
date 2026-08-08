import type { LeadSource } from "@/lib/validations/lead";

/**
 * Client-side lead submission.
 *
 * Shared by the contact form and the strategy-session modal so attribution is
 * captured identically by both — the previous `mailto:` handlers captured none
 * at all, which made paid and organic spend impossible to evaluate.
 *
 * Returns a discriminated result rather than throwing: a form needs to render
 * an error, not unwind.
 */

export interface LeadFields {
  name?: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
}

export type LeadResult =
  | { ok: true }
  | { ok: false; message: string; fields?: Record<string, string> };

const GENERIC_ERROR =
  "We couldn't send that. Please try again, or email contact@aiautomix.com.";

/**
 * Reads UTM parameters, landing page and referrer from the live document.
 *
 * Deliberately limited to campaign attribution and the entry page. No cookies,
 * no fingerprinting, no third-party identifiers — this is the minimum needed to
 * tell which campaign produced a lead.
 */
function attribution() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const get = (key: string) => params.get(key) ?? undefined;

  return {
    landingPage: window.location.pathname + window.location.search,
    // Same-origin referrers say nothing useful about acquisition.
    referrer:
      document.referrer && !document.referrer.includes(window.location.host)
        ? document.referrer
        : undefined,
    utmSource: get("utm_source"),
    utmMedium: get("utm_medium"),
    utmCampaign: get("utm_campaign"),
    utmTerm: get("utm_term"),
    utmContent: get("utm_content"),
  };
}

export async function submitLead(
  source: LeadSource,
  fields: LeadFields,
  /** Honeypot value. Non-empty means a bot filled a field humans cannot see. */
  honeypot = "",
): Promise<LeadResult> {
  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...fields,
        source,
        website: honeypot,
        ...attribution(),
      }),
    });

    if (response.ok) return { ok: true };

    const payload = await response.json().catch(() => null);
    const error = payload?.error;
    return {
      ok: false,
      message: error?.message ?? GENERIC_ERROR,
      fields: error?.fields,
    };
  } catch {
    // Network failure or the request never left the browser.
    return { ok: false, message: GENERIC_ERROR };
  }
}
