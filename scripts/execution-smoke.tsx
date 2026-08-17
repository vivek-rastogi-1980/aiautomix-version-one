/**
 * AI Business Execution tests (Phase 10.1).
 *
 * This phase executes nothing real, so almost every check here is about what
 * the system REFUSES to do. Sections:
 *
 *   STATE       The machine: every valid transition, every invalid one, and the
 *               specific one §6 names — COMPLETED can never re-enter EXECUTING.
 *   APPROVAL    Derived from the side effect, not declared per type. An
 *               unapproved action cannot execute, in TypeScript and in SQL.
 *   IDEMPOTENCY Keys are derived, not generated. Same attempt, same key.
 *   RETRY       Retryable and non-retryable are a closed vocabulary, and the
 *               attempt budget is server-owned.
 *   PROVIDER    The mock works and is deterministic; N8N refuses safely.
 *   WEBHOOK     Signature, timestamp, replay — the four checks, each falsified.
 *   SECURITY    No credentials reachable, no client-supplied authority, RLS,
 *               workspace isolation.
 *   MIRROR      The TypeScript machine and the SQL machine agree.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  ACTION_STATES,
  ACTION_STATE_LABELS,
  ACTION_STATE_MEANING,
  ACTION_TYPES,
  ALLOWED_TRANSITIONS,
  AUDIT_EVENTS,
  ERROR_CODES,
  ERROR_CODE_LABELS,
  PLAN_STATUSES,
  RETRYABLE_ERROR_CODES,
  SIDE_EFFECTS,
  SIDE_EFFECT_MEANING,
  TERMINAL_STATES,
  approvalRequiredFor,
  availableTransitions,
  canTransition,
  isActionState,
  isActionType,
  isPlanStatus,
  isRetryable,
  isTerminal,
  planAllowsExecution,
  type ActionState,
  type TransitionContext,
} from "@/features/execution/types";
import {
  ACTION_REGISTRY,
  CAUTIOUS_RETRY_POLICY,
  DEFAULT_RETRY_POLICY,
  MAX_ATTEMPTS_CEILING,
  getActionDefinition,
  findActionDefinition,
  maxAttemptsFor,
  requiresApproval,
  validateActionInput,
} from "@/features/execution/registry";
import {
  IDEMPOTENCY_NAMESPACE,
  chargeKey,
  executionKey,
  parseExecutionKey,
  refundKey,
} from "@/features/execution/idempotency";
import {
  PROVIDER_IDS,
  getProvider,
  listProviders,
  mockProvider,
  n8nProvider,
  resolveProvider,
} from "@/features/execution/providers";
import {
  IDEMPOTENCY_HEADER,
  NONCE_HEADER,
  SIGNATURE_HEADER,
  SIGNATURE_WINDOW_SECONDS,
  TIMESTAMP_HEADER,
  createMemoryNonceStore,
  generateNonce,
  readSignedHeaders,
  safeEqual,
  signPayload,
  signingString,
  verifySignedRequest,
} from "@/features/execution/webhook-security";
import {
  EXECUTION_CREDIT_COST,
  EXECUTION_ENTITLEMENT,
} from "@/features/execution/constants";
import { FEATURES } from "@/features/commerce/types";

const results: string[] = [];
let failures = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (!condition) failures += 1;
  results.push(
    `${condition ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`,
  );
}

function eq(name: string, actual: unknown, expected: unknown): void {
  const ok = actual === expected;
  check(
    name,
    ok,
    ok ? "" : `expected ${String(expected)}, got ${String(actual)}`,
  );
}

function read(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), "utf8");
}

/** Source with comments removed, so prose cannot satisfy a structural test. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** A permissive context: approved, no approval needed, attempts remaining. */
function ctx(overrides: Partial<TransitionContext> = {}): TransitionContext {
  return {
    approvalRequired: false,
    approved: true,
    retryCount: 0,
    maxRetries: 3,
    ...overrides,
  };
}

