/**
 * The email template engine.
 *
 * ---------------------------------------------------------------------------
 * What this is NOT
 * ---------------------------------------------------------------------------
 * It is not a template language. There are no conditionals, no loops, no
 * expressions, no filters and no function calls — because every one of those
 * features is a way for an admin-authored string to become executable, and the
 * people who write these templates are not the people who should be able to run
 * code on the server.
 *
 * `eval`, `new Function`, `vm`, tagged templates and dynamic `import` are all
 * absent, and the test suite asserts their absence by scanning this file. The
 * whole engine is one regex over a closed list of variable names.
 *
 * ---------------------------------------------------------------------------
 * The three rules
 * ---------------------------------------------------------------------------
 *   CLOSED VOCABULARY.  A placeholder that is not in `TEMPLATE_VARIABLES` is a
 *                       validation error at save time, not a silent blank at
 *                       send time. An admin who typos `{{user.frist_name}}`
 *                       finds out immediately rather than after a thousand
 *                       emails go out addressed to nobody.
 *
 *   VALUES ARE ESCAPED. Substituted values are HTML-escaped in the HTML body,
 *                       always, with no opt-out. A business idea title
 *                       containing `<script>` is a real thing a visitor can
 *                       type into a public form, and it must arrive in an inbox
 *                       as text.
 *
 *   URLS ARE CHECKED.   A value used as a URL is parsed and must be http(s).
 *                       `javascript:` in an href is the oldest injection there
 *                       is and it survives HTML escaping.
 *
 * A plain module: no I/O, no clock, no randomness. Pure functions all the way
 * down, which is what makes the security properties testable.
 */

// ---------------------------------------------------------------------------
// The closed variable vocabulary
// ---------------------------------------------------------------------------

/**
 * Every variable a template may reference.
 *
 * `isUrl` marks the ones that end up in an href. Those get parsed rather than
 * merely escaped, because escaping does nothing to `javascript:alert(1)`.
 */
export const TEMPLATE_VARIABLES = [
  { key: "user.first_name", label: "First name", isUrl: false },
  { key: "user.last_name", label: "Last name", isUrl: false },
  { key: "user.email", label: "Email address", isUrl: false },
  { key: "workspace.name", label: "Workspace name", isUrl: false },
  { key: "business_idea.title", label: "Business idea title", isUrl: false },
  { key: "business_idea.industry", label: "Industry", isUrl: false },
  { key: "validation.score", label: "Validation score", isUrl: false },
  { key: "validation.status", label: "Validation status", isUrl: false },
  { key: "validation.report_url", label: "Report link", isUrl: true },
  { key: "validation.pdf_url", label: "PDF download link", isUrl: true },
  { key: "booking.date", label: "Booking date", isUrl: false },
  { key: "booking.time", label: "Booking time", isUrl: false },
  { key: "booking.timezone", label: "Booking timezone", isUrl: false },
  { key: "booking.meeting_url", label: "Meeting link", isUrl: true },
  { key: "activation_url", label: "Activation link", isUrl: true },
  { key: "dashboard_url", label: "Dashboard link", isUrl: true },
  { key: "support_email", label: "Support email", isUrl: false },
] as const;

export type TemplateVariableKey = (typeof TEMPLATE_VARIABLES)[number]["key"];

const VARIABLE_KEYS = new Set<string>(
  TEMPLATE_VARIABLES.map((variable) => variable.key),
);

const URL_KEYS = new Set<string>(
  TEMPLATE_VARIABLES.filter((variable) => variable.isUrl).map((v) => v.key),
);

export function isTemplateVariable(key: string): key is TemplateVariableKey {
  return VARIABLE_KEYS.has(key);
}

export function isUrlVariable(key: string): boolean {
  return URL_KEYS.has(key);
}

/**
 * The placeholder pattern.
 *
 * Deliberately narrow: lower-case words, dots and underscores only, with
 * optional surrounding spaces. It cannot match an expression, a function call,
 * a subscript or anything with a bracket in it — so there is no syntax here for
 * an attacker to reach for even before the vocabulary check runs.
 */
const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*)\s*\}\}/g;

export type TemplateContext = Partial<Record<TemplateVariableKey, string>>;

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

/** HTML-escape. Applied to every substituted value in an HTML body, always. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A URL safe to put in an href, or null.
 *
 * Only http and https survive. `javascript:`, `data:`, `vbscript:` and every
 * other scheme are rejected outright rather than sanitised, because a
 * partially-sanitised URL scheme is a puzzle for an attacker rather than a wall.
 */
export function safeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface TemplateIssue {
  variable: string;
  message: string;
}

