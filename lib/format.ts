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

/** Format an ISO timestamp as a short, human date (e.g. "Aug 1, 2026"). */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Format an ISO timestamp with the time of day (e.g. "Aug 1, 2026, 2:05 PM"). */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
