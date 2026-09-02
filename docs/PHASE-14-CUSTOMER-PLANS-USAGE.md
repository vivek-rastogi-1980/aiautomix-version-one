# Phase 14 — Customer plans, usage and entitlements

Status: implemented. Migration `0029_phase14_plan_assignment.sql` **created and
statically verified, not yet applied.** See [Migration](#9-migration).

Phase 14 began as a large brief and finished as a small one. The audit found
that the entitlement engine the brief described already existed, built in Sprint
6.5 and completed by migration `0025`. Rather than rebuild it, Phase 14 added
only the three things that were genuinely missing:

| Gap | What was missing | Where it landed |
| --- | --- | --- |
| A | No way to change a workspace's plan | `admin_change_workspace_plan` + admin UI |
| B | No record of plan changes | `subscription_plan_history` |
| C | Account section showed no workspace, plan or status | `features/settings/account-panel.tsx` |

---

## 1. Existing entitlement architecture (reused, not rebuilt)

**Plan limits are stored in database entitlements and are dynamically read by
`entitlement_consume`. They are not hard-coded in application code.**

That sentence is enforced, not merely asserted: `scripts/commerce-smoke.tsx`
fails the build if a limit constant appears in the migration, the validator, the
plan service or the enforcement module.

The resolution chain, unchanged by this phase:

```
authenticated user
  → workspace              (workspace_members, via is_workspace_member)
  → subscriptions.plan_id  (read inside the DB; never supplied by a caller)
  → plan_entitlements      (read on EVERY call — no cache, no constant)
  → usage_counters         (locked FOR UPDATE)
  → allow / deny
```

`limit_value` encodes three states: `NULL` = unlimited, `0` = denied, `N` =
capped at N.

Seeded defaults (migration `0007`):

| Plan | Validations / month | Business plans / month |
| --- | --- | --- |
| Free | 3 | 1 |
| Starter | 25 | 10 |
| Growth | 100 | 40 |

A SUPER_ADMIN editing these in Admin → Entitlements changes the answer for the
very next request. No deploy, rebuild, restart or re-login.

### Atomic enforcement

`entitlement_consume` materialises the counter row, takes `FOR UPDATE` on it,
compares against the current limit and increments — all in one statement. Two
concurrent requests serialise; the second sees the first's increment. This is
what makes it a *reservation* rather than a *count*, and it is why the naive
`check → execute → increment` pattern is explicitly not used.

Both expensive paths reserve **before** any AI call:

- `features/ai/services/business-validator.ts`
- `features/ai/services/business-plan.ts`

A denial therefore costs zero AI spend. On failure both call
`releaseEntitlement`, which marks the ledger row `released` rather than deleting
it, so the attempt stays visible.

---

## 2. Plan assignment (Gap A)

`Admin → Workspaces → [workspace] → Change plan`, offering Free, Starter and
Growth.

Authorization is the existing `plans.manage` permission, which in the seeded
matrix is held by **SUPER_ADMIN alone** — `ADMIN` is explicitly excluded from
it. No new permission and no second RBAC system was introduced.

The check happens three times, and only the last one matters:

1. `assertPermission(context, "plans.manage")` in the Server Action — for a
   legible error.
2. RLS on the tables involved.
3. `admin_has('plans.manage')` **inside** `admin_change_workspace_plan` — this
   is the gate. If every line of TypeScript were deleted, the database would
   still refuse.

### Nothing is trusted from the caller

The function's only parameters are `p_workspace_id`, `p_plan_id` and
`p_reason`. There is deliberately **no current-plan parameter**: the old value
is read from `subscriptions` inside the transaction, so a stale page or a forged
request cannot cause a transition record that never happened.

An unknown `p_plan_id` is rejected against the `plans` catalog — stranding a
workspace on an uncatalogued plan would leave it with no entitlement rows, which
`entitlement_consume` reads as `feature_not_in_plan` and denies everything.

Changing to the plan already in force raises rather than writing a no-op row.

---

## 3. Plan history (Gap B)

`subscription_plan_history` — append-only.

| Column | Notes |
| --- | --- |
| `id` | uuid pk |
| `workspace_id` | FK, cascade |
| `subscription_id` | denormalised, deliberately not a FK |
| `old_plan`, `new_plan` | plan **ids**, not FKs — a retired plan must not erase history |
| `changed_by` | FK to `auth.users`, `on delete set null` |
| `changed_by_role` | the admin role at the time |
| `reason` | optional |
| `created_at` | utc |

`subscriptions` remains the single source of truth for the *current* plan. This
table records *transitions* only and never duplicates current state.

**Immutability** is a `before update or delete` trigger
(`reject_plan_history_mutation`), mirroring `reject_audit_mutation` (0008) and
`reject_ledger_mutation` (0007).

**RLS**: one `SELECT` policy requiring `admin_has('workspaces.read')`. There is
**no INSERT, UPDATE or DELETE policy for any role**, so the security-definer
function is the only writer. A customer cannot write here by any path.

---

## 4. Atomicity of a plan change

A plpgsql function body is one statement to the caller, so these three writes
commit or roll back together:

```
BEGIN                                  (implicit)
  UPDATE subscriptions SET plan_id     -- the change
  INSERT subscription_plan_history     -- the record
  PERFORM admin_log(...)               -- the shared audit trail
COMMIT
```

A plan change without its history is not a state this system can reach.

The subscription row is locked `FOR UPDATE` before it is read, so two admins
changing the same workspace concurrently serialise into a chain rather than two
conflicting branches.

---

## 5. Downgrade behaviour

A plan change **never** touches `usage_counters`, `usage_reservations`,
`credit_accounts`, `credit_transactions` or `ai_usage_logs`. It also does not
rewrite `current_period_start` / `current_period_end` — resetting the period
would silently hand back an allowance the customer had already spent.

The consequence is intended:

> A workspace that used 80 validations on Growth and is moved to Free (limit 3)
> reads **80 / 3**, and further requests are refused until the period resets or
> the workspace is upgraded.

No new enforcement produces this. `entitlement_consume` already compares the
counter against whatever the limit is *now*, so the existing engine yields it for
free. The admin workspace screen renders the over-limit case in red rather than
clamping the number, because the true state is what explains the refusals.

---

## 6. Customer account (Gap C)

`/settings` now leads with an Account panel showing **Name, Email, Workspace,
Plan, Status**, above the existing Change Email / Change Password / Sign Out
controls. No second account page and no duplicate authentication logic.

The plan **name** comes from the `plans` catalog, not a label map in the
component, so a renamed plan renames here without a deploy.

Status shows `suspended` when the workspace is suspended, otherwise the
subscription status — a suspended workspace is the more important fact.

The panel is display-only. That is not what enforces the rule: `subscriptions`
grants no write policy to any client role, and the only writer demands
`plans.manage` inside Postgres. The panel being read-only just means the screen
tells the truth.

---

## 7. Audit trail

Reuses `admin_audit_logs`. A plan change writes action
`WORKSPACE_PLAN_CHANGED`, entity `workspace`, with `before_data`
`{"plan_id": "..."}` and `after_data` `{"plan_id": "..."}` plus the reason.

Two records exist for one change by design: the commerce-specific
`subscription_plan_history`, and the shared trail where a plan change appears
alongside every other privileged act. Both are append-only.

---

## 8. Security summary

| Property | Enforced by |
| --- | --- |
| Customer cannot change their plan | No write policy on `subscriptions`; RPC requires `plans.manage` |
| Customer cannot change limits | `admin_update_entitlement` requires `entitlements.manage` |
| Customer cannot spoof `workspace_id` | `is_workspace_member()` inside `entitlement_consume` |
| Customer cannot spoof plan or usage | Neither is a parameter anywhere |
| Customer cannot forge history | No INSERT policy; trigger blocks UPDATE/DELETE |
| Lesser admin cannot assign plans | `plans.manage` is SUPER_ADMIN-only |
| Anonymous callers | `revoke all ... from anon` on both new functions |
| Direct API calls | Identical path — the gate is in the database, not the UI |

---

## 9. Migration

`supabase/migrations/0029_phase14_plan_assignment.sql`

- **CREATED** ✅
- **APPLIED** ❌ — not executed against any database
- **VERIFIED** — statically only (typecheck, lint, 95 smoke checks)

Additive: one table, three functions, one trigger, one policy, two indexes. It
edits no applied migration.

### To apply

Paste into the Supabase SQL Editor, or `supabase db push`. Then confirm:

```sql
select count(*) from public.subscription_plan_history;   -- expect 0
select public.admin_change_workspace_plan is not null;   -- function exists
```

Applying it changes no existing row and no plan limit. Until it is applied, the
admin plan control returns "That did not work" (the function does not exist) and
the plan-history panel renders empty — nothing else is affected.

---

## 10. Testing strategy

21 new checks in `scripts/commerce-smoke.tsx` (95 total, all passing), covering
the brief's 15 required scenarios: authorization, invalid plan, history created,
history immutable, audit created, atomicity, lock ordering, downgrade
preservation, no period rewrite, no forged old-plan, isolation, and the
customer-facing panels.

These are source- and SQL-level property assertions, in the same style as the
existing suite, which needs no database. They verify that the *properties* hold —
that the lock precedes the comparison, that the RLS block contains no write
policy — rather than exercising a live connection.

**What that does not cover**: behaviour against real data. A live concurrency
test (two simultaneous plan changes) and the end-to-end admin→customer flow need
an applied migration and a test database. Both are listed as outstanding in the
Phase 14 report.

---

## 11. Production deployment procedure

1. Apply `0029` to the database (SQL Editor or `db push`).
2. Deploy the application.
3. Verify on a **test workspace** only:
   - Admin → Workspaces → test workspace → Change plan → Free → Starter
   - Confirm the plan updates, history shows `free → starter`, and Admin →
     Audit logs shows `WORKSPACE_PLAN_CHANGED`
   - Return it to its original plan; note that this leaves two more history rows,
     which is correct — history is append-only
4. Confirm the customer's `/settings` shows the workspace, plan and status.

**Do not** verify by editing production entitlement limits (3 → 5 → 3). Real
customers would briefly receive an artificial limit. Limit changes belong in a
test database or a staging Supabase project.

Nothing in this phase resets usage, alters credits or modifies customer data.
