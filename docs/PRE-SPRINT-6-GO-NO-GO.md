# PRE-SPRINT-6 GO / NO-GO REVIEW

**Date:** 2026-08-10 · **Branch:** `main` · **HEAD:** `a15b92f` · **Tree:** clean

---

## Final decision

# CONDITIONAL GO

**No blockers. No unresolved Critical or High security exposure. Production build
passes.** Three conditions must be met before Sprint 6 work merges — none require
application code changes, and none are on the critical path for starting.

The honest caveat driving "conditional" rather than "go": **12 of 16 core user
flows were verified structurally, not functionally.** Their routes, guards, RLS
predicates and data contracts are correct, but no authenticated session was
driven through them. That is not evidence of breakage — it is absence of
evidence, and this review already produced one example of an assumption that
turned out wrong (see Corrections).

---

## Executive summary

The codebase is in good condition. Architecture is sound (0 circular
dependencies), the AI platform boundary is genuinely enforced, RLS is enabled and
correctly predicated on all 15 tables, and every quality gate passes.

Sprint 5.5 closed two Critical issues — an unpatched Next.js RCE with App Router
middleware bypasses, and a lead-capture path that silently discarded submissions.

What remains is operational rather than structural: no CI, three new findings
from this review, and a body of documentation that does not exist.

---

## Corrections to previous reporting

Recorded prominently because a review is only useful if its errors are visible.

**1. "Every foreign key is indexed" — WRONG.** `ARCHITECTURE-REVIEW.md` claimed
this. Queried against the live database, **6 foreign keys have no index**. The
earlier claim came from counting `create index` statements in migration files
rather than cross-checking every constraint.

**2. "Migration 0005 unapplied" — WRONG.** Reported as a Critical blocker. It was
already applied; nothing had checked. Corrected and verified end-to-end on
2026-08-10.

**3. "All five migrations applied" — only approximately true.** See DB-001: the
live schema and migration 0004 disagree.

---

## Current commit

```
a15b92f  docs: migration 0005 verified against the live database
5db8e69  chore: Sprint 5.5 stabilization — review docs, security tests, EOL fix
1d7d5d7  Merge origin/main, keeping the patched Next.js
0883ec0  feat(analytics): conversion events, manifest, News schema, sprint docs
ad6aaca  security: patch critical Next.js RCE and middleware bypasses (S06-02)
```

`main` is level with `origin/main`. Working tree clean.

---

## Test results

All four commands exist and were run. **Nothing hidden.**

| Command | Result |
| --- | ---: |
| `npm run typecheck` | **exit 0** |
| `npm run lint` | **exit 0** (`eslint . --max-warnings 0`) |
| `npm test` | **126/126 checks passed** |
| `npm run build` | **✓ Compiled — 44 routes, Next 15.5.23** |
| `npm audit` | 3 high (assessed unreachable — see Security) |

| Suite | Checks |
| --- | ---: |
| `test:engine` — Workflow Manager vs mock provider, both workflows | 35 |
| `test:report` — validator document model, HTML render, UTC determinism | 23 |
| `test:plan` — plan catalog, render, PDF export | 26 |
| `test:pdf` — A4, multi-page, branded | 6 |
| `test:security` — authorization, redirect, header injection, rate limit, lead validation | 36 |

---

## Database status

Verified by querying the **live database**, not by reading migration files.

| Check | Result |
| --- | --- |
| Migrations 0001–0005 | All present (15 expected tables exist) |
| RLS enabled | **15 / 15 tables** — none disabled |
| Tables with zero policies | **none** |
| `security definer` functions | 6, **all pin `search_path`** |
| Indexes / FKs / unique / check | 50 / 32 / 6 / 10 |
| Workspace-scoped tables | 7 |
| `handle_new_user` trigger | wired as `on_auth_user_created` |

**Workspace isolation predicates — verified correct:**

```
business_plans          INSERT  user_id = auth.uid() AND can_edit_workspace(workspace_id)
                        UPDATE/DELETE  can_edit_workspace(workspace_id)
                        SELECT  user_id = auth.uid() OR is_workspace_member(workspace_id)
business_plan_sections  writes  can_edit_workspace   reads  is_workspace_member
business_plan_versions  writes  can_edit_workspace   reads  is_workspace_member
projects                writes  owner-only           reads  owner OR workspace member
```

### New findings

**DB-001 — Schema drift between migration 0004 and the live database · MEDIUM**
Migration 0004 (lines 444–457) widens the SELECT policies on `business_ideas`
and `validation_reports` to `auth.uid() = user_id OR is_workspace_member(...)`.
**The live database has `auth.uid() = user_id` only.** `projects`, from the same
block, *does* carry the widened predicate — so the block applied partially.

*Direction of drift is fail-safe* (live is more restrictive than specified), and
with no invitation flow there is no user-visible impact. But re-running 0004 on a
fresh project would produce a different schema from production, which breaks
reproducibility.
**Required: a new migration `0006` to reconcile. Do not edit 0004.**

