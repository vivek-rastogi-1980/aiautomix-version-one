import { ExternalLink } from "lucide-react";

import type { SourceEntry } from "@/features/ai/renderer/types";

/**
 * SourceIndex — the Evidence & Sources section.
 *
 * A numbered list rather than a table: the same six fields have to fit a phone
 * without horizontal scrolling, and an `<ol>` reflows where a `<table>` does
 * not. The numbering is meaningful — it is what a citation elsewhere in the
 * report refers to.
 *
 * "Not stated" is printed for a missing publication date. The schema keeps that
 * column nullable on purpose, and filling it with the retrieval date would
 * misrepresent how current the evidence is.
 */
export function SourceIndex({ entries }: { entries: SourceEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted">
        No sources were retrieved for this research.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {entries.map((entry, index) => (
        <li
          key={index}
          className="flex gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
        >
          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-strong">
            [{index + 1}]
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-foreground">
              {entry.url ? (
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet"
                >
                  {entry.title}
                  <ExternalLink
                    className="ml-1 inline size-3 align-baseline"
                    aria-hidden="true"
                  />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : (
                entry.title
              )}
            </p>

            <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-strong">
              {entry.publisher ? (
                <div className="flex gap-1.5">
                  <dt>Publisher</dt>
                  <dd className="text-muted">{entry.publisher}</dd>
                </div>
              ) : null}
              {entry.sourceType ? (
                <div className="flex gap-1.5">
                  <dt>Type</dt>
                  <dd className="text-muted">{entry.sourceType}</dd>
                </div>
              ) : null}
              <div className="flex gap-1.5">
                <dt>Published</dt>
                <dd className="text-muted">
                  {entry.publishedAt ?? "Not stated"}
                </dd>
              </div>
              {entry.retrievedAt ? (
                <div className="flex gap-1.5">
                  <dt>Retrieved</dt>
                  <dd className="text-muted">{entry.retrievedAt}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </li>
      ))}
    </ol>
  );
}
