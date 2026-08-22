# Plan limits and enforcement

## Where limits live

`plan_entitlements` — one row per (plan, feature):

| Column | Meaning |
|---|---|
| `is_enabled` | feature appears on the plan at all |
| `limit_value` | `NULL` = unlimited · `0` = denied · `n` = n per month |

**No limit exists anywhere else.** Not in a constant, not in an environment
variable, not in a cache, not in a React component. `entitlement_consume` reads
this table on every call, so an edit is live on the very next request.

Current values:

| Plan | Validations | Business plans | Market research |
|---|---|---|---|
| free | 3 | 1 | denied |
| starter | 25 | 10 | denied |
| growth | 100 | 40 | 25 |
| professional | unlimited | unlimited | 200 |
| enterprise | unlimited | unlimited | unlimited |

## Changing a limit

Admin → Entitlements. Requires `entitlements.manage` (SUPER_ADMIN). Writes
through `admin_update_entitlement`, which records an `admin_audit_logs` row with
actor, reason and before/after values in the same transaction.

Blank means unlimited. `0` means denied. They are different states and the UI
keeps them distinct — collapsing them into a falsy check is the classic bug in
this area.

**Verified live:** raising free validations 3 → 5 changed enforcement on the
next request; the dashboard showed `0 / 1` within one page load after an edit to
1. No deploy, rebuild, restart or re-login.

## The enforcement flow

```
request
  │
  ├─ authenticate                     (session, never a client-supplied user)
  ├─ resolve workspace                (membership, never a request parameter)
  │
  ├─ entitlement_consume(ws, feature, key)      ◀── ONE atomic statement flow
  │     ├─ is_workspace_member?            → refuse if not
  │     ├─ replay of this key?             → return prior outcome, charge nothing
  │     ├─ plan  ← subscriptions           (server-side)
  │     ├─ limit ← plan_entitlements       (read NOW, never cached)
  │     ├─ SELECT counter FOR UPDATE       ◀── serialises concurrent callers
  │     ├─ used >= limit?                  → refuse, return {used, limit, reason}
  │     └─ used += 1, write ledger row
  │
  ├─ DENIED ──▶ EntitlementError ──▶ 402 + structured payload
  │              (no AI call, no rows written, no spend)
  │
  ├─ ALLOWED ─▶ runWorkflow()  ← the only path that reaches a provider
  │
  └─ failure ─▶ entitlement_release(key)   (allowance returned)
```

## Concurrency

`SELECT ... FOR UPDATE` on the counter row is what makes this safe. Two
simultaneous callers serialise; the second observes the first's increment.

Proven against the live database with **real parallel connections**:

| Test | Result |
|---|---|
| limit 3, used 2, 2 simultaneous | 1 allowed, 1 denied, `used` = 3 |
| limit 3, used 0, **8 simultaneous** | 3 allowed, 5 denied — three runs, identical |
| counter vs ledger after a clean burst | 3 and 3, in agreement |

The previous pattern (`countWorkflowRuns` then `canAccessWithinLimit`) cannot do
this: it reads a count, then executes, and the usage row is written only after
the AI call returns — a window seconds wide in which both requests observe the
pre-request count.

## Refund policy

A reservation is **released** when the work it paid for did not happen:

- the AI run threw
- the `business_ideas` / `business_plans` insert failed

Release marks the ledger row `released` and decrements the counter. It never
deletes: what was attempted stays visible. Releasing twice is a no-op, and the
counter can never go below zero.

This matches the policy `countWorkflowRuns` already implemented by counting
successes only — a customer does not spend allowance on a report they never
received.

## Idempotency

The key is derived **server-side** from the workspace and a fingerprint of the
submission. A retry of the same request collides with its first attempt and
returns `replayed: true` without consuming a second unit.

A client-supplied key would defeat this entirely — the caller would simply send
a fresh one — so there is no parameter for it.

## Period

Calendar month, UTC. `usage_period_start()` in SQL mirrors
`currentPeriodStart()` in TypeScript. There is deliberately one definition.

Counters are keyed by `(workspace, feature, period_start)`, so a new month gets
a new row and the previous month's usage cannot block it. Nothing is deleted at
a boundary.

## What a client cannot do

`entitlement_consume` takes **only** a workspace id, a feature name and an
idempotency key. There is no parameter for a plan, a limit, or a usage count.

| Attack | Result |
|---|---|
| Non-member names another workspace | `insufficient_privilege` |
| Anonymous call | `insufficient_privilege` |
| Member resets own counter directly | 0 rows — no UPDATE policy exists |
| Member edits `plan_entitlements` | 0 rows — admin-only |
| Retry to double-consume | `replayed: true`, nothing charged |

All five verified against the live database.

## Not yet on this path

`market_research`, `competitor_analysis`, `financial_intelligence` and
`marketing_intelligence` still use the older `countWorkflowRuns` +
`canAccessWithinLimit` pattern. Their **credit** debits are atomic
(`apply_credit_transaction` locks the account row); their **quota** checks carry
the same race described above.

**Existing features scheduled for migration to the atomic entitlement path in
the next phase.** They were deliberately left untouched here so this phase
establishes one proven mechanism rather than changing five execution paths at
once.
