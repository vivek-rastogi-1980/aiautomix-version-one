import { Badge } from "@/components/ui/badge";
import { levelTone, TONE_BADGE } from "@/features/ai/renderer/tone";
import type { RankedEntry } from "@/features/ai/renderer/types";

interface RankedListProps {
  entries: RankedEntry[];
  /** Label shown before the level badge, e.g. "Priority" or "Severity". */
  levelLabel?: string;
}

/**
 * RankedList — ordered, prioritised items. Shared by recommendations, risks and
 * revenue models so those sections stay visually consistent
 * (REPORT-DESIGN-SYSTEM.md; CODING-STANDARDS: no duplicated UI).
 */
export function RankedList({ entries, levelLabel }: RankedListProps) {
  return (
    <ol className="flex flex-col gap-4">
      {entries.map((entry, index) => (
        <li
          key={`${entry.title}-${index}`}
          className="rounded-2xl border border-line bg-fill-1 p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
              <span className="mr-2 text-muted-strong">{index + 1}.</span>
              {entry.title}
            </h3>
            {entry.level ? (
              <Badge variant={TONE_BADGE[levelTone(entry.level)]}>
                {levelLabel ? `${levelLabel}: ` : ""}
                {entry.level}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {entry.description}
          </p>
          {entry.footnote ? (
            <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-muted">
              <span className="font-medium text-foreground/90">
                {entry.footnote.label}:
              </span>{" "}
              {entry.footnote.value}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
