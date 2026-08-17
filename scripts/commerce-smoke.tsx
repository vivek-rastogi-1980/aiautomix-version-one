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
  check("ten features defined", FEATURES.length === 10);

  // Every plan must state a position on every feature. A missing pair is worse
  // than a denial: `canAccess` finds no row and falls through to its
  // fail-closed default, so the feature silently disappears from a paid plan.
  // 5 plans x 10 features = 50 rows.
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
