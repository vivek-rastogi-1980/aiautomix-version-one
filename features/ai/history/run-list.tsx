import Link from "next/link";
import { CircleAlert, CircleCheck, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { AiRunSummary } from "@/features/ai/history/data";
import { formatDateTime, formatDuration, formatTokens } from "@/lib/format";

interface RunListProps {
  runs: AiRunSummary[];
}

/**
 * AI History list (AI-HISTORY-SPEC.md).
 *
 * Every execution the platform has run for this user, successful or not, with
 * the prompt version and model behind it — and a link back to the report when
 * the run produced one, so previous reports can be reopened.
 */
export function RunList({ runs }: RunListProps) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
          <FileText className="size-7" />
        </span>
        <p className="mt-5 font-display text-lg font-bold text-foreground">
          No AI runs yet
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Every workflow the platform executes is recorded here with its prompt
          version, model, tokens and duration.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {runs.map((run) => {
        const succeeded = run.status === "success";
        const StatusIcon = succeeded ? CircleCheck : CircleAlert;

        return (
          <li key={run.id}>
            <Card className="flex flex-wrap items-center gap-x-5 gap-y-3 p-5">
              <StatusIcon
                aria-hidden
                className={`size-5 shrink-0 ${
                  succeeded ? "text-brand-green" : "text-danger-soft"
                }`}
              />

              <div className="min-w-[12rem] flex-1">
                <h3 className="font-display text-[15px] font-bold tracking-tight text-foreground">
                  {run.workflowLabel}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  {formatDateTime(run.createdAt)} · {run.providerLabel} ·{" "}
                  {run.model} · prompt {run.promptVersion}
                </p>
                {!succeeded && run.errorCode ? (
                  <p className="mt-1.5 text-xs text-danger-soft">
                    {run.errorCode}
                    {run.attempts > 1 ? ` after ${run.attempts} attempts` : ""}
                  </p>
                ) : null}
              </div>

              <dl className="flex items-center gap-5 text-xs text-muted">
                <div>
                  <dt className="text-muted-strong">Tokens</dt>
                  <dd className="tabular-nums">
                    {formatTokens(run.totalTokens)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-strong">Duration</dt>
                  <dd className="tabular-nums">
                    {formatDuration(run.durationMs)}
                  </dd>
                </div>
              </dl>

              {run.reportId ? (
                <Link
                  href={`/reports/${run.reportId}`}
                  className="text-sm font-medium text-brand-cyan hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet"
                >
                  Open report
                  <span className="sr-only">
                    {" "}
                    for the {run.workflowLabel} run on{" "}
                    {formatDateTime(run.createdAt)}
                  </span>
                </Link>
              ) : (
                <Badge variant={succeeded ? "neutral" : "archived"}>
                  {succeeded ? "No report" : "Failed"}
                </Badge>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
