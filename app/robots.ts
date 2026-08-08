import type { MetadataRoute } from "next";

import { PRIVATE_PREFIXES } from "@/lib/seo/routes";
import { getSiteUrl } from "@/lib/seo/site-url";

/**
 * robots.txt (P0-2 — there was none).
 *
 * Note what is *not* disallowed: `/_next/`, `/assets/` and anything else the
 * page needs to render. Blocking those is a common own-goal — Google renders
 * pages before judging them, so a crawler denied CSS and JS sees a broken site
 * and scores it accordingly.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Auth-gated already, so this is about crawl budget and index hygiene
        // rather than access control. Kept in sync with the sitemap via the
        // shared route module.
        disallow: PRIVATE_PREFIXES,
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
