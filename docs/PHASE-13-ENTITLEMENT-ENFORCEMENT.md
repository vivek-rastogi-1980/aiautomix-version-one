# Phase 13 — Entitlement Enforcement: Audit

Audit only. No application code changed to produce this document.

## 1. Existing entitlement architecture

Everything below already exists and works. There is exactly one entitlement
engine and it must not be duplicated.

| Concern | Where |
|---|---|
| Feature vocabulary | `features/commerce/types.ts` — 10 features, 5 plan ids |
| Access decision | `features/commerce/entitlements.ts` — `canAccess()` |
| Access + quota | `entitlements.ts` — `canAccessWithinLimit()` |
| Plan resolution | `entitlements.ts` — `getWorkspacePlan()` |
| Denial copy | `entitlements.ts` — `describeDenial()` |
| Limits data | `plan_entitlements.limit_value` (migration 0007) |

`canAccess()` evaluates workspace → plan → subscription status → entitlement row
and **fails closed at every step**: unknown plan, inactive subscription, missing
row, `is_enabled = false` and `limit_value = 0` all deny. `limit_value IS NULL`
means unlimited; `0` means denied. Those two states are deliberately distinct.

**No limit is hard-coded anywhere.** Verified: the values live only in
`plan_entitlements`, editable from `/admin/entitlements` through the audited
`admin_update_entitlement` RPC, gated on `entitlements.manage`.

Current live values, read from the database:

| Plan | `business_idea_validation` | `business_plan` | `market_research` |
|---|---|---|---|
| free | 3 | 1 | disabled (0) |
| starter | 25 | 10 | disabled (0) |
| growth | 100 | 40 | 25 |
| professional | unlimited | unlimited | 200 |
| enterprise | unlimited | unlimited | unlimited |

## 2. Existing credit architecture

`credit_accounts` (cached balance) + `credit_transactions` (append-only ledger,
the authority) + `apply_credit_transaction()`.

The function is `security definer`, pins `search_path`, and takes
**`for update` on the account row**, so concurrent debits serialise: the second
call sees the first's balance and an overdraw is rejected rather than racing
negative. A `balance >= 0` CHECK constraint backs it up if the function is ever
bypassed.

**Credits are genuinely race-safe.** This is the pattern to copy.

Callers: `features/{research,competitors,financials,marketing}/engine.ts` via
`debitCredits()` / `refundCredits()` with deterministic idempotency keys.

## 3. Existing usage architecture

`features/commerce/usage.ts`:

- `currentPeriodStart()` — first day of the current **UTC calendar month**
- `countWorkflowRuns(workspace, workflow, since)` — `COUNT(*)` over
  `ai_usage_logs` where `status = 'success'` and `created_at >= since`

So the period model already exists and is calendar-month UTC. **Do not invent a
second one.** Usage counts successes only — a failed run the customer did not
benefit from does not consume allowance.

## 4. Validation execution path (current)

```
/validator  →  features/business-ideas/actions.ts
            →  features/ai/services/business-validator.ts
            →  runWorkflow()                    ← features/ai/engine
            →  insert business_ideas / validation_reports
```

**No entitlement check. No credit debit. At any point in that chain.**

## 5. Business plan execution path (current)

Same shape, same result: `features/business-plans/` contains no `canAccess` and
no `debitCredits`.

`runWorkflow()` — the shared AI engine — meters nothing. Only the four newer
feature engines enforce, each doing it in their own engine rather than in the
platform.

## 6. The gap

`business_idea_validation` and `business_plan` are fully described in the
catalog, editable by SUPER_ADMIN, displayed in the admin panel — and **read by
no code**. A free workspace with a stated cap of 3 validations/month can run
unlimited validations, each a real billed OpenAI call.

This is the flagship feature the entire acquisition funnel drives traffic to.

## 7. THE ARCHITECTURAL BLOCKER — usage limits are not atomic

This is the most important finding, and it means the requested behaviour
**cannot be achieved by copying the existing enforcement pattern.**

`canAccessWithinLimit(workspaceId, feature, currentUsage)` takes the usage count
as an **argument**. Callers do:

```
const used = await countWorkflowRuns(...)      // SELECT COUNT
const decision = await canAccessWithinLimit(..., used)
if (decision.allowed) await runWorkflow(...)   // usage recorded AFTER
```

