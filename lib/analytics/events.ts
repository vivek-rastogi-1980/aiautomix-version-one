/**
 * Conversion event tracking (SPRINT-06 S06-10).
 *
 * GA4 was loaded but only ever recorded pageviews, so there was no way to tell
 * whether any call to action worked. These are the nine events the sprint
 * names, defined once as a typed union so a call site cannot invent a name that
 * silently never reports.
 *
 * PRIVACY — the rule this module exists to enforce:
 * never send personally identifying data to analytics. No name, no email, no
 * phone, no company, no free-text message. The payloads below are deliberately
 * limited to non-identifying context — which form, which page, which campaign.
 * That is enough to optimise a funnel and not enough to identify a person, and
 * it keeps GA4 out of scope for the consent and data-processing obligations
 * that PII would create across the US, UK, EU and India markets.
 *
 * Safe when analytics is not configured: `gtag` is only defined once GA loads,
 * and every helper is a no-op without it. Nothing here throws.
 */

export type AnalyticsEvent =
  | "contact_form_submit"
  | "book_consultation"
  | "whatsapp_click"
  | "phone_click"
  | "email_click"
  | "service_cta_click"
  | "idea_validator_started"
  | "idea_validator_completed"
  | "ai_demo_started";

/**
 * Non-identifying context only. The absence of a `name`/`email`/`message` field
 * here is the enforcement mechanism — TypeScript rejects them at the call site.
 */
export interface AnalyticsPayload {
  /** Which form or surface produced the event, e.g. "strategy-session". */
  source?: string;
  /** Page path the event fired on. Path only — never the query string, which
   *  can carry an email in a prefilled link. */
  page?: string;
  /** Campaign attribution, when present in the URL. */
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  /** Free label for a CTA, e.g. "hero" or "pricing". Author-supplied, never
   *  user input. */
  label?: string;
}

type GtagFn = (
  command: "event" | "config" | "js",
  targetOrName: string | Date,
  params?: Record<string, unknown>,
) => void;

function gtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const fn = (window as unknown as { gtag?: GtagFn }).gtag;
  return typeof fn === "function" ? fn : null;
}

/** Campaign parameters from the current URL, if any. */
function campaign(): Pick<
  AnalyticsPayload,
  "utm_source" | "utm_medium" | "utm_campaign"
> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const pick = (key: string) => params.get(key) ?? undefined;
  return {
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
  };
}

/**
 * Record a conversion event. No-op when analytics is not configured, so call
 * sites never need to check.
 */
export function trackEvent(
  event: AnalyticsEvent,
  payload: AnalyticsPayload = {},
): void {
  const send = gtag();
  if (!send) return;

  // `pathname` only — `search` can contain a prefilled email or token.
  const page =
    payload.page ??
    (typeof window !== "undefined" ? window.location.pathname : undefined);

  const params: Record<string, unknown> = {
    ...campaign(),
    ...payload,
    page,
  };

  // Drop empty keys so GA4 reports do not fill with "(not set)".
  for (const key of Object.keys(params)) {
    if (params[key] === undefined || params[key] === "") delete params[key];
  }

  try {
    send("event", event, params);
  } catch {
    // Analytics must never break a conversion it is only meant to observe.
  }
}

/**
 * Outbound-contact helper for `tel:`, `mailto:` and WhatsApp links.
 *
 * Takes the channel rather than the address on purpose: the destination is a
 * phone number or email address, which is exactly the PII this module refuses
 * to send.
 */
export function trackContactClick(
  channel: "phone" | "email" | "whatsapp",
  label?: string,
): void {
  const event: AnalyticsEvent =
    channel === "phone"
      ? "phone_click"
      : channel === "email"
        ? "email_click"
        : "whatsapp_click";
  trackEvent(event, { label });
}
