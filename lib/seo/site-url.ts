/**
 * The canonical absolute origin for this deployment.
 *
 * Single source of truth for `metadataBase`, the sitemap, robots.txt and the
 * JSON-LD graph. Driven by `NEXT_PUBLIC_SITE_URL` so preview, staging and
 * production each describe themselves correctly rather than all claiming to be
 * production.
 *
 * The trailing slash is stripped because every caller concatenates a path onto
 * this, and `https://host//news` is a different URL to a crawler.
 */
export const DEFAULT_SITE_URL = "https://www.aiautomix.com";

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return DEFAULT_SITE_URL;
  return configured.replace(/\/+$/, "");
}
