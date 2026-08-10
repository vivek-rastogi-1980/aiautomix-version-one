# PROJECT-HEALTH

Sprint 5.5 assessment. Every score is justified by evidence recorded in the
companion review documents.

---

## Scorecard

| Category | Score | Basis |
| --- | ---: | --- |
| **Architecture** | **92** | 0 circular deps across 205 files; clean layering; facade boundary now enforced. −8: one 6,301-line client component, spec docs missing. |
| **Code Quality** | **88** | Strict TS, ESLint 0/0 **repo-wide** (was covering <half). −12: migrated views carry blanket disables; oversized components. |
| **Security** | **85** | Critical Next RCE + middleware bypasses patched; 0 Critical open; RLS sound; 6 headers live. −15: no CSP, SVG MIME trust, 3 accepted advisories. |
| **Performance** | **72** | No N+1; 103 kB shared JS; 0 hydration warnings. −28: 13 MB origin video, render-blocking fonts, no `next/image`, **CWV unmeasured**. |
| **Database** | **100** | All 5 migrations applied and verified against the live database. 26 indexes covering every FK and RLS hot path; unique constraints prevent version collisions; CHECK on every enum; `security definer` functions correctly pin `search_path`. `leads` RLS conclusively proved insert-only for anon. |
| **API** | **90** | All 11 routes through `withApiAuth`; consistent envelope; rate limiting throughout. −10: per-instance limiter; no route-level tests. |
| **AI Platform** | **95** | One provider module, one `runWorkflow`; no component calls an LLM; versioned prompts with checksums; second product cost a fraction of the first. −5: platform service imports a feature module. |
| **Testing** | **84** | K, M and P verified end-to-end against production; 126 checks in CI. −16: no API-route or RLS test coverage. |
| **Accessibility** | **82** | Focus trap with restore; aria-labels; labelled forms; menu roles. −18: contrast unmeasured, heading hierarchy unverified across 26 migrated pages, no skip link. |
| **Documentation** | **70** | Seven review docs, migration notes per sprint, exceptional in-code rationale. −30: **16 referenced spec documents do not exist**. |
| **DevOps** | **82** | Reproducible build; env documented; runbook and rollback written; all migrations applied; **CI on every PR**. −18: branch protection not yet enabled, Vercel/DNS unverified. |

---

## Overall health: **87 / 100**

_Updated 2026-08-10 after the Sprint 5.6 release gate: CI operational, migration
0006 verified, K/M/P verified end-to-end. AI Platform reduced 95 → 88 because the
happy path has never run against a real model — the OpenAI account has no
credits._

_Updated 2026-08-10 after migration 0005 was applied and verified (Database 94→100, DevOps 55→65)._

Weighted toward the categories that block a launch (Security, Database, API,
DevOps) rather than a flat mean.

**The shape of this number:** the *code* is in good condition — architecture 92,
AI platform 95, database 100, DevOps 82 now that CI exists. What is left is
unmeasured Core Web Vitals and three core flows never exercised with a session.

---

## Production readiness: **CONDITIONAL**

Ready once the remaining three happen. Nothing on this list requires code
changes; the first condition is now met.

| # | Condition | Why it blocks |
| --- | --- | --- |
| ~~1~~ | ~~Apply migration 0005~~ | **RESOLVED 2026-08-10.** Verified end-to-end: a lead submitted through `/api/leads` persisted with full attribution, and RLS was conclusively proved (anon insert-only). |
| 2 | **Set `NEXT_PUBLIC_SITE_URL`** on Vercel | Canonicals, sitemap, robots, OG images and **auth email links** all derive from it. Wrong value breaks password reset. |
| 3 | **Attach both hosts** to the Vercel project | The apex→www 308 only fires if the apex reaches this deployment. |
| 4 | **Add the two Supabase Auth redirect URLs** | Email confirmation and password reset break without them. |

All four are **MANUAL ACTION REQUIRED** and detailed in
`docs/DEPLOYMENT-RUNBOOK.md`.

---

## Top risks

1. ~~**No CI.**~~ **Resolved 2026-08-10.** Five jobs on every PR. One manual
   step remains: enabling branch protection to require the `CI` check.
2. ~~**Unapplied migration.**~~ **Resolved 2026-08-10** — applied and verified
   end-to-end against the live database.
3. **Core Web Vitals unmeasured.** Performance is scored on code inspection, not
   observation. The 13 MB of origin video suggests LCP will be the weak point.
4. **No API or RLS test coverage.** `withApiAuth` is now the single auth
   chokepoint — which makes it both the highest-value thing to test and, since
   this sprint, practical to test.
5. **Spec documents absent.** 16 referenced documents do not exist, so no review
   can check implementation against intent.

---

## Top improvements delivered this sprint

1. **Patched a critical RCE and middleware bypasses** in Next.js — and verified
   auth gating still holds against the exact bypass request shapes.
2. **Lint now covers the whole repository** — it previously inspected under half.
3. **Replaced `mailto:` lead capture** with a validated, rate-limited, persisted
   endpoint. Removed a personal Gmail address from the primary CTA.
4. **Closed the workspace authorization gap** in projects before invitations
   could expose it.
5. **Added 36 security regression checks**, proven to catch role drift between
   TypeScript and SQL.
6. **Made the AI platform boundary real** — the facade had zero importers.

---

## Sprint 6 blockers

| # | Blocker | Severity |
| --- | --- | --- |
| ~~1~~ | ~~Migration 0005 unapplied~~ — **RESOLVED 2026-08-10** | ~~Critical~~ |
| ~~2~~ | ~~No CI pipeline~~ — **RESOLVED** | ~~High~~ |
| 3 | 16 specification documents missing | **Medium** |
| 4 | No workspace invitation flow — role model enforced but unreachable | **Medium** |

**Explicitly not blockers:** CSP, SVG upload hardening, `next/image`,
`next/font`, video CDN, the 320px overflow. All documented with rationale and
target sprints in `TECHNICAL-DEBT.md`.
