import { renderToBuffer } from "@react-pdf/renderer";

import { toPdfFilename } from "@/features/ai/pdf/filename";
import { ReportPdfDocument } from "@/features/ai/pdf/report-pdf";
import { getBusinessPlan } from "@/features/business-plans/data";
import { buildBusinessPlanReportModel } from "@/features/business-plans/report-definition";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { apiError } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";

/** @react-pdf/renderer needs the Node runtime (not Edge). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/business-plans/:id/pdf — the branded A4 plan.
 *
 * Reuses the Sprint 4 PDF Engine unchanged: the plan supplies a document model
 * and gets cover, logo, running header/footer and page numbers for free.
 */
export const GET = withApiAuth<{ id: string }>(
  {
    route: "GET /api/business-plans/:id/pdf",
    scope: "business-plan-pdf",
    errorMessage: "Could not export the business plan.",
  },
  async ({ user, params: { id } }) => {
    const { workspace } = await getWorkspaceContext(user.id);
    const result = await getBusinessPlan(workspace.id, id);

    if (!result) {
      return apiError("NOT_FOUND", "Business plan not found.", 404);
    }

    if (result.sections.length === 0) {
      return apiError(
        "PLAN_UNRENDERABLE",
        "This plan has no sections yet. Generate it again.",
        422,
      );
    }

    const model = buildBusinessPlanReportModel(result);
    const generatedAt = new Date(result.plan.created_at).toLocaleString(
      "en-US",
      { dateStyle: "long", timeStyle: "short", timeZone: "UTC" },
    );

    const buffer = await renderToBuffer(
      <ReportPdfDocument model={model} generatedAt={`${generatedAt} UTC`} />,
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${toPdfFilename(model.title, "aiautomix-business-plan")}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  },
);
