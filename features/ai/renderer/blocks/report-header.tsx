import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScoreGauge } from "@/features/ai/renderer/blocks/score-gauge";
import { TONE_BADGE } from "@/features/ai/renderer/tone";
import type { ReportScore } from "@/features/ai/renderer/types";
import { formatDate } from "@/lib/format";

interface ReportHeaderProps {
  kicker: string;
  title: string;
  summary: string;
  generatedAt: string;
  score?: ReportScore;
  /** Rendered top-right — typically the PDF download button. */
  actions?: React.ReactNode;
}

/**
 * ReportHeader — hero summary and score card (REPORT-DESIGN-SYSTEM.md).
 * Server Component: no interactivity beyond the injected `actions` slot.
 */
export function ReportHeader({
  kicker,
  title,
  summary,
  generatedAt,
  score,
  actions,
}: ReportHeaderProps) {
  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-violet">
            {kicker}
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Generated {formatDate(generatedAt)}
          </p>
          {score?.verdict ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Badge variant={TONE_BADGE[score.verdict.tone]}>
                Verdict: {score.verdict.label}
              </Badge>
              <span className="text-sm text-muted">{score.verdict.blurb}</span>
            </div>
          ) : null}
        </div>

        {score || actions ? (
          <div className="flex shrink-0 flex-col items-center gap-4">
            {score ? (
              <ScoreGauge
                value={score.value}
                label={score.label}
                tone={score.tone}
              />
            ) : null}
            {actions}
          </div>
        ) : null}
      </div>

      <div className="mt-7 border-t border-white/[0.06] pt-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
          Executive summary
        </h2>
        <p className="mt-2.5 text-[15px] leading-relaxed text-muted">
          {summary}
        </p>
      </div>
    </Card>
  );
}
