import { AlertTriangle, ExternalLink, Quote } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  CLAIM_KIND_LABELS,
  CLAIM_KIND_MEANING,
  COMPETITOR_SECTION_TITLES,
  isCompetitorReportSection,
  type ClaimKind,
} from "@/features/competitors/types";
import type {
  EvidenceWithSource,
  Page,
} from "@/features/competitors/data";
import type { CompetitorSourceRow } from "@/types/database";

/**
 * Claim → evidence → source, and the source index.
 *
 * The order is the point. `competitor_evidence.source_id` is NOT NULL with a
 * foreign key, so a claim that cannot name its source was never stored — and
 * this component renders the chain in full rather than showing a claim and
 * hiding where it came from.
 *
 * Every claim carries its kind as a word. A competitor's own marketing headline
 * and an independently observed price look different here, because they are
 * different, and a report that renders them identically has started lying.
 */

const KIND_STYLE: Record<ClaimKind, string> = {
  STATED: "border-accent-lime/40 bg-accent-lime/10 text-accent-lime",
  OBSERVED: "border-brand-green/40 bg-brand-green/10 text-brand-green",
  INFERRED: "border-brand-cyan/40 bg-brand-cyan/10 text-accent",
  RECOMMENDED: "border-brand-violet/40 bg-brand-violet/10 text-brand-violet",
};

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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 60);
  }
}

export function CompetitorEvidence({
  page,
}: {
  page: Page<EvidenceWithSource>;
}) {
  const stated = page.rows.filter(
    (row) => row.evidence.claim_kind === "STATED",
  ).length;

  return (
    <section aria-labelledby="evidence-heading" className="flex flex-col gap-5">
      <div>
        <h2
          id="evidence-heading"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Evidence
        </h2>
        <p className="text-sm text-muted">
          {page.total === 0
            ? "No claims have been extracted yet."
            : `${page.total} claim${page.total === 1 ? "" : "s"}, each tied to the source it came from.`}
        </p>
      </div>

      {page.total === 0 ? (
        <Card className="flex flex-col items-center px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-fill-2 text-muted-strong">
            <Quote className="size-5" />
          </span>
          <p className="mt-4 font-display text-base font-bold text-foreground">
            No evidence extracted yet
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Discovery and pricing record what a source actually shows. Nothing
            is claimed before then.
          </p>
        </Card>
      ) : (
        <>
          {stated > 0 ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-xl border border-accent-lime/30 bg-accent-lime/10 px-4 py-3 text-sm text-accent-lime"
            >
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                {stated} of these are the competitor&apos;s own claims about
                itself, not independent observations. They are labelled{" "}
                <strong>{CLAIM_KIND_LABELS.STATED}</strong>.
              </span>
            </p>
          ) : null}

          <ul className="flex flex-col gap-3">
            {page.rows.map((row) => (
              <EvidenceRow key={row.evidence.id} row={row} />
            ))}
          </ul>

          {page.total > page.pageSize ? (
            <p className="text-xs text-muted-strong">
              Showing {page.rows.length} of {page.total} claims.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function EvidenceRow({ row }: { row: EvidenceWithSource }) {
  const { evidence, source, competitorName } = row;
  const href = source ? safeHref(source.url) : null;
  const kind = (evidence.claim_kind ?? "OBSERVED") as ClaimKind;
  const sectionTitle = isCompetitorReportSection(evidence.section_key)
    ? COMPETITOR_SECTION_TITLES[evidence.section_key]
    : evidence.section_key;

  return (
    <li>
      <Card
        className={cn(
          "p-4 sm:p-5",
          evidence.is_contradictory ? "border-accent-lime/40" : null,
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-tight",
              KIND_STYLE[kind],
            )}
            title={CLAIM_KIND_MEANING[kind]}
          >
            {kind}
          </span>
          {competitorName ? (
            <span className="text-xs font-semibold text-foreground">
              {competitorName}
            </span>
          ) : null}
          <span className="text-xs uppercase tracking-wide text-muted-strong">
            {sectionTitle}
          </span>
          <span className="text-xs text-muted-strong">
            {evidence.confidence} confidence
          </span>
          {evidence.is_contradictory ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent-lime/40 bg-accent-lime/10 px-2 py-0.5 text-[11px] font-semibold text-accent-lime">
              <AlertTriangle className="size-3" aria-hidden="true" />
              Contradicts another source
            </span>
          ) : null}
        </div>

        <p className="mt-2.5 text-sm font-medium leading-relaxed text-foreground">
          {evidence.claim}
        </p>

        {evidence.evidence_reference ? (
          <blockquote className="mt-2.5 border-l-2 border-line pl-3 text-sm leading-relaxed text-muted">
            {evidence.evidence_reference}
          </blockquote>
        ) : null}

        <p className="mt-3 text-xs text-muted-strong">
          <span className="uppercase tracking-wide">Source: </span>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-accent underline-offset-4 hover:underline"
            >
              {source?.title?.trim() ||
                source?.publisher?.trim() ||
                hostOf(href)}
              <ExternalLink
                className="ml-1 inline size-3 align-baseline"
                aria-hidden="true"
              />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            "Recorded, but the link is no longer usable."
          )}
        </p>
      </Card>
    </li>
  );
}

/**
 * The source index.
 *
 * Only metadata is shown — `competitor_sources.metadata` holds retrieval facts,
 * never page content, so there is no stored HTML to render and no way for a
 * retrieved page to inject anything here. Every field is a text node.
 */
export function CompetitorSources({
  page,
}: {
  page: Page<CompetitorSourceRow>;
}) {
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
            : `${page.total} source${page.total === 1 ? "" : "s"} retrieved. Every competitor in this project traces back to one of these.`}
        </p>
      </div>

      {page.total === 0 ? (
        <Card className="px-6 py-10 text-center">
          <p className="font-display text-base font-bold text-foreground">
            Nothing retrieved yet
          </p>
          <p className="mt-1 text-sm text-muted">
            Discovery searches the web and stores what it finds.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {page.rows.map((source) => {
            const href = safeHref(source.url);
            const host = hostOf(source.url);
            return (
              <li key={source.id}>
                <Card className="p-4">
                  <h3 className="font-display text-sm font-bold leading-snug tracking-tight text-foreground">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet"
                      >
                        {source.title?.trim() || host}
                        <ExternalLink
                          className="ml-1 inline size-3 align-baseline"
                          aria-hidden="true"
                        />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ) : (
                      source.title?.trim() || host
                    )}
                  </h3>
                  <p className="mt-1 break-words text-xs text-muted">
                    {source.publisher?.trim() ? `${source.publisher} · ` : ""}
                    {host}
                  </p>
                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-strong">
                    <div className="flex gap-1.5">
                      <dt>Published</dt>
                      {/* A missing publication date stays missing. Substituting
                          the retrieval date would overstate how current the
                          evidence is. */}
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
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
