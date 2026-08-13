import { AlertTriangle, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CLAIM_LABEL_MEANING,
  REPORT_SECTIONS,
  SECTION_TITLES,
  isReportSection,
  type ClaimLabel,
  type ReportSection,
} from "@/features/research/types";
import {
  toContentBlocks,
  type ContentBlock,
  type LabelledPoint,
} from "@/features/research/result-content";
import type { ResearchResultRow } from "@/types/database";

/**
 * The research output, section by section.
 *
 * Everything here is a Server Component reading `research_results` rows. The
 * browser is never asked to parse generated Markdown, and no section is
 * rendered from anything but the row that was persisted for it — if a stage has
 * not run, its section is simply absent rather than shown as empty-but-fine.
 *
 * The `insufficient_evidence` status gets its own visible treatment rather than
 * being smoothed away. That status is a first-class outcome of the evidence
 * model: the pipeline looked and could not support the section. Rendering it as
 * ordinary content would convert a known gap into apparent confidence, which is
 * the one failure this product cannot afford.
 */

interface ResearchResultsProps {
  results: ResearchResultRow[];
}

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "active" | "completed" | "archived" | "paused" }
> = {
  complete: { label: "Complete", variant: "active" },
  partial: { label: "Partial", variant: "completed" },
  insufficient_evidence: {
    label: "Insufficient evidence",
    variant: "paused",
  },
  failed: { label: "Failed", variant: "archived" },
};

const CONFIDENCE_LABEL: Record<string, string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

/**
 * Each label gets a distinct border, a distinct word and a distinct tooltip.
 * The word is the primary signal; the colour only reinforces it.
 */
const LABEL_STYLE: Record<ClaimLabel, string> = {
  FACT: "border-brand-green/40 bg-brand-green/10 text-brand-green",
  INFERENCE: "border-brand-cyan/40 bg-brand-cyan/10 text-accent",
  RECOMMENDATION: "border-accent-lime/40 bg-accent-lime/10 text-accent-lime",
};

export function ResearchResults({ results }: ResearchResultsProps) {
  // Ordered by the report's own section order, not by write time, so a
  // half-finished run still reads top to bottom.
  const bySection = new Map<ReportSection, ResearchResultRow>();
  for (const row of results) {
    if (isReportSection(row.section_key)) bySection.set(row.section_key, row);
  }

  const ordered = REPORT_SECTIONS.filter((section) => bySection.has(section));

  if (ordered.length === 0) {
    return (
      <Card className="px-6 py-10 text-center">
        <p className="font-display text-base font-bold text-foreground">
          No results yet
        </p>
        <p className="mt-1 text-sm text-muted">
          Each stage writes its section as it completes. Run the first stage to
          see results here.
        </p>
      </Card>
    );
  }

  return (
    <section aria-labelledby="results-heading" className="flex flex-col gap-5">
      <div>
        <h2
          id="results-heading"
          className="font-display text-lg font-bold tracking-tight text-foreground"
        >
          Research output
        </h2>
        <p className="text-sm text-muted">
          {ordered.length} of {REPORT_SECTIONS.length} report sections written
          so far.
        </p>
      </div>

      {ordered.map((section) => (
        <SectionCard
          key={section}
          section={section}
          row={bySection.get(section)!}
        />
      ))}
    </section>
  );
}

function SectionCard({
  section,
  row,
}: {
  section: ReportSection;
  row: ResearchResultRow;
}) {
  const blocks = toContentBlocks(row.structured_content);
  const status = STATUS_BADGE[row.status] ?? {
    label: row.status,
    variant: "completed" as const,
  };
  const insufficient = row.status === "insufficient_evidence";
  const headingId = `section-${section}`;

  return (
    <Card className="p-6 sm:p-7">
      <article aria-labelledby={headingId}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3
            id={headingId}
            className="font-display text-base font-bold tracking-tight text-foreground"
          >
            {SECTION_TITLES[section]}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            <span className="text-xs text-muted-strong">
              {CONFIDENCE_LABEL[row.confidence] ?? row.confidence}
            </span>
          </div>
        </div>

        {insufficient ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-accent-lime/30 bg-accent-lime/10 px-4 py-3 text-sm text-accent-lime">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              The sources found did not support this section. Treat anything
              below as unverified, and widen the research scope if you need it.
            </span>
          </p>
        ) : null}

        {blocks.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No content was stored for this section.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </div>
        )}
      </article>
    </Card>
  );
}

function Block({ block }: { block: ContentBlock }) {
  if (block.kind === "prose") {
    return (
      <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
        {block.text}
      </p>
    );
  }

  if (block.kind === "list") {
    return (
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-strong">
          {block.title}
        </h4>
        <ul className="mt-2 flex flex-col gap-1.5">
          {block.items.map((item, index) => (
            <li
              key={index}
              className="flex gap-2 text-sm leading-relaxed text-muted"
            >
              <span aria-hidden="true" className="text-muted-strong">
                •
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {block.items.map((point, index) => (
        <Point key={index} point={point} />
      ))}
    </ul>
  );
}

function Point({ point }: { point: LabelledPoint }) {
  return (
    <li className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
      <span
        className={cn(
          "inline-flex w-fit shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-tight",
          LABEL_STYLE[point.label],
        )}
        title={CLAIM_LABEL_MEANING[point.label]}
      >
        {point.label}
      </span>
      <span className="text-sm leading-relaxed text-muted">
        {point.text}
        {point.sourceUrl ? (
          <>
            {" "}
            <a
              href={point.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline"
            >
              source
              <ExternalLink className="size-3" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </>
        ) : null}
      </span>
    </li>
  );
}
