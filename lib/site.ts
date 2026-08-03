import { headers } from "next/headers";

/**
 * Absolute origin of the current deployment, used to build email redirect
 * links. Prefers `NEXT_PUBLIC_SITE_URL`; otherwise derives it from the request
 * headers (works on Vercel and localhost).
 */
export async function getOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "localhost:3000";
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

/**
 * Restrict a user-supplied `redirectTo` to a safe internal path (prevents open
 * redirects). Returns `fallback` for anything that isn't a single-slash path.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  return value;
}
