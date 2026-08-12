# Sprint 07 — Admin & Operations Platform

**Status:** Complete
**Date:** 2026-08-11
**Migration:** `0008_sprint7_admin_platform.sql` (applied and verified against the live database)
**Baseline before this sprint:** typecheck, lint, format pass; 177 test assertions green.

---

## 1. The central architectural decision

An admin panel has to cross the workspace boundary that every other table spends
its RLS enforcing. There are two ways to do that:

| | How | Failure mode |
|---|---|---|
| **(a)** Service-role key | Query with a key that bypasses RLS; check permissions in application code | One forgotten check exposes **every row of every table** — the database has been told to trust the caller absolutely |
| **(b)** RLS-based *(chosen)* | Grant the admin's own session read access through policies that consult a permission table | A forgotten check returns **nothing** — the database re-derives authority from `auth.uid()` on every statement |

**This sprint takes (b).** `SUPABASE_SERVICE_ROLE_KEY` is not read by the Next.js
application anywhere. The application layer became defence in depth instead of
the only defence.

The cost is more SQL: admin reads are expressed as fifteen `SELECT` policies
rather than as a privileged connection. That is the right trade for a surface
`ADMIN-SECURITY-SPEC.md` opens by calling "a high-value attack surface".

```
Browser → middleware (session) → layout requireAdmin() → page requirePermission()
        → Server Action assertPermission() → security definer RPC (re-checks)
        → RLS policy consults admin_has(permission)
```

Five layers. The first four produce good errors; **the fifth is the one that
enforces**. Delete every line of TypeScript in `features/admin/` and an
unauthorized credit adjustment still fails.

---

## 2. Routes

All fourteen are dynamic — confirmed against build output, none prerendered.
`/admin` is `Disallow`ed in `robots.txt`, absent from the sitemap, and carries
`robots: { index: false }` in its layout metadata.

| Route | Permission | Notes |
|---|---|---|
| `/admin` | *(any admin)* | KPIs; unavailable metrics labelled, never zeroed |
| `/admin/users` | `users.read` | Search, status filter, pagination |
| `/admin/users/[id]` | `users.read` | Memberships, audit history, suspend/restore |
| `/admin/workspaces` | `workspaces.read` | Search, status filter, pagination |
| `/admin/workspaces/[id]` | `workspaces.read` | Members, plan, credits, ledger, usage, actions |
| `/admin/ai` | `ai.read` | Status/workflow/model/date filters |
| `/admin/ai/[id]` | `ai.read` | Request detail and failure text, redacted |
| `/admin/usage` | `usage.read` | Consumption and estimated cost |
| `/admin/credits` | `credits.read` | Balances and the ledger |
| `/admin/plans` | `plans.read` | Edit requires `plans.manage` |
| `/admin/entitlements` | `entitlements.read` | Edit requires `entitlements.manage` |
| `/admin/audit-logs` | `audit.read` | Immutable; no delete control exists |
| `/admin/system-health` | `system.read` | Presence and reachability only |
| `/admin/settings` | *(any admin)* | Your role, the matrix, staff directory |

---

## 3. RBAC matrix

Defined **once**, as rows in `admin_role_permissions`. `features/admin/permissions.ts`
mirrors it for the UI; the smoke suite asserts the two match **in both
directions** on every run.

| Permission | SUPER_ADMIN | ADMIN | SUPPORT | ANALYST |
|---|:--:|:--:|:--:|:--:|
| `users.read` | ✓ | ✓ | ✓ | — |
| `users.manage` | ✓ | ✓ | — | — |
| `workspaces.read` | ✓ | ✓ | ✓ | ✓ |
| `workspaces.manage` | ✓ | ✓ | — | — |
| `ai.read` | ✓ | ✓ | ✓ | ✓ |
| `usage.read` | ✓ | ✓ | ✓ | ✓ |
| `credits.read` | ✓ | ✓ | ✓ | — |
| `credits.adjust` | ✓ | ✓ | — | — |
| `plans.read` | ✓ | ✓ | ✓ | ✓ |
| `plans.manage` | ✓ | — | — | — |
| `entitlements.read` | ✓ | ✓ | ✓ | ✓ |
| `entitlements.manage` | ✓ | — | — | — |
| `audit.read` | ✓ | ✓ | — | — |
| `system.read` | ✓ | ✓ | — | ✓ |
| **Total** | **14** | **12** | **7** | **6** |