**DB-002 — Six foreign keys without an index · MEDIUM**
`ai_usage_logs.request_id`, `business_plan_sections.workspace_id`,
`business_plan_versions.edited_by`, `business_plan_versions.workspace_id`,
`business_plans.ai_request_id`, `business_plans.business_idea_id`.

The two `workspace_id` columns matter most — they are **RLS predicate columns**,
so every policy evaluation on those tables is a sequential scan. Invisible at 0
rows; a real scaling problem once plans accumulate.
**Required: index them in migration `0006`.**

**DB-003 — One user has no profile row · LOW**
`auth.users = 1`, `public.profiles = 0`. The trigger is correctly wired, so the
account predates migration 0001 and 0001 has no backfill for existing users. The
dashboard degrades gracefully (`profile?.full_name ?? email.split("@")[0]`) and
the profile page upserts, so it self-heals on first save. Worth a backfill in
0006 if any real users predate 0001.

---

## Security status — **GO**

**No unresolved Critical. No unresolved High that exposes user data, workspace
data, AI usage, API credentials, business plans or reports.**

| Verified | Evidence |
| --- | --- |
| Secrets | `OPENAI_API_KEY` server-only; service-role key used only by a local script, never at runtime; nothing behind `NEXT_PUBLIC_` |
| Authentication | `getUser()` verifies against Supabase, not the cookie. **10/10 protected routes return 307 → `/login`** |
| API authorization | **5/5 sampled endpoints return 401** unauthenticated; all 11 go through `withApiAuth` |
| RLS | Enabled on 15/15 tables; predicates verified per table |
| `leads` isolation | Conclusively proved: with a row known to exist, anon read returned `[]` on full *and* targeted queries; anon could not UPDATE or DELETE |
| Open redirect | `safeRedirectPath` rejects `//host`, absolute URLs, backslash paths |
| Header injection | `toPdfFilename` strips to `[a-z0-9-]`, caps at 60, has a fallback |
| Prompt injection | User input fenced BEGIN/END and labelled untrusted |
| XSS / SQLi / CSRF / CORS | No user input reaches an HTML sink; no raw SQL; Server Actions carry origin checks; no permissive CORS |

**Accepted with rationale:** no CSP (needs nonces for migrated inline blocks
first — a CSP loose enough to pass buys nothing); 3 `npm audit` high findings
requiring `next@16`, assessed unreachable (postcss is build-time only against
attacker-controlled CSS; sharp is reached solely via Next's Image Optimizer,
which never runs because this app uses no `next/image`).

**Open High:** SVG upload trusts client-declared MIME. Bounded — Supabase Storage
serves from its own origin, so it cannot reach app cookies. Phishing vector only.

---

## AI platform status — **GO**

Every requirement in section 7 verified.

| Requirement | Evidence |
| --- | --- |
| All AI calls go through the Workflow Engine | Exactly one function executes a workflow (`runWorkflow`) |
| No frontend OpenAI calls | grep for `new OpenAI`, `openai.`, `chat.completions` outside `features/ai/providers/`: **zero hits** |
| Prompts versioned | Markdown files with version + checksum; `ai_prompt_versions` has 2 rows |
| JSON schema validated | `validateResponse` with repair + retry; 35 engine checks cover malformed output, out-of-range scores, missing sections |
| Usage recorded | `recordWorkflowRun` inside `runWorkflow` — not the feature's to skip |
| Errors handled | `AiError` carries code, user-safe message and HTTP status |
| Workflow isolation | `ai_workflows` has 2 registered workflows; each run records which produced it |

`runWorkflow` owns input validation, rate limiting, provider selection, prompt
loading, response validation, cost estimation and usage recording. **A feature
cannot skip a stage because none of the stages are the feature's to call.**

---

## Core user flow verification

**This is the weakest part of the assessment and the reason for CONDITIONAL.**

| # | Flow | Status | Evidence |
| --- | --- | --- | --- |
| A | Registration | **STRUCTURAL** | `/register` 200; `on_auth_user_created` trigger wired |
| B | Login | **STRUCTURAL** | `/login` 200; middleware redirects with `redirectTo` preserved |
| C | Dashboard | **STRUCTURAL** | 307 when anonymous; data layer has no N+1 |
| D | Workspace creation | **STRUCTURAL** | Lazy bootstrap in `getWorkspaceContext`; 1 workspace + 1 member exist |
| E | **Workspace isolation** | **VERIFIED** | RLS predicates queried per table; role parity TS↔SQL enforced by test |
| F | Project creation | **STRUCTURAL** | `canEdit` guard added in 5.5; RLS owner-only writes confirmed |
| G | Idea Validator | **PARTIAL** | Engine verified against mock provider (35 checks). **No real model run.** |
| H | Validation Report | **VERIFIED** | 23 checks — document model + HTML render |
| I | Business Plan creation | **PARTIAL** | Engine verified vs mock. **No real model run.** |
| J | Section generation | **VERIFIED** | 26 checks — catalog validated against schema |
| K | Section editing | **NOT VERIFIED** | Requires a session |
| L | Section versioning | **STRUCTURAL** | `unique (section_id, version)` confirmed live |
| M | Version restoration | **NOT VERIFIED** | Requires a session |
| N | PDF generation | **VERIFIED** | Real PDFs produced — A4, multi-page, branded, 34–41 KB |
| O | Report history | **STRUCTURAL** | `/reports` 307; `/api/reports` 401 |
| P | Logout | **NOT VERIFIED** | Requires a session |

