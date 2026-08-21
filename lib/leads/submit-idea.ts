/**
 * Client-side submission for the "Validate Your Idea" funnel.
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 * ---------------------------------------------------------------------------
 * The `/validate-your-idea` page had no submission at all. Its handler
 * validated the fields, set `submitted: true` to render "Your validation is
 * running", and returned — sending nothing anywhere. Every visitor who filled
 * that form saw a success screen and their idea was discarded.
 *
 * That is the same failure `lib/leads/submit.ts` was written to fix on the
 * home-page modal, where the old `mailto:` handler "meant the success state was
 * shown even when no mail client existed and the lead was simply lost". The
 * fix landed on one form and not the other.
 *
 * ---------------------------------------------------------------------------
 * Why not just reuse `submitLead`
 * ---------------------------------------------------------------------------
 * `submitLead` posts to `/api/leads`, which captures a lead and stops there.
 * This page is the PRIMARY funnel: it should also provision an account, create
 * a workspace and start a validation, which is what
 * `/api/onboarding/validate-idea` does. Same visitor, a much larger promise —
 * so it gets the endpoint that can keep it.
 *
 * Attribution is captured identically to `submitLead`: campaign parameters and
 * the entry page only. No cookies, no fingerprinting, no third-party ids.
 */

export interface IdeaFields {
  /** The page collects one name field; it is split for the funnel's schema. */
  name: string;
  email: string;
  industry?: string;
  idea: string;
  phone?: string;
}

export type IdeaResult =
  | { ok: true; activationSent: boolean; message: string; duplicate: boolean }
  | { ok: false; message: string };

const GENERIC_ERROR =
  "We couldn't send that. Please try again, or email contact@aiautomix.com.";

function attribution() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const get = (key: string) => params.get(key) ?? undefined;

  return {
    landingPage: window.location.pathname + window.location.search,
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

/**
 * Split a single free-text name into first and last.
 *
 * The funnel schema requires a first name. The page asks for "Full name", so
 * the split happens here rather than by adding a field to a converting form —
 * §2 is explicit that the first form stays conversion-focused.
 *
 * Everything after the first token becomes the surname, which handles
 * multi-part family names correctly and degrades to an empty last name for
 * someone who types one word.
 */
export function splitName(full: string): { first: string; last?: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "" };
  const [first, ...rest] = parts;
  return { first: first!, last: rest.length > 0 ? rest.join(" ") : undefined };
}

export async function submitIdea(
  fields: IdeaFields,
  /** Honeypot. Non-empty means a bot filled a field humans cannot see. */
  honeypot = "",
): Promise<IdeaResult> {
  const { first, last } = splitName(fields.name);

  try {
    const response = await fetch("/api/onboarding/validate-idea", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: first,
        lastName: last,
        email: fields.email,
        phone: fields.phone,
        businessIdea: fields.idea,
        industry: fields.industry,
        company_website: honeypot,
        ...attribution(),
      }),
    });

    const payload = await response.json().catch(() => null);

    if (response.ok && payload?.success) {
      const data = payload.data ?? {};
      return {
        ok: true,
        activationSent: data.activationSent === true,
        duplicate: data.duplicate === true,
        message:
          typeof data.message === "string" ? data.message : "We have your idea.",
      };
    }

    return {
      ok: false,
      message: payload?.error?.message ?? GENERIC_ERROR,
    };
  } catch {
    // Network failure, or the request never left the browser.
    return { ok: false, message: GENERIC_ERROR };
  }
}
