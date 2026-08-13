import { renderToBuffer } from "@react-pdf/renderer";

import { toPdfFilename } from "@/features/ai/pdf/filename";
import { ReportPdfDocument } from "@/features/ai/pdf/report-pdf";
import { getOpenAiModel } from "@/features/ai/providers/openai";
import { composeResearchReport } from "@/features/research/report/compose";
import { buildResearchReportModel } from "@/features/research/report/definition";
import { RESEARCH_WORKFLOWS } from "@/features/research/stages/workflows";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { canAccess } from "@/features/commerce/entitlements";
import { apiError } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";

/** @react-pdf/renderer needs the Node runtime (not Edge). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/research/:id/pdf — the branded A4 market research report.
 *
 * Reuses the Sprint 4 PDF Engine unchanged: the research feature supplies the
 * same `ReportDocumentModel` the web report renders, and gets the cover, logo,
 * running header/footer and page numbers for free. The three evidence blocks
 * Phase 5 added are handled inside that engine, so this route contains no
 * layout of its own.
 *
 * Authorisation is layered rather than assumed:
 *
 *   `withApiAuth` refuses an unauthenticated caller and rate-limits the rest —
 *   PDF rendering is the most expensive GET in the app, so the bucket is its
 *   own rather than shared.
 *
 *   The workspace comes from the session, never from the request, and the
 *   composer filters on it. A research id from another workspace returns no row
 *   and 404s — the same answer a nonexistent id gets, so the route cannot be
 *   used to discover which ids exist.
 *
 *   The entitlement is re-checked here. A workspace that has lost Market
 *   Research should not keep a working export URL, and this endpoint is
 *   reachable directly rather than only from the gated page.
 */
export const GET = withApiAuth<{ id: string }>(
  {
    route: "GET /api/research/:id/pdf",
    scope: "research-pdf",
    errorMessage: "Could not export the market research report.",
  },
  async ({ user, params: { id } }) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return apiError("INVALID_INPUT", "Invalid research id.", 422);
    }

    const { workspace } = await getWorkspaceContext(user.id);

    const access = await canAccess(workspace.id, "market_research");
    if (!access.allowed) {
      return apiError(
        "FORBIDDEN",
        "Your current plan does not include Market Research.",
        403,
      );
    }

    const composed = await composeResearchReport(workspace.id, id);

    if (!composed.report) {
      // "Not found" and "not finished" are genuinely different answers, but
      // neither reveals anything about another workspace: the composer already
      // returned nothing for a row this caller cannot read.
      return apiError(
        composed.reason === "Research not found."
          ? "NOT_FOUND"
          : "REPORT_NOT_READY",
        composed.reason,
        composed.reason === "Research not found." ? 404 : 422,
      );
    }

    const model = buildResearchReportModel({
      report: composed.report,
      model: getOpenAiModel(),
      promptVersion:
        RESEARCH_WORKFLOWS["research-report"]?.promptVersion ?? "v1",
    });

    const generatedAt = new Date(composed.report.generatedAt).toLocaleString(
      "en-US",
      { dateStyle: "long", timeStyle: "short", timeZone: "UTC" },
    );

    const buffer = await renderToBuffer(
      <ReportPdfDocument model={model} generatedAt={`${generatedAt} UTC`} />,
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        // `toPdfFilename` slugs the title, which is what keeps a user-supplied
        // string out of a response header.
        "Content-Disposition": `attachment; filename="${toPdfFilename(model.title, "aiautomix-market-research")}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  },
);
