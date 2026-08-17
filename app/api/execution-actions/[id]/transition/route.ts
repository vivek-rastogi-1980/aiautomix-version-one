import { apiError, apiSuccess } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";
import { EXECUTION_APPROVE_SCOPE } from "@/features/execution/constants";
import { getExecutionAccess } from "@/features/execution/permissions";
import { getExecutionAction } from "@/features/execution/data";
import { transitionAction } from "@/features/execution/service";
import { isActionState } from "@/features/execution/types";

/**
 * POST /api/execution-actions/:id/transition — move an action along the
 * NON-approval part of the state machine.
 *
 * `to` is constrained to two values. APPROVED and EXECUTING are deliberately
 * unreachable here: approving goes through `/approve` so the approver is
 * recorded from the session, and executing goes through `/execute` so it passes
 * the full nine-step authorisation pipeline. A single endpoint that accepted
 * any target state would be a second path to the thing this phase exists to
 * control, and the second path is always the one that gets the check wrong.
 *
 * CANCELLED has its own endpoint too, because cancelling has a rule the others
 * do not: an action already executing must not be cancelled.
 */
const ALLOWED_TARGETS = ["READY", "AWAITING_APPROVAL"] as const;

export const POST = withApiAuth<{ id: string }>(
  {
    route: "POST /api/execution-actions/[id]/transition",
    scope: EXECUTION_APPROVE_SCOPE,
    errorMessage: "The action could not be changed.",
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

    let target: string | null = null;
    let reason: string | undefined;
    try {
      const body = (await request.json()) as { to?: unknown; reason?: unknown };
      if (typeof body?.to === "string") target = body.to;
      if (typeof body?.reason === "string") reason = body.reason.slice(0, 2000);
    } catch {
      return apiError("INVALID_INPUT", "A target state is required.", 422);
    }

    if (!target || !(ALLOWED_TARGETS as readonly string[]).includes(target)) {
      return apiError(
        "INVALID_INPUT",
        "This endpoint only moves an action to Ready or Awaiting approval.",
        422,
      );
    }

    const view = await getExecutionAction(access.workspace.id, id);
    if (!view) {
      return apiError("NOT_FOUND", "Action not found.", 404);
    }

    const current = isActionState(view.row.status) ? view.row.status : "DRAFT";
    const result = await transitionAction(
      id,
      current,
      target as "READY" | "AWAITING_APPROVAL",
      reason,
    );

    if (!result.ok) {
      return apiError("INVALID_STATE", result.message, 422);
    }

    return apiSuccess({ actionId: id, state: result.state });
  },
);
