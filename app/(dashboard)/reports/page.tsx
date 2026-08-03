import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, Sparkles } from "lucide-react";

import { requireUser } from "@/lib/auth/session";
import { getBusinessIdeas, getReports } from "@/features/reports/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ScoreGauge } from "@/features/ai/renderer/blocks/score-gauge";
import { TONE_BADGE } from "@/features/ai/renderer/tone";
import { businessValidatorScoreBand } from "@/features/reports/report-definition";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Reports",
  description: "Your AI business validation report history.",
};

export default async function ReportsPage() {
  const user = await requireUser();
  const [reports, ideas] = await Promise.all([
    getReports(user.id),
    getBusinessIdeas(user.id),
  ]);

  const titleById = new Map(ideas.map((idea) => [idea.id, idea.title]));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Reports
          </h1>
          <p className="text-muted">
            Every validation report you&apos;ve generated.
          </p>
        </div>
        <Link href="/validator" className={cn(buttonVariants({ size: "md" }))}>
          <Sparkles className="size-4" /> New validation
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
            <FileText className="size-7" />
          </span>
          <p className="mt-5 font-display text-lg font-bold text-foreground">
            No reports yet
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Submit a business idea and the validator will generate a scored,
            structured report you can download as a PDF.
          </p>
          <Link
            href="/validator"
            className={cn(buttonVariants({ size: "md" }), "mt-6")}
          >
            <Sparkles className="size-4" /> Validate an idea
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {reports.map((report) => {
            const band = businessValidatorScoreBand(report.score);
            return (
              <li key={report.id}>
                <Link
                  href={`/reports/${report.id}`}
                  className="group block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet"
                >
                  <Card className="flex items-center gap-5 p-5 transition-colors group-hover:border-white/20">
                    <ScoreGauge
                      value={report.score}
                      tone={band.tone}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-display text-base font-bold tracking-tight text-foreground">
                        {titleById.get(report.business_idea_id) ??
                          "Business idea"}
                      </h2>
                      <p className="mt-1 text-xs text-muted">
                        {formatDate(report.created_at)} · {report.model}
                      </p>
                      <div className="mt-2.5">
                        <Badge variant={TONE_BADGE[band.tone]}>
                          {band.label}
                        </Badge>
                      </div>
                    </div>
                    <ArrowRight className="size-5 shrink-0 text-muted-strong transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
