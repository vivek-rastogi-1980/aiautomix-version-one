/**
 * AI Business Execution — the vocabulary and the state machine.
 *
 * A plain module, no `server-only`: the service, the API routes, the UI and the
 * test suite all need these words to mean the same thing.
 *
 * ---------------------------------------------------------------------------
 * What this phase is, and is not
 * ---------------------------------------------------------------------------
 * This is the FOUNDATION for turning strategy into controlled action. It models
 * the plan, the action, the approval and the audit. It executes nothing real:
 * the only working provider is a mock, and the N8N adapter refuses to run until
 * it is configured.
 *
 * That ordering is deliberate. The dangerous parts of an execution system are
 * not the integrations — they are the state machine that decides what may run,
 * the approval gate that decides who said so, and the idempotency key that
 * decides whether it runs twice. Building those first, against a provider that
 * cannot post to anyone's LinkedIn, is how you find the bugs while they are
 * still cheap.
 *
 * ---------------------------------------------------------------------------
 * The division of authority
 * ---------------------------------------------------------------------------
 *   AIAUTOMIX decides WHAT should happen         — the strategy phases
 *   THE ENGINE decides WHETHER it is authorised  — this module
 *   THE USER approves anything consequential     — the approval gate
 *   THE PROVIDER decides HOW it is carried out   — the adapter
 *
 * No layer may do another layer's job. In particular, a provider never decides
 * whether it is allowed to run, and the UI never decides that an action is
 * approved.
 */

// ---------------------------------------------------------------------------
// Action states
// ---------------------------------------------------------------------------

