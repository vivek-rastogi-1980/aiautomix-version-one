import "server-only";

import { createClient } from "@/lib/supabase/server";
import { canAccess } from "@/features/commerce/entitlements";
import { canEdit } from "@/features/workspaces/roles";
import {
  EXECUTION_CREDIT_COST,
  EXECUTION_ENTITLEMENT,
  MAX_ATTEMPTS_CEILING,
  PROVIDER_TIMEOUT_MS,
} from "@/features/execution/constants";
import { executionKey } from "@/features/execution/idempotency";
import {
  findActionDefinition,
  maxAttemptsFor,
  validateActionInput,
} from "@/features/execution/registry";
import { resolveProvider } from "@/features/execution/providers";
import type { ExecutionResult } from "@/features/execution/providers/types";
import {
  canTransition,
  isActionState,
  isActionType,
  isPlanStatus,
  isRetryable,
  planAllowsExecution,
  type ActionState,
  type ActionType,
  type ErrorCode,
} from "@/features/execution/types";
import type { ExecutionActionRow } from "@/types/database";

/**
 * The execution service.
 *
 * ---------------------------------------------------------------------------
 * The authorisation pipeline, in order
 * ---------------------------------------------------------------------------
 * §22 specifies nine steps and the ORDER is the design. Each one is cheaper
 * than the next and each closes a door the next step would otherwise have to
 * defend:
 *
 *   1. AUTHENTICATE          — the route wrapper did this before we were called
 *   2. WORKSPACE AUTHORISE    — RLS returns nothing for another workspace's row
 *   3. ACTION EXISTS          — a 404 that reveals nothing about other workspaces
 *   4. STATE PERMITS          — the state machine, not a boolean on the request
 *   5. APPROVAL PRESENT       — checked here AND in SQL, because it matters most
 *   6. ENTITLEMENT            — the plan includes execution
 *   7. CREDITS                — zero in this phase; the call site exists anyway
 *   8. CREATE THE RUN         — unique idempotency key, so a duplicate collides
 *   9. DISPATCH               — only now does a provider learn anything
 *
 * A client cannot skip a step by sending a different body: there is no field in
 * any request that participates in steps 4 through 7. The action id is the only
 * thing a caller supplies, and everything else is read from the database.
 *
 * ---------------------------------------------------------------------------
 * Dispatch is synchronous in this phase, and the design does not depend on it
 * ---------------------------------------------------------------------------
 * §32 requires that a future provider be allowed to take longer than a request.
 * The run row is created BEFORE dispatch and closed AFTER, so an asynchronous
 * provider changes only who calls `execution_record_result` — a signed callback
 * instead of this function. No table, no state and no key changes. §32 also
 * forbids building a queue now, so there isn't one.
 */

export interface ExecuteOptions {
  /**
   * Force the mock provider.
   *
   * A SERVER decision, never a request field. Phase 10.1 sets it true for every
   * dispatch, because no real integration exists — a client that could choose
   * would be able to report success for something that never happened.
   */
  dryRun: boolean;
}

export interface ExecutionOutcome {
  ok: boolean;
  actionId: string;
  runId: string | null;
  state: ActionState;
  attempt: number;
  provider: string;
  /** True when an identical dispatch had already been recorded. §15. */
  deduplicated: boolean;
  externalId: string | null;
  summary: string | null;
  errorCode: ErrorCode | null;
  message: string;
  durationMs: number | null;
  retryable: boolean;
}

/** A refusal that never reached a provider. */
function refused(
  actionId: string,
  state: ActionState,
  errorCode: ErrorCode,
  message: string,
): ExecutionOutcome {
  return {
    ok: false,
    actionId,
    runId: null,
    state,
    attempt: 0,
    provider: "none",
    deduplicated: false,
    externalId: null,
    summary: null,
    errorCode,
    message,
    durationMs: null,
    retryable: false,
  };
}

