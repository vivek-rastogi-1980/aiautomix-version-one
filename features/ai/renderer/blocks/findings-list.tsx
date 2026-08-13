import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CLAIM_KIND_LABEL,
  CLAIM_KIND_MEANING,
  CONFIDENCE_LABEL,
  CONFIDENCE_STEP,
  CONFIDENCE_STEPS,
  CONFIDENCE_TONE,
  type ClaimKind,
  type FindingEntry,
  type ReportConfidence,
} from "@/features/ai/renderer/types";
import { TONE_BAR, TONE_TEXT } from "@/features/ai/renderer/tone";

/**
 * FindingsList — claims with their label, confidence and citations.
 *
 * Three rules are enforced here rather than left to whoever builds a model.
 *
 *   The label is a word. `FACT` / `INFERENCE` / `RECOMMENDATION` render as
 *   text with a `title` explaining each. Colour reinforces; it never carries
 *   the meaning alone, because a reader who cannot distinguish green from amber
 *   would otherwise read a proposal as a finding.
 *
 *   Confidence is ordinal. The meter has three steps and is always accompanied
 *   by its label. A percentage would imply a measurement the research engine
 *   never made.
 *
 *   A FACT with no citation says so. Silence would let an uncited assertion sit
 *   beside cited ones and look identical.
 */

const KIND_STYLE: Record<ClaimKind, string> = {
  FACT: "border-brand-green/40 bg-brand-green/10 text-brand-green",
  INFERENCE: "border-brand-cyan/40 bg-brand-cyan/10 text-accent",
  RECOMMENDATION: "border-accent-lime/40 bg-accent-lime/10 text-accent-lime",
};

function ConfidenceMeter({ confidence }: { confidence: ReportConfidence }) {
  const tone = CONFIDENCE_TONE[confidence];
  const filled = CONFIDENCE_STEP[confidence];

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: CONFIDENCE_STEPS }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "block h-1.5 w-3 rounded-full",
              index < filled ? TONE_BAR[tone] : "bg-white/15",
            )}
          />
        ))}
      </span>
      <span className={cn("text-xs font-semibold", TONE_TEXT[tone])}>
        {CONFIDENCE_LABEL[confidence]}
      </span>
    </span>
  );
}

function Citations({ entry }: { entry: FindingEntry }) {
  const citations = entry.citations ?? [];

  if (citations.length === 0) {
    // Only a FACT owes a citation; the other two kinds are honest without one.
    if (entry.kind !== "FACT") return null;
    return (
      <p className="mt-1.5 text-xs text-accent-lime">
        No source recorded for this statement.
      </p>
    );
  }

  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-strong">
      <span>
        {citations.length === 1 ? "Source:" : `Sources (${citations.length}):`}
      </span>
      {citations.map((citation, index) => (
        <span key={index} className="inline-flex items-center">
          {citation.url ? (
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet"
            >
              {citation.label}
              <ExternalLink className="size-3" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <span>{citation.label}</span>
          )}
          {citation.publishedAt ? (
            <span className="ml-1 text-muted-strong">
              ({citation.publishedAt})
            </span>
          ) : null}
        </span>
      ))}
    </p>
  );
}

export function FindingsList({ entries }: { entries: FindingEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3.5">
      {entries.map((entry, index) => (
        <li key={index} className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-tight",
                KIND_STYLE[entry.kind],
              )}
              title={CLAIM_KIND_MEANING[entry.kind]}
            >
              {CLAIM_KIND_LABEL[entry.kind]}
            </span>
            {entry.confidence ? (
              <ConfidenceMeter confidence={entry.confidence} />
            ) : null}
          </div>
          <p className="text-sm leading-relaxed text-muted">{entry.text}</p>
          <Citations entry={entry} />
        </li>
      ))}
    </ul>
  );
}
