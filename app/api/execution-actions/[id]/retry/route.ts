import { apiError, apiSuccess } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";
import { EXECUTION_EXECUTE_SCOPE } from "@/features/execution/constants";
import { getExecutionAccess } from "@/features/execution/permissions";
import { retryAction } from "@/features/execution/service";

/**
 * POST /api/execution-actions/:id/retry — try a failed action again.
 *
 * The retry COUNT is server-owned (§17): it is derived from the action's stored
 * `retry_count`, which only `execution_record_result` ever changes. There is no
 * request field for it, so a client cannot ask for ten attempts at a publishing
 * action and get ten posts.
 *
 * Retryability is also server-decided, from the stored error code rather than
 * from what the client believes. A non-retryable failure — bad input, missing
 * authorisation, an unconfigured provider — is refused here, because retrying
 * it burns the attempt budget, delays the honest error, and for a provider that
 * partially applied a change before rejecting it can duplicate a side effect.
 */
export const POST = withApiAuth<{ id: string }>(
  {
    route: "POST /api/execution-actions/[id]/retry",
    scope: EXECUTION_EXECUTE_SCOPE,
    errorMessage: "The action could not be retried.",
  },
  async ({ params: { id } }) => {
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
    if (!access.canExecute) {
      return apiError(
        "FORBIDDEN",
        "Your role in this workspace cannot execute actions.",
        403,
      );
    }

    const outcome = await retryAction(id, { dryRun: true });

    return apiSuccess({
      success: outcome.ok,
      actionId: outcome.actionId,
      runId: outcome.runId,
      state: outcome.state,
      attempt: outcome.attempt,
      provider: outcome.provider,
      deduplicated: outcome.deduplicated,
      externalId: outcome.externalId,
      summary: outcome.summary,
      errorCode: outcome.errorCode,
      message: outcome.message,
      durationMs: outcome.durationMs,
      retryable: outcome.retryable,
      dryRun: true,
    });
  },
);
