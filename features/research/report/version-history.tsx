import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { InsightCard } from "@/features/ai/renderer/blocks/insight-card";
import { formatDateTime } from "@/lib/format";
import type { ReportVersionEntry } from "@/features/research/data";

/**
 * Report version history.
 *
 * Every regeneration inserts a new `research_results` row and stands the
 * previous one down — nothing is updated in place and nothing is deleted. This
 * panel is the visible proof of that: the older versions are still there, and
 * the list says which one is current.
 */
export function ReportVersionHistory({
  versions,
}: {
  versions: ReportVersionEntry[];
}) {
  if (versions.length <= 1) return null;

  return (
    <InsightCard title="Report versions" icon={History}>
      <ol className="flex flex-col gap-2.5">
        {versions.map((entry) => (
          <li
            key={entry.version}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line pb-2.5 text-sm last:border-0 last:pb-0"
          >
            <span className="flex items-center gap-2.5">
              <span className="font-semibold tabular-nums text-foreground">
                v{entry.version}
              </span>
              {entry.isCurrent ? (
                <Badge variant="active">Current</Badge>
              ) : (
                <Badge variant="neutral">Superseded</Badge>
              )}
            </span>
            <span className="text-xs text-muted-strong">
              {formatDateTime(entry.createdAt)}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-muted-strong">
        Superseded versions are retained in full. Regenerating never overwrites
        an earlier report.
      </p>
    </InsightCard>
  );
}