Three shape decisions worth challenging in review:

- **ANALYST has no `users.read` and no `credits.read`.** Analysing platform
  usage does not require customer PII or sight of individual money movements.
- **SUPPORT holds no mutating permission at all** in Sprint 7. "Limited safe
  operational actions" was read conservatively; granting `credits.adjust` to
  support is a deliberate future decision, not a default.
- **ADMIN excludes `plans.manage` / `entitlements.manage`.** Changing a price or
  what a plan includes is a platform-wide commercial act, not an operational one.

Privilege is monotonic — `SUPER_ADMIN ⊇ ADMIN ⊇ SUPPORT ∪ ANALYST` — and the
suite asserts it, so a future edit cannot accidentally give a junior role
something a senior one lacks.

---

## 4. Database changes (migration 0008)

**Tables:** `admin_users`, `admin_role_permissions`, `admin_audit_logs`.
**Columns:** `suspended_at` / `suspended_reason` on `profiles` and `workspaces`.
**Functions:** `admin_role()`, `is_admin()`, `admin_has()`, `admin_log()`,
`admin_set_user_suspended()`, `admin_set_workspace_suspended()`,
`admin_apply_credits()`, `admin_update_plan()`, `admin_update_entitlement()`,
`admin_platform_stats()` — every one `security definer` with `search_path`
pinned.

Additive only. No applied migration was modified; no existing policy was dropped
or rewritten. Admin policies are *additional* permissive policies, so workspace
isolation for non-admins is untouched — `admin_has(...)` is false for them,
leaving the original predicate as the only one that can match.

### Four properties worth knowing

**Nothing has a client write policy.** Not one INSERT, UPDATE, DELETE or ALL
policy exists on any table this migration touches. Every mutation is a
`security definer` function that checks the permission itself.

**Action and audit cannot come apart.** Each mutating function performs the
change and writes the audit row *in the same transaction*. There is no ordering
of failures that yields a change with no audit record, or an audit record for a
change that did not happen. This is why they are functions rather than
application code.

**Audit authorship cannot be forged.** `admin_log()` stamps `auth.uid()` and the
caller's current role; it accepts neither from the caller.

**Admins cannot mint admins.** `admin_users` has no write policy, so promotion
requires direct database access. One compromised admin session cannot create
another admin — the blast radius of a stolen cookie stops at what that role
already holds.

---

## 5. Security verification

### Behavioural RBAC testing — 61/61 against the live database

Run inside a single transaction that was **rolled back**, so the temporary role
grants never persisted. Structural checks can confirm a policy exists; only
impersonating a role shows whether it denies.

| Scenario | Result |
|---|---|
| Signed-in non-admin: `admin_role()`, `is_admin()`, `admin_has()` | null / false / false |
| Non-admin calls `admin_apply_credits` | `permission denied: credits.adjust` |
| Non-admin calls suspend / platform stats | denied |
| Non-admin reads `admin_audit_logs` / `admin_users` | 0 rows |
| Each of the 4 roles resolves to exactly its grants | ✓ (all 39) |
| Unknown permission string, every role | denied |
| SUPPORT attempts a credit change | `permission denied: credits.adjust` |
| ADMIN credit change with a blank reason | `a reason is required` |
| ADMIN credit grant | succeeded, wrote **exactly one** audit row with correct action, actor role and reason |
| ADMIN attempts `plans.manage` | `permission denied: plans.manage` |
| ADMIN attempts to INSERT an audit row directly | RLS violation |
| ADMIN attempts to self-promote | 0 rows affected; role verified unchanged |
| ANALYST platform stats | user counts **absent** (not zeroed); AI metrics present |
| ANALYST reads `profiles` | 0 rows |
| Deactivated admin | role null, holds nothing |

### Audit immutability — both layers, measured separately

An early test failure here was informative. The three assertions that failed
were **wrong assertions, not vulnerabilities** — and the protection turned out
to be stronger than I had claimed:

| Layer | Caller | Result |
|---|---|---|
| **1 — RLS** | `authenticated` admin | UPDATE and DELETE affect **0 rows**; no error raised; row verified byte-identical afterwards |
| **2 — Trigger** | RLS-bypassing connection (service-role key, leaked connection string, operator at a psql prompt) | `admin_audit_logs is append-only: UPDATE is not permitted` |

