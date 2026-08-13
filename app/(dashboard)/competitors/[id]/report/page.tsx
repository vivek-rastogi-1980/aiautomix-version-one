import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Swords } from "lucide-react";

import { Card } from "@/components/ui/card";
import { DownloadPdfButton } from "@/features/ai/pdf/download-pdf-button";
import { ReportRenderer } from "@/features/ai/renderer/report-renderer";
import { getOpenAiModel } from "@/features/ai/providers/openai";
import { getCompetitorAccess } from "@/features/competitors/permissions";
import { composeCompetitorReport } from "@/features/competitors/report/definition";
import { CompetitorAccessNotice } from "@/features/competitors/competitor-access-notice";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Competitor report",
  description: "The evidence-backed competitor intelligence report.",
};

/**
 * `/competitors/[id]/report` — the consulting-style report.
 *
 * A Server Component that composes the report from stored rows and hands it to
 * the platform Report Engine. No AI runs on a page view, no web request is made
 * and no credit is spent: everything on screen was persisted by a stage that
 * already ran and was already paid for.
 *
 * A project from another workspace returns no row and becomes a 404, so ids
 * cannot be probed — the same rule the rest of the feature follows.
 */
export default async function CompetitorReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getCompetitorAccess();

  if (!access.entitled) {
    return (
      <div className="flex flex-col gap-8">
        <BackLink id={id} />
        <CompetitorAccessNotice reason="not_entitled" />
      </div>
    );
  }

  // Ownership first: an unreadable id must 404 before the composer says
  // anything about whether a report exists.
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("competitor_projects")
    .select("id, title")
    .eq("id", id)
    .eq("workspace_id", access.workspace.id)
    .maybeSingle();

  if (!project) notFound();

  const composed = await composeCompetitorReport(access.workspace.id, id);

  if (!("model" in composed)) {
    return (
      <div className="flex flex-col gap-8">
        <BackLink id={id} />
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
            <Swords className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-display text-lg font-bold text-foreground">
            No report yet
          </h1>
          <p className="mt-1 max-w-md text-sm text-muted">{composed.reason}</p>
          <p className="mt-3 text-xs text-muted-strong">
            Project: {project.title}
          </p>
          <Link
            href={`/competitors/${id}`}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent underline-offset-4 hover:underline"
          >
            Open the competitor pipeline
          </Link>
        </Card>
      </div>
    );
  }

  // The model is stamped here rather than inside the composer, which is
  // deliberately free of provider knowledge.
  const model = {
    ...composed.model,
    meta: { ...composed.model.meta, model: getOpenAiModel() },
  };

  return (
    <div className="flex flex-col gap-6">
      <BackLink id={id} />

      <ReportRenderer
        model={model}
        actions={
          <DownloadPdfButton
            href={`/api/competitors/${id}/pdf`}
            title={composed.model.title}
            suffix="aiautomix-competitors"
          />
        }
      />

      <p className="text-xs text-muted-strong">
        Report version v{composed.version}. Earlier versions are retained —
        re-running a stage supersedes a section rather than overwriting it.
      </p>
    </div>
  );
}

function BackLink({ id }: { id: string }) {
  return (
    <Link
      href={`/competitors/${id}`}
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Back to competitor project
    </Link>
  );
}
