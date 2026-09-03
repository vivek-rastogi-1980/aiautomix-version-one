/**
 * Commercial platform regression tests (Sprint 6.5).
 *
 * Two kinds of check live here, and the split matters:
 *
 *   PURE       — subscription transitions, entitlement semantics, price
 *                formatting. Run in-process, no database.
 *   SCHEMA     — the migration's own guarantees, asserted by parsing
 *                `0007_sprint6_5_commercial_platform.sql`.
 *
 * The schema checks exist because the properties that make a credit ledger
 * trustworthy — immutability, non-negative balance, row-locking, idempotency,
 * absence of client write policies — live in SQL, not TypeScript. A test suite
 * that only exercised the TS wrapper would pass while someone quietly dropped
 * the trigger. Parsing the migration means removing a guarantee fails the build.
 *
 * The runtime behaviour of those guarantees (concurrent debit, overdraw
 * rejection, duplicate idempotency key) was verified directly against the live
 * database when 0007 was applied; see docs/SPRINT-06.5-COMMERCIAL-PLATFORM.md.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  FEATURES,
  PLAN_IDS,
  SUBSCRIPTION_STATUSES,
  isEntitledStatus,
  type SubscriptionStatus,
} from "@/features/commerce/types";
import { canTransition, formatPrice } from "@/features/commerce/subscriptions";

const results: string[] = [];
let failures = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (!condition) failures += 1;
  results.push(
    `${condition ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`,
  );
}

function main(): void {
  // Entitlement pairs are seeded across migrations: 0007 established the
  // catalog, and each later phase seeds its own feature. The invariant is that
  // every plan x feature pair exists SOMEWHERE, so all seeding migrations are
  // read together — checking only 0007 would fail the moment a phase adds a
  // feature, for the wrong reason.
  const migration = [
    "supabase/migrations/0007_sprint6_5_commercial_platform.sql",
    "supabase/migrations/0016_phase8_financial_intelligence.sql",
    "supabase/migrations/0017_phase9_marketing_intelligence.sql",
    "supabase/migrations/0018_phase10_execution_foundation.sql",
    // Phase 15 seeds `execution_roadmap` across all five plans.
    "supabase/migrations/0031_phase15_execution_roadmap.sql",
  ]
    .map((file) => readFileSync(path.join(process.cwd(), file), "utf8"))
    .join("\n");

  // --- Plan catalog ---------------------------------------------------------
  check("five plans defined", PLAN_IDS.length === 5, PLAN_IDS.join(", "));
  for (const id of PLAN_IDS) {
    check(
      `plan '${id}' is seeded by the migration`,
      new RegExp(`\\('${id}',`).test(migration),
    );
  }
  check("eleven features defined", FEATURES.length === 11);

  // Every plan must state a position on every feature. A missing pair is worse
  // than a denial: `canAccess` finds no row and falls through to its
  // fail-closed default, so the feature silently disappears from a paid plan.
  // 5 plans x 11 features = 55 rows.
  let missingPairs = 0;
  for (const plan of PLAN_IDS) {
    for (const feature of FEATURES) {
      if (
        !new RegExp(`\\('${plan}','${feature}', *(true|false),`).test(migration)
      ) {
        missingPairs += 1;
        results.push(`FAIL entitlement row missing for ${plan}/${feature}`);
        failures += 1;
      }
    }
  }
  const expectedPairs = PLAN_IDS.length * FEATURES.length;
  check(
    `all ${expectedPairs} plan x feature entitlement pairs are seeded`,
    missingPairs === 0,
    `${expectedPairs - missingPairs}/${expectedPairs} present`,
  );

  // Price formatting — minor units, and the quote-only case.
  check("free renders as Free", formatPrice(0) === "Free", formatPrice(0));
  check(
    "2900 minor units renders as $29",
    formatPrice(2900) === "$29",
    formatPrice(2900),
  );
  check(
    "null price renders as Custom",
    formatPrice(null) === "Custom",
    formatPrice(null),
  );

  // --- Entitlement semantics -----------------------------------------------
  // NULL = unlimited, 0 = denied. Encoding these as distinct values is what
  // lets "unlimited" and "denied" avoid collapsing into the same falsy check.
  check(
    "migration documents null as unlimited",
    /NULL = unlimited/i.test(migration) || /null.*unlimited/i.test(migration),
  );
  check(
    "enterprise entitlements are all unlimited (null limits)",
    !/\('enterprise','[a-z_]+', *true, *[0-9]/.test(migration),
  );
  check(
    "free denies market_research",
    /\('free','market_research', *false, *0\)/.test(migration),
  );
  check(
    "free denies api_access",
    /\('free','api_access', *false, *0\)/.test(migration),
  );

  // --- Subscription state machine ------------------------------------------
  check("five statuses defined", SUBSCRIPTION_STATUSES.length === 5);

  check("trialing grants access", isEntitledStatus("trialing"));
  check("active grants access", isEntitledStatus("active"));
  // Deliberate: a failed card should not instantly remove service.
  check(
    "past_due still grants access (grace period)",
    isEntitledStatus("past_due"),
  );
  check("canceled does NOT grant access", !isEntitledStatus("canceled"));
  check("expired does NOT grant access", !isEntitledStatus("expired"));
  check("null status does NOT grant access", !isEntitledStatus(null));

  check("trialing -> active allowed", canTransition("trialing", "active"));
  check("active -> past_due allowed", canTransition("active", "past_due"));
  check(
    "past_due -> active allowed (recovered)",
    canTransition("past_due", "active"),
  );
  check(
    "canceled -> active allowed (reactivation)",
    canTransition("canceled", "active"),
  );
  // The transitions that must not happen — an out-of-order webhook resurrecting
  // a dead subscription is the failure this guards.
  check("expired -> active REJECTED", !canTransition("expired", "active"));
  check("expired -> trialing REJECTED", !canTransition("expired", "trialing"));
  check(
    "canceled -> past_due REJECTED",
    !canTransition("canceled", "past_due"),
  );
  check("active -> trialing REJECTED", !canTransition("active", "trialing"));
  check(
    "same-state transition is a no-op, not an error",
    SUBSCRIPTION_STATUSES.every((s) =>
      canTransition(s, s as SubscriptionStatus),
    ),
  );

  // --- Credit ledger guarantees (asserted against the SQL) ------------------
  check(
    "balance cannot go negative (CHECK constraint)",
    /balance\s+integer\s+not null\s+default 0\s+check \(balance >= 0\)/i.test(
      migration,
    ),
  );
  check(
    "ledger rejects UPDATE and DELETE (immutability trigger)",
    /before update or delete on public\.credit_transactions/i.test(migration),
  );
  check(
    "debit path row-locks the account (for update)",
    /for update/i.test(migration),
  );
  check(
    "idempotency key is unique per workspace",
    /unique \(workspace_id, idempotency_key\)/i.test(migration),
  );
  check(
    "overdraw raises rather than writing",
    /insufficient credits/i.test(migration),
  );
  check(
    "credit mutation function is security definer with pinned search_path",
    /security definer[\s\S]{0,80}set search_path = public/i.test(migration),
  );
  check(
    "all five transaction kinds are constrained",
    /check \(kind in \('GRANT','DEBIT','REFUND','ADJUSTMENT','EXPIRATION'\)\)/i.test(
      migration,
    ),
  );
  check(
    "zero-amount transactions rejected",
    /check \(amount <> 0\)/i.test(migration),
  );

  // --- Workspace isolation & client write denial ---------------------------
  const commercialTables = [
    "plans",
    "plan_entitlements",
    "subscriptions",
    "credit_accounts",
    "credit_transactions",
  ];
  for (const table of commercialTables) {
    check(
      `${table} has RLS enabled`,
      new RegExp(
        `alter table public\\.${table} enable row level security`,
        "i",
      ).test(migration),
    );
  }

  // The security control is the ABSENCE of write policies: no client role may
  // insert, update or delete a subscription, balance or ledger row.
  const writePolicy =
    /create policy[^;]*?on public\.(subscriptions|credit_accounts|credit_transactions|plans|plan_entitlements)\s+for\s+(insert|update|delete|all)/i;
  check(
    "NO client write policy exists on any commercial table",
    !writePolicy.test(migration),
  );

  check(
    "subscription reads are workspace-scoped",
    /on public\.subscriptions for select[\s\S]{0,160}is_workspace_member\(workspace_id\)/i.test(
      migration,
    ),
  );
  check(
    "credit account reads are workspace-scoped",
    /on public\.credit_accounts for select[\s\S]{0,160}is_workspace_member\(workspace_id\)/i.test(
      migration,
    ),
  );
  check(
    "credit ledger reads are workspace-scoped",
    /on public\.credit_transactions for select[\s\S]{0,160}is_workspace_member\(workspace_id\)/i.test(
      migration,
    ),
  );

  // --- Usage metering -------------------------------------------------------
  check(
    "ai_usage_logs carries workspace_id",
    /alter table public\.ai_usage_logs[\s\S]{0,120}add column if not exists workspace_id/i.test(
      migration,
    ),
  );
  check(
    "usage workspace_id is indexed",
    /ai_usage_logs_workspace_idx/.test(migration),
  );
  check(
    "0004 is not modified by this migration",
    !/drop table|alter table public\.workspaces drop/i.test(migration),
  );

  // =========================================================================
  // PHASE 13 — ATOMIC ENTITLEMENT ENFORCEMENT
  //
  // The catalog already described monthly limits for business validation and
  // business plans, and a SUPER_ADMIN could edit them. Nothing read them: both
  // features ran the AI with no quota check at all. These checks exist so that
  // cannot silently return.
  // =========================================================================

  const readFile = (relative: string): string =>
    readFileSync(path.join(process.cwd(), relative), "utf8");

  const enforceMigration = readFile(
    "supabase/migrations/0025_atomic_entitlement_usage.sql",
  );
  const validatorSource = readFile(
    "features/ai/services/business-validator.ts",
  );
  const planSource = readFile("features/ai/services/business-plan.ts");
  const enforcementSource = readFile("features/commerce/enforcement.ts");

  // --- No hard-coded limits ------------------------------------------------
  for (const [source, name] of [
    [enforceMigration, "migration 0025"],
    [validatorSource, "the validator"],
    [planSource, "the plan service"],
    [enforcementSource, "the enforcement module"],
  ] as const) {
    check(
      name + " hard-codes no plan limit",
      !/LIMIT_(FREE|STARTER|GROWTH)|(FREE|STARTER|GROWTH)_[A-Z_]*LIMIT/.test(
        source,
      ),
      "limits live in plan_entitlements and nowhere else",
    );
  }
  check(
    "the limit is read from plan_entitlements on every call",
    /from public[.]plan_entitlements/.test(enforceMigration) &&
      !/materialized view/i.test(enforceMigration),
    "a cached limit would ignore an admin edit until the next deploy",
  );

  // --- Atomicity -----------------------------------------------------------
  check(
    "the counter row is locked before the limit comparison",
    (() => {
      const lock = enforceMigration.indexOf("for update");
      const compare = enforceMigration.indexOf("v_used >= v_limit");
      return lock !== -1 && compare !== -1 && lock < compare;
    })(),
    "check-then-act lets two concurrent requests both pass",
  );
  check(
    "the ledger has a unique idempotency key",
    /idempotency_key text not null unique/.test(enforceMigration),
    "a retry must collide rather than consume a second unit",
  );

  // --- AI never runs after a denial ----------------------------------------
  for (const [source, name] of [
    [validatorSource, "validation"],
    [planSource, "business plan"],
  ] as const) {
    check(
      name + " reserves entitlement BEFORE calling the AI",
      (() => {
        // The CALL site, not the import at the top of the file — `runWorkflow`
        // appears as an import long before anything executes, so matching the
        // bare name compares the wrong two positions and always fails.
        const consume = source.indexOf("consumeEntitlement(");
        const run = source.indexOf("await runWorkflow");
        return consume !== -1 && run !== -1 && consume < run;
      })(),
      "a denial must prevent the spend, not report on it",
    );
    check(
      name + " throws EntitlementError when refused",
      /throw new EntitlementError[(]/.test(source),
    );
    check(
      name + " releases the reservation when the run fails",
      (source.match(/releaseEntitlement[(]/g) ?? []).length >= 2,
      "including the path that throws before the try/catch",
    );
  }

  // --- Nothing is trusted from the client ----------------------------------
  check(
    "entitlement_consume accepts no plan, limit or usage argument",
    (() => {
      const from = enforceMigration.indexOf(
        "create or replace function public.entitlement_consume",
      );
      const sig = enforceMigration.slice(from, from + 400);
      return (
        /p_workspace_id/.test(sig) &&
        /p_feature/.test(sig) &&
        !/p_plan|p_limit|p_used|p_usage/.test(sig)
      );
    })(),
    "a client that can assert its own allowance has none",
  );
  check(
    "the plan is resolved from subscriptions inside the function",
    /from public[.]subscriptions/.test(enforceMigration),
  );
  check(
    "membership is verified before allowance is spent",
    (() => {
      const guard = enforceMigration.indexOf("is_workspace_member");
      const spend = enforceMigration.indexOf("set used = used + 1");
      return guard !== -1 && spend !== -1 && guard < spend;
    })(),
    "otherwise one workspace could spend another's quota",
  );
  check(
    "anon cannot execute the enforcement functions",
    /revoke all on function public[.]entitlement_consume[\s\S]{0,90}from anon/.test(
      enforceMigration,
    ),
  );
  check(
    "usage tables have no write policy for any client role",
    !/on public[.]usage_counters for (insert|update|delete)/i.test(
      enforceMigration,
    ),
    "the security definer functions are the only supported writer",
  );

  // --- Refund policy -------------------------------------------------------
  check(
    "release marks the ledger rather than deleting it",
    /set state = 'released'/.test(enforceMigration) &&
      !/delete from public[.]usage_reservations/.test(enforceMigration),
    "what was attempted must stay visible",
  );
  check(
    "a release can never drive the counter negative",
    /greatest[(]used - 1, 0[)]/.test(enforceMigration),
  );

  // --- Period --------------------------------------------------------------
  check(
    "the period reuses the existing calendar-month definition",
    /date_trunc[(]'month'/.test(enforceMigration),
  );

  // --- Structured refusal --------------------------------------------------
  check(
    "a refusal returns structured context, not just a message",
    /'used', v_used/.test(enforceMigration) &&
      /'limit', v_limit/.test(enforceMigration) &&
      /'reason', 'limit_reached'/.test(enforceMigration),
  );
  check(
    "a transport failure denies rather than opening up",
    /reason: "unavailable"/.test(enforcementSource),
    "failing open is worst exactly when load is highest",
  );

  // =========================================================================
  // Phase 14 — workspace plan assignment and plan history (migration 0029)
  //
  // Same approach as the section above: assert the properties in the SQL and
  // the call sites, because those are what hold at runtime. A plan change that
  // is authorised in TypeScript but not in Postgres is not authorised.
  // =========================================================================

  const planMigration = readFile(
    "supabase/migrations/0029_phase14_plan_assignment.sql",
  );
  const adminActions = readFile("features/admin/actions.ts");
  const adminPermissions = readFile("features/admin/permissions.ts");
  const accountPanel = readFile("features/settings/account-panel.tsx");

  // --- 1/2/3. Authorized, unauthorized, and customer plan changes ----------
  check(
    "changing a plan requires plans.manage inside the database",
    (() => {
      const from = planMigration.indexOf(
        "create or replace function public.admin_change_workspace_plan",
      );
      const body = planMigration.slice(from, from + 900);
      return (
        /admin_has[(]'plans[.]manage'[)]/.test(body) &&
        /insufficient_privilege/.test(body)
      );
    })(),
    "the TypeScript guard is a courtesy; this is the gate",
  );
  check(
    "plans.manage is held by SUPER_ADMIN only",
    (() => {
      // ADMIN's block must not list it; SUPER_ADMIN spreads every permission.
      const adminBlock = adminPermissions.slice(
        adminPermissions.indexOf("ADMIN: ["),
        adminPermissions.indexOf("SUPER_ADMIN: ["),
      );
      return (
        !/"plans\.manage"/.test(adminBlock) &&
        /SUPER_ADMIN: \[\.\.\.ADMIN_PERMISSIONS\]/.test(adminPermissions)
      );
    })(),
    "a customer or lesser admin must not be able to assign plans",
  );
  check(
    "the plan-change action asserts plans.manage before the RPC",
    (() => {
      const from = adminActions.indexOf(
        "export async function changeWorkspacePlan",
      );
      const body = adminActions.slice(from, from + 900);
      const assert = body.indexOf('assertPermission(context, "plans.manage")');
      const rpc = body.indexOf("admin_change_workspace_plan");
      return assert !== -1 && rpc !== -1 && assert < rpc;
    })(),
  );
  check(
    "no client-side plan write exists anywhere",
    !/from\("subscriptions"\)[\s\S]{0,120}\.(update|insert|delete)\(/.test(
      adminActions,
    ),
    "subscriptions has no write policy; the RPC is the only writer",
  );

  // --- 4. Invalid plan ------------------------------------------------------
  check(
    "an unknown plan id is rejected",
    /if not exists \(select 1 from public[.]plans where id = p_plan_id\)/.test(
      planMigration,
    ),
    "stranding a workspace on an uncatalogued plan denies every feature",
  );
  check(
    "changing to the plan already in force is rejected",
    /already on the % plan/.test(planMigration) &&
      /check \(old_plan <> new_plan\)/.test(planMigration),
    "a no-op must not write a meaningless history row",
  );

  // --- 5/6. History created, and immutable ---------------------------------
  check(
    "a plan change writes subscription_plan_history",
    /insert into public[.]subscription_plan_history/.test(planMigration),
  );
  check(
    "plan history records the required columns",
    ["workspace_id", "old_plan", "new_plan", "changed_by", "reason"].every(
      (column) => new RegExp(`^\\s+${column}\\s`, "m").test(planMigration),
    ),
  );
  check(
    "plan history is append-only",
    /before update or delete on public[.]subscription_plan_history/.test(
      planMigration,
    ) && /is append-only/.test(planMigration),
  );
  check(
    "plan history grants no client INSERT, UPDATE or DELETE policy",
    (() => {
      const from = planMigration.indexOf(
        "alter table public.subscription_plan_history enable row level security",
      );
      const rls = planMigration.slice(from, from + 700);
      return (
        /for select/.test(rls) &&
        !/for (insert|update|delete)/.test(rls) &&
        !/for all/.test(rls)
      );
    })(),
    "the security definer function must be the only writer",
  );

  // --- 7. Audit event -------------------------------------------------------
  check(
    "a plan change writes a WORKSPACE_PLAN_CHANGED audit row",
    /admin_log\(\s*'WORKSPACE_PLAN_CHANGED'/.test(planMigration),
    "reusing admin_audit_logs rather than a parallel trail",
  );

  // --- 8. Atomicity ---------------------------------------------------------
  check(
    "update, history and audit happen in one function body",
    (() => {
      const from = planMigration.indexOf(
        "create or replace function public.admin_change_workspace_plan",
      );
      const end = planMigration.indexOf("$$;", from);
      const body = planMigration.slice(from, end);
      return (
        /update public[.]subscriptions/.test(body) &&
        /insert into public[.]subscription_plan_history/.test(body) &&
        /admin_log\(/.test(body)
      );
    })(),
    "a plan change without its history must not be reachable",
  );
  check(
    "the subscription row is locked before it is read",
    (() => {
      const from = planMigration.indexOf(
        "create or replace function public.admin_change_workspace_plan",
      );
      const body = planMigration.slice(
        from,
        planMigration.indexOf("$$;", from),
      );
      const lock = body.indexOf("for update");
      const update = body.indexOf("update public.subscriptions");
      return lock !== -1 && update !== -1 && lock < update;
    })(),
    "concurrent plan changes must serialise into a chain",
  );

  // --- 9/10. Downgrade behaviour and usage preservation --------------------
  check(
    "a plan change never touches usage, reservations or credits",
    (() => {
      const from = planMigration.indexOf(
        "create or replace function public.admin_change_workspace_plan",
      );
      const body = planMigration.slice(
        from,
        planMigration.indexOf("$$;", from),
      );
      return !/(usage_counters|usage_reservations|credit_accounts|credit_transactions|ai_usage_logs)/.test(
        body,
      );
    })(),
    "a downgrade limits what happens next, it does not rewrite history",
  );
  check(
    "a plan change never rewrites the billing period",
    (() => {
      const from = planMigration.indexOf("update public.subscriptions");
      const stmt = planMigration.slice(from, planMigration.indexOf(";", from));
      return (
        /set plan_id = p_plan_id/.test(stmt) &&
        !/current_period_start|current_period_end/.test(stmt)
      );
    })(),
    "resetting the period would silently hand back a spent allowance",
  );
  check(
    "the old plan is read from the database, never supplied",
    (() => {
      const from = planMigration.indexOf(
        "create or replace function public.admin_change_workspace_plan",
      );
      const sig = planMigration.slice(from, from + 300);
      return (
        /p_workspace_id/.test(sig) &&
        /p_plan_id/.test(sig) &&
        !/p_old_plan|p_current_plan/.test(sig)
      );
    })(),
    "a forged current plan would record a transition that never happened",
  );

  // --- 11/12. Isolation -----------------------------------------------------
  check(
    "plan history reads require workspaces.read",
    /admin_has[(]'workspaces[.]read'[)]/.test(planMigration),
  );
  check(
    "the customer account panel is display-only",
    !/changeWorkspacePlan|updatePlan|<form|useState/.test(accountPanel),
    "a customer must have no control, and no action, to change their plan",
  );

  // --- 13/14. Customer-facing plan and usage --------------------------------
  check(
    "the account panel takes its plan and status as read-only props",
    /planName/.test(accountPanel) && /status/.test(accountPanel),
  );
  check(
    "the account panel hard-codes no plan limit or plan name map",
    !/PLAN_LABEL|(free|starter|growth)\s*:/i.test(accountPanel),
    "names come from the plans catalog so a rename needs no deploy",
  );

  // --- 15. Concurrency ------------------------------------------------------
  check(
    "the plan-change function returns the transition it actually applied",
    /'old_plan', v_old_plan/.test(planMigration) &&
      /'new_plan', p_plan_id/.test(planMigration),
    "so a caller that lost a race sees the real before-state",
  );

  // --- Report ---------------------------------------------------------------
  console.log(results.join("\n"));
  const total = results.length;
  if (failures > 0) {
    console.error(
      `\n${total - failures}/${total} checks passed — COMMERCE SMOKE FAILED`,
    );
    process.exit(1);
  }
  console.log(`\n${total}/${total} checks passed — COMMERCE SMOKE PASSED`);
}

main();
