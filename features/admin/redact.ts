import "server-only";

/**
 * Output redaction for admin surfaces.
 *
 * ADMIN-SECURITY-SPEC.md forbids provider credentials reaching the UI and
 * requires prompts/responses to be redacted "where necessary". The admin panel
 * shows AI request detail, which is the one place raw model input and output
 * would otherwise be rendered — to staff, about customers.
 *
 * Two independent concerns, handled separately below:
 *
 *   1. SECRETS must never render, at all, for anyone. A key that leaks into a
 *      prompt (a user pasting their own config, an error string carrying an
 *      Authorization header) would otherwise be displayed and, worse, screenshot
 *      into a ticket. `redactSecrets` is applied to every string this module
 *      emits — it is not optional and not permission-gated, because no admin
 *      role has a legitimate need to read a credential.
 *
 *   2. CUSTOMER CONTENT is business data, not a secret. Staff with `ai.read`
 *      may need it to diagnose a failure. It is truncated rather than hidden,
 *      so a support agent sees enough to recognise the shape of a request
 *      without the panel becoming a bulk export of customer thinking.
 */

/**
 * Patterns for credentials that must never be displayed.
 *
 * Deliberately broad. A false positive costs a support agent some context; a
 * false negative puts a live key on a screen and into whatever comes next.
 *
 * Note the absence of a leading word-boundary anchor on the key patterns.
 * Requiring one before `sk-` means a key concatenated straight onto other
 * word characters escapes redaction entirely - a hole the test suite caught.
 * The trailing anchor is kept so a match ends cleanly.
 */
const SECRET_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  // OpenAI: sk-…, sk-proj-…, and the org/project variants.
  { label: "OPENAI_KEY", pattern: /sk-[A-Za-z0-9_-]{16,}\b/g },
  // Anthropic.
  { label: "ANTHROPIC_KEY", pattern: /sk-ant-[A-Za-z0-9_-]{16,}\b/g },
  // Supabase / any JWT: three base64url segments.
  {
    label: "JWT",
    pattern: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  },
  // Supabase publishable/secret key format.
  {
    label: "SUPABASE_KEY",
    pattern: /sb_(?:publishable|secret)_[A-Za-z0-9_-]{16,}\b/g,
  },
  // Generic bearer tokens in copied headers.
  { label: "BEARER", pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi },
  // Postgres / connection URIs, which carry a password inline.
  { label: "DB_URI", pattern: /\bpostgres(?:ql)?:\/\/[^\s"']+/gi },
  // `KEY=value` shapes for anything that names itself a secret.
  {
    label: "ENV_SECRET",
    pattern:
      /\b([A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z0-9_]*)\s*[=:]\s*["']?[^\s"',;]{8,}["']?/g,
  },
];

/**
 * Replace anything that looks like a credential with a labelled placeholder.
 *
 * The label is kept so an operator can tell *that* a secret was present — which
 * is itself a signal worth acting on — without seeing its value.
 */
export function redactSecrets(input: string | null | undefined): string {
  if (!input) return "";
  let out = input;
  for (const { label, pattern } of SECRET_PATTERNS) {
    // `pattern` carries /g; reset so repeated calls do not skip matches.
    pattern.lastIndex = 0;
    out = out.replace(pattern, `[REDACTED:${label}]`);
  }
  return out;
}

/** True when the raw text contained something that had to be redacted. */
export function containsSecret(input: string | null | undefined): boolean {
  if (!input) return false;
  return redactSecrets(input) !== input;
}

const DEFAULT_PREVIEW = 600;

/**
 * Redact, then truncate, for display in the admin UI.
 *
 * Order matters: truncating first could cut a key in half and leave a fragment
 * that the patterns no longer match but a reader still recognises.
 */
export function safePreview(
  input: unknown,
  maxLength = DEFAULT_PREVIEW,
): { text: string; truncated: boolean; hadSecret: boolean } {
  const raw =
    typeof input === "string"
      ? input
      : input == null
        ? ""
        : JSON.stringify(input, null, 2);

  const hadSecret = containsSecret(raw);
  const redacted = redactSecrets(raw);
  const truncated = redacted.length > maxLength;

  return {
    text: truncated ? `${redacted.slice(0, maxLength)}…` : redacted,
    truncated,
    hadSecret,
  };
}

/**
 * Redact a JSON blob recursively — used for audit `before`/`after` snapshots.
 *
 * Keys whose *name* implies a secret are dropped entirely rather than
 * pattern-matched, because a short or unusual value would slip past the regexes
 * while the key name says exactly what it is.
 */
const SECRET_KEY = /(key|secret|token|password|credential|authorization)/i;

export function redactJson(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[REDACTED:DEPTH]";
  if (value == null) return value;
  if (typeof value === "string") return redactSecrets(value);
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((v) => redactJson(v, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k)
        ? "[REDACTED:KEY_NAME]"
        : redactJson(v, depth + 1);
    }
    return out;
  }

  return "[REDACTED:UNKNOWN_TYPE]";
}
