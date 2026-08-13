import { AlertTriangle, ExternalLink, Quote } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SECTION_TITLES, isReportSection } from "@/features/research/types";
import type { EvidenceWithSource, Page } from "@/features/research/data";

/**
 * Claim → evidence → source, in that order, for every stored claim.
 *
 * The order is the point. `research_evidence.source_id` is NOT NULL with a
 * foreign key, so a claim that cannot name its source was never stored — and
 * this component renders the chain in full rather than showing a claim and
 * hiding where it came from. A reader who wants to check a number can reach the
 * page it came from in one click.
 *
 * Confidence is printed as a word. Contradictions are called contradictions.
 * Neither is smoothed into a colour, because a research tool that quietly
 * upgrades weak evidence into confident prose is worse than no research tool.
 */

interface ResearchEvidenceProps {
  page: Page<EvidenceWithSource>;
}

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "border-brand-green/40 bg-brand-green/10 text-brand-green",
  medium: "border-brand-cyan/40 bg-brand-cyan/10 text-accent",
  low: "border-accent-lime/40 bg-accent-lime/10 text-accent-lime",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
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

export function ResearchEvidence({ page }: ResearchEvidenceProps) {
  const lowConfidence = page.rows.filter(
    (row) => row.evidence.confidence === "low",
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
            The evidence stage reads the retrieved sources and records what each
            one actually supports. Nothing is claimed before then.
          </p>
        </Card>
      ) : (
        <>
          {lowConfidence > 0 ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-xl border border-accent-lime/30 bg-accent-lime/10 px-4 py-3 text-sm text-accent-lime"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                {lowConfidence} of the claims shown are low confidence. Treat
                them as leads to verify, not as findings.
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
  const { evidence, source } = row;
  const href = source ? safeHref(source.url) : null;
  const sectionTitle = isReportSection(evidence.section_key)
    ? SECTION_TITLES[evidence.section_key]
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
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
            {sectionTitle}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              CONFIDENCE_STYLE[evidence.confidence] ??
                "border-white/10 bg-fill-2 text-muted",
            )}
          >
            {CONFIDENCE_LABEL[evidence.confidence] ?? evidence.confidence}
          </span>
          {evidence.is_contradictory ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent-lime/40 bg-accent-lime/10 px-2 py-0.5 text-[11px] font-semibold text-accent-lime">
              <AlertTriangle className="size-3" aria-hidden="true" />
              Contradicts another source
            </span>
          ) : null}
        </div>

        {/* Claim */}
        <p className="mt-2.5 text-sm font-medium leading-relaxed text-foreground">
          {evidence.claim}
        </p>

        {/* Evidence — the supporting reference, when the extractor recorded one */}
        {evidence.evidence_reference ? (
          <blockquote className="mt-2.5 border-l-2 border-line pl-3 text-sm leading-relaxed text-muted">
            {evidence.evidence_reference}
          </blockquote>
        ) : null}

        {/* Source */}
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
                new URL(href).hostname.replace(/^www\./, "")}
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
