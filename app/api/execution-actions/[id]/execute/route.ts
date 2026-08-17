import { apiError, apiSuccess } from "@/lib/api/response";
import { withApiAuth } from "@/lib/api/route-handler";
import { EXECUTION_EXECUTE_SCOPE } from "@/features/execution/constants";
import { getExecutionAccess } from "@/features/execution/permissions";
import { executeAction } from "@/features/execution/service";

/**
 * POST /api/execution-actions/:id/execute — dispatch one action.
 *
 * ---------------------------------------------------------------------------
 * The body is empty, and that is the security property
 * ---------------------------------------------------------------------------
 * Nothing authoritative comes from the request. Not the state, not the
 * approval, not the provider, not the attempt number, not the idempotency key,
 * and not a dry-run flag. The action id in the URL is the only input, and every
 * other decision is read from the database by the execution service.
 *
 * That is what makes the approval gate un-bypassable from a client: there is no
 * field to set. A caller who wants to execute an unapproved action has to
 * approve it first, through the approve endpoint, as themselves, into an
 * immutable audit row.
 *
 * `dryRun` is forced true. No real integration exists in this phase, and a
 * client-selectable provider would let someone report success for something
 * that never happened — or, worse, route a rehearsal to a real publisher.
 */
export const POST = withApiAuth<{ id: string }>(
  {
    route: "POST /api/execution-actions/[id]/execute",
    scope: EXECUTION_EXECUTE_SCOPE,
    errorMessage: "The action could not be executed.",
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

    // Server-decided. See the note above.
    const outcome = await executeAction(id, { dryRun: true });

    // A refused or failed execution is a 200 whose payload says so, matching
    // every other stage-runner in this platform: the request was handled
    // correctly, the work did not succeed, and the client needs the structured
    // detail either way.
    return apiSuccess({
      success: outcome.ok,
      actionId: outcome.actionId,
      runId: outcome.runId,
      state: outcome.state,
      attempt: outcome.attempt,
      provider: outcome.provider,
      // The idempotency guarantee, visible to the caller. §15.
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