async function main(): Promise<void> {
  const migration = read(
    "supabase/migrations/0018_phase10_execution_foundation.sql",
  );
  const seedMigration = read(
    "supabase/migrations/0007_sprint6_5_commercial_platform.sql",
  );
  const service = read("features/execution/service.ts");
  const registrySource = read("features/execution/registry.ts");
  const n8nSource = read("features/execution/providers/n8n.ts");
  const mockSource = read("features/execution/providers/mock.ts");
  const executeRoute = read("app/api/execution-actions/[id]/execute/route.ts");
  const approveRoute = read("app/api/execution-actions/[id]/approve/route.ts");
  const retryRoute = read("app/api/execution-actions/[id]/retry/route.ts");
  const cancelRoute = read("app/api/execution-actions/[id]/cancel/route.ts");
  const transitionRoute = read(
    "app/api/execution-actions/[id]/transition/route.ts",
  );
  const actionsSource = read("features/execution/actions.ts");
  const controls = read("features/execution/action-controls.tsx");
  const dataSource = read("features/execution/data.ts");
  const listPage = read("app/(dashboard)/execution/page.tsx");
  const detailPage = read("app/(dashboard)/execution/[id]/page.tsx");
  const adminOps = read("features/admin/research-ops.ts");

  // =========================================================================
  // STATE MACHINE
  // =========================================================================

  eq("eight action states", ACTION_STATES.length, 8);
  check(
    "every state has a label and a plain-language meaning",
    ACTION_STATES.every(
      (state) =>
        ACTION_STATE_LABELS[state] && ACTION_STATE_MEANING[state].length > 10,
    ),
  );
  check(
    "COMPLETED and CANCELLED are the terminal states",
    TERMINAL_STATES.slice().sort().join(",") === "CANCELLED,COMPLETED",
  );
  check(
    "isTerminal agrees with the list",
    ACTION_STATES.every(
      (state) =>
        isTerminal(state) ===
        (TERMINAL_STATES as readonly string[]).includes(state),
    ),
  );

  // --- Valid transitions succeed ------------------------------------------
  const validPath: [ActionState, ActionState][] = [
    ["DRAFT", "READY"],
    ["READY", "AWAITING_APPROVAL"],
    ["AWAITING_APPROVAL", "APPROVED"],
    ["APPROVED", "EXECUTING"],
    ["EXECUTING", "COMPLETED"],
  ];
  for (const [from, to] of validPath) {
    check(
      `VALID ${from} → ${to}`,
      canTransition(from, to, ctx({ approvalRequired: true, approved: true }))
        .allowed,
    );
  }
  check(
    "VALID EXECUTING → FAILED",
    canTransition("EXECUTING", "FAILED", ctx()).allowed,
  );
  check(
    "VALID FAILED → EXECUTING (a retry)",
    canTransition("FAILED", "EXECUTING", ctx()).allowed,
  );
  check(
    "VALID AWAITING_APPROVAL → READY (a rejection)",
    canTransition("AWAITING_APPROVAL", "READY", ctx()).allowed,
  );

  // --- Invalid transitions fail -------------------------------------------
  /**
   * THE rule §6 names explicitly. A completed action is a historical fact;
   * running the thing again means a new action with its own id, its own
   * approval and its own idempotency key.
   */
  const completedToExecuting = canTransition("COMPLETED", "EXECUTING", ctx());
  check(
    "INVALID COMPLETED → EXECUTING is refused",
    !completedToExecuting.allowed,
  );
  eq(
    "and it is refused as terminal, not merely disallowed",
    completedToExecuting.reason,
    "terminal",
  );
  check(
    "the refusal tells the user what to do instead",
    /revision/i.test(completedToExecuting.message),
  );

  const invalid: [ActionState, ActionState][] = [
    ["DRAFT", "EXECUTING"],
    ["DRAFT", "APPROVED"],
    ["READY", "COMPLETED"],
    ["AWAITING_APPROVAL", "EXECUTING"],
    ["APPROVED", "COMPLETED"],
    ["EXECUTING", "CANCELLED"],
    ["CANCELLED", "READY"],
    ["COMPLETED", "FAILED"],
    ["FAILED", "COMPLETED"],
  ];
  for (const [from, to] of invalid) {
    check(
      `INVALID ${from} → ${to} is refused`,
      !canTransition(from, to, ctx()).allowed,
    );
  }

  check(
    "an unknown state is refused rather than defaulting",
    !canTransition("NOPE" as ActionState, "READY", ctx()).allowed,
  );
  check(
    "every terminal state has an empty transition list",
    TERMINAL_STATES.every((state) => ALLOWED_TRANSITIONS[state].length === 0),
  );
  check(
    "every listed target is a real state",
    Object.values(ALLOWED_TRANSITIONS).every((targets) =>
      targets.every((target) => isActionState(target)),
    ),
  );
  check("a known state validates", isActionState("APPROVED"));
  check("an invented state is refused", !isActionState("SORT_OF_DONE"));
  check(
    "availableTransitions never offers a terminal move",
    availableTransitions("COMPLETED", ctx()).length === 0,
  );

  // =========================================================================
  // APPROVAL
  // =========================================================================

  check(
    "an approval-required action cannot execute without approval",
    !canTransition(
      "APPROVED",
      "EXECUTING",
      ctx({
        approvalRequired: true,
        approved: false,
      }),
    ).allowed,
  );
  eq(
    "and the refusal names approval as the reason",
    canTransition(
      "APPROVED",
      "EXECUTING",
      ctx({
        approvalRequired: true,
        approved: false,
      }),
    ).reason,
    "not_approved",
  );
  check(
    "an approved action CAN execute",
    canTransition(
      "APPROVED",
      "EXECUTING",
      ctx({
        approvalRequired: true,
        approved: true,
      }),
    ).allowed,
  );
  check(
    "an approval-required action cannot skip straight from READY to EXECUTING",
    !canTransition(
      "READY",
      "EXECUTING",
      ctx({
        approvalRequired: true,
        approved: false,
      }),
    ).allowed,
  );
  check(
    "but an internal draft CAN run straight from READY",
    canTransition("READY", "EXECUTING", ctx({ approvalRequired: false }))
      .allowed,
    "an action that never leaves the workspace should not have to pretend to seek approval",
  );

  // --- The rule is derived, not declared per type -------------------------
  eq("three side effects", SIDE_EFFECTS.length, 3);
  check(
    "every side effect explains itself",
    SIDE_EFFECTS.every((effect) => SIDE_EFFECT_MEANING[effect].length > 20),
  );
  check(
    "only an internal draft may run unattended",
    approvalRequiredFor("EXTERNAL_MUTATION") &&
      approvalRequiredFor("PUBLIC_VISIBLE") &&
      !approvalRequiredFor("INTERNAL_DRAFT"),
  );
  for (const actionType of ACTION_TYPES) {
    const definition = getActionDefinition(actionType);
    check(
      `'${actionType}' derives approval from its side effect`,
      requiresApproval(definition) ===
        approvalRequiredFor(definition.sideEffect),
    );
  }
  check(
    "EVERY action that leaves AIAutoMix requires approval",
    ACTION_TYPES.filter(
      (type) => getActionDefinition(type).sideEffect !== "INTERNAL_DRAFT",
    ).every((type) => requiresApproval(getActionDefinition(type))),
  );
  eq(
    "exactly one action type is an internal draft",
    ACTION_TYPES.filter(
      (type) => getActionDefinition(type).sideEffect === "INTERNAL_DRAFT",
    ).length,
    1,
  );
  check(
    "and it is GENERATE_CONTENT",
    getActionDefinition("GENERATE_CONTENT").sideEffect === "INTERNAL_DRAFT",
  );
  check(
    "the §7 list — website, social, email, ads, CRM — all require approval",
    (
      [
        "CREATE_LANDING_PAGE",
        "CREATE_SOCIAL_POST",
        "CREATE_BLOG_POST",
        "CREATE_EMAIL_SEQUENCE",
        "CREATE_CRM_PIPELINE",
      ] as const
    ).every((type) => requiresApproval(getActionDefinition(type))),
  );

  // --- The approval gate in SQL -------------------------------------------
  check(
    "SQL refuses to move an unapproved action into EXECUTING",
    /needs approval before it can run/.test(migration),
  );
  check(
    "a check constraint stops an unapproved row LOOKING approved",
    /execution_actions_approval_recorded/.test(migration) &&
      /approved_by is not null and approved_at is not null/.test(migration),
  );
  check(
    "the approver is auth.uid(), never a parameter",
    /approved_by = auth\.uid\(\)/.test(migration) &&
      !/p_approved_by/.test(migration),
    "a caller must not be able to approve as somebody else",
  );
  check(
    "a rejection clears any prior approval",
    /approved_by = null, approved_at = null/.test(migration),
    "so a later approval cannot inherit an earlier one",
  );
  check(
    "the audit table is append-only, reusing 0008's trigger",
    /reject_audit_mutation/.test(migration) &&
      /execution_audit_logs_no_update/.test(migration) &&
      /execution_audit_logs_no_delete/.test(migration),
  );
  check(
    "the audit row records actor, role, event, entity and both states",
    [
      "actor_user_id",
      "actor_role",
      "event",
      "entity_type",
      "entity_id",
      "previous_state",
      "new_state",
    ].every((column) => migration.includes(column)),
  );
  check(
    "the actor role is denormalised, so a later demotion cannot rewrite history",
    /actor_role AT THE TIME|role AT THE TIME|at the time/i.test(migration),
  );
  eq("fifteen audit events", AUDIT_EVENTS.length, 15);
  check(
    "every audit event is constrained in SQL",
    AUDIT_EVENTS.every((event) => migration.includes(`'${event}'`)),
  );

  // =========================================================================
  // IDEMPOTENCY
  // =========================================================================

  eq(
    "a key is namespaced, action-scoped and attempt-scoped",
    executionKey("abc", 1),
    "exec:abc:1",
  );
  eq("the namespace is distinct", IDEMPOTENCY_NAMESPACE, "exec");
  check(
    "the same attempt always derives the same key",
    executionKey("abc", 2) === executionKey("abc", 2),
    "determinism is the whole feature",
  );
  check(
    "a different attempt derives a different key",
    executionKey("abc", 1) !== executionKey("abc", 2),
    "a retry is a new external effect and must be allowed to happen",
  );
  check(
    "a different action derives a different key",
    executionKey("abc", 1) !== executionKey("abd", 1),
  );
  check(
    "charge and refund keys are separate namespaces again",
    chargeKey("a", 1) !== executionKey("a", 1) &&
      refundKey("a", 1) !== chargeKey("a", 1),
  );
  check(
    "no other feature can collide on a shared id",
    ["research:", "competitor:", "financial:", "gtm:"].every(
      (prefix) => !executionKey("a", 1).startsWith(prefix),
    ),
  );
  const parsed = parseExecutionKey("exec:xyz:3");
  check(
    "a key round-trips",
    parsed?.actionId === "xyz" && parsed?.attempt === 3,
  );
  eq("a malformed key parses to null", parseExecutionKey("nope"), null);
  eq(
    "a key from another namespace parses to null",
    parseExecutionKey("gtm:xyz:3"),
    null,
  );

  check(
    "the key column is UNIQUE, so a duplicate collides rather than racing",
    /idempotency_key\s+text not null unique/.test(migration),
  );
  check(
    "a collision returns the EXISTING run instead of creating a second",
    /was_existing/.test(migration) &&
      /select id into v_existing[\s\S]{0,200}from public\.execution_runs/.test(
        migration,
      ),
  );
  check(
    "the service reports deduplication to the caller",
    code(service).includes("deduplicated: true"),
  );
  check(
    "the attempt number comes from the server-owned retry count",
    /const attempt = action\.retry_count \+ 1/.test(code(service)),
    "a client cannot mint a fresh key by claiming a different attempt",
  );
  check(
    "no route accepts an idempotency key from the client",
    [
      executeRoute,
      retryRoute,
      approveRoute,
      cancelRoute,
      transitionRoute,
    ].every((route) => !/idempotency/i.test(code(route))),
  );

  // =========================================================================
  // RETRY
  // =========================================================================

  eq("eleven error codes", ERROR_CODES.length, 11);
  check(
    "every code has a label",
    ERROR_CODES.every((codeName) => Boolean(ERROR_CODE_LABELS[codeName])),
  );
  check(
    "network, timeout, unavailable and rate-limit are retryable",
    (
      [
        "NETWORK_ERROR",
        "PROVIDER_TIMEOUT",
        "PROVIDER_UNAVAILABLE",
        "RATE_LIMITED",
      ] as const
    ).every((codeName) => isRetryable(codeName)),
  );
  check(
    "authorisation, invalid input, missing approval and entitlement are NOT",
    (
      [
        "AUTHORIZATION_FAILED",
        "INVALID_INPUT",
        "APPROVAL_MISSING",
        "ENTITLEMENT_DENIED",
      ] as const
    ).every((codeName) => !isRetryable(codeName)),
    "retrying these burns the budget and can duplicate a partial change",
  );
  check(
    "an unconfigured provider is not retryable",
    !isRetryable("PROVIDER_NOT_CONFIGURED"),
  );
  check(
    "anything not on the retryable list is permanent by default",
    ERROR_CODES.filter(
      (codeName) =>
        !(RETRYABLE_ERROR_CODES as readonly string[]).includes(codeName),
    ).every((codeName) => !isRetryable(codeName)),
  );
  eq("an unknown code is not retryable", isRetryable("SOMETHING_ELSE"), false);
  eq("a null code is not retryable", isRetryable(null), false);

  check(
    "a retry is refused once the attempt budget is spent",
    !canTransition("FAILED", "EXECUTING", ctx({ retryCount: 3, maxRetries: 3 }))
      .allowed,
  );
  eq(
    "and the refusal names exhaustion",
    canTransition("FAILED", "EXECUTING", ctx({ retryCount: 3, maxRetries: 3 }))
      .reason,
    "retry_exhausted",
  );
  check(
    "a retry is allowed while attempts remain",
    canTransition("FAILED", "EXECUTING", ctx({ retryCount: 1, maxRetries: 3 }))
      .allowed,
  );

  eq("the ceiling is five attempts", MAX_ATTEMPTS_CEILING, 5);
  check(
    "no registry entry exceeds the ceiling",
    ACTION_TYPES.every((type) => maxAttemptsFor(type) <= MAX_ATTEMPTS_CEILING),
  );
  check(
    "SQL caps retry_count at the same ceiling",
    /retry_count[\s\S]{0,80}<= 5/.test(migration),
  );
  check(
    "no RPC accepts a retry count as a parameter",
    !/p_retry_count/.test(migration),
    "§17 puts retry under server control",
  );
  check(
    "only execution_record_result changes retry_count",
    (migration.match(/retry_count\s*=/g) ?? []).length === 1,
  );
  check(
    "no route accepts a retry count from the client",
    [executeRoute, retryRoute].every(
      (route) => !/retryCount|retry_count|maxAttempts/.test(code(route)),
    ),
  );
  check(
    "the service refuses to retry a non-retryable failure",
    code(service).includes("if (!isRetryable(action.error_code))"),
  );

  // --- Cautious policy for the expensive duplicates ----------------------
  eq(
    "the default policy is three attempts",
    DEFAULT_RETRY_POLICY.maxAttempts,
    3,
  );
  eq("the cautious policy is one", CAUTIOUS_RETRY_POLICY.maxAttempts, 1);
  check(
    "social posts and email sequences use the cautious policy",
    getActionDefinition("CREATE_SOCIAL_POST").retryPolicy.maxAttempts === 1 &&
      getActionDefinition("CREATE_EMAIL_SEQUENCE").retryPolicy.maxAttempts ===
        1,
    "a duplicate post or a duplicate sequence is expensive and embarrassing",
  );

  // =========================================================================
  // REGISTRY
  // =========================================================================

  eq("eight action types", ACTION_TYPES.length, 8);
  check(
    "every type has a registry entry",
    ACTION_TYPES.every((type) => Boolean(ACTION_REGISTRY[type])),
  );
  check(
    "every entry declares itself consistently",
    ACTION_TYPES.every((type) => getActionDefinition(type).actionType === type),
  );
  check(
    "every entry names a provider that exists",
    ACTION_TYPES.every((type) =>
      PROVIDER_IDS.includes(getActionDefinition(type).provider),
    ),
  );
  check(
    "every entry states its consequence in a sentence",
    ACTION_TYPES.every(
      (type) => getActionDefinition(type).consequence.length > 30,
    ),
    "§25 forbids hiding consequences",
  );
  check(
    "every entry names the integration a user would need",
    ACTION_TYPES.every(
      (type) => getActionDefinition(type).requiredIntegration.length > 3,
    ),
  );
  check("a known type validates", isActionType("CREATE_BLOG_POST"));
  check("an invented type is refused", !isActionType("MINT_NFT"));
  eq("an unknown type has no definition", findActionDefinition("nope"), null);

  // --- Typed inputs, no untyped blobs -------------------------------------
  check(
    "the registry declares no `any` payload",
    !/:\s*any\b/.test(code(registrySource)),
    "§10 forbids untyped payloads",
  );
  check(
    "a valid landing-page input parses",
    validateActionInput("CREATE_LANDING_PAGE", {
      pageTitle: "Spring offer",
      slug: "spring-offer",
      headline: "Fewer no-shows",
      bodyCopy: "Body copy here.",
      callToAction: "Book a demo",
      destination: { label: "example.com" },
    }).ok,
  );
  check(
    "an invalid slug is refused",
    !validateActionInput("CREATE_LANDING_PAGE", {
      pageTitle: "Spring offer",
      slug: "Spring Offer!",
      headline: "Fewer no-shows",
      bodyCopy: "Body copy here.",
      callToAction: "Book",
      destination: { label: "example.com" },
    }).ok,
  );
  check(
    "a missing required field is refused, with a path",
    (() => {
      const result = validateActionInput("CREATE_SOCIAL_POST", {
        network: "linkedin",
      });
      return (
        !result.ok && result.issues.length > 0 && result.issues[0]!.path !== ""
      );
    })(),
  );
  check(
    "an unknown network is refused",
    !validateActionInput("CREATE_SOCIAL_POST", {
      network: "myspace",
      content: "hello",
      destination: { label: "Company page" },
    }).ok,
  );
  check(
    "no registry input schema has a field for a credential",
    !/token|secret|apiKey|api_key|password|credential/i.test(
      code(registrySource),
    ),
    "the domain model has nowhere to put a credential",
  );

  // =========================================================================
  // PROVIDERS
  // =========================================================================

  eq("two providers are registered", PROVIDER_IDS.length, 2);
  check("both resolve by id", listProviders().length === 2);
  eq("an unknown provider resolves to null", getProvider("wordpress"), null);

  check("the mock is configured", mockProvider.isConfigured());
  eq("and has no unconfigured reason", mockProvider.unconfiguredReason(), null);

  const mockResult = await mockProvider.execute({
    actionId: "action-1",
    actionType: "GENERATE_CONTENT",
    workspaceId: "workspace-1",
    idempotencyKey: executionKey("action-1", 1),
    attempt: 1,
    input: { brief: "Write something", format: "blog" },
    timeoutMs: 1000,
  });
  check("the mock succeeds", mockResult.ok);
  check(
    "and says plainly that nothing was published",
    mockResult.ok && /nothing was published or sent/i.test(mockResult.summary),
  );

  const mockRepeat = await mockProvider.execute({
    actionId: "action-1",
    actionType: "GENERATE_CONTENT",
    workspaceId: "workspace-1",
    idempotencyKey: executionKey("action-1", 1),
    attempt: 1,
    input: { brief: "Write something", format: "blog" },
    timeoutMs: 1000,
  });
  check(
    "the mock is deterministic: same key in, same external id out",
    mockResult.ok &&
      mockRepeat.ok &&
      mockResult.externalId === mockRepeat.externalId,
    "a random id would make the idempotency tests unfalsifiable",
  );

  const mockDifferent = await mockProvider.execute({
    actionId: "action-1",
    actionType: "GENERATE_CONTENT",
    workspaceId: "workspace-1",
    idempotencyKey: executionKey("action-1", 2),
    attempt: 2,
    input: { brief: "Write something", format: "blog" },
    timeoutMs: 1000,
  });
  check(
    "a different key yields a different id",
    mockDifferent.ok &&
      mockResult.ok &&
      mockDifferent.externalId !== mockResult.externalId,
  );

  for (const [simulate, expected, retryableExpectation] of [
    ["network_error", "NETWORK_ERROR", true],
    ["timeout", "PROVIDER_TIMEOUT", true],
    ["invalid", "INVALID_INPUT", false],
    ["authorization", "AUTHORIZATION_FAILED", false],
  ] as const) {
    const failure = await mockProvider.execute({
      actionId: "a",
      actionType: "GENERATE_CONTENT",
      workspaceId: "w",
      idempotencyKey: "exec:a:1",
      attempt: 1,
      input: { simulate },
      timeoutMs: 1000,
    });
    check(
      `the mock can simulate ${simulate}`,
      !failure.ok && failure.errorCode === expected,
    );
    eq(
      `and ${expected} retryability is ${retryableExpectation}`,
      isRetryable(expected),
      retryableExpectation,
    );
  }

  // --- N8N refuses safely -------------------------------------------------
  check(
    "N8N reports itself unconfigured without credentials",
    !n8nProvider.isConfigured(),
  );
  check(
    "and explains why in words a user can act on",
    (n8nProvider.unconfiguredReason() ?? "").length > 20,
  );
  const n8nResult = await n8nProvider.execute({
    actionId: "a",
    actionType: "CREATE_SOCIAL_POST",
    workspaceId: "w",
    idempotencyKey: "exec:a:1",
    attempt: 1,
    input: {},
    timeoutMs: 1000,
  });
  check(
    "N8N refuses rather than attempting anything",
    !n8nResult.ok && n8nResult.errorCode === "PROVIDER_NOT_CONFIGURED",
  );
  check(
    "and says plainly that nothing was sent",
    !n8nResult.ok && /nothing was sent anywhere/i.test(n8nResult.message),
  );
  check(
    "the N8N adapter makes no network call in this phase",
    !/fetch\(|axios|http\.request/.test(code(n8nSource)),
  );
  check(
    "it reads credentials from the environment on the server only",
    /process\.env\.N8N_/.test(n8nSource),
  );
  check(
    "the config reader is private — nothing exported hands out a credential",
    !/export\s+(function|const)\s+readConfig/.test(n8nSource) &&
      typeof n8nProvider.isConfigured() === "boolean",
    "isConfigured returns a boolean, not the URL",
  );
  check(
    "the unconfigured reason leaks no configuration value",
    !/https?:\/\//.test(n8nProvider.unconfiguredReason() ?? ""),
  );
  check(
    "it requires https, so a plaintext base URL is treated as unconfigured",
    /protocol !== "https:"/.test(n8nSource),
  );

  // --- The provider abstraction stays clean -------------------------------
  check(
    "the domain model does not hard-code N8N",
    !/n8n/i.test(code(read("features/execution/types.ts"))),
    "§12: the transport must not leak into the rules",
  );
  check(
    "the service does not import a provider directly",
    !/providers\/(n8n|mock)/.test(code(service)),
    "it asks the registry, which is the composition root",
  );
  check(
    "dry-run resolution is a server decision, not a request field",
    /resolveProvider\(/.test(code(service)) &&
      !/body[\s\S]{0,120}dryRun/.test(code(executeRoute)),
  );
  check(
    "the execute route forces dryRun true in this phase",
    /dryRun: true/.test(code(executeRoute)),
  );
  eq(
    "resolveProvider honours the dry run",
    resolveProvider("n8n", { dryRun: true })?.id,
    "mock",
  );
  eq(
    "and returns the real provider otherwise",
    resolveProvider("n8n", { dryRun: false })?.id,
    "n8n",
  );

  // =========================================================================
  // WEBHOOK SECURITY  (§14 — library only, no public endpoint yet)
  // =========================================================================

  const secret = "test-secret";
  const now = 1_760_000_000;
  const body = JSON.stringify({ actionId: "a", status: "ok" });
  const nonce = generateNonce();
  const signature = signPayload(secret, now, nonce, body);

  check("a nonce is long enough to be unguessable", nonce.length >= 32);
  check(
    "the signed string includes timestamp AND nonce, not just the body",
    signingString(now, nonce, body).startsWith(`${now}.${nonce}.`),
    "signing only the body would let a captured body be replayed with a fresh timestamp",
  );

  const store = createMemoryNonceStore();
  const good = await verifySignedRequest(
    { signature, timestamp: String(now), nonce, body },
    secret,
    store,
    now,
  );
  check("a correctly signed, fresh request is accepted", good.valid);

  const replay = await verifySignedRequest(
    { signature, timestamp: String(now), nonce, body },
    secret,
    store,
    now,
  );
  check("REPLAY: the same nonce is refused the second time", !replay.valid);
  eq("and the reason is replay", replay.reason, "replayed");

  const expired = await verifySignedRequest(
    {
      signature: signPayload(secret, now - 3600, generateNonce(), body),
      timestamp: String(now - 3600),
      nonce: generateNonce(),
      body,
    },
    secret,
    createMemoryNonceStore(),
    now,
  );
  check("EXPIRED: an hour-old request is refused", !expired.valid);

  const tampered = await verifySignedRequest(
    {
      signature,
      timestamp: String(now),
      nonce: generateNonce(),
      body: `${body} `,
    },
    secret,
    createMemoryNonceStore(),
    now,
  );
  check("TAMPERED: a modified body fails the signature", !tampered.valid);
  eq("and the reason is the signature", tampered.reason, "bad_signature");

  const wrongSecret = await verifySignedRequest(
    { signature, timestamp: String(now), nonce, body },
    "the-wrong-secret",
    createMemoryNonceStore(),
    now,
  );
  check("WRONG KEY: a different secret fails", !wrongSecret.valid);

  const future = await verifySignedRequest(
    {
      signature: signPayload(secret, now + 99_999, nonce, body),
      timestamp: String(now + 99_999),
      nonce,
      body,
    },
    secret,
    createMemoryNonceStore(),
    now,
  );
  check("FUTURE: a far-future timestamp is refused", !future.valid);

  for (const [field, reason] of [
    ["signature", "missing_signature"],
    ["timestamp", "missing_timestamp"],
    ["nonce", "missing_nonce"],
  ] as const) {
    const request = {
      signature: field === "signature" ? null : signature,
      timestamp: field === "timestamp" ? null : String(now),
      nonce: field === "nonce" ? null : nonce,
      body,
    };
    const result = await verifySignedRequest(
      request,
      secret,
      createMemoryNonceStore(),
      now,
    );
    check(
      `MISSING ${field} is refused`,
      !result.valid && result.reason === reason,
    );
  }

  const malformed = await verifySignedRequest(
    { signature, timestamp: "not-a-number", nonce, body },
    secret,
    createMemoryNonceStore(),
    now,
  );
  check("a malformed timestamp is refused", !malformed.valid);

  check("safeEqual accepts identical strings", safeEqual("abc", "abc"));
  check("safeEqual rejects different strings", !safeEqual("abc", "abd"));
  check(
    "safeEqual tolerates unequal lengths without throwing",
    !safeEqual("a", "aaaaaaaaaaaaaaaa"),
  );
  eq("the freshness window is five minutes", SIGNATURE_WINDOW_SECONDS, 300);
  check(
    "header names are exported so a route and its tests cannot disagree",
    Boolean(
      SIGNATURE_HEADER &&
      TIMESTAMP_HEADER &&
      NONCE_HEADER &&
      IDEMPOTENCY_HEADER,
    ),
  );
  check(
    "readSignedHeaders reads all three from a Headers object",
    (() => {
      const headers = new Headers();
      headers.set(SIGNATURE_HEADER, signature);
      headers.set(TIMESTAMP_HEADER, String(now));
      headers.set(NONCE_HEADER, nonce);
      const request = readSignedHeaders(headers, body);
      return (
        request.signature === signature &&
        request.timestamp === String(now) &&
        request.nonce === nonce
      );
    })(),
  );

  /**
   * The endpoint deliberately does not exist yet.
   *
   * §14 requires that any future callback be authenticated, signed, replay-proof
   * and idempotent. Shipping the verification without the route is how you avoid
   * an unauthenticated public URL that "will be secured later" — because the URL
   * works long before anyone notices the checks are missing.
   */
  check(
    "no public webhook callback endpoint exists in this phase",
    (() => {
      try {
        read("app/api/webhooks/n8n/route.ts");
        return false;
      } catch {
        return true;
      }
    })(),
    "the verification library ships first, on purpose",
  );

  // =========================================================================
  // SECURITY
  // =========================================================================

  check(
    "every read policy is scoped by is_workspace_member(workspace_id)",
    [
      "execution_plans",
      "execution_actions",
      "execution_runs",
      "execution_audit_logs",
    ].every((table) =>
      migration.includes(
        `on public.${table} for select using (public.is_workspace_member(workspace_id))`,
      ),
    ),
  );
  check(
    "every table carries a workspace_id to scope on",
    [
      "execution_plans",
      "execution_actions",
      "execution_runs",
      "execution_audit_logs",
    ].every((table) => {
      const start = migration.indexOf(
        `create table if not exists public.${table}`,
      );
      if (start === -1) return false;
      return migration
        .slice(start, migration.indexOf(");", start))
        .includes("workspace_id");
    }),
  );
  check(
    "there is no client insert or update policy on any execution table",
    !/create policy[\s\S]{0,200}on public\.execution_\w+[\s\S]{0,80}for (insert|update)/i.test(
      migration.replace(/--.*$/gm, ""),
    ),
    "every write goes through a security-definer function",
  );
  check(
    "RLS is enabled on all four tables",
    (migration.match(/enable row level security/g) ?? []).length === 4,
  );
  check(
    "every mutating RPC re-derives the caller's role from auth.uid()",
    (
      migration.match(
        /where workspace_id = [\w.]+ and user_id = auth\.uid\(\)/g,
      ) ?? []
    ).length >= 4,
  );
  check(
    "a cross-workspace source is refused, not silently nulled",
    /belongs to another workspace/.test(migration),
  );
  check(
    "admins read through admin_has, never a service-role bypass",
    /admin_has\('ai\.read'\)/.test(migration) &&
      !/service_role/i.test(migration),
  );
  check(
    "no feature file uses a service-role client",
    [service, dataSource, actionsSource, executeRoute, approveRoute].every(
      (source) => !/SERVICE_ROLE|service_role/.test(source),
    ),
  );

  // --- No credential can reach a client -----------------------------------
  check(
    "no client component imports a provider",
    !/features\/execution\/providers/.test(controls),
  );
  check(
    "the client sends no state, provider, attempt or key",
    !/status:|provider:|attempt:|idempotencyKey/.test(code(controls)),
    "there is nothing in any request body here that the server trusts",
  );
  check(
    "the client component is marked as one",
    controls.trimStart().startsWith('"use client"'),
  );
  check(
    "no execution table has a column that could hold a credential",
    (() => {
      const ddl = migration.slice(
        migration.indexOf("create table if not exists public.execution_plans"),
        migration.indexOf("-- 6. Row level security"),
      );
      // Column definitions only: two-space indent, name, then whitespace.
      const columns = [...ddl.matchAll(/^ {2}([a-z_]+) {2,}/gm)].map(
        (match) => match[1]!,
      );
      return (
        columns.length > 20 &&
        !columns.some((column) =>
          /token|secret|api_key|password|credential/.test(column),
        )
      );
    })(),
    "the schema has nowhere to put one",
  );
  check(
    "the run table is documented as never holding credentials",
    /never contains credentials/i.test(migration),
  );

  // --- The approval bypass §28 asks us to look for ------------------------
  check(
    "no route accepts approval_required from the client",
    [
      executeRoute,
      approveRoute,
      transitionRoute,
      cancelRoute,
      retryRoute,
    ].every((route) => !/approval_required|approvalRequired/.test(code(route))),
  );
  check(
    "the add-action server action DERIVES approval from the registry",
    /p_approval_required: requiresApproval\(definition\)/.test(
      code(actionsSource),
    ),
  );
  check(
    "and never reads it from the form",
    !/formData\.get\("approval/.test(code(actionsSource)),
  );
  check(
    "no server action can set a status directly",
    !/status:\s*"(APPROVED|EXECUTING|COMPLETED)"/.test(code(actionsSource)),
  );
  check(
    "the transition endpoint refuses APPROVED and EXECUTING as targets",
    /ALLOWED_TARGETS = \["READY", "AWAITING_APPROVAL"\]/.test(transitionRoute),
    "a single any-state endpoint would be the second path that gets it wrong",
  );

  // --- Cancellation safety (§27) ------------------------------------------
  check(
    "an executing action cannot be cancelled",
    !canTransition("EXECUTING", "CANCELLED", ctx()).allowed,
  );
  check(
    "and the service explains why rather than pretending",
    /cannot be cancelled mid-flight/.test(code(service)),
    "marking it cancelled would make the audit trail wrong",
  );

  // --- Pause blocks execution ---------------------------------------------
  check(
    "only an ACTIVE plan permits execution",
    planAllowsExecution("ACTIVE") &&
      !planAllowsExecution("PAUSED") &&
      !planAllowsExecution("CANCELLED") &&
      !planAllowsExecution("DRAFT"),
  );
  check(
    "SQL refuses execution while a plan is not active",
    /resume it before running actions/.test(migration),
  );
  check(
    "the service checks the plan status before dispatching",
    code(service).includes("planAllowsExecution(status)"),
  );
  eq("five plan statuses", PLAN_STATUSES.length, 5);
  check("a known plan status validates", isPlanStatus("PAUSED"));
  check("an invented one is refused", !isPlanStatus("SNOOZED"));

  // =========================================================================
  // MIRROR — TypeScript and SQL agree
  // =========================================================================

  for (const state of ACTION_STATES) {
    check(
      `state '${state}' is constrained in SQL`,
      migration.includes(`'${state}'`),
    );
  }
  for (const type of ACTION_TYPES) {
    check(
      `action type '${type}' is constrained in SQL`,
      migration.includes(`'${type}'`),
    );
  }

  /**
   * The transition table exists in both TypeScript and SQL. The application is
   * the primary enforcement point and SQL is the backstop; a backstop that
   * trusts the thing it is backing up is decorative. So they must agree.
   */
  const sqlTransitions = migration.slice(
    migration.indexOf("-- The transition table."),
    migration.indexOf("-- THE approval gate, restated in SQL."),
  );
  for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
    if (targets.length === 0) {
      check(
        `SQL has no rule for terminal state ${from}`,
        !sqlTransitions.includes(`p_expected_state = '${from}'`),
      );
      continue;
    }
    const line = sqlTransitions
      .split("\n")
      .find((row) => row.includes(`p_expected_state = '${from}'`));
    check(`SQL has a rule for ${from}`, Boolean(line));
    if (!line) continue;
    for (const target of targets) {
      check(
        `SQL allows ${from} → ${target}, matching TypeScript`,
        line.includes(`'${target}'`),
      );
    }
    const sqlTargets = [...line.matchAll(/'([A-Z_]+)'/g)]
      .map((match) => match[1])
      .filter((value) => value !== from);
    check(
      `SQL allows nothing extra from ${from}`,
      sqlTargets.every((target) =>
        (targets as readonly string[]).includes(target),
      ),
      sqlTargets.join(","),
    );
  }

  // =========================================================================
  // ENTITLEMENT AND CREDITS
  // =========================================================================

  eq(
    "the feature has its own entitlement",
    EXECUTION_ENTITLEMENT,
    "business_execution",
  );
  check(
    "it is a known commerce feature",
    (FEATURES as readonly string[]).includes(EXECUTION_ENTITLEMENT),
  );
  check(
    "and it is seeded for every plan by migration 0018",
    ["free", "starter", "growth", "professional", "enterprise"].every((plan) =>
      migration
        .replace(/\s+/g, "")
        .includes(`('${plan}','${EXECUTION_ENTITLEMENT}'`),
    ),
  );
  check(
    "the 0007 catalog is untouched — 0018 adds rather than edits",
    !seedMigration.includes(EXECUTION_ENTITLEMENT),
  );
  check(
    "access is not inferred from marketing intelligence",
    !code(read("features/execution/permissions.ts")).includes(
      "marketing_intelligence",
    ),
  );
  eq(
    "planning and drafting cost no credits in this phase",
    EXECUTION_CREDIT_COST,
    0,
  );
  check(
    "no new credit system was created",
    !/create table[\s\S]{0,60}credit/i.test(migration),
    "§18: use the existing infrastructure",
  );
  check(
    "the service checks the entitlement before dispatch",
    code(service).includes(
      "canAccess(action.workspace_id, EXECUTION_ENTITLEMENT)",
    ),
  );

  // =========================================================================
  // API AND UI
  // =========================================================================

  for (const [name, source] of [
    ["execute", executeRoute],
    ["approve", approveRoute],
    ["retry", retryRoute],
    ["cancel", cancelRoute],
    ["transition", transitionRoute],
  ] as const) {
    check(
      `the ${name} route is wrapped in withApiAuth`,
      /withApiAuth<\{ id: string \}>/.test(source),
    );
    check(
      `the ${name} route declares a rate-limit scope`,
      /scope: EXECUTION_\w+_SCOPE/.test(source),
    );
    check(
      `the ${name} route re-checks the entitlement`,
      /access\.entitled/.test(source),
    );
    check(
      `the ${name} route validates the id format`,
      /\[0-9a-f-\]\{36\}/.test(source),
    );
  }
  check(
    "the execute route takes NOTHING from the request body",
    !/request\.json\(\)/.test(code(executeRoute)),
    "the action id is the only input",
  );
  check(
    "a missing action is a 404, not a 403",
    /apiError\("NOT_FOUND"/.test(approveRoute),
    "a caller must not be able to probe which ids exist elsewhere",
  );
  check(
    "every page gate calls getExecutionAccess",
    [listPage, detailPage].every((page) =>
      page.includes("await getExecutionAccess()"),
    ),
  );
  check("the detail page shows the audit trail", /AuditTrail/.test(detailPage));
  check(
    "the approval preview shows target, data and integration",
    (() => {
      const views = read("features/execution/execution-views.tsx");
      return (
        /Preview — what would happen/.test(views) &&
        /Data that would be sent/.test(views) &&
        /Carried out by/.test(views)
      );
    })(),
    "§26",
  );

  // =========================================================================
  // ADMIN
  // =========================================================================

  check(
    "the admin aggregate counts in SQL rather than in JavaScript",
    /admin_execution_stats/.test(migration) &&
      /select count\(\*\) from public\.execution_runs/.test(migration),
  );
  check(
    "it is permission-gated inside the function",
    /admin_execution_stats[\s\S]*?admin_has\('ai\.read'\)/.test(migration),
  );
  check(
    "the dashboard reads it through a typed RPC",
    /rpc\("admin_execution_stats"/.test(adminOps),
  );
  check(
    "no separate admin system was created",
    !/create table[\s\S]{0,60}admin_/i.test(migration),
    "§20",
  );

  // =========================================================================
  // SCOPE — what this phase deliberately does NOT do
  // =========================================================================

  const featureSources = [
    service,
    registrySource,
    n8nSource,
    mockSource,
    dataSource,
    actionsSource,
  ].join("\n");

  check(
    "nothing publishes to a social network",
    !/api\.linkedin\.com|graph\.facebook\.com|api\.twitter\.com|api\.x\.com/.test(
      featureSources,
    ),
  );
  check(
    "nothing sends email",
    !/nodemailer|sendgrid|postmark|resend\.|ses\.send/i.test(featureSources),
  );
  check(
    "no background worker or queue was built",
    !/bullmq|new Worker\(|node-cron|setInterval\(/.test(featureSources),
    "§32 forbids it in this phase",
  );
  check(
    "no provider in this phase performs a network call",
    !/fetch\(|XMLHttpRequest/.test(code(mockSource) + code(n8nSource)),
  );

  // -------------------------------------------------------------------------
  console.log(results.join("\n"));
  const total = results.length;
  if (failures > 0) {
    console.error(
      `\n${total - failures}/${total} checks passed — EXECUTION SMOKE FAILED`,
    );
    process.exit(1);
  }
  console.log(`\n${total}/${total} checks passed — EXECUTION SMOKE PASSED`);
}

void main();
