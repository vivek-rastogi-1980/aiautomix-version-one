import { type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { getUser } from "@/lib/auth/session";
import { getReport } from "@/features/reports/data";
import { businessValidatorReportSchema } from "@/features/ai/schemas/business-validator";
import { ReportPdfDocument } from "@/features/ai/pdf/report-pdf";
import { buildBusinessValidatorReportModel } from "@/features/reports/report-definition";
import { apiError, rateLimitOrError } from "@/lib/api/response";

/** @react-pdf/renderer needs the Node runtime (not Edge). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Turn a report title into a safe download filename. */
function toFilename(title: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "business-validation-report";
  return `${slug}-aiautomix-report.pdf`;
}

/**
 * GET /api/reports/:id/pdf — stream the branded A4 PDF for a report.
 * Auth + ownership enforced before any rendering work happens.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "You must be signed in.", 401);
  }

  const limited = rateLimitOrError(user.id, "report-pdf");
  if (limited) return limited;

  const { id } = await context.params;
  const result = await getReport(user.id, id);
  if (!result) {
    return apiError("NOT_FOUND", "Report not found.", 404);
  }

  const parsed = businessValidatorReportSchema.safeParse(
    result.report.report_json,
  );
  if (!parsed.success) {
    return apiError(
      "REPORT_UNRENDERABLE",
      "This report cannot be exported. Please run the validation again.",
      422,
    );
  }

  const title = result.idea?.title ?? "Business idea";
  const generatedAt = new Date(result.report.created_at).toLocaleString(
    "en-US",
    { dateStyle: "long", timeStyle: "short", timeZone: "UTC" },
  );

  // The PDF renders the same document model the page renders, so the export can
  // never drift from what the user saw on screen.
  const buffer = await renderToBuffer(
    <ReportPdfDocument
      model={buildBusinessValidatorReportModel({
        title,
        report: parsed.data,
        createdAt: result.report.created_at,
        model: result.report.model,
        promptVersion: result.report.prompt_version,
        durationMs: result.report.duration_ms,
        tokens: result.report.tokens_used,
      })}
      generatedAt={`${generatedAt} UTC`}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${toFilename(title)}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
