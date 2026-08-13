import { ExternalLink, Link2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { Page } from "@/features/research/data";
import type { ResearchSourceRow } from "@/types/database";

/**
 * The sources behind the research.
 *
 * Three deliberate constraints.
 *
 *   Only metadata is shown. `research_sources.metadata` holds retrieval facts,
 *   never page content — there is no stored HTML to render, and so no way for
 *   a retrieved page to inject anything into this list. Every field below is
 *   printed as a text node.
 *
 *   Links are hostile until proven otherwise. `rel="noopener noreferrer
 *   nofollow"` on every one: `noopener` denies the opened page a handle on
 *   `window.opener`, and these URLs came from a web search rather than from us.
 *
 *   A missing date stays missing. `published_at` is nullable throughout the
 *   schema precisely so an unknown publication date is recorded as unknown
 *   rather than filled in with the retrieval date, which would misrepresent
 *   how current the evidence is.
 */

interface ResearchSourcesProps {
  page: Page<ResearchSourceRow>;
}

const TYPE_LABEL: Record<string, string> = {
  web: "Web",
  news: "News",
  report: "Report",
  government: "Government",
  academic: "Academic",
  industry: "Industry",
  company: "Company",
  statistics: "Statistics",
  other: "Other",
};

/** Host only. A full URL in a heading wraps badly and reads worse. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 60);
  }
}

/** Refuse to build an `href` from anything that is not http(s). */
function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

export function ResearchSources({ page }: ResearchSourcesProps) {
  return (
    <section aria-labelledby="sources-heading" className="flex flex-col gap-5">
      <div>
        <h2
          id="sources-heading"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Sources
        </h2>
        <p className="text-sm text-muted">
          {page.total === 0
            ? "No sources have been retrieved yet."
            : `${page.total} source${page.total === 1 ? "" : "s"} retrieved by the discovery and collection stages.`}
        </p>
      </div>

      {page.total === 0 ? (
        <Card className="flex flex-col items-center px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-fill-2 text-muted-strong">
            <Link2 className="size-5" />
          </span>
          <p className="mt-4 font-display text-base font-bold text-foreground">
            Nothing retrieved yet
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Source discovery searches the web and stores what it finds. Run that
            stage to populate this list.
          </p>
        </Card>
      ) : (
        <>
          {/* A list rather than a table: a table of six columns cannot fit a
              phone without horizontal scrolling, and these rows stack cleanly. */}
          <ul className="flex flex-col gap-3">
            {page.rows.map((source) => (
              <SourceRow key={source.id} source={source} />
            ))}
          </ul>

          {page.total > page.pageSize ? (
            <p className="text-xs text-muted-strong">
              Showing {page.rows.length} of {page.total} sources.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function SourceRow({ source }: { source: ResearchSourceRow }) {
  const href = safeHref(source.url);
  const host = hostOf(source.url);
  const title = source.title?.trim() || host;

  return (
    <li>
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-sm font-bold leading-snug tracking-tight text-foreground">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet"
                >
                  {title}
                  <ExternalLink
                    className="ml-1 inline size-3 align-baseline"
                    aria-hidden="true"
                  />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : (
                title
              )}
            </h3>

            <p className="mt-1 break-words text-xs text-muted">
              {source.publisher?.trim() ? `${source.publisher} · ` : ""}
              {host}
            </p>

            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-strong">
              <div className="flex gap-1.5">
                <dt>Published</dt>
                <dd className="text-muted">
                  {source.published_at
                    ? formatDate(source.published_at)
                    : "Not stated"}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Retrieved</dt>
                <dd className="text-muted">
                  {formatDate(source.retrieved_at)}
                </dd>
              </div>
            </dl>
          </div>

          <Badge variant="neutral">
            {TYPE_LABEL[source.source_type] ?? source.source_type}
          </Badge>
        </div>
      </Card>
    </li>
  );
}
