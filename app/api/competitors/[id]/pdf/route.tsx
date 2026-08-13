import { renderToBuffer } from "@react-pdf/renderer";

import { toPdfFilename } from "@/features/ai/pdf/filename";
import { ReportPdfDocument } from "@/features/ai/pdf/report-pdf";
import { getOpenAiModel } from "@/features/ai/providers/openai";
import { canAccess } from "@/features/commerce/entitlements";
import { COMPETITOR_ENTITLEMENT } from "@/features/competitors/constants";
import { composeCompetitorReport } from "@/features/competitors/report/definition";
import { getWorkspaceContext } from "@/features/workspaces/data";
import { apiError } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";

/** @react-pdf/renderer needs the Node runtime (not Edge). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/competitors/:id/pdf — the branded A4 competitor report.
 *
 * Reuses the Sprint 4 PDF Engine unchanged: the feature supplies the same
 * `ReportDocumentModel` the web report renders, and gets the cover, logo,
 * running header/footer and page numbers for free. The evidence blocks the
 * report engine gained in Phase 5 are handled inside that engine, so this route
 * contains no layout of its own.
 *
 * Authorisation is layered rather than assumed:
 *
 *   `withApiAuth` refuses an unauthenticated caller and rate-limits the rest —
 *   PDF rendering is the most expensive GET in the app, so the bucket is its
 *   own rather than shared.
 *
 *   The workspace comes from the session, never from the request, and the
 *   composer filters on it. A project id from another workspace returns no row
 *   and 404s — the same answer a nonexistent id gets, so the route cannot be
 *   used to discover which ids exist.
 *
 *   The entitlement is re-checked here. A workspace that has lost Competitor
 *   Intelligence should not keep a working export URL, and this endpoint is
 *   reachable directly rather than only from the gated page.
 */
export const GET = withApiAuth<{ id: string }>(
  {
    route: "GET /api/competitors/:id/pdf",
    scope: "competitors-pdf",
    errorMessage: "Could not export the competitor report.",
  },
  async ({ user, params: { id } }) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return apiError("INVALID_INPUT", "Invalid competitor project id.", 422);
    }

    const { workspace } = await getWorkspaceContext(user.id);

    const access = await canAccess(workspace.id, COMPETITOR_ENTITLEMENT);
    if (!access.allowed) {
      return apiError(
        "FORBIDDEN",
        "Your current plan does not include Competitor Intelligence.",
        403,
      );
    }

    const composed = await composeCompetitorReport(workspace.id, id);

    if (!("model" in composed)) {
      // "Not found" and "not finished" are genuinely different answers, but
      // neither reveals anything about another workspace: the composer already
      // returned nothing for a row this caller cannot read.
      const notFound = composed.reason === "Competitor project not found.";
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
        // `toPdfFilename` slugs the title, which is what keeps a user-supplied
        // string out of a response header.
        "Content-Disposition": `attachment; filename="${toPdfFilename(model.title, "aiautomix-competitors")}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  },
);
