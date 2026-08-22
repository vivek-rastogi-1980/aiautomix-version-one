/**
 * Admin platform regression tests (Sprint 7).
 *
 * Three kinds of check, and the split is the point:
 *
 *   MIRROR  The TypeScript permission matrix must equal the rows seeded in
 *           migration 0008 — in BOTH directions. `features/admin/permissions.ts`
 *           only hides UI; the SQL is what authorizes. If they drift, the panel
 *           starts showing controls that fail, or hiding ones that would work.
 *
 *   SCHEMA  The guarantees that live in SQL — audit immutability, the absence
 *           of write policies, permission checks inside every mutating function
 *           — asserted by parsing the migration. A suite that only exercised
 *           the TypeScript would keep passing after someone dropped a trigger.
 *
 *   PURE    Redaction and pagination clamping, run in-process.
 *
 * Runtime RBAC behaviour (a non-admin being denied, each role resolving to
 * exactly its grants, audit rows surviving a delete attempt) was verified
 * against the live database when 0008 was applied: 61/61 checks, all inside a
 * transaction that was rolled back. See docs/SPRINT-07-ADMIN-PLATFORM.md.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  ROLE_PERMISSIONS,
  roleHasPermission,
  permissionsFor,
  isAdminRole,
  isAdminPermission,
  type AdminPermission,
  type AdminRole,
} from "@/features/admin/permissions";
import {
  redactSecrets,
  redactJson,
  safePreview,
  containsSecret,
} from "@/features/admin/redact";
import { pageParams, escapeSearch, searchTerm } from "@/features/admin/query";
import { ADMIN_NAV, ADMIN_NAV_SECTIONS } from "@/features/admin/nav";
import { buildFunnel } from "@/features/admin/leads";

const results: string[] = [];
let failures = 0;

function check(name: string, condition: boolean, detail = ""): void {
  if (!condition) failures += 1;
  results.push(
    `${condition ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`,
  );
}

function main(): void {
  const migration = readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/0008_sprint7_admin_platform.sql",
    ),
    "utf8",
  );

  // The RBAC matrix alone is seeded across migrations: 0008 established it and
  // each later phase grants its own permissions. Only the grant parse and the
  // permission-constraint check read both.
  //
  // The security assertions further down stay scoped to `migration`, because
  // several of them — "no email-based authorization" in particular — are
  // statements about THIS migration's executable SQL. Widening them to a file
  // that legitimately stores contact emails would not make them stronger; it
  // would make them meaningless.
  const rbacSeed =
    migration +
    "\n" +
    readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/0019_client_onboarding.sql",
      ),
      "utf8",
    );

  // =========================================================================
  // MIRROR — TypeScript matrix vs the seeded SQL
  // =========================================================================

  // Parse the seeded grants out of the migration's INSERT block.
  const seeded = new Set<string>();
  const seedPattern =
    /\('(SUPER_ADMIN|ADMIN|SUPPORT|ANALYST)',\s*'([a-z_]+\.[a-z_]+)'\)/g;
  for (const match of rbacSeed.matchAll(seedPattern)) {
    seeded.add(`${match[1]}:${match[2]}`);
  }
  check(
    "migration seeds grants at all",
    seeded.size > 0,
    `${seeded.size} found`,
  );

  const declared = new Set<string>();
  for (const role of ADMIN_ROLES) {
    for (const permission of ROLE_PERMISSIONS[role]) {
      declared.add(`${role}:${permission}`);
    }
  }

  // Both directions. One direction alone would let the mirror silently gain or
  // lose a grant depending on which side drifted.
  const missingInTs = [...seeded].filter((g) => !declared.has(g));
  const extraInTs = [...declared].filter((g) => !seeded.has(g));
  check(
    "every SQL grant exists in TypeScript",
    missingInTs.length === 0,
    missingInTs.join(", ") || "none missing",
  );
  check(
    "TypeScript declares no grant the SQL lacks",
    extraInTs.length === 0,
    extraInTs.join(", ") || "none extra",
  );
  check(
    "grant counts match exactly",
    seeded.size === declared.size,
    `sql=${seeded.size} ts=${declared.size}`,
  );

  // Four roles, and twenty-one permissions: the fourteen from
  // ADMIN-RBAC-SPEC.md plus the seven migration 0019 added for client
  // onboarding.
  check("four admin roles", ADMIN_ROLES.length === 4, ADMIN_ROLES.join(", "));
  check("twenty-one permissions", ADMIN_PERMISSIONS.length === 21);
  for (const permission of ADMIN_PERMISSIONS) {
    check(
      `permission '${permission}' is constrained in SQL`,
      rbacSeed.includes(`'${permission}'`),
    );
  }

  // =========================================================================
  // MIRROR — least privilege shape
  // =========================================================================

  check(
    "SUPER_ADMIN holds every permission",
    ADMIN_PERMISSIONS.every((p) => roleHasPermission("SUPER_ADMIN", p)),
  );
  check(
    "ADMIN cannot manage plans",
    !roleHasPermission("ADMIN", "plans.manage"),
  );
  check(
    "ADMIN cannot manage entitlements",
    !roleHasPermission("ADMIN", "entitlements.manage"),
  );
  check(
    "ADMIN can adjust credits",
    roleHasPermission("ADMIN", "credits.adjust"),
  );
  check(
    "ADMIN can read the audit log",
    roleHasPermission("ADMIN", "audit.read"),
  );

  // SUPPORT is read-only: it must hold no `.manage` or `.adjust` grant at all.
  const supportMutations = ROLE_PERMISSIONS.SUPPORT.filter(
    (p) => p.endsWith(".manage") || p.endsWith(".adjust"),
  );
  check(
    "SUPPORT holds no mutating permission",
    supportMutations.length === 0,
    supportMutations.join(", ") || "none",
  );
  check("SUPPORT can read users", roleHasPermission("SUPPORT", "users.read"));
  check(
    "SUPPORT cannot read the audit log",
    !roleHasPermission("SUPPORT", "audit.read"),
  );

  // ANALYST sees no customer PII and no money.
  const analystMutations = ROLE_PERMISSIONS.ANALYST.filter(
    (p) => p.endsWith(".manage") || p.endsWith(".adjust"),
  );
  check(
    "ANALYST holds no mutating permission",
    analystMutations.length === 0,
    analystMutations.join(", ") || "none",
  );
  check(
    "ANALYST cannot read users (no PII)",
    !roleHasPermission("ANALYST", "users.read"),
  );
  check(
    "ANALYST cannot read credits",
    !roleHasPermission("ANALYST", "credits.read"),
  );
  check(
    "ANALYST can read AI + usage",
    roleHasPermission("ANALYST", "ai.read") &&
      roleHasPermission("ANALYST", "usage.read"),
  );

  // Privilege must be monotonic: ADMIN ⊇ SUPPORT ∪ ANALYST, SUPER_ADMIN ⊇ ADMIN.
  const adminSet = new Set<string>(ROLE_PERMISSIONS.ADMIN);
  check(
    "ADMIN is a superset of SUPPORT",
    ROLE_PERMISSIONS.SUPPORT.every((p) => adminSet.has(p)),
  );
  check(
    "ADMIN is a superset of ANALYST",
    ROLE_PERMISSIONS.ANALYST.every((p) => adminSet.has(p)),
  );
  const superSet = new Set<string>(ROLE_PERMISSIONS.SUPER_ADMIN);
  check(
    "SUPER_ADMIN is a superset of ADMIN",
    ROLE_PERMISSIONS.ADMIN.every((p) => superSet.has(p)),
  );

  // =========================================================================
  // MIRROR — deny by default
  // =========================================================================

  check("null role holds nothing", !roleHasPermission(null, "users.read"));
  check(
    "undefined role holds nothing",
    !roleHasPermission(undefined, "users.read"),
  );
  check(
    "unknown role holds nothing",
    !roleHasPermission("ROOT" as AdminRole, "users.read"),
  );
  check(
    "unknown permission is denied for every role",
    ADMIN_ROLES.every(
      (r) =>
        !roleHasPermission(r, "users.delete_everything" as AdminPermission),
    ),
  );
  check("permissionsFor(null) is empty", permissionsFor(null).length === 0);
  check(
    "isAdminRole rejects junk",
    !isAdminRole("admin") && !isAdminRole(null) && !isAdminRole(42),
  );
  check(
    "isAdminPermission rejects junk",
    !isAdminPermission("users.READ") && !isAdminPermission(""),
  );

  // =========================================================================
  // SCHEMA — audit trail
  // =========================================================================

  check(
    "audit table exists",
    /create table if not exists public\.admin_audit_logs/i.test(migration),
  );
  check(
    "audit rejects UPDATE and DELETE via trigger",
    /before update or delete on public\.admin_audit_logs/i.test(migration),
  );
  check("audit trigger raises append-only", /append-only/i.test(migration));
  check(
    "audit records the actor's role at the time",
    /actor_role\s+text not null/i.test(migration),
  );
  check(
    "audit actor cannot be forged (stamped from auth.uid)",
    /values \(\s*auth\.uid\(\)/i.test(migration),
  );
  check(
    "audit actor FK uses on delete restrict",
    /actor_user_id uuid not null references auth\.users \(id\) on delete restrict/i.test(
      migration,
    ),
  );

  // =========================================================================
  // SCHEMA — no write policies anywhere
  // =========================================================================

  const adminTables = [
    "admin_users",
    "admin_role_permissions",
    "admin_audit_logs",
  ];
  for (const table of adminTables) {
    check(
      `${table} has RLS enabled`,
      new RegExp(
        `alter table public\\.${table} enable row level security`,
        "i",
      ).test(migration),
    );
  }

  const writePolicy =
    /create policy[^;]*?on public\.(admin_users|admin_role_permissions|admin_audit_logs|profiles|workspaces|credit_accounts|credit_transactions|plans|plan_entitlements)\s+for\s+(insert|update|delete|all)/i;
  check(
    "migration 0008 adds NO write policy to any table",
    !writePolicy.test(migration),
  );

  // Every policy this migration adds must be a SELECT policy.
  const policies = [
    ...migration.matchAll(
      /create policy\s+"[^"]+"\s*\n?\s*on public\.\w+ for (\w+)/gi,
    ),
  ];
  check(
    "every policy added is SELECT",
    policies.length > 0 &&
      policies.every((m) => m[1].toLowerCase() === "select"),
    `${policies.length} policies, kinds: ${[...new Set(policies.map((m) => m[1].toLowerCase()))].join(",")}`,
  );

  // =========================================================================
  // SCHEMA — mutating functions check permission and audit
  // =========================================================================

  const MUTATIONS: { fn: string; permission: string; action: string }[] = [
    {
      fn: "admin_set_user_suspended",
      permission: "users.manage",
      action: "USER_SUSPENDED",
    },
    {
      fn: "admin_set_workspace_suspended",
      permission: "workspaces.manage",
      action: "WORKSPACE_SUSPENDED",
    },
    {
      fn: "admin_apply_credits",
      permission: "credits.adjust",
      action: "CREDIT_GRANTED",
    },
    {
      fn: "admin_update_plan",
      permission: "plans.manage",
      action: "PLAN_UPDATED",
    },
    {
      fn: "admin_update_entitlement",
      permission: "entitlements.manage",
      action: "ENTITLEMENT_UPDATED",
    },
  ];

  for (const { fn, permission, action } of MUTATIONS) {
    // Isolate the function body so the assertions cannot be satisfied by text
    // that happens to appear elsewhere in the file.
    const start = migration.indexOf(`create or replace function public.${fn}`);
    const body = start === -1 ? "" : migration.slice(start, start + 3000);

    check(`${fn} exists`, start !== -1);
    check(
      `${fn} checks admin_has('${permission}')`,
      new RegExp(`admin_has\\('${permission.replace(".", "\\.")}'\\)`).test(
        body,
      ),
    );
    check(
      `${fn} raises insufficient_privilege`,
      /insufficient_privilege/.test(body),
    );
    check(`${fn} writes an audit row`, /admin_log\(/.test(body));
    check(`${fn} logs '${action}'-family action`, body.includes(action));
    check(`${fn} is security definer`, /security definer/i.test(body));
    check(`${fn} pins search_path`, /set search_path = public/i.test(body));
  }

  // A reason is mandatory for money movement — enforced in SQL, not just the UI.
  const creditsStart = migration.indexOf(
    "create or replace function public.admin_apply_credits",
  );
  const creditsBody = migration.slice(creditsStart, creditsStart + 3000);
  check(
    "credit changes require a reason (enforced in SQL)",
    /reason is required for manual credit changes/i.test(creditsBody),
  );
  check(
    "credit changes delegate to apply_credit_transaction",
    /apply_credit_transaction\(/.test(creditsBody),
  );
  check(
    "admin credit ops limited to GRANT/ADJUSTMENT/REFUND",
    /p_kind not in \('GRANT', 'ADJUSTMENT', 'REFUND'\)/.test(creditsBody),
  );

  // Suspension must require a reason too.
  for (const fn of [
    "admin_set_user_suspended",
    "admin_set_workspace_suspended",
  ]) {
    const s = migration.indexOf(`create or replace function public.${fn}`);
    const b = migration.slice(s, s + 2500);
    check(
      `${fn} requires a reason to suspend`,
      /reason is required to suspend/i.test(b),
    );
  }

  // =========================================================================
  // SCHEMA — authorization primitives
  // =========================================================================

  check(
    "admin_role() reads from admin_users using auth.uid()",
    /create or replace function public\.admin_role\(\)[\s\S]{0,400}a\.user_id = auth\.uid\(\) and a\.is_active/i.test(
      migration,
    ),
  );
  check(
    "admin_has() is a positive lookup (deny by default)",
    /create or replace function public\.admin_has[\s\S]{0,500}select exists \([\s\S]{0,300}admin_role_permissions/i.test(
      migration,
    ),
  );
  check(
    "inactive admins resolve to no role",
    /and a\.is_active/i.test(migration),
  );
  // ADMIN-SECURITY-SPEC.md: "Never authorize based on email."
  //
  // Scoped to executable SQL: `--` comments AND `comment on ... is '...'`
  // strings are stripped first, because the table comment legitimately contains
  // the sentence "never an email address" and would otherwise fail this check.
  // What matters is that no policy or function *predicate* mentions email.
  const executableSql = migration
    .replace(/--.*$/gm, "")
    .replace(/comment on[\s\S]*?;/gi, "");
  check(
    "no email-based authorization in executable SQL",
    !/\bemail\b/i.test(executableSql),
    (executableSql.match(/.{0,40}\bemail\b.{0,40}/i) ?? ["none"])[0],
  );
  check(
    "authorization derives from auth.uid(), not an identifier list",
    /auth\.uid\(\)/.test(executableSql) &&
      !/user_id\s+in\s+\(/i.test(executableSql),
  );

  // The whole design rests on not using a service-role key.
  check(
    "migration documents the no-service-role decision",
    /SUPABASE_SERVICE_ROLE_KEY` is NOT read|no service-role key/i.test(
      migration,
    ),
  );

  // =========================================================================
  // PURE — redaction
  // =========================================================================

  const SECRETS: [string, string][] = [
    ["OpenAI key", "sk-abcdefghijklmnopqrstuvwxyz123456"],
    ["Anthropic key", "sk-ant-abcdefghijklmnopqrstuvwxyz12"],
    [
      "JWT",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NX0.dBjftJeZ4CVPmB92K27uhbUJU1p1r",
    ],
    ["Supabase publishable", "sb_publishable_abcdefghijklmnop123"],
    ["Bearer token", "Bearer abcdefghijklmnopqrstuvwxyz123456"],
    ["Postgres URI", "postgresql://user:hunter2@db.example.com:5432/postgres"],
    ["env assignment", 'OPENAI_API_KEY="verysecretvalue123"'],
  ];

  for (const [label, secret] of SECRETS) {
    const text = `before ${secret} after`;
    const out = redactSecrets(text);
    check(`redacts ${label}`, !out.includes(secret), out.slice(0, 60));
    check(`${label} detected by containsSecret`, containsSecret(text));
  }

  check(
    "redaction preserves surrounding text",
    redactSecrets(
      "error at line 5: sk-abcdefghijklmnopqrstuvwxyz123456 failed",
    ).includes("error at line 5"),
  );
  check(
    "redaction is idempotent",
    redactSecrets(redactSecrets("sk-abcdefghijklmnopqrstuvwxyz123456")) ===
      redactSecrets("sk-abcdefghijklmnopqrstuvwxyz123456"),
  );
  check(
    "empty input is safe",
    redactSecrets(null) === "" && redactSecrets(undefined) === "",
  );
  check(
    "ordinary text is untouched",
    redactSecrets("the plan failed to validate") ===
      "the plan failed to validate",
  );

  // The /g patterns must not skip matches on repeated calls (lastIndex reset).
  const twice = redactSecrets(
    "sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaa sk-bbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  );
  check(
    "redacts every occurrence, not every other one",
    !twice.includes("sk-aaaa") && !twice.includes("sk-bbbb"),
    twice,
  );

  // redactJson drops secret-named keys outright.
  const blob = redactJson({
    name: "ok",
    apiKey: "short",
    nested: { authorization: "x", note: "sk-abcdefghijklmnopqrstuvwxyz123456" },
  }) as Record<string, unknown>;
  check(
    "redactJson drops secret-named keys",
    blob.apiKey === "[REDACTED:KEY_NAME]",
  );
  check(
    "redactJson recurses",
    (blob.nested as Record<string, unknown>).authorization ===
      "[REDACTED:KEY_NAME]",
  );
  check(
    "redactJson redacts values inside nested strings",
    !JSON.stringify(blob).includes("sk-abcdefghijklmnopqrstuvwxyz123456"),
  );
  check("redactJson keeps benign values", blob.name === "ok");

  // safePreview must redact BEFORE truncating.
  //
  // The secret is positioned to STRADDLE the cut: truncating first would slice
  // it mid-key and leave a recognisable fragment that no pattern would then
  // match. Redacting first removes it whole. Placing the secret safely inside
  // or outside the boundary would let a truncate-first implementation pass.
  const head = "e".repeat(190);
  const long = `${head} sk-abcdefghijklmnopqrstuvwxyz123456 ${"y".repeat(2000)}`;
  const preview = safePreview(long, 200);
  check("safePreview truncates", preview.truncated);
  check("safePreview flags the secret", preview.hadSecret);
  check(
    "safePreview leaks no key fragment across the truncation boundary",
    !preview.text.includes("sk-abcdefghij"),
    preview.text.slice(180, 230),
  );

  // A key glued directly to word characters must still be caught — the case
  // that a leading word-boundary anchor silently missed.
  check(
    "redacts a key with no boundary before it",
    !redactSecrets("traceidsk-abcdefghijklmnopqrstuvwxyz123456").includes(
      "sk-abcdefghij",
    ),
  );

  // =========================================================================
  // PURE — pagination clamping
  // =========================================================================

  check("default page is 1", pageParams(undefined).page === 1);
  check("negative page clamps to 1", pageParams("-5").page === 1);
  check("zero page clamps to 1", pageParams("0").page === 1);
  check("junk page clamps to 1", pageParams("abc").page === 1);
  check(
    "page size is capped at 100",
    pageParams("1", "100000").pageSize === 100,
  );
  check(
    "negative size falls back to default",
    pageParams("1", "-10").pageSize === 25,
  );
  check(
    "junk size falls back to default",
    pageParams("1", "xyz").pageSize === 25,
  );
  check(
    "range is contiguous across pages",
    pageParams("2", "25").from === 25 && pageParams("2", "25").to === 49,
  );
  check("array params take the first value", pageParams(["3", "9"]).page === 3);

  // Search sanitising — a filter term must not alter the query's shape.
  check("escapes LIKE wildcards", escapeSearch("100%_x").includes("\\%"));
  check(
    "strips PostgREST filter syntax",
    !escapeSearch("a,b(c)").includes(","),
  );
  check("empty search is undefined", searchTerm("   ") === undefined);
  check(
    "search is length-capped",
    (searchTerm("a".repeat(500)) ?? "").length <= 100,
  );

  // =========================================================================
  // Navigation declares permissions
  // =========================================================================

  const navNeedingPermission = ADMIN_NAV.filter(
    (item) => item.href !== "/admin" && item.href !== "/admin/settings",
  );
  check(
    "every substantive nav entry declares a permission",
    navNeedingPermission.every((item) => Boolean(item.permission)),
    navNeedingPermission
      .filter((i) => !i.permission)
      .map((i) => i.href)
      .join(", ") || "all declared",
  );
  check(
    "nav permissions are all real permissions",
    ADMIN_NAV.every(
      (item) => !item.permission || isAdminPermission(item.permission),
    ),
  );
  check(
    "every core route from SPRINT-07.md has a nav entry",
    [
      "/admin",
      "/admin/users",
      "/admin/workspaces",
      "/admin/ai",
      "/admin/usage",
      "/admin/credits",
      "/admin/plans",
      "/admin/entitlements",
      "/admin/audit-logs",
      "/admin/system-health",
      "/admin/settings",
    ].every((href) => ADMIN_NAV.some((item) => item.href === href)),
  );

  // =========================================================================
  // PHASE 12 — COMMAND CENTER
  // =========================================================================

  const commandMigration = readFileSync(
    path.join(process.cwd(), "supabase/migrations/0024_command_center_stats.sql"),
    "utf8",
  );

  check(
    "every nav entry belongs to a declared section",
    ADMIN_NAV.every((item) =>
      (ADMIN_NAV_SECTIONS as readonly string[]).includes(item.section),
    ),
  );
  check(
    "no nav section is declared but empty",
    ADMIN_NAV_SECTIONS.every((section) =>
      ADMIN_NAV.some((item) => item.section === section),
    ),
    "an empty heading in the sidebar promises a page that is not there",
  );
  check(
    "command center stats refuse a non-admin",
    /if not public[.]is_admin[(][)][\s\S]{0,120}raise exception/.test(
      commandMigration,
    ),
  );
  check(
    "and anon cannot execute it at all",
    /revoke all on function public[.]admin_command_center_stats[\s\S]{0,90}from anon/.test(
      commandMigration,
    ),
  );
  for (const [blockKey, grant] of [
    ["active_users", "users.read"],
    ["new_leads_today", "leads.read"],
    ["most_used_model", "ai.read"],
    ["credits_issued", "credits.read"],
  ] as const) {
    check(
      `'${blockKey}' is gated behind ${grant}`,
      (() => {
        const at = commandMigration.indexOf(blockKey);
        if (at === -1) return false;
        const before = commandMigration.slice(0, at);
        const last = before.lastIndexOf("admin_has(");
        return (
          last !== -1 && commandMigration.slice(last, last + 60).includes(grant)
        );
      })(),
    );
  }
  check(
    "AI cost is summed as numeric and returned as text, never a float",
    /to_char[(]/.test(commandMigration) &&
      !/::float|::double precision/.test(commandMigration),
    "no JavaScript floating-point arithmetic for financial totals",
  );
  check(
    "funnel stages count DISTINCT leads, not events",
    (() => {
      const from = commandMigration.indexOf("'stage_idea_submitted'");
      const to = commandMigration.indexOf("'stage_booking_completed'");
      if (from === -1 || to === -1) return false;
      const stageBlock = commandMigration.slice(from, to);
      return !/count[(][*][)] from public[.]lead_events/.test(stageBlock);
    })(),
    "a customer opening a report four times is one lead, not four",
  );
  check(
    "an empty funnel yields null percentages, never 0%",
    (() => {
      const stages = buildFunnel({ stage_lead_created: 0 });
      return stages[0]!.count === 0 && stages[0]!.ofTop === null;
    })(),
    "0% next to an empty funnel reads as collapsed conversion, not no traffic",
  );
  check(
    "a role that cannot see leads gets null counts, not zeros",
    buildFunnel({}).every((stage) => stage.count === null),
  );
  check(
    "drop-off is computed against the PREVIOUS stage",
    (() => {
      const stages = buildFunnel({
        stage_lead_created: 100,
        stage_idea_submitted: 40,
      });
      return stages[1]!.dropOff === 60 && stages[1]!.ofTop === 40;
    })(),
  );

  // -------------------------------------------------------------------------
  console.log(results.join("\n"));
  const total = results.length;
  if (failures > 0) {
    console.error(
      `\n${total - failures}/${total} checks passed — ADMIN SMOKE FAILED`,
    );
    process.exit(1);
  }
  console.log(`\n${total}/${total} checks passed — ADMIN SMOKE PASSED`);
}

main();
