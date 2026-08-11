# Sprint 06.5 — Commercial Platform Foundation

**Status:** Complete
**Date:** 2026-08-11
**Migration:** `0007_sprint6_5_commercial_platform.sql` (applied and verified against the live database)

This sprint builds the commercial substrate — plans, entitlements, credits, usage
metering and subscription state — **without** any payment processing. No Stripe,
no Razorpay, no checkout, no payment webhooks. That boundary was explicit in the
brief and is respected everywhere, including the pricing page, which deliberately
has no checkout button.

---

## 1. What was built

### Data model (migration 0007)

| Table | Purpose |
|---|---|
| `plans` | Plan catalog: price, currency, monthly credits, sort order, public flag |
| `plan_entitlements` | Per-plan feature grants and limits |
| `subscriptions` | One row per workspace: plan, status, period bounds |
| `credit_accounts` | Current balance, lifetime granted, lifetime spent |
| `credit_transactions` | Append-only ledger; every balance change, with the balance after |

Plus `ai_usage_logs.workspace_id` (added + indexed) so usage carries the
commercial boundary.

### Engines (`features/commerce/`)

| Module | Responsibility |
|---|---|
| `types.ts` | `FEATURES`, `PLAN_IDS`, `SUBSCRIPTION_STATUSES`, `isEntitledStatus()` |
| `entitlements.ts` | `canAccess`, `canAccessWithinLimit`, `getPlanEntitlements`, `describeDenial` |
| `credits.ts` | `grantCredits`, `debitCredits`, `refundCredits`, `adjustCredits`, `expireCredits`, reads |
| `subscriptions.ts` | State machine, `listPlans`, `getPlan`, `formatPrice` |
| `usage.ts` | `getWorkspaceUsage`, `getUsageSummary`, `currentPeriodStart` — read-only |

### Surfaces

| Route | Render mode | Notes |
|---|---|---|
| `/pricing` | dynamic | Catalog read from the DB per request. In the sitemap. |
| `/usage` | dynamic | Plan, credits, runs, tokens, limits, ledger. `Disallow`ed in robots.txt. |
| `/diagnostics` | dynamic | Owner/Admin only, workspace-scoped. `Disallow`ed in robots.txt. |

Render mode was confirmed against the build output, not assumed: `/pricing`,
`/usage` and `/diagnostics` produce no prerendered HTML, while `/news` and
`/privacy-policy` do.

---

## 2. Three decisions worth knowing

### `usage_events` was not created — `ai_usage_logs` was extended instead

`SPRINT-06.5.md` lists a `usage_events` table. `ai_usage_logs` (migration 0003)
already carries every field `USAGE-METERING-SPEC.md` requires; the only thing
missing was `workspace_id`. Creating `usage_events` alongside it would mean every
AI run writes the same event twice, to two tables that can disagree — and the
first time they disagreed, nobody would know which one was right. The column was
added to the existing table instead.

### No client write policies — the security control is an absence

`plans`, `plan_entitlements`, `subscriptions`, `credit_accounts` and
`credit_transactions` all have RLS enabled and carry **only** SELECT policies.
There is no INSERT, UPDATE, DELETE or ALL policy for any client role on any of
them. A user cannot grant themselves credits, change their plan, or alter an
entitlement, because no policy exists that would let the statement through.

Balance changes happen exclusively through `apply_credit_transaction()`, a
`security definer` function with a pinned `search_path` that row-locks the
account with `SELECT … FOR UPDATE`, rejects overdraw, and absorbs retries by
idempotency key.

Because this guarantee lives in SQL rather than TypeScript, the test suite
asserts it by parsing the migration — a suite that only exercised the TS wrapper
would keep passing after someone dropped the trigger.

### `past_due` still grants access

`isEntitledStatus('past_due')` returns `true`. A failed card should not
instantly remove service; that is a grace period, not a bug. `canceled` and
`expired` both deny, and `expired` is terminal — no transition leads out of it,
which is what stops an out-of-order webhook from resurrecting a dead
subscription.

---

## 3. Test coverage against `SPRINT-06.5-TEST-CASES.md`

