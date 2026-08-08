import Link from "next/link";

import { SiteNav } from "@/components/layout/site-nav";
import { formatDate } from "@/lib/format";
import {
  CATEGORY_ACCENT,
  NEWS_ARTICLES,
  type NewsArticle,
} from "@/features/news/news-data";
import { buildNewsBreadcrumb } from "@/features/news/news-schema";

const PAGE_CSS = `
body { margin: 0; background: #0A0B0F; }
    a { color: #8CA0FF; text-decoration: none; }
    a:hover { color: #B4C2FF; }
    @keyframes navLogoFloat { 0%,100% { transform: translateY(0); filter: drop-shadow(0 0 10px rgba(255,255,255,0.85)) drop-shadow(0 0 18px rgba(180,150,255,0.5)) brightness(1.1); } 50% { transform: translateY(-4px); filter: drop-shadow(0 0 16px rgba(255,255,255,1)) drop-shadow(0 0 26px rgba(180,150,255,0.7)) brightness(1.25); } }
    @keyframes beamFlicker { 0%,100% { opacity: 0.85; } 45% { opacity: 1; } 50% { opacity: 0.7; } 55% { opacity: 1; } }
  .site-menu-link:hover { background: #E4E3FA; }

  /* Cards lift on hover and reveal their accent edge. Transform and opacity
     only, so the animation stays on the compositor. */
  .news-card {
    transition: transform 0.28s cubic-bezier(0.22,0.61,0.36,1),
                border-color 0.28s ease,
                box-shadow 0.28s ease;
  }
  .news-card:hover {
    transform: translateY(-4px);
    border-color: rgba(255,255,255,0.16) !important;
    box-shadow: 0 24px 60px -30px rgba(0,0,0,0.9);
  }
  .news-card:hover .news-card-title { color: #FFFFFF; }
  .news-card:hover .news-card-arrow { transform: translateX(4px); opacity: 1; }
  .news-card-title { transition: color 0.2s ease; }
  .news-card-arrow { transition: transform 0.28s cubic-bezier(0.22,0.61,0.36,1), opacity 0.2s ease; opacity: 0.55; }

  .news-card:focus-visible {
    outline: 2px solid #7C5CFF;
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .news-card, .news-card-title, .news-card-arrow { transition: none; }
    .news-card:hover { transform: none; }
  }

  @media (max-width: 900px) {
    .news-wrap { padding: 80px 20px 100px !important; }
    .news-featured-grid { grid-template-columns: 1fr !important; }
  }
`;

function Meta({ article }: { article: NewsArticle }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        fontSize: "12.5px",
        color: "#6E6C7C",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          color: CATEGORY_ACCENT[article.category],
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
  );
}

export function NewsIndexView() {
  const [lead, ...rest] = NEWS_ARTICLES;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildNewsBreadcrumb()),
        }}
      />
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

        <div
          className="news-wrap"
          style={{
            maxWidth: "1120px",
            margin: "0 auto",
            padding: "100px 64px 120px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#8A87A0",
              marginBottom: "20px",
              fontWeight: 600,
            }}
          >
            {"Newsroom"}
          </div>
          <h1
            style={{
              fontFamily: "'Bricolage Grotesque',sans-serif",
              fontWeight: 800,
              fontSize: "clamp(34px,5vw,60px)",
              letterSpacing: "-0.02em",
              lineHeight: 1.02,
              margin: "0 0 16px",
              maxWidth: "760px",
            }}
          >
            {"What we're building, and what we're learning"}
          </h1>
          <p
            style={{
              fontSize: "17px",
              lineHeight: 1.6,
              color: "#B9B5C9",
              maxWidth: "620px",
              margin: "0 0 64px",
            }}
          >
            {
              "Product releases, engineering notes and the occasional opinion about where AI automation is actually useful."
            }
          </p>

          {/* Lead story — larger treatment, same data as the cards below. */}
          <Link
            href={`/news/${lead.slug}`}
            className="news-card"
            style={{
              display: "block",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "24px",
              padding: "40px",
              marginBottom: "48px",
              background:
                "linear-gradient(135deg, rgba(124,92,255,0.09), rgba(240,33,158,0.05))",
              color: "inherit",
            }}
          >
            <Meta article={lead} />
            <h2
              className="news-card-title"
              style={{
                fontFamily: "'Bricolage Grotesque',sans-serif",
                fontWeight: 800,
                fontSize: "clamp(26px,3.2vw,40px)",
                letterSpacing: "-0.02em",
                lineHeight: 1.08,
                margin: "18px 0 14px",
                maxWidth: "720px",
                color: "#F4F3F7",
              }}
            >
              {lead.title}
            </h2>
            <p
              style={{
                fontSize: "16px",
                lineHeight: 1.6,
                color: "#B9B5C9",
                maxWidth: "640px",
                margin: "0 0 22px",
              }}
            >
              {lead.excerpt}
            </p>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#8CA0FF",
              }}
            >
              {"Read the story"}
              <span className="news-card-arrow" aria-hidden>
                {"→"}
              </span>
            </span>
          </Link>

          <div
            className="news-featured-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "24px",
            }}
          >
            {rest.map((article) => (
              <Link
                key={article.slug}
                href={`/news/${article.slug}`}
                className="news-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  padding: "30px",
                  background: "rgba(255,255,255,0.02)",
                  color: "inherit",
                  height: "100%",
                }}
              >
                <Meta article={article} />
                <h2
                  className="news-card-title"
                  style={{
                    fontFamily: "'Bricolage Grotesque',sans-serif",
                    fontWeight: 700,
                    fontSize: "22px",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.2,
                    margin: "16px 0 12px",
                    color: "#F4F3F7",
                  }}
                >
                  {article.title}
                </h2>
                <p
                  style={{
                    fontSize: "15px",
                    lineHeight: 1.6,
                    color: "#B9B5C9",
                    margin: "0 0 20px",
                    flexGrow: 1,
                  }}
                >
                  {article.excerpt}
                </p>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13.5px",
                    fontWeight: 600,
                    color: "#8CA0FF",
                  }}
                >
                  {"Read more"}
                  <span className="news-card-arrow" aria-hidden>
                    {"→"}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
