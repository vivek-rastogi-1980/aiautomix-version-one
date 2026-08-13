import { AlertTriangle, Info, ShieldAlert, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { TONE_SURFACE, TONE_TEXT } from "@/features/ai/renderer/tone";
import type { ReportTone } from "@/features/ai/renderer/types";

/**
 * ReportCallout — a stated limitation the reader must not skim past.
 *
 * Used for insufficient evidence, sources that disagree about a figure, and
 * data that was not structured enough to chart honestly. It carries a heading
 * and an icon as well as a tone, so the warning survives greyscale printing and
 * a screen reader.
 */

const TONE_ICON: Record<ReportTone, typeof Info> = {
  positive: Info,
  caution: AlertTriangle,
  negative: ShieldAlert,
  neutral: TriangleAlert,
};

export function ReportCallout({
  tone,
  title,
  text,
}: {
  tone: ReportTone;
  title: string;
  text: string;
}) {
  const Icon = TONE_ICON[tone];

  return (
    <div
      role="note"
      className={cn(
        "flex gap-3 rounded-2xl border px-4 py-3.5",
        TONE_SURFACE[tone],
      )}
    >
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", TONE_TEXT[tone])}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold", TONE_TEXT[tone])}>{title}</p>
        <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-muted">
          {text}
        </p>
      </div>
    </div>
  );
}
