import { z } from "zod";

/**
 * Shared text-field builders for user-supplied input.
 *
 * Every AI workflow's input schema uses these, so sanitisation happens the same
 * way everywhere: characters that would corrupt a prompt or a PDF are stripped
 * before validation, not after (CODING-STANDARDS: no duplicated logic).
 */

const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const C0_END = 0x20;
const C1_START = 0x7f;
const C1_END = 0x9f;

/**
 * Remove C0 and C1 control characters, keeping tab, newline and carriage
 * return — multi-line input (plan sections, long descriptions) must survive.
 *
 * Written as a code-point scan rather than a regex character class so the
 * intent is readable and the source file contains no literal control bytes.
 */
export function stripControlCharacters(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const isC0 =
      code < C0_END &&
      code !== TAB &&
      code !== LINE_FEED &&
      code !== CARRIAGE_RETURN;
    const isC1 = code >= C1_START && code <= C1_END;
    if (!isC0 && !isC1) out += char;
  }
  return out;
}

/** Zod preprocessor: sanitise and trim, passing non-strings through untouched. */
export const cleanText = (value: unknown) =>
  typeof value === "string" ? stripControlCharacters(value).trim() : value;

export const requiredText = (label: string, min: number, max: number) =>
  z.preprocess(
    cleanText,
    z
      .string()
      .min(min, `${label} must be at least ${min} characters`)
      .max(max, `${label} must be at most ${max} characters`),
  );

export const optionalText = (max: number) =>
  z.preprocess(
    cleanText,
    z
      .string()
      .max(max, `Must be at most ${max} characters`)
      .optional()
      .default(""),
  );

/** Optional foreign key: a UUID, or the empty string a `<select>` submits. */
export const optionalUuid = (message: string) =>
  z.preprocess(
    cleanText,
    z.string().uuid(message).optional().or(z.literal("")),
  );