Coverage is marked honestly. **AUTO** = asserted by the automated suite on every
run. **DB** = exercised against the live database when 0007 was applied. **GAP**
= not covered; stated rather than glossed.

### Plan
| Case | Coverage |
|---|---|
| Free resolves correctly | AUTO — seeded row asserted |
| Paid plans resolve correctly | AUTO — all 5 plan ids asserted against the seed |
| Unknown plan fails safely | TYPE — `PlanId` is a closed union; `getPlan` returns `null` and callers fail closed. Not asserted at runtime. |

### Entitlements
| Case | Coverage |
|---|---|
| Allowed feature succeeds | AUTO — all 35 plan x feature entitlement pairs asserted present |
| Restricted feature denied | AUTO — free denies `market_research` and `api_access` |
| Workspace isolation enforced | AUTO (policy shape) + DB |
| Client cannot grant entitlement | AUTO — no write policy exists |

### Credits
| Case | Coverage |
|---|---|
| Grant increases balance | DB |
| Debit decreases balance | DB |
| Insufficient balance rejected | AUTO (`CHECK (balance >= 0)` + raise) |
| Refund restores balance | DB |
| Adjustment is auditable | DB — the sprint's own test credits were zeroed by a compensating `ADJUSTMENT`, because the ledger refused the delete |
| Concurrent debits remain atomic | AUTO (`FOR UPDATE` asserted) — **not** proven under real contention; see gaps |
| Duplicate request does not double-charge | AUTO (unique `(workspace_id, idempotency_key)`) |

### Usage
| Case | Coverage |
|---|---|
| Successful AI request creates usage event | Regression suite (engine smoke, 35 checks) |
| Failed AI request records failure | Regression suite |
| Tokens / model / estimated cost persist | Regression suite |

### Subscription
| Case | Coverage |
|---|---|
| Active subscription grants entitlements | AUTO |
| Canceled subscription changes access correctly | AUTO |
| Past-due state is handled | AUTO — grants access by design |
| Client cannot modify subscription state | AUTO — no write policy exists |

### Security
| Case | Coverage |
|---|---|
| Cross-workspace access denied | AUTO — every SELECT policy asserted to be `is_workspace_member`-scoped |
| Client cannot modify credits / plan / entitlement | AUTO — absence of write policies asserted, and the assertion itself was meta-tested against synthetic violating SQL |
| RLS enforced | AUTO — all five tables |

### Regression & build gates

All green on a clean tree:

| Gate | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass (0 warnings) |
| `npx prettier --check .` | pass |
| `npm test` | **177/177** — engine 35, report 23, plan 26, pdf 6, security 36, commerce 51 |
| `npm run build` | pass (clean `.next`) |

Validator, business plan, PDF, workspace and auth all covered by the pre-existing
suites, unchanged and still passing.

---

## 4. Known gaps

1. **Concurrency is asserted structurally, not empirically.** The suite proves
   `FOR UPDATE` is in the function; it does not fire two simultaneous debits and
   observe the outcome. The lock is the standard Postgres pattern and the
   `CHECK (balance >= 0)` constraint is a second line of defence, but a real
   contention test would need a harness that opens two connections. Worth adding
   before credits gate anything users pay for.
2. **No payment processing.** By design. Every plan CTA routes to `/contact`.
3. **Credits are not yet consumed by AI runs.** The ledger, the atomic mutation
   and the metering all exist; wiring `debitCredits` into `runWorkflow` is a
   deliberate follow-up so that enforcement lands as one reviewable change.
4. **No cross-workspace admin panel.** `/diagnostics` is workspace-scoped on
   purpose. A real admin view needs RLS policies that intentionally break the
   isolation every other table enforces — a security design task, not a page.

---

## 5. Recommendation for Sprint 7

Wire enforcement, in this order:

1. `canAccess` gate in `runWorkflow` before any provider call.
2. `debitCredits` on success, `refundCredits` on failure, both keyed by
   `ai_request_id` for idempotency.
3. A real concurrency test for the credit path (gap 1).
4. Only then, payment processing — the data model is ready for it, and adding a
   provider to a model that already enforces limits is a much smaller change than
   doing both at once.