export const ACTION_STATES = [
  "DRAFT",
  "READY",
  "AWAITING_APPROVAL",
  "APPROVED",
  "EXECUTING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type ActionState = (typeof ACTION_STATES)[number];

export const ACTION_STATE_LABELS: Record<ActionState, string> = {
  DRAFT: "Draft",
  READY: "Ready",
  AWAITING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved",
  EXECUTING: "Executing",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export const ACTION_STATE_MEANING: Record<ActionState, string> = {
  DRAFT: "Still being written. Nothing will run.",
  READY: "Complete and valid, waiting to be sent for approval or run.",
  AWAITING_APPROVAL: "Someone must review the consequences before this runs.",
  APPROVED: "A named person approved it. It may now execute.",
  EXECUTING: "Handed to a provider. Waiting for a result.",
  COMPLETED:
    "Finished successfully. Terminal — re-running requires a revision.",
  FAILED: "The provider returned an error. Retryable errors can be retried.",
  CANCELLED: "Stopped deliberately. Terminal.",
};

/** States from which nothing further happens without creating a new action. */
export const TERMINAL_STATES: readonly ActionState[] = [
  "COMPLETED",
  "CANCELLED",
];

export function isTerminal(state: ActionState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function isActionState(value: unknown): value is ActionState {
  return (
    typeof value === "string" &&
    (ACTION_STATES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// The state machine
// ---------------------------------------------------------------------------

/**
 * Why a transition was refused. Returned rather than thrown so a caller can
 * render the reason without string-matching an exception message.
 */
export type TransitionRefusal =
  | "unknown_state"
  | "not_allowed"
  | "terminal"
  | "approval_required"
  | "not_approved"
  | "retry_exhausted";

export interface TransitionContext {
  /** Does this action need a human to approve it before executing? */
  approvalRequired: boolean;
  /** Has a human actually approved it? */
  approved: boolean;
  /** Attempts already made. Compared against the server-owned cap. */
  retryCount: number;
  maxRetries: number;
}

/**
 * The transition table, written out rather than inferred.
 *
 * `COMPLETED` and `CANCELLED` map to empty lists, which is how the machine says
 * "terminal" without a special case. In particular COMPLETED → EXECUTING is
 * absent, and that absence is the rule §6 asks for: a completed action is a
 * historical fact. To do the thing again you create a revision, which is a new
 * action with its own id, its own approval and its own idempotency key. Letting
 * a completed action re-enter EXECUTING would make "did this run?" unanswerable
 * from the row, and the answer to that question is the whole point of an audit.
 */
export const ALLOWED_TRANSITIONS: Record<ActionState, readonly ActionState[]> =
  {
    DRAFT: ["READY", "CANCELLED"],
    READY: ["AWAITING_APPROVAL", "EXECUTING", "DRAFT", "CANCELLED"],
    AWAITING_APPROVAL: ["APPROVED", "READY", "CANCELLED"],
    APPROVED: ["EXECUTING", "CANCELLED"],
    EXECUTING: ["COMPLETED", "FAILED"],
    FAILED: ["EXECUTING", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };

export interface TransitionDecision {
  allowed: boolean;
  reason: TransitionRefusal | null;
  /** Human wording, safe to show a user. */
  message: string;
}

const OK: TransitionDecision = { allowed: true, reason: null, message: "" };

function refuse(
  reason: TransitionRefusal,
  message: string,
): TransitionDecision {
  return { allowed: false, reason, message };
}

/**
 * May this action move from `from` to `to`?
 *
 * The table is consulted first, then the guards. Both must pass. The guards are
 * where the approval gate actually lives: the table permits READY → EXECUTING
 * because an action that needs no approval should not have to pretend to seek
 * one, and the guard is what stops that path being used by an action that does.
 */
export function canTransition(
  from: ActionState,
  to: ActionState,
  context: TransitionContext,
): TransitionDecision {
  if (!isActionState(from) || !isActionState(to)) {
    return refuse("unknown_state", "That is not a state this system has.");
  }

  if (isTerminal(from)) {
    return refuse(
      "terminal",
      `This action is ${ACTION_STATE_LABELS[from].toLowerCase()} and cannot change. Create a revision to run it again.`,
    );
  }

  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    return refuse(
      "not_allowed",
      `An action cannot go from ${ACTION_STATE_LABELS[from]} to ${ACTION_STATE_LABELS[to]}.`,
    );
  }

  if (to === "EXECUTING") {
    // THE approval gate. Nothing else in the system is permitted to decide
    // this, and no request body can carry a flag that skips it.
    if (context.approvalRequired && !context.approved) {
      return refuse(
        "not_approved",
        "This action needs approval before it can run.",
      );
    }
    if (from === "READY" && context.approvalRequired) {
      return refuse(
        "approval_required",
        "This action must be sent for approval before it can run.",
      );
    }
    if (from === "FAILED" && context.retryCount >= context.maxRetries) {
      return refuse(
        "retry_exhausted",
        `This action has already been attempted ${context.retryCount} times.`,
      );
    }
  }

  return OK;
}

/** Every state reachable from `from` under this context. Used by the UI. */
export function availableTransitions(
  from: ActionState,
  context: TransitionContext,
): ActionState[] {
  return ACTION_STATES.filter((to) => canTransition(from, to, context).allowed);
}

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

export const ACTION_TYPES = [
  "CREATE_LANDING_PAGE",
  "GENERATE_CONTENT",
  "CREATE_SOCIAL_POST",
  "CREATE_BLOG_POST",
  "CREATE_LEAD_FORM",
  "CREATE_CRM_PIPELINE",
  "CREATE_EMAIL_SEQUENCE",
  "CREATE_ANALYTICS_CONFIGURATION",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export function isActionType(value: unknown): value is ActionType {
  return (
    typeof value === "string" &&
    (ACTION_TYPES as readonly string[]).includes(value)
  );
}

/**
 * What an action actually does to the world.
 *
 * This is the field approval is derived FROM, rather than a per-type opinion
 * about whether something feels risky. The rule is mechanical and therefore
 * testable: anything that leaves AIAutoMix needs a human to say yes.
 */
export const SIDE_EFFECTS = [
  "INTERNAL_DRAFT",
  "EXTERNAL_MUTATION",
  "PUBLIC_VISIBLE",
] as const;

export type SideEffect = (typeof SIDE_EFFECTS)[number];

export const SIDE_EFFECT_LABELS: Record<SideEffect, string> = {
  INTERNAL_DRAFT: "Draft inside AIAutoMix",
  EXTERNAL_MUTATION: "Changes an external system",
  PUBLIC_VISIBLE: "Visible to the public",
};

export const SIDE_EFFECT_MEANING: Record<SideEffect, string> = {
  INTERNAL_DRAFT:
    "Produces a draft that stays in this workspace. Nothing leaves AIAutoMix and nobody outside sees it.",
  EXTERNAL_MUTATION:
    "Creates or changes something in a system you own elsewhere. Reversing it may require going to that system.",
  PUBLIC_VISIBLE:
    "Puts something where strangers, customers and search engines can see it. Assume it cannot be fully un-seen.",
};

/**
 * The approval rule, in one line.
 *
 * §7 lists website changes, social publishing, emails, advertising and CRM
 * communication as approval-required. All of those are external or public, so
 * the rule generalises: only a draft that never leaves the workspace may run
 * unattended.
 */
export function approvalRequiredFor(sideEffect: SideEffect): boolean {
  return sideEffect !== "INTERNAL_DRAFT";
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export const PLAN_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function isPlanStatus(value: unknown): value is PlanStatus {
  return (
    typeof value === "string" &&
    (PLAN_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * A paused plan blocks execution of its actions.
 *
 * §27 asks for Pause. Pausing the plan rather than each action is the useful
 * granularity: the thing a founder wants at 2am is "stop everything", not
 * "stop these six things individually".
 */
export function planAllowsExecution(status: PlanStatus): boolean {
  return status === "ACTIVE";
}

// ---------------------------------------------------------------------------
// Execution records
// ---------------------------------------------------------------------------

export const EXECUTION_STATUSES = ["RUNNING", "SUCCEEDED", "FAILED"] as const;

export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const EXECUTION_STATUS_LABELS: Record<ExecutionStatus, string> = {
  RUNNING: "Running",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Why an execution failed, and whether trying again could possibly help.
 *
 * The split matters more than it looks. Retrying a network timeout is free and
 * often works. Retrying an authorisation failure burns the attempt budget,
 * delays the honest error and — for a provider that partially applied a change
 * before rejecting it — can duplicate a side effect. So the classification is a
 * closed vocabulary rather than a guess at an error string.
 */
export const ERROR_CODES = [
  "NETWORK_ERROR",
  "PROVIDER_TIMEOUT",
  "PROVIDER_UNAVAILABLE",
  "RATE_LIMITED",
  "PROVIDER_ERROR",
  "AUTHORIZATION_FAILED",
  "INVALID_INPUT",
  "APPROVAL_MISSING",
  "ENTITLEMENT_DENIED",
  "PROVIDER_NOT_CONFIGURED",
  "CANCELLED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Retryable codes. Everything not listed here is permanent by default. */
export const RETRYABLE_ERROR_CODES: readonly ErrorCode[] = [
  "NETWORK_ERROR",
  "PROVIDER_TIMEOUT",
  "PROVIDER_UNAVAILABLE",
  "RATE_LIMITED",
];

export function isRetryable(code: ErrorCode | string | null): boolean {
  return (
    typeof code === "string" &&
    (RETRYABLE_ERROR_CODES as readonly string[]).includes(code)
  );
}

export const ERROR_CODE_LABELS: Record<ErrorCode, string> = {
  NETWORK_ERROR: "Network error",
  PROVIDER_TIMEOUT: "Provider timed out",
  PROVIDER_UNAVAILABLE: "Provider unavailable",
  RATE_LIMITED: "Rate limited by the provider",
  PROVIDER_ERROR: "Provider rejected the request",
  AUTHORIZATION_FAILED: "Authorisation failed",
  INVALID_INPUT: "The action's input is not valid",
  APPROVAL_MISSING: "Approval is missing",
  ENTITLEMENT_DENIED: "Your plan does not include this",
  PROVIDER_NOT_CONFIGURED: "That integration is not connected yet",
  CANCELLED: "Cancelled",
};

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export const AUDIT_EVENTS = [
  "PLAN_CREATED",
  "PLAN_PAUSED",
  "PLAN_RESUMED",
  "PLAN_CANCELLED",
  "ACTION_CREATED",
  "ACTION_READY",
  "ACTION_SUBMITTED_FOR_APPROVAL",
  "ACTION_APPROVED",
  "ACTION_REJECTED",
  "ACTION_EXECUTION_STARTED",
  "ACTION_EXECUTION_SUCCEEDED",
  "ACTION_EXECUTION_FAILED",
  "ACTION_RETRIED",
  "ACTION_CANCELLED",
  "ACTION_REVISED",
] as const;

export type AuditEvent = (typeof AUDIT_EVENTS)[number];

export const AUDIT_EVENT_LABELS: Record<AuditEvent, string> = {
  PLAN_CREATED: "Plan created",
  PLAN_PAUSED: "Plan paused",
  PLAN_RESUMED: "Plan resumed",
  PLAN_CANCELLED: "Plan cancelled",
  ACTION_CREATED: "Action created",
  ACTION_READY: "Action marked ready",
  ACTION_SUBMITTED_FOR_APPROVAL: "Sent for approval",
  ACTION_APPROVED: "Approved",
  ACTION_REJECTED: "Rejected",
  ACTION_EXECUTION_STARTED: "Execution started",
  ACTION_EXECUTION_SUCCEEDED: "Execution succeeded",
  ACTION_EXECUTION_FAILED: "Execution failed",
  ACTION_RETRIED: "Retried",
  ACTION_CANCELLED: "Action cancelled",
  ACTION_REVISED: "Revision created",
};

// ---------------------------------------------------------------------------
// Effort — shown in the plan UI (§24)
// ---------------------------------------------------------------------------

export const EFFORT_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export const EFFORT_LABELS: Record<EffortLevel, string> = {
  LOW: "Minutes",
  MEDIUM: "Hours",
  HIGH: "Days",
};