async function loadAction(
  actionId: string,
): Promise<{ action: ExecutionActionRow; planStatus: string } | null> {
  const supabase = await createClient();

  // RLS scopes this to the caller's workspaces. A row from another workspace
  // comes back as "not found", which is also the right thing to tell the user.
  const { data: action } = await supabase
    .from("execution_actions")
    .select("*")
    .eq("id", actionId)
    .maybeSingle();

  if (!action) return null;

  const { data: plan } = await supabase
    .from("execution_plans")
    .select("status")
    .eq("id", action.execution_plan_id)
    .maybeSingle();

  return { action, planStatus: plan?.status ?? "CANCELLED" };
}

/**
 * Move an action to a new state.
 *
 * Every status change in the system goes through here, and every one carries
 * the state the caller believed the action was in. That expectation is checked
 * inside the SQL function under a row lock, so two tabs racing to approve and
 * execute cannot both succeed.
 */
export async function transitionAction(
  actionId: string,
  from: ActionState,
  to: ActionState,
  reason?: string,
): Promise<{ ok: boolean; message: string; state: ActionState }> {
  const loaded = await loadAction(actionId);
  if (!loaded) {
    return { ok: false, message: "Action not found.", state: from };
  }

  const { action } = loaded;
  const current = isActionState(action.status) ? action.status : "DRAFT";

  const decision = canTransition(current, to, {
    approvalRequired: action.approval_required,
    approved: Boolean(action.approved_by && action.approved_at),
    retryCount: action.retry_count,
    maxRetries: isActionType(action.action_type)
      ? maxAttemptsFor(action.action_type)
      : MAX_ATTEMPTS_CEILING,
  });

  if (!decision.allowed) {
    return { ok: false, message: decision.message, state: current };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("execution_transition", {
    p_action_id: actionId,
    p_expected_state: current,
    p_new_state: to,
    p_reason: reason ?? null,
  });

  if (error) {
    return { ok: false, message: error.message, state: current };
  }

  return {
    ok: true,
    message: "",
    state: typeof data === "string" && isActionState(data) ? data : to,
  };
}

/**
 * Execute an action.
 *
 * The nine steps, in order, with the reason each refusal is distinct: a user
 * who is told "not approved" can fix it, and a user told "access denied" cannot.
 */
export async function executeAction(
  actionId: string,
  options: ExecuteOptions = { dryRun: true },
): Promise<ExecutionOutcome> {
  // --- 3. The action exists and this caller may read it -------------------
  const loaded = await loadAction(actionId);
  if (!loaded) {
    return refused(
      actionId,
      "DRAFT",
      "AUTHORIZATION_FAILED",
      "Action not found.",
    );
  }

  const { action, planStatus } = loaded;
  const current = isActionState(action.status) ? action.status : "DRAFT";

  if (!isActionType(action.action_type)) {
    return refused(
      actionId,
      current,
      "INVALID_INPUT",
      "This action has a type this version does not know how to run.",
    );
  }

  const actionType: ActionType = action.action_type;
  const definition = findActionDefinition(actionType);
  if (!definition) {
    return refused(
      actionId,
      current,
      "INVALID_INPUT",
      "No registry entry exists for this action type.",
    );
  }

  // --- The plan must be active. Pausing stops everything under it. §27 ----
  const status = isPlanStatus(planStatus) ? planStatus : "CANCELLED";
  if (!planAllowsExecution(status)) {
    return refused(
      actionId,
      current,
      "INVALID_INPUT",
      `This plan is ${status.toLowerCase()}. Resume it before running actions.`,
    );
  }

  // --- 4 and 5. State and approval ---------------------------------------
  const attemptsAllowed = maxAttemptsFor(actionType);
  const decision = canTransition(current, "EXECUTING", {
    approvalRequired: action.approval_required,
    approved: Boolean(action.approved_by && action.approved_at),
    retryCount: action.retry_count,
    maxRetries: attemptsAllowed,
  });

  if (!decision.allowed) {
    const code: ErrorCode =
      decision.reason === "not_approved" ||
      decision.reason === "approval_required"
        ? "APPROVAL_MISSING"
        : "INVALID_INPUT";
    return refused(actionId, current, code, decision.message);
  }

  // --- 6. Entitlement -----------------------------------------------------
  const access = await canAccess(action.workspace_id, EXECUTION_ENTITLEMENT);
  if (!access.allowed) {
    return refused(
      actionId,
      current,
      "ENTITLEMENT_DENIED",
      "This workspace's plan does not include Business Execution.",
    );
  }

  // --- Re-validate the input against the registry ------------------------
  // It was validated when stored, but the schema may have tightened since, and
  // dispatching a payload nothing has vouched for is how a provider receives a
  // field it does not understand.
  const validated = validateActionInput(actionType, action.input);
  if (!validated.ok) {
    return refused(
      actionId,
      current,
      "INVALID_INPUT",
      `This action's input is no longer valid: ${validated.issues
        .map((issue) => `${issue.path || "input"} — ${issue.message}`)
        .join("; ")}`,
    );
  }

  // --- 7. Credits ---------------------------------------------------------
  // Zero in this phase, and the constant says why. The branch exists so a later
  // phase changes a number rather than adding a step to the pipeline.
  if (EXECUTION_CREDIT_COST > 0) {
    // Intentionally unreachable in Phase 10.1. See constants.ts.
  }

  const provider = resolveProvider(action.execution_provider, {
    dryRun: options.dryRun,
  });

  if (!provider) {
    return refused(
      actionId,
      current,
      "PROVIDER_NOT_CONFIGURED",
      `No provider is registered as "${action.execution_provider}".`,
    );
  }

  if (!provider.isConfigured()) {
    return refused(
      actionId,
      current,
      "PROVIDER_NOT_CONFIGURED",
      provider.unconfiguredReason() ??
        "That integration is not connected yet, so nothing was sent.",
    );
  }

  // --- Move to EXECUTING under a row lock --------------------------------
  const moved = await transitionAction(actionId, current, "EXECUTING");
  if (!moved.ok) {
    return refused(actionId, current, "INVALID_INPUT", moved.message);
  }

  // Attempt numbering is derived from the server-owned retry count. A client
  // has no way to influence it, so it cannot mint a fresh idempotency key by
  // claiming a different attempt.
  const attempt = action.retry_count + 1;
  const idempotencyKey = executionKey(actionId, attempt);

  const supabase = await createClient();

  // --- 8. Claim the run. A duplicate collides on the unique key. ----------
  const { data: claimRows, error: claimError } = await supabase.rpc(
    "execution_claim_run",
    {
      p_action_id: actionId,
      p_provider: provider.id,
      p_attempt: attempt,
      p_idempotency_key: idempotencyKey,
    },
  );

  if (claimError || !claimRows?.length) {
    // The action is EXECUTING but no run exists. Record the failure so it does
    // not sit there forever.
    await transitionAction(
      actionId,
      "EXECUTING",
      "FAILED",
      claimError?.message,
    );
    return refused(
      actionId,
      "FAILED",
      "PROVIDER_ERROR",
      claimError?.message ?? "Could not record this execution.",
    );
  }

  const runId = claimRows[0].run_id;
  const wasExisting = claimRows[0].was_existing === true;

  if (wasExisting) {
    // THE idempotency guarantee, observable. An identical dispatch does not
    // reach the provider a second time.
    return {
      ok: true,
      actionId,
      runId,
      state: current,
      attempt,
      provider: provider.id,
      deduplicated: true,
      externalId: null,
      summary: null,
      errorCode: null,
      message:
        "This exact execution was already recorded. Nothing was sent a second time.",
      durationMs: null,
      retryable: false,
    };
  }

  // --- 9. Dispatch --------------------------------------------------------
  const started = Date.now();
  let result: ExecutionResult;

  try {
    result = await provider.execute({
      actionId,
      actionType,
      workspaceId: action.workspace_id,
      idempotencyKey,
      attempt,
      input: validated.value,
      timeoutMs: PROVIDER_TIMEOUT_MS,
    });
  } catch (error) {
    // A provider that throws is a provider that failed. Treated as retryable
    // because an unhandled throw is usually transport, not logic.
    result = {
      ok: false,
      errorCode: "PROVIDER_ERROR",
      message:
        error instanceof Error
          ? error.message.slice(0, 500)
          : "The provider failed without an explanation.",
    };
  }

  const durationMs = Date.now() - started;

  if (result.ok) {
    // Validate what came back. A provider that returns the wrong shape has not
    // succeeded in any sense the rest of the system can use.
    const parsed = definition.outputSchema.safeParse(result.output);
    const output = parsed.success ? parsed.data : result.output;

    await supabase.rpc("execution_record_result", {
      p_run_id: runId,
      p_status: "SUCCEEDED",
      p_external_id: result.externalId,
      p_summary: result.summary,
      p_result: output as never,
      p_duration_ms: durationMs,
    });

    return {
      ok: true,
      actionId,
      runId,
      state: "COMPLETED",
      attempt,
      provider: provider.id,
      deduplicated: false,
      externalId: result.externalId,
      summary: result.summary,
      errorCode: null,
      message: result.summary,
      durationMs,
      retryable: false,
    };
  }

  await supabase.rpc("execution_record_result", {
    p_run_id: runId,
    p_status: "FAILED",
    p_external_id: result.externalId ?? null,
    p_error_code: result.errorCode,
    p_error_message: result.message,
    p_duration_ms: durationMs,
  });

  return {
    ok: false,
    actionId,
    runId,
    state: "FAILED",
    attempt,
    provider: provider.id,
    deduplicated: false,
    externalId: result.externalId ?? null,
    summary: null,
    errorCode: result.errorCode,
    message: result.message,
    durationMs,
    // Retryable AND within budget. Reporting "retryable" for an action that has
    // exhausted its attempts would offer the user a button that cannot work.
    retryable: isRetryable(result.errorCode) && attempt < attemptsAllowed,
  };
}

/**
 * Retry a failed action.
 *
 * A thin wrapper, and deliberately so: retry is not a different operation, it
 * is the same execution with the attempt counter one higher — which is exactly
 * what makes its idempotency key different and its side effect legitimate.
 *
 * The retryability check happens here rather than in the UI, because §17 puts
 * retry under server control and a client that could retry a non-retryable
 * failure would be a client that can duplicate a partially-applied change.
 */
export async function retryAction(
  actionId: string,
  options: ExecuteOptions = { dryRun: true },
): Promise<ExecutionOutcome> {
  const loaded = await loadAction(actionId);
  if (!loaded) {
    return refused(
      actionId,
      "DRAFT",
      "AUTHORIZATION_FAILED",
      "Action not found.",
    );
  }

  const { action } = loaded;
  const current = isActionState(action.status) ? action.status : "DRAFT";

  if (current !== "FAILED") {
    return refused(
      actionId,
      current,
      "INVALID_INPUT",
      "Only a failed action can be retried.",
    );
  }

  if (!isRetryable(action.error_code)) {
    return refused(
      actionId,
      current,
      "INVALID_INPUT",
      "This failure will not be fixed by trying again. Correct the action instead.",
    );
  }

  return executeAction(actionId, options);
}

/** Cancel an action, where its state permits. §27. */
export async function cancelAction(
  actionId: string,
  reason?: string,
): Promise<{ ok: boolean; message: string; state: ActionState }> {
  const loaded = await loadAction(actionId);
  if (!loaded) {
    return { ok: false, message: "Action not found.", state: "DRAFT" };
  }

  const current = isActionState(loaded.action.status)
    ? loaded.action.status
    : "DRAFT";

  // EXECUTING is deliberately not cancellable. §27: never cancel an external
  // operation after it has started unless the provider supports cancellation,
  // and none does yet. Marking it cancelled here would tell the user nothing
  // happened while the provider carried on.
  if (current === "EXECUTING") {
    return {
      ok: false,
      message:
        "This action is already running. It cannot be cancelled mid-flight — wait for the result.",
      state: current,
    };
  }

  return transitionAction(actionId, current, "CANCELLED", reason);
}

/** Whether the caller may act on this workspace at all. Used by the UI. */
export function canOperate(role: string): boolean {
  return canEdit(role as never);
}
