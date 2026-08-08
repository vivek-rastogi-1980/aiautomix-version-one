import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NewsArticleView } from "@/features/news/news-article-view";
import { NEWS_ARTICLES, getArticle } from "@/features/news/news-data";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Articles come from a static module, so every permalink can be prerendered at
 * build time. `dynamicParams = false` makes an unknown slug a 404 rather than
 * an on-demand render of content that does not exist.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return NEWS_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};

  return {
    title: { absolute: `${article.title} | AIAutomix` },
    description: article.excerpt,
    alternates: { canonical: `/news/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt,
      publishedTime: article.date,
      authors: [article.author],
      images: ["/assets/logo-ice2.png"],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  return <NewsArticleView article={article} />;
}
