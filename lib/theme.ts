import "server-only";

import { cookies } from "next/headers";

/**
 * Theme preference for the signed-in surfaces (dashboard and admin).
 *
 * Stored in a cookie rather than `localStorage` because the choice has to be
 * known on the SERVER, before the first byte. A client-side read can only
 * happen after hydration, which means the page paints dark and then snaps to
 * light — the flash-of-wrong-theme that makes theme toggles feel broken.
 * Reading a cookie in the layout means the correct markup is what gets sent.
 *
 * Not stored in the database: it is a per-device display preference, not
 * account state. Someone on a bright monitor at work and a dark room at home
 * wants different answers from the same account, and a profile column would
 * force one on both.
 */

export const THEME_COOKIE = "aiautomix-theme";

export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

/** Dark is the product's identity; light is opt-in. */
export const DEFAULT_THEME: Theme = "dark";

export function isTheme(value: unknown): value is Theme {
  return (
    typeof value === "string" && (THEMES as readonly string[]).includes(value)
  );
}

/** The caller's theme, falling back to dark for an absent or junk cookie. */
export async function getTheme(): Promise<Theme> {
  const store = await cookies();
  const value = store.get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : DEFAULT_THEME;
}

export function otherTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}