That is textbook check-then-act. Two concurrent requests both read `used = 2`
against a limit of 3, both pass, both execute. Worse, `ai_usage_logs` is only
written **after** the AI call succeeds, so the count never includes in-flight
work — the window is the entire duration of the AI request, seconds wide.

**Consequence:** CASE A of the brief (limit 3, usage 2, two simultaneous
requests → exactly one succeeds) fails under the current design.

**This affects existing features too.** Research, competitors, financials and
marketing all share this race for their *quota* checks. Their *credit* debits
are safe, because `apply_credit_transaction` locks — but a quota is not a
credit, and nothing locks the quota.

Credits limit spend. Quotas limit count. Today only the first is enforced
atomically.

## 8. Existing Super Admin entitlement management

`/admin/entitlements` renders the plan × feature matrix and edits
`limit_value` / `is_enabled` through `admin_update_entitlement`, which writes an
`admin_audit_logs` row in the same transaction (before/after snapshot, actor,
reason). The UI correctly distinguishes blank = unlimited from `0` = denied.

**This satisfies the "admin configuration must be real" requirement already —
on the configuration side.** What is missing is an execution engine that reads
it.

## 9. Existing customer dashboard

`app/(dashboard)/dashboard/page.tsx` shows the Phase 11 funnel panel plus
projects/reports counts. It shows **no plan, no credits, no usage**.

`/dashboard/usage` does exist and already uses `getUsageSummary()`,
`getCreditAccount()` and the workspace plan.

## 10. Files that will change

| File | Change |
|---|---|
| `supabase/migrations/0025_*.sql` | NEW — `usage_counters` + `entitlement_consume()` / `entitlement_release()` |
| `features/commerce/entitlements.ts` | Add atomic `consumeEntitlement()` wrapper |
| `features/ai/services/business-validator.ts` | Enforce before `runWorkflow`, release on failure |
| `features/business-plans/*` | Same |
| `features/dashboard/*` | Plan / usage panel |
| `lib/api/response.ts` or callers | Structured `ENTITLEMENT_LIMIT_REACHED` error |
| `scripts/commerce-smoke.tsx` | Tests |

## 11. Proposed design — atomic reservation

Mirrors `credit_accounts` + `credit_transactions` exactly, because that pattern
is already proven race-safe in this codebase.

```
usage_counters                          usage_reservations
  workspace_id                            id
  feature                                 workspace_id
  period_start        ← cached count      feature
  used                  (like balance)    period_start
  PK (ws, feature,                        idempotency_key  UNIQUE
      period_start)                       state: held|released
                                          ← the ledger (authority)
```

`entitlement_consume(workspace, feature, idempotency_key)`:

1. `security definer`, `search_path = public`, explicit authorization
2. Resolve plan **server-side** from `subscriptions` — never from the caller
3. Read `plan_entitlements.limit_value` **at call time**, so a SUPER_ADMIN edit
   takes effect on the very next request with no deploy and no restart
4. `INSERT ... ON CONFLICT` the counter row, then `SELECT ... FOR UPDATE`
5. If `limit_value IS NOT NULL AND used >= limit` → return
   `{allowed:false, reason, used, limit}` — **before any AI call**
6. Otherwise increment `used`, write the reservation row, return remaining
7. Idempotency key already present → return the prior outcome, do not re-consume

`entitlement_release(idempotency_key)` decrements on AI failure, matching the
existing "failed runs do not consume allowance" policy that `countWorkflowRuns`
already implements by counting successes only.

The `FOR UPDATE` on the counter row is what makes CASE A pass: two concurrent
calls serialise, the second sees the first's increment.

CASE D (limit lowered below current usage) works naturally: the counter is
compared against the *current* limit at call time, so new requests are refused
while history is untouched.

## 12. Open question

Should the existing four features (research, competitors, financials,
marketing) be migrated onto the atomic path in this phase, or left on the racy
check-then-act until a follow-up?

Migrating them is the correct end state and closes the same hole. Leaving them
is smaller and lower-risk. Recommendation: build the mechanism now, migrate
validation and business plans now, migrate the other four in a follow-up so this
phase stays reviewable.