Layer 1 filters rather than raising, so the trigger never fires for a normal
admin. That means the trigger's real job is the case RLS *cannot* help with — a
connection that bypasses it entirely. Both hold. The suite now asserts each
layer for what it actually does.

### Redaction — a real gap found and closed

`\bsk-…` requires a non-word character before the key, so a credential
concatenated directly onto word characters escaped redaction. The leading
word-boundary anchor was removed from all key patterns. Over-redacting costs a
support agent some context; under-redacting puts a live key on a screen and into
whatever screenshot follows.

### Build-output verification

- No admin route prerendered to HTML (all 14 are `ƒ` dynamic).
- `robots.txt` contains `Disallow: /admin`; `/admin` absent from the sitemap.
- No occurrence of `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` or
  `SUPABASE_DB_URL` anywhere in `.next/static/`.

### Accepted, not fixed: the namespace is discoverable

`/admin` answers `307` where an unrouted path answers `404`, so anyone can
determine that `/admin/*` is a real protected area. An earlier code comment
claimed the surface was "not enumerable by comparing status codes"; that was an
overstatement and has been corrected in `features/admin/guard.ts`.

This is accepted rather than fixed. The property that matters is that no data
crosses the boundary — the redirect body carries none — and obscuring the URL
buys nothing against an attacker who can guess the word "admin".

---

## 6. Test coverage against `ADMIN-TEST-CASES.md`

**AUTO** = automated suite, every run. **DB** = live-database behavioural test.
**GAP** = not covered, stated rather than glossed.

### Authentication
| Case | Coverage |
|---|---|
| Unauthenticated cannot access `/admin` | **HTTP** — verified live against the dev server: all 5 routes tested return `307` to `/login?redirectTo=…`, body 26 bytes with no admin vocabulary |
| Authenticated non-admin cannot access | DB — role resolves null, every read returns 0 rows |
| Admin session enforced server-side | AUTO — `guard.ts` is `server-only`; role read via RPC from `auth.uid()` |

### RBAC
| Case | Coverage |
|---|---|
| SUPER_ADMIN / ADMIN permissions work | AUTO + DB |
| SUPPORT restricted | AUTO (holds no mutating permission) + DB |
| ANALYST read-only | AUTO + DB |
| Unknown permissions denied | AUTO (all roles) + DB |

### Users / Workspaces
| Case | Coverage |
|---|---|
| Search, pagination | AUTO — clamping, escaping, contiguous ranges |
| Details correct | Manual review; **GAP:** no fixture-backed render test |
| Unauthorized mutation rejected | AUTO (function bodies) + DB |
| Cross-workspace data protected | AUTO (every policy is `admin_has`-gated) + DB |
| Suspend/restore authorization | AUTO + DB |

### AI / Credits / Plans / Audit / Health
| Case | Coverage |
|---|---|
| Requests visible only to authorized roles | AUTO + DB |
| Filters work | AUTO (params) — **GAP:** filter results not asserted against seeded data |
| Provider secrets never appear | AUTO — 7 credential formats, plus the no-boundary case |
| Failure details safe | AUTO — redact-before-truncate proven with a secret straddling the cut |
| Grant/adjustment require reason | AUTO (SQL) + DB |
| Refund atomic | Inherited from `apply_credit_transaction` (Sprint 6.5) |
| Every mutation creates an audit record | AUTO (all 5 functions) + DB |
| Event immutable to normal admin | DB — both layers |
| Sensitive values redacted | AUTO — `redactJson` drops secret-named keys |
| Health checks work; secrets not exposed | AUTO + build-output scan |

### Build gates
| Gate | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass (0 warnings) |
| `npx prettier --check .` | pass |
| `npm test` | **319/319** — engine 35, report 23, plan 26, pdf 6, security 36, commerce 51, admin 142 |
| `npm run build` | pass (clean `.next`) |

Regression: validator, business plan, PDF, workspace, auth, usage and pricing
suites all unchanged and still passing.

---

## 7. Known limitations

1. **End-to-end HTTP testing is half done.** The *anonymous* case is now
   verified live: every admin route returns `307` to `/login` with the correct
   `redirectTo`, a 26-byte body, and no admin vocabulary. The *signed-in
   non-admin* case is still only proven at the database layer, because
   exercising it requires an authenticated session. Worth a Playwright pass with
   a seeded non-admin account.

   Note also that these checks were run by hand against a dev server; they are
   not part of `npm test`, which is deliberately server-free so CI stays fast.
   A Playwright suite would make them permanent.