**VERIFIED = exercised. STRUCTURAL = routing, guards and contracts confirmed;
behaviour not driven. NOT VERIFIED = neither.**

Three flows (K, M, P) have no verification at all. Two (G, I) have never been run
against a real model — only a mock provider.

---

## Performance status — **CONDITIONAL**

| Check | Result |
| --- | --- |
| Hydration errors | **zero** — console clean |
| N+1 queries | **none** — every multi-fetch uses `Promise.all` |
| Bundle | 103 kB shared; pages 105–131 kB |
| Client components | Migrated marketing views are client by necessity; platform code is server-first |
| PDF generation | Works; synchronous and CPU-bound |
| Images | **`next/image` unused sitewide** — no optimisation |
| Fonts | **Render-blocking** Google Fonts `<link>` |
| Video | **13 MB of MP4 from the origin**, no CDN |
| Core Web Vitals | **NOT MEASURED** — requires a deployed URL |

Performance is scored on code inspection, not observation. The 13 MB of origin
video makes LCP the likely weak point.

---

## Technical debt classification

**BLOCKER = 0.**

| Item | Class | Deferral rationale |
| --- | --- | --- |
| TD-009 No CI | **HIGH** | **Requires CTO approval to defer.** Every gate above depends on a human remembering. |
| TD-010 SVG upload MIME trust | **HIGH** | Deferred — bounded to Supabase's own origin; fixing changes upload behaviour |
| TD-015 No CSP | **HIGH** | Deferred — needs nonces on migrated inline blocks first |
| TD-016 3 `npm audit` high | **HIGH** | Deferred — assessed unreachable; needs `next@16` major |
| DB-001 Schema drift | **MEDIUM** | New — fail-safe direction, needs migration 0006 |
| DB-002 Unindexed FKs | **MEDIUM** | New — RLS predicate columns; scaling risk |
| TD-011 No API/RLS tests | MEDIUM | Partially mitigated by the 36-check suite |
| TD-012 Per-instance rate limiter | MEDIUM | Looser than configured under serverless |
| TD-021 19 spec docs missing | MEDIUM | No review can check implementation against intent |
| DB-003 Missing profile row | LOW | Self-heals |
| TD-013 320px 7px overflow | LOW | Fix attempted and reverted |
| TD-014 Animation shorthand warnings | LOW | Re-render only |

Four HIGH items remain. Per section 9, Sprint 6 may start only if each is fixed
**or has explicit CTO-approved deferral.** Three carry documented technical
rationale. **TD-009 (no CI) does not** — it is deferred only by omission.

---

## Production readiness score

| Category | Score | Basis |
| --- | ---: | --- |
| Architecture | 92 | 0 circular deps; clean layering; facade enforced |
| Security | 85 | 0 Critical open; RLS verified live; no CSP, SVG MIME |
| Database | 88 | RLS 15/15, all definers pinned — **−12 for drift + unindexed FKs** |
| AI Platform | 95 | Boundary verified by grep and by test |
| API | 90 | 11/11 wrapped; 401s confirmed |
| Testing | 66 | 126 checks — **but 3 core flows unverified, 2 mock-only** |
| Performance | 72 | No N+1, no hydration errors; CWV unmeasured |
| Accessibility | 82 | Focus trap, labels, roles; contrast unmeasured |
| Documentation | 70 | 8 review docs — **19 referenced specs do not exist** |
| Deployment | 65 | Runbook + rollback written; **no CI**; Vercel/DNS unverified |

## **Overall: 81 / 100**

Weighted toward launch-blocking categories (Security, Database, API, Deployment).

---

## Remaining risks

1. **No CI** — every gate here depends on someone remembering. Highest leverage.
2. **Three core flows never verified** (section editing, version restore, logout).
3. **Two AI flows never run against a real model** — only a mock provider.
4. **Schema drift** — migration files no longer reproduce production.
5. **Core Web Vitals unmeasured.**
6. **19 spec documents absent** — Sprint 6 cannot be reviewed against a spec.

---

## Sprint 6 blockers

**None.** No Critical issue, no unresolved security blocker, no broken workflow
found, no data-isolation issue, build passes.

### Conditions before Sprint 6 work merges

1. **Add CI** running `typecheck`, `lint`, `test`, `build` — or record explicit
   CTO approval to defer TD-009.
2. **Write migration `0006`** reconciling DB-001 (policy drift) and DB-002
   (unindexed FK columns). Do not edit 0004.
3. **Exercise flows K, M and P once manually**, and run G and I against a real
   model at least once. These are the only unknowns that could hide a defect.

---

## Verdict

**CONDITIONAL GO.**

AIAutomix is **not** approved to begin Sprint 6 unconditionally. It is approved
to begin once the three conditions above are met — none of which requires
application code changes, and all of which can be completed in under a day.

The codebase is sound. The gaps are in verification and process, not in
architecture or security.
