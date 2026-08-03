import { getWorkflowCatalog } from "@/features/ai/registry/catalog";
import { isPlatformConfigured } from "@/features/ai/providers";
import { getUser } from "@/lib/auth/session";
import {
  apiError,
  apiSuccess,
  logApiError,
  rateLimitOrError,
} from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/workflows — the workflows this deployment can execute. */
export async function GET() {
  const user = await getUser();
  if (!user) return apiError("UNAUTHORIZED", "You must be signed in.", 401);

  const limited = rateLimitOrError(user.id, "ai:workflows");
  if (limited) return limited;

  try {
    const workflows = await getWorkflowCatalog();
    return apiSuccess({
      configured: isPlatformConfigured(),
      workflows,
    });
  } catch (error) {
    logApiError("GET /api/ai/workflows", error);
    return apiError("INTERNAL_ERROR", "Could not load workflows.", 500);
  }
}