/**
 * Which variables does this template reference, and are they all real?
 *
 * Run at SAVE time. §"Email variables": unknown variables must not silently
 * execute anything — and the friendlier half of that is that they must not
 * silently render as an empty string either, which is how a template ships
 * saying "Hello ," to ten thousand people.
 */
export function validateTemplate(source: string): {
  ok: boolean;
  used: string[];
  issues: TemplateIssue[];
} {
  const used = new Set<string>();
  const issues: TemplateIssue[] = [];

  for (const match of source.matchAll(PLACEHOLDER)) {
    const key = match[1]!;
    used.add(key);
    if (!isTemplateVariable(key)) {
      issues.push({
        variable: key,
        message: `{{${key}}} is not a variable this system provides.`,
      });
    }
  }

  // A brace pair that the strict pattern did not match is almost always a typo
  // — `{{ user.first name }}`, `{{user.first_name}` — and silently leaving it
  // in the body means it ships to a customer verbatim.
  const loose = source.match(/\{\{[^}]*\}\}/g) ?? [];
  for (const raw of loose) {
    PLACEHOLDER.lastIndex = 0;
    if (!PLACEHOLDER.test(raw)) {
      issues.push({
        variable: raw,
        message: `${raw} is not a valid placeholder. Use {{group.name}} with lower-case letters, digits and underscores.`,
      });
    }
  }

  return { ok: issues.length === 0, used: [...used], issues };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderResult {
  output: string;
  /** Variables the template used that the context did not supply. */
  missing: string[];
  /** URL variables whose value was rejected as unsafe. */
  rejectedUrls: string[];
}

/**
 * Render a template.
 *
 * `html` decides escaping: an HTML body escapes every value, a plain-text body
 * does not (there is nothing to escape into) but still refuses unsafe URLs,
 * because a text email is rendered as clickable links by every mail client.
 *
 * An unknown placeholder is left VERBATIM rather than blanked. That is
 * deliberate: a visible `{{oops}}` in a test send is a bug someone fixes, and a
 * silent empty string is a bug that ships.
 */
export function renderTemplate(
  source: string,
  context: TemplateContext,
  options: { html: boolean } = { html: true },
): RenderResult {
  const missing: string[] = [];
  const rejectedUrls: string[] = [];

  const output = source.replace(PLACEHOLDER, (whole, rawKey: string) => {
    if (!isTemplateVariable(rawKey)) return whole;

    const value = context[rawKey];
    if (value === undefined || value === null || value === "") {
      missing.push(rawKey);
      return "";
    }

    if (isUrlVariable(rawKey)) {
      const url = safeUrl(String(value));
      if (url === null) {
        rejectedUrls.push(rawKey);
        return "";
      }
      // Escaped even though it parsed: a valid URL can still contain `&` and
      // quotes that break out of an attribute.
      return options.html ? escapeHtml(url) : url;
    }

    return options.html ? escapeHtml(String(value)) : String(value);
  });

  return { output, missing, rejectedUrls };
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

/**
 * Sample values for the admin preview.
 *
 * Obviously fictional, and never drawn from a real record. §"Email preview" is
 * explicit that real user information must not appear here — an admin
 * previewing a template should not be reading a customer's business idea as a
 * side effect.
 */
export const PREVIEW_CONTEXT: Record<TemplateVariableKey, string> = {
  "user.first_name": "Vivek",
  "user.last_name": "Sample",
  "user.email": "sample.visitor@example.com",
  "workspace.name": "Sample Workspace",
  "business_idea.title": "AI appointment management for dental clinics",
  "business_idea.industry": "Healthcare software",
  "validation.score": "78",
  "validation.status": "Completed",
  "validation.report_url": "https://example.com/reports/sample",
  "validation.pdf_url": "https://example.com/reports/sample.pdf",
  "booking.date": "12 March 2026",
  "booking.time": "3:00 PM",
  "booking.timezone": "Asia/Kolkata",
  "booking.meeting_url": "https://example.com/meet/sample",
  activation_url: "https://example.com/activate/sample",
  dashboard_url: "https://example.com/dashboard",
  support_email: "support@example.com",
};

export function previewTemplate(
  subject: string,
  bodyHtml: string,
): { subject: string; bodyHtml: string; missing: string[] } {
  const renderedSubject = renderTemplate(subject, PREVIEW_CONTEXT, {
    html: false,
  });
  const renderedBody = renderTemplate(bodyHtml, PREVIEW_CONTEXT, {
    html: true,
  });

  return {
    subject: renderedSubject.output,
    bodyHtml: renderedBody.output,
    missing: [
      ...new Set([...renderedSubject.missing, ...renderedBody.missing]),
    ],
  };
}
