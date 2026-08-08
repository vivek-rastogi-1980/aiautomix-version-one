import { getSiteUrl } from "@/lib/seo/site-url";
import type { NewsArticle } from "@/features/news/news-data";

/**
 * JSON-LD for the News section (SPRINT-06 S06-06).
 *
 * News articles are the strongest rich-result candidates on the site — dated,
 * authored, sectioned editorial content — and had no structured data at all.
 *
 * Every field below is taken from what the page actually renders. No ratings,
 * no review counts, no awards, no invented publish dates. `Article` is used
 * rather than `NewsArticle`, which Google reserves for journalism from a news
 * publisher; overclaiming that is exactly the kind of thing that earns a manual
 * action.
 *
 * `publisher` points at the same `@id` the root layout defines for the
 * Organization, so the graph resolves to one entity rather than asserting a
 * second, unrelated publisher on every article.
 */

function organizationId(siteUrl: string): string {
  return `${siteUrl}/#organization`;
}

/** Breadcrumb trail: Home → News → (article). */
export function buildNewsBreadcrumb(article?: NewsArticle) {
  const siteUrl = getSiteUrl();

  const items = [
    { name: "Home", item: siteUrl },
    { name: "News", item: `${siteUrl}/news` },
  ];

  if (article) {
    items.push({
      name: article.title,
      item: `${siteUrl}/news/${article.slug}`,
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: entry.item,
    })),
  };
}

export function buildArticleSchema(article: NewsArticle) {
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/news/${article.slug}`;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: article.title,
    description: article.excerpt,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: article.date,
    // No separate modified date is tracked, so this is honest rather than
    // inflated — claiming a fresh dateModified to look current is a common and
    // detectable abuse.
    dateModified: article.date,
    author: { "@type": "Organization", name: article.author, url: siteUrl },
    publisher: { "@id": organizationId(siteUrl) },
    articleSection: article.category,
    inLanguage: "en",
    image: `${siteUrl}/opengraph-image`,
  };
}
