import { renderToBuffer } from "@react-pdf/renderer";

import { toPdfFilename } from "@/features/ai/pdf/filename";
import { ReportPdfDocument } from "@/features/ai/pdf/report-pdf";
import { getOpenAiModel } from "@/features/ai/providers/openai";
import { canAccess } from "@/features/commerce/entitlements";
import { FINANCIAL_ENTITLEMENT } from "@/features/financials/constants";
import { composeFinancialReport } from "@/features/financials/report/definition";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { apiError } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";

/** @react-pdf/renderer needs the Node runtime (not Edge). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/financials/:id/pdf — the branded A4 financial report.
 *
 * Reuses the Sprint 4 PDF Engine unchanged: this feature supplies the same
 * `ReportDocumentModel` the web report renders and gets the cover, logo,
 * running header/footer and page numbers for free. No layout lives here.
 *
 * Authorisation is layered: `withApiAuth` refuses an unauthenticated caller and
 * rate-limits the rest in its own bucket; the workspace comes from the session
 * rather than the request; and the entitlement is re-checked, because a
 * workspace that has lost Financial Intelligence should not keep a working
 * export URL for a document full of its own financial projections.
 */
export const GET = withApiAuth<{ id: string }>(
  {
    route: "GET /api/financials/:id/pdf",
    scope: "financials-pdf",
    errorMessage: "Could not export the financial report.",
  },
  async ({ user, params: { id } }) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return apiError("INVALID_INPUT", "Invalid financial project id.", 422);
    }

    const { workspace } = await getWorkspaceContext(user.id);

    const access = await canAccess(workspace.id, FINANCIAL_ENTITLEMENT);
    if (!access.allowed) {
      return apiError(
        "FORBIDDEN",
        "Your current plan does not include Financial Intelligence.",
        403,
      );
    }

    const composed = await composeFinancialReport(workspace.id, id);

    if (!("model" in composed)) {
      // "Not found" and "not finished" are different answers, but neither
      // reveals anything about another workspace: the composer already returned
      // nothing for a row this caller cannot read.
      const notFound = composed.reason === "Financial model not found.";
      return apiError(
        notFound ? "NOT_FOUND" : "REPORT_NOT_READY",
        composed.reason,
        notFound ? 404 : 422,
      );
    }

    const model = {
      ...composed.model,
      meta: { ...composed.model.meta, model: getOpenAiModel() },
    };

    const generatedAt = new Date(composed.generatedAt).toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    });

    const buffer = await renderToBuffer(
      <ReportPdfDocument model={model} generatedAt={`${generatedAt} UTC`} />,
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        // `toPdfFilename` slugs the title, keeping a user-supplied string out
        // of a response header.
        "Content-Disposition": `attachment; filename="${toPdfFilename(model.title, "aiautomix-financials")}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  },
);
