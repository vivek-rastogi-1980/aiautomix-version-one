import Link from "next/link";

import { SiteNav } from "@/components/layout/site-nav";
import { formatDate } from "@/lib/format";
import {
  CATEGORY_ACCENT,
  NEWS_ARTICLES,
  type NewsArticle,
} from "@/features/news/news-data";

const PAGE_CSS = `
body { margin: 0; background: #0A0B0F; }
    a { color: #8CA0FF; text-decoration: none; }
    a:hover { color: #B4C2FF; }
    @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
    @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
  .site-menu-link:hover { background: #E4E3FA; }

  .news-back { transition: gap 0.2s ease, color 0.2s ease; }
  .news-back:hover { gap: 12px; }

  .news-next {
    transition: transform 0.28s cubic-bezier(0.22,0.61,0.36,1), border-color 0.28s ease;
  }
  .news-next:hover {
    transform: translateY(-3px);
    border-color: rgba(255,255,255,0.16) !important;
  }

  @media (prefers-reduced-motion: reduce) {
    .news-back, .news-next { transition: none; }
    .news-next:hover { transform: none; }
  }

  @media (max-width: 900px) {
    .news-article-wrap { padding: 80px 20px 100px !important; }
  }
`;

interface NewsArticleViewProps {
  article: NewsArticle;
}

export function NewsArticleView({ article }: NewsArticleViewProps) {
  const accent = CATEGORY_ACCENT[article.category];
  // Wraps to the top of the list at the end, so the last article is not a
  // dead end.
  const index = NEWS_ARTICLES.findIndex((a) => a.slug === article.slug);
  const next = NEWS_ARTICLES[(index + 1) % NEWS_ARTICLES.length];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <div
        style={{
          background: "#0A0B0F",
          color: "#F4F3F7",
          fontFamily: "'Inter',sans-serif",
          width: "100%",
          minHeight: "100vh",
        }}
      >
        <SiteNav />

        <article
          className="news-article-wrap"
          style={{
            maxWidth: "760px",
            margin: "0 auto",
            padding: "100px 64px 120px",
          }}
        >
          <Link
            href="/news"
            className="news-back"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#8A87A0",
              marginBottom: "36px",
            }}
          >
            <span aria-hidden>{"←"}</span>
            {"All news"}
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "12.5px",
              color: "#6E6C7C",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                color: accent,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontSize: "11.5px",
              }}
            >
              {article.category}
            </span>
            <span aria-hidden>{"·"}</span>
            <time dateTime={article.date}>{formatDate(article.date)}</time>
            <span aria-hidden>{"·"}</span>
            <span>{`${article.readingMinutes} min read`}</span>
          </div>

          <h1
            style={{
              fontFamily: "'Bricolage Grotesque',sans-serif",
              fontWeight: 800,
              fontSize: "clamp(32px,4.6vw,54px)",
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              margin: "0 0 20px",
            }}
          >
            {article.title}
          </h1>

          <p
            style={{
              fontSize: "19px",
              lineHeight: 1.6,
              color: "#B9B5C9",
              margin: "0 0 14px",
            }}
          >
            {article.excerpt}
          </p>

          <div
            style={{
              fontSize: "13.5px",
              color: "#6E6C7C",
              paddingBottom: "34px",
              marginBottom: "44px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {`By ${article.author}`}
          </div>

          {article.sections.map((section) => (
            <section key={section.heading} style={{ marginBottom: "44px" }}>
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: 700,
                  fontSize: "clamp(21px,2.4vw,27px)",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.25,
                  margin: "0 0 18px",
                }}
              >
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: "16.5px",
                    lineHeight: 1.75,
                    color: "#D6D4E0",
                    margin: "0 0 18px",
                  }}
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}

          <div
            style={{
              marginTop: "72px",
              paddingTop: "40px",
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#6E6C7C",
                fontWeight: 600,
                marginBottom: "18px",
              }}
            >
              {"Read next"}
            </div>
            <Link
              href={`/news/${next.slug}`}
              className="news-next"
              style={{
                display: "block",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "18px",
                padding: "26px",
                background: "rgba(255,255,255,0.02)",
                color: "inherit",
              }}
            >
              <span
                style={{
                  color: CATEGORY_ACCENT[next.category],
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontSize: "11.5px",
                }}
              >
                {next.category}
              </span>
              <div
                style={{
                  fontFamily: "'Bricolage Grotesque',sans-serif",
                  fontWeight: 700,
                  fontSize: "20px",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.25,
                  margin: "10px 0 8px",
                  color: "#F4F3F7",
                }}
              >
                {next.title}
              </div>
              <div
                style={{
                  fontSize: "14.5px",
                  lineHeight: 1.6,
                  color: "#B9B5C9",
                }}
              >
                {next.excerpt}
              </div>
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
