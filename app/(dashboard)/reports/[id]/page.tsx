import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireUser } from "@/lib/auth/session";
import { getReport } from "@/features/reports/data";
import { buildBusinessValidatorReportModel } from "@/features/reports/report-definition";
import { ReportRenderer } from "@/features/ai/renderer/report-renderer";
import { DownloadPdfButton } from "@/features/reports/download-pdf-button";
import { FormAlert } from "@/components/ui/form-message";
import { businessValidatorReportSchema } from "@/features/ai/schemas/business-validator";

export const metadata: Metadata = { title: "Validation report" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();
  const result = await getReport(user.id, id);

  if (!result) notFound();

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
          actions={<DownloadPdfButton reportId={record.id} title={title} />}
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
