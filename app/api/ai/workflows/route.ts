import { getWorkflowCatalog } from "@/features/ai/registry/catalog";
import { isPlatformConfigured } from "@/features/ai";
import { apiSuccess } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/workflows — the workflows this deployment can execute. */
export const GET = withApiAuth(
  {
    route: "GET /api/ai/workflows",
    scope: "ai:workflows",
    errorMessage: "Could not load workflows.",
  },
  async () => {
    const workflows = await getWorkflowCatalog();
    return apiSuccess({
      configured: isPlatformConfigured(),
      workflows,
    });
  },
);
