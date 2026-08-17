import { apiError, apiSuccess } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";
import { EXECUTION_CANCEL_SCOPE } from "@/features/execution/constants";
import { getExecutionAccess } from "@/features/execution/permissions";
import { cancelAction } from "@/features/execution/service";

/**
 * POST /api/execution-actions/:id/cancel — stop an action deliberately.
 *
 * An action already EXECUTING is refused rather than cancelled. §27 is explicit
 * that an external operation must not be cancelled after it has started unless
 * the provider supports cancellation, and none does yet. Marking the row
 * CANCELLED would tell the user nothing happened while the provider carried on
 * — the worst of both, because the audit trail would then be wrong about the
 * one thing it exists to be right about.
 */
export const POST = withApiAuth<{ id: string }>(
  {
    route: "POST /api/execution-actions/[id]/cancel",
    scope: EXECUTION_CANCEL_SCOPE,
    errorMessage: "The action could not be cancelled.",
  },
  async ({ request, params: { id } }) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return apiError("INVALID_INPUT", "Invalid action id.", 422);
    }

    const access = await getExecutionAccess();

    if (!access.entitled) {
      return apiError(
        "FORBIDDEN",
        "This workspace's plan does not include Business Execution.",
        403,
      );
    }
    if (!access.canCreate) {
      return apiError(
        "FORBIDDEN",
        "Your role in this workspace cannot change actions.",
        403,
      );
    }

    let reason: string | undefined;
    try {
      const body = (await request.json()) as { reason?: unknown };
      if (typeof body?.reason === "string") reason = body.reason.slice(0, 2000);
    } catch {
      // No body is normal.
    }

    const result = await cancelAction(id, reason);

    if (!result.ok) {
      return apiError("INVALID_STATE", result.message, 422);
    }

    return apiSuccess({ actionId: id, state: result.state });
  },
);