2. **List rendering is not fixture-tested.** Pagination maths and search
   escaping are covered; "does the users table show the right rows" is verified
   by inspection only. Needs seeded fixtures.
3. **User email is not displayed.** It lives in `auth.users`, which has no admin
   read policy. Showing it would have required either a service-role client
   (rejected) or opening the auth schema. Support agents identify users by name,
   company and ID.
4. **Active users is not measured.** Nothing records sessions or last-seen, so
   the dashboard says so rather than inventing a definition.
5. **Prompt and response bodies are not shown**, even to `ai.read`. Displaying
   customer business plans to staff is a privacy decision deserving its own
   review, not a side effect of a debugging screen.
6. **Admin roles are granted by SQL, not UI** — deliberate, see §4.
7. **No rate limiting on admin Server Actions.** `ADMIN-SECURITY-SPEC.md` lists
   rate limiting for sensitive operations. The REST routes have it via
   `withApiAuth`; Server Actions do not go through that wrapper. Every mutation
   is authorized and audited, so the exposure is noise rather than escalation —
   but it is a real gap against the spec.

---

## 8. Recommended Sprint 8 scope

1. **Close gap 7** — a rate limiter for admin Server Actions.
2. **End-to-end auth tests** (gaps 1–2): anonymous, non-admin and each role
   against every route, plus seeded fixtures for list rendering.
3. **Wire credits into `runWorkflow`** — carried from Sprint 6.5, still the
   largest missing commercial link. `canAccess` before the provider call,
   `debitCredits` on success, `refundCredits` on failure, keyed by
   `ai_request_id`.
4. **Real concurrency test for the credit path** — carried from Sprint 6.5;
   `FOR UPDATE` is asserted structurally, never under contention.
5. **Session/last-seen tracking**, which would make "active users" measurable
   and turn gap 4 into a real metric.
6. **Only then, payment processing.** The data model has been ready since
   Sprint 6.5, and adding a provider to a model that already enforces limits and
   audits changes is a far smaller change than doing both at once.

---

## 9. Addendum — light theme for the signed-in surfaces

Added after the sprint: an opt-in light theme for the dashboard and admin
panel. Marketing pages remain dark and are structurally unable to change.

### How it is scoped

`:root` holds the original dark values; light is an override under
`[data-theme="light"]`, and that attribute is set only on the two signed-in
shells. The 24 migrated marketing pages paint themselves with inline hex and
never render those shells, so no preference can reach them. Verified against
the build output: `news.html` still contains `#0A0B0F` and no `data-theme`.

### Two things that would have broken

**Hardcoded alpha utilities.** 44 uses of `border-white/[0.06]` and similar.
White at 6% over a white background is invisible — every border, divider and
hover state in light mode would have silently vanished. They are now a
`--line-*` / `--fill-*` scale that inverts to a dark alpha, keeping the same
visual weight against the opposite background. 50 files migrated.

**Opacity modifiers.** The sticky headers use `bg-ink/75` and `bg-surface/60`.
A colour token holding a plain hex in a CSS variable cannot take Tailwind's
`/opacity` modifier, so those would have compiled away. Solid colours are
therefore stored as RGB channel triplets and mapped with `<alpha-value>`;
confirmed in the built CSS as `rgb(var(--ink-rgb)/.75)`.

### Preference storage

A cookie, read server-side in each shell's layout. `localStorage` would only be
readable after hydration, so the page would paint dark and snap to light — the
flash that makes theme toggles feel broken. Not stored per account either: the
same person wants different answers on a bright monitor at work and in a dark
room at home.

### Contrast

A WCAG audit of both palettes surfaced a **pre-existing** failure:
`muted-strong` measured 3.84:1 in the dark theme, against the 4.5:1 that small
print requires. It was corrected in both themes (dark now 4.56:1, light
4.53:1). Every text pair in both palettes now passes AA.

Brand cyan was not usable as a link colour on white — about 1.9:1 — so links
route through an `--accent` token that darkens to `#0A63B0` in light mode
(6.13:1 on card).

### Not verified

The rendered result. Both themes are proven at the token, build and contrast
level, but nobody has looked at the light dashboard — it sits behind a login.
