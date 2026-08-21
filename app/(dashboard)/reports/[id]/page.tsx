import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireUser } from "@/lib/auth/session";
import { getReport } from "@/features/reports/data";
import { buildBusinessValidatorReportModel } from "@/features/reports/report-definition";
import { ReportRenderer } from "@/features/ai/renderer/report-renderer";
import { DownloadPdfButton } from "@/features/ai/pdf/download-pdf-button";
import { StartResearchLink } from "@/features/research/start-research-link";
import { StartCompetitorsLink } from "@/features/competitors/start-competitors-link";
import { FormAlert } from "@/components/ui/form-message";
import { businessValidatorReportSchema } from "@/features/ai/schemas/business-validator";
import { recordFunnelEvent } from "@/features/onboarding/funnel-events";

export const metadata: Metadata = { title: "Validation report" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();
  const result = await getReport(user.id, id);

  if (!result) notFound();

  // §19 REPORT_VIEWED. Placed AFTER `getReport` returned a row, which is the
  // point at which the read has been authorised: `getReport` filters on
  // `user_id` and runs under RLS, so an unauthorised request has already gone
  // to notFound() above and records nothing.
  //
  // Not awaited — a customer reading their report must not wait on an
  // analytics write, and `recordFunnelEvent` never throws.
  void recordFunnelEvent("REPORT_VIEWED", { report_id: id });

  const { report: record, idea } = result;
  const title = idea?.title ?? "Business idea";

  // Stored JSON is re-validated before rendering: a report written by an older
  // prompt version must never crash the page.
  const parsed = businessValidatorReportSchema.safeParse(record.report_json);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/reports"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to reports
      </Link>

      {parsed.success ? (
        <ReportRenderer
          model={buildBusinessValidatorReportModel({
            title,
            report: parsed.data,
            createdAt: record.created_at,
            model: record.model,
            promptVersion: record.prompt_version,
            durationMs: record.duration_ms,
            tokens: record.tokens_used,
          })}
          actions={
            <>
              {/* The validated idea is the natural starting point for market
                  research, so the handoff lives where the verdict is read. */}
              {idea ? <StartResearchLink ideaId={idea.id} /> : null}
              {idea ? <StartCompetitorsLink ideaId={idea.id} /> : null}
              <DownloadPdfButton
                href={`/api/reports/${record.id}/pdf`}
                title={title}
                suffix="aiautomix-report"
              />
            </>
          }
        />
      ) : (
        <FormAlert variant="error">
          This report was saved in a format this version of the app can no
          longer render. Please run the validation again.
        </FormAlert>
      )}
    </div>
  );
}
