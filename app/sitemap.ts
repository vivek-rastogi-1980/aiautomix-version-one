import type { MetadataRoute } from "next";

import { NEWS_ARTICLES } from "@/features/news/news-data";
import { PUBLIC_ROUTES } from "@/lib/seo/routes";
import { getSiteUrl } from "@/lib/seo/site-url";

/**
 * sitemap.xml (P0-1 — there was none).
 *
 * Covers only public, canonical, indexable pages. Everything auth-gated is
 * excluded by construction: the list comes from `PUBLIC_ROUTES`, which is the
 * same module `robots.ts` reads its disallow list from, so the two cannot
 * contradict each other.
 *
 * News articles are derived from the article data rather than hand-listed, so
 * publishing one is a single edit.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  // Stable per build. Using `new Date()` per entry would churn every timestamp
  // on every deploy and teach crawlers the dates mean nothing.
  const buildDate = new Date();

  const pages: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route.path === "/" ? "" : route.path}`,
    lastModified: buildDate,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const articles: MetadataRoute.Sitemap = NEWS_ARTICLES.map((article) => ({
    url: `${siteUrl}/news/${article.slug}`,
    // The article's own publish date — this one is genuinely meaningful.
    lastModified: new Date(article.date),
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  return [...pages, ...articles];
}
