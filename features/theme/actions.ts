"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";

/**
 * Persist the viewer's theme choice.
 *
 * Deliberately not authenticated: this is a display preference, it reveals
 * nothing and grants nothing. Gating it behind a session would mean the
 * toggle stopped working the moment a session expired, on a control that has
 * no security meaning.
 *
 * The value is validated against the union rather than written through, so a
 * crafted request cannot put arbitrary text into an attribute that ends up in
 * the DOM.
 */
export async function setTheme(theme: Theme): Promise<void> {
  if (!isTheme(theme)) return;

  const store = await cookies();
  store.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    // Not `httpOnly`: harmless to read, and leaving it readable lets a future
    // client-side enhancement avoid a round trip. Not `secure` in absolute
    // terms either — it must keep working on http://localhost during dev.
    secure: process.env.NODE_ENV === "production",
  });

  // Both themed shells are server-rendered, so the new markup has to come from
  // the server for the change to be visible.
  revalidatePath("/", "layout");
}
