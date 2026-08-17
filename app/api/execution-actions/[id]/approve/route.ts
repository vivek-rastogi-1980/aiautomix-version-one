import { apiError, apiSuccess } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";
import { EXECUTION_APPROVE_SCOPE } from "@/features/execution/constants";
import { getExecutionAccess } from "@/features/execution/permissions";
import { getExecutionAction } from "@/features/execution/data";
import { transitionAction } from "@/features/execution/service";
import { isActionState } from "@/features/execution/types";

/**
 * POST /api/execution-actions/:id/approve — record a human decision.
 *
 * ---------------------------------------------------------------------------
 * What the request body can and cannot say
 * ---------------------------------------------------------------------------
 * It can carry `decision` ("approve" or "reject") and a `reason`. It cannot
 * carry the action's state, the approver's identity, or a flag that skips the
 * check — all three come from the session and the database.
 *
 * The approver is `auth.uid()`, written by the SQL function. There is no
 * parameter for it, which means a caller cannot approve as somebody else, and
 * the audit row cannot name the wrong person.
 *
 * A rejection sends the action back to READY and CLEARS any prior approval, so
 * an action that was approved, rejected, and later approved again carries the
 * second approval rather than inheriting the first.
 */
export const POST = withApiAuth<{ id: string }>(
  {
    route: "POST /api/execution-actions/[id]/approve",
    scope: EXECUTION_APPROVE_SCOPE,
    errorMessage: "The approval could not be recorded.",
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
    if (!access.canApprove) {
      return apiError(
        "FORBIDDEN",
        "Your role in this workspace cannot approve actions.",
        403,
      );
    }

    let decision = "approve";
    let reason: string | null = null;
    try {
      const body = (await request.json()) as {
        decision?: unknown;
        reason?: unknown;
      };
      if (body?.decision === "reject") decision = "reject";
      if (typeof body?.reason === "string") reason = body.reason.slice(0, 2000);
    } catch {
      // An empty body means "approve". The default is the common case.
    }

    const view = await getExecutionAction(access.workspace.id, id);
    if (!view) {
      // 404 rather than 403: a caller must not be able to probe which action
      // ids exist in other workspaces.
      return apiError("NOT_FOUND", "Action not found.", 404);
    }

    const current = isActionState(view.row.status) ? view.row.status : "DRAFT";

    if (current !== "AWAITING_APPROVAL") {
      return apiError(
        "INVALID_STATE",
        `This action is ${current.toLowerCase().replace("_", " ")}, so there is nothing to approve.`,
        422,
      );
    }

    const target = decision === "reject" ? "READY" : "APPROVED";
    const result = await transitionAction(
      id,
      current,
      target,
      reason ?? undefined,
    );

    if (!result.ok) {
      return apiError("INVALID_STATE", result.message, 422);
    }

    return apiSuccess({
      actionId: id,
      decision,
      state: result.state,
      // Echoed so the UI can show what the approver is now responsible for.
      consequence: view.consequence,
      requiredIntegration: view.requiredIntegration,
      providerConfigured: view.providerConfigured,
    });
  },
);
