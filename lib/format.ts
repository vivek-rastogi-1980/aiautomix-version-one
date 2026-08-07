/** Derive up-to-two-letter initials from a name, falling back to the email. */
export function initialsFrom(
  name: string | null | undefined,
  email: string,
): string {
  const source = name?.trim() || email.split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : source.slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Every timestamp in the app renders in UTC.
 *
 * This is not cosmetic. These formatters run in Server Components *and* in
 * client components that hydrate. `toLocaleDateString`/`toLocaleString` without
 * an explicit `timeZone` use the ambient zone — the server's during SSR, the
 * browser's during hydration — so the two disagree and React reports
 * "some attributes of the server rendered HTML didn't match the client".
 *
 * Pinning the zone makes the output a pure function of the timestamp, which is
 * what hydration requires. It also matches the PDF engine, which already stamps
 * generation time in UTC.
 *
 * The trade-off is deliberate: users read UTC rather than local time. For
 * audit-flavoured data — when a section was edited, when a run happened — an
 * unambiguous zone is worth more than a familiar one. Showing local time
 * safely would mean rendering timestamps only after mount, which costs a visible
 * flash on every page.
 */
const DISPLAY_TIME_ZONE = "UTC";

/** Format an ISO timestamp as a short, human date (e.g. "Aug 1, 2026"). */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: DISPLAY_TIME_ZONE,
  });
}

/**
 * Format an ISO timestamp with the time of day, labelled with its zone
 * (e.g. "Aug 1, 2026, 2:05 PM UTC"). The label is not decoration — without it
 * the displayed time would be silently wrong for every reader outside UTC.
 */
export function formatDateTime(iso: string): string {
  const formatted = new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: DISPLAY_TIME_ZONE,
  });
  return `${formatted} UTC`;
}

/** Format a millisecond duration for display (e.g. "820ms", "4.3s"). */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Compact token counts (e.g. "1,240", "18.4k"). */
export function formatTokens(tokens: number | null): string {
  if (tokens === null) return "—";
  if (tokens < 10_000) return tokens.toLocaleString("en-US");
  return `${(tokens / 1000).toFixed(1)}k`;
}
