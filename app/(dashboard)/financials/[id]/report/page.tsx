import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calculator } from "lucide-react";

import { Card } from "@/components/ui/card";
import { DownloadPdfButton } from "@/features/ai/pdf/download-pdf-button";
import { ReportRenderer } from "@/features/ai/renderer/report-renderer";
import { getOpenAiModel } from "@/features/ai/providers/openai";
import { getFinancialAccess } from "@/features/financials/permissions";
import { composeFinancialReport } from "@/features/financials/report/definition";
import { FinancialAccessNotice } from "@/features/financials/financial-access-notice";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Financial report",
  description: "The deterministic financial and funding report.",
};

/**
 * `/financials/[id]/report` — the consulting-style report.
 *
 * A Server Component that composes from stored rows and hands the result to the
 * platform Report Engine. No AI runs on a page view, no arithmetic happens here
 * and no credit is spent: every figure was calculated by the engine and
 * persisted by a stage that already ran.
 */
export default async function FinancialReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getFinancialAccess();

  if (!access.entitled) {
    return (
      <div className="flex flex-col gap-8">
        <BackLink id={id} />
        <FinancialAccessNotice reason="not_entitled" />
      </div>
    );
  }

  // Ownership first: an unreadable id must 404 before the composer says
  // anything about whether a report exists.
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("financial_projects")
    .select("id, title")
    .eq("id", id)
    .eq("workspace_id", access.workspace.id)
    .maybeSingle();

  if (!project) notFound();

  const composed = await composeFinancialReport(access.workspace.id, id);

  if (!("model" in composed)) {
    return (
      <div className="flex flex-col gap-8">
        <BackLink id={id} />
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-violet/15 text-brand-violet">
            <Calculator className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-display text-lg font-bold text-foreground">
            No report yet
          </h1>
          <p className="mt-1 max-w-md text-sm text-muted">{composed.reason}</p>
          <p className="mt-3 text-xs text-muted-strong">
            Model: {project.title}
          </p>
          <Link
            href={`/financials/${id}`}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent underline-offset-4 hover:underline"
          >
            Open the model pipeline
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
            href={`/api/financials/${id}/pdf`}
            title={composed.model.title}
            suffix="aiautomix-financials"
          />
        }
      />

      <p className="text-xs text-muted-strong">
        Report version v{composed.version}. All figures in {composed.currency},
        calculated deterministically from the stored assumptions — the same
        inputs always produce the same report.
      </p>
    </div>
  );
}

function BackLink({ id }: { id: string }) {
  return (
    <Link
      href={`/financials/${id}`}
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Back to financial model
    </Link>
  );
}
