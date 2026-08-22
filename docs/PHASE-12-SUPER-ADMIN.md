# Phase 12 — Super Admin Command Center

## What Phase 12 actually was

An audit-first phase. The brief described building a command center; the audit
found **23 admin routes, 14 admin RPCs and every required table already
existed**. Roughly 85% of the requested scope was already built and tested by
phases 7–11.

So Phase 12 is deliberately small: it closes real gaps and changes nothing that
already worked. The most valuable output was the audit itself.

## Design decisions worth knowing

### RBAC was NOT restricted to SUPER_ADMIN

The brief says *"only SUPER_ADMIN should access the complete command center."*
That contradicts the existing, tested RBAC, where `ADMIN` runs operations,
`SUPPORT` has read-only customer access and `ANALYST` has analytics without PII
— allocated deliberately in migration 0008 and asserted by 162 admin checks.

Restricting `/admin` to `SUPER_ADMIN` would revoke access other staff rely on.
Instead, per-permission gating is unchanged: `SUPER_ADMIN` sees the complete
picture because it holds all 21 permissions, and every other role sees exactly
its own slice with the rest rendered **Unavailable**.

Tightening this later is a one-line change in the layout guard. Locking staff
out today would not have been easily undone.

### No `/api/admin/*` REST endpoints were created

The brief suggests ten. The admin panel is Server Components + Server Actions
throughout, with one server-side aggregation per page. Adding REST endpoints
would duplicate `features/admin/data.ts` and create a second authorization
surface to keep in sync — which the brief's own §14 warns against. The existing
design already satisfies the performance requirement: no browser fan-out, no
N+1, no client-side aggregation.

### "Unavailable" is never zero

Every stat can be `null`, and `null` renders as **Unavailable**, not `0`.
`0 leads` and `you cannot see leads` are different facts. An operator who
confuses them concludes the funnel is broken and goes hunting for a bug that
does not exist. The `admin_command_center_stats` function omits a key entirely
rather than returning zero when the caller lacks the grant.

## What was added

| Area | Change |
|---|---|
| Migration `0024` | `admin_command_center_stats(timestamptz)` — permission-gated aggregates |
| Navigation | 16 flat links grouped into 7 sections |
| Dashboard | Active users, signed in today, never signed in, new leads today |
| Dashboard | AI platform block: most-used model/feature, avg cost/request, failure rate |
| Dashboard | Per-workflow AI spend table |
| Dashboard | 9-stage lead funnel with drop-off |
| `features/admin/funnel-panel.tsx` | Funnel + workflow panels |
| `features/admin/leads.ts` | `getCommandCenterStats`, `buildFunnel` |
| Tests | 13 new admin checks (149 → 162) |

## KPI sources

Every number is traceable. Nothing is estimated or derived from a proxy.

| KPI | Source | Calculation |
|---|---|---|
| Active users | `auth.users.last_sign_in_at` | `count(*) where last_sign_in_at >= since` |
| Signed in today | `auth.users.last_sign_in_at` | `count(*) where >= date_trunc('day', now())` |
| Never signed in | `auth.users.last_sign_in_at` | `count(*) where is null` |
| New leads today | `leads.created_at` | `count(*) where >= today` |
| Funnel stages | `lead_events.event` | `count(DISTINCT lead_id)` per event |
| Most used model | `ai_usage_logs.model` | `group by model order by count desc limit 1` |
| Most used feature | `ai_usage_logs.workflow` | same, by workflow |
| Avg cost / request | `ai_usage_logs.estimated_cost_usd` | `sum(numeric) / count(*)`, as text |
| AI failure rate | `ai_usage_logs.status` | `count(status <> 'success') / count(*)` |
| Per-workflow spend | `ai_usage_logs` | grouped; cost `sum(numeric)` as text |
| Credits issued/consumed | `credit_transactions.amount` | `sum` where `> 0` / `abs(sum)` where `< 0` |

**Money is never a float.** `estimated_cost_usd` is `numeric`, summed as
`numeric`, and returned via `to_char` as a decimal string. The UI formats that
string and never does arithmetic on it.

**Funnel stages count DISTINCT leads, not events.** Someone who opens their
report four times is one lead that reached "report viewed". Counting rows would
inflate every downstream conversion rate.

## Security model

- `is_admin()` guard inside the function; non-admins get
  `insufficient_privilege`, verified at the database for both `authenticated`
  and `anon`
- Each block gated by its own `admin_has(...)`; absent keys, never zeros
- `security definer` with `set search_path = public`
- `revoke all ... from anon`
- Every `/admin/*` route runs `requirePermission()` server-side, and RLS refuses
  the rows independently

## Known limitations

- **Active users** means "signed in within the window". There is still no
  session or last-seen tracking beyond `last_sign_in_at`, so this is a
  sign-in count, not engagement. The definition is printed next to the number.
- **Historical leads have no funnel events.** Leads captured before an event was
  instrumented are counted at zero for that stage rather than back-filled, which
  is why an old lead can show a later stage without the earlier one.
- **Recent activity is still three separate lists** (AI failures, new
  workspaces, credit movements) rather than one unified timeline. Deferred —
  a merged feed needs a union view across five tables and was not worth the
  query cost for this phase.
- **No date-range picker.** The window is fixed at 30 days.

## Deferred

- Unified recent-activity feed
- Dashboard date-range control
- `/admin/business-ideas` and `/admin/reports` — the brief lists them, but no
  such pages exist and §5 says not to create pages for modules that do not
  exist. Reports are reachable per-user and per-workspace today.
