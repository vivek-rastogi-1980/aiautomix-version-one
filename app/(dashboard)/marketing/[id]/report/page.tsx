import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Megaphone } from "lucide-react";

import { Card } from "@/components/ui/card";
import { DownloadPdfButton } from "@/features/ai/pdf/download-pdf-button";
import { ReportRenderer } from "@/features/ai/renderer/report-renderer";
import { getOpenAiModel } from "@/features/ai/providers/openai";
import { getGtmAccess } from "@/features/marketing/permissions";
import { composeGtmReport } from "@/features/marketing/report/definition";
import { MarketingAccessNotice } from "@/features/marketing/marketing-access-notice";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Go-to-market report",
  description:
    "The evidence-backed go-to-market plan, with every claim labelled.",
};

/**
 * `/marketing/[id]/report` — the consulting-style report.
 *
 * A Server Component that composes from stored rows and hands the result to the
 * platform Report Engine. No AI runs on a page view, no arithmetic happens here
 * and no credit is spent: every figure was calculated by the engine and
 * persisted by a stage that already ran.
 */
export default async function GtmReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getGtmAccess();

  if (!access.entitled) {
    return (
      <div className="flex flex-col gap-8">
        <BackLink id={id} />
        <MarketingAccessNotice reason="not_entitled" />
      </div>
    );
  }

  // Ownership first: an unreadable id must 404 before the composer says
  // anything about whether a report exists.
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("gtm_projects")
    .select("id, title")
    .eq("id", id)
    .eq("workspace_id", access.workspace.id)
    .maybeSingle();

  if (!project) notFound();

  const composed = await composeGtmReport(access.workspace.id, id);

  if (!("model" in composed)) {
    return (
      <div className="flex flex-col gap-8">
        <BackLink id={id} />
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
            <Megaphone className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-display text-lg font-bold text-foreground">
            No report yet
          </h1>
          <p className="mt-1 max-w-md text-sm text-muted">{composed.reason}</p>
          <p className="mt-3 text-xs text-muted-strong">
            Plan: {project.title}
          </p>
          <Link
            href={`/marketing/${id}`}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent underline-offset-4 hover:underline"
          >
            Open the GTM pipeline
          </Link>
        </Card>
      </div>
    );
  }

  // The provider model is stamped here rather than inside the composer, which
  // is deliberately free of provider knowledge.
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
            href={`/api/marketing/${id}/pdf`}
            title={composed.model.title}
            suffix="aiautomix-gtm-plan"
          />
        }
      />

      <p className="text-xs text-muted-strong">
        Report version v{composed.version}. All figures in {composed.currency}.
        Channel scores and every money figure were calculated deterministically
        from stored rows — the same inputs always produce the same report.
      </p>
    </div>
  );
}

function BackLink({ id }: { id: string }) {
  return (
    <Link
      href={`/marketing/${id}`}
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Back to marketing plan
    </Link>
  );
}
