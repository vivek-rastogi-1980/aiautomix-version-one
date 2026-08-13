import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Loader2, Microscope } from "lucide-react";

import { Card } from "@/components/ui/card";
import { DownloadPdfButton } from "@/features/ai/pdf/download-pdf-button";
import { ReportRenderer } from "@/features/ai/renderer/report-renderer";
import { getReportVersions } from "@/features/research/data";
import { getResearchAccess } from "@/features/research/permissions";
import { composeResearchReport } from "@/features/research/report/compose";
import { buildResearchReportModel } from "@/features/research/report/definition";
import { RegenerateReportButton } from "@/features/research/report/regenerate-button";
import { ReportVersionHistory } from "@/features/research/report/version-history";
import { ResearchAccessNotice } from "@/features/research/research-access-notice";
import { stageCost } from "@/features/research/cost";
import { isResearchDepth } from "@/features/research/types";
import { getOpenAiModel } from "@/features/ai/providers/openai";
import { RESEARCH_WORKFLOWS } from "@/features/research/stages/workflows";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Market research report",
  description: "The evidence-backed market research report.",
};

/**
 * `/research/[id]/report` — the consulting-style report.
 *
 * A Server Component that composes the report from stored rows and hands it to
 * the platform Report Engine. No AI runs on a page view, no web request is
 * made, and no credit is spent: everything on screen was persisted by a stage
 * that already ran and was already paid for.
 *
 * A request from another workspace returns no row and becomes a 404, so ids
 * cannot be probed — the same rule the rest of the feature follows.
 */
export default async function ResearchReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getResearchAccess();

  if (!access.entitled) {
    return (
      <div className="flex flex-col gap-8">
        <BackLink id={id} />
        <ResearchAccessNotice reason="not_entitled" />
      </div>
    );
  }

  // Ownership first: an unreadable id must 404 before the composer says
  // anything about whether a report exists.
  const supabase = await createClient();
  const { data: request } = await supabase
    .from("research_requests")
    .select("id, title, depth")
    .eq("id", id)
    .eq("workspace_id", access.workspace.id)
    .maybeSingle();

  if (!request) notFound();

  const composed = await composeResearchReport(access.workspace.id, id);

  if (!composed.report) {
    return (
      <div className="flex flex-col gap-8">
        <BackLink id={id} />
        <NotReadyState
          researchId={id}
          title={request.title}
          status={composed.status}
          reason={composed.reason}
        />
      </div>
    );
  }

  const versions = await getReportVersions(access.workspace.id, id);
  const depth = isResearchDepth(request.depth) ? request.depth : "standard";

  const model = buildResearchReportModel({
    report: composed.report,
    model: getOpenAiModel(),
    promptVersion: RESEARCH_WORKFLOWS["research-report"]?.promptVersion ?? "v1",
  });

  return (
    <div className="flex flex-col gap-6">
      <BackLink id={id} />

      <ReportRenderer
        model={model}
        actions={
          <DownloadPdfButton
            href={`/api/research/${id}/pdf`}
            title={composed.report.title}
            suffix="aiautomix-market-research"
          />
        }
      />

      <ReportVersionHistory versions={versions} />

      {access.canCreate ? (
        <Card className="p-6 sm:p-7">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Regenerate
          </h2>
          <p className="mt-1 text-sm text-muted">
            Rebuilds the fifteen sections from the sources and evidence already
            stored. The research stages are not re-run and no new sources are
            retrieved.
          </p>
          <div className="mt-5">
            <RegenerateReportButton
              requestId={id}
              cost={stageCost(depth, "report")}
            />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function BackLink({ id }: { id: string }) {
  return (
    <Link
      href={`/research/${id}`}
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Back to research
    </Link>
  );
}

/**
 * Every state except "ready".
 *
 * `draft`, `generating` and `failed` each get their own sentence and their own
 * next action. A blank page, or a spinner that never resolves, would leave the
 * user unable to tell a report that is coming from one that never will.
 */
function NotReadyState({
  researchId,
  title,
  status,
  reason,
}: {
  researchId: string;
  title: string;
  status: string;
  reason: string;
}) {
  const generating = status === "generating";

  return (
    <Card className="flex flex-col items-center px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
        {generating ? (
          <Loader2 className="size-6 animate-spin" aria-hidden="true" />
        ) : (
          <Microscope className="size-6" aria-hidden="true" />
        )}
      </span>

      <h1 className="mt-5 font-display text-lg font-bold text-foreground">
        {generating
          ? "The report is being generated"
          : status === "failed"
            ? "The report could not be generated"
            : "No report yet"}
      </h1>

      <p className="mt-1 max-w-md text-sm text-muted">{reason}</p>
      <p className="mt-3 text-xs text-muted-strong">
        Research: {title} · Status: {status}
      </p>

      <Link
        href={`/research/${researchId}`}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent underline-offset-4 hover:underline"
      >
        Open the research pipeline
      </Link>
    </Card>
  );
}
