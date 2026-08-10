# STABILIZATION-SUMMARY — Sprint 5.5

Stabilization, architecture, security, performance and technical-debt review of
the Sprint 1–5 codebase. **No Sprint 6 features were implemented.**

---

## What was inspected

| Area | Coverage |
| --- | --- |
| Source | 205 TypeScript/TSX files across `app/ components/ features/ lib/ hooks/ types/ scripts/` |
| Routes | 44 total — 26 public marketing, 5 auth, 12 dashboard, 12 API |
| Database | 5 migrations, 15 tables, 26 indexes, all RLS policies and `security definer` functions |
| Server Actions | 7 modules |
| Dependencies | 457 packages; full `npm audit` |
| Config | `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `middleware.ts`, `.env.example` |
| Git | branch, status, recent commits |

**Method note:** the brief lists 21 specification documents to read first.
**Sixteen of them do not exist** anywhere on disk — `ENGINEERING-HANDBOOK.md`,
`ARCHITECTURE.md`, `DATABASE.md`, `API-STANDARDS.md`, `CODING-STANDARDS.md`,
`UI-DESIGN-SYSTEM.md`, `PRODUCT-ROADMAP.md`, `AI-WORKFLOW-ENGINE.md`,
`JSON-SCHEMAS.md`, `PROMPT-STANDARDS.md`, `OPENAI-INTEGRATION.md`,
`REPORT-DESIGN-SYSTEM.md`, `PDF-STANDARDS.md`, `TEST-CASES.md`,
`WORKSPACE-ARCHITECTURE.md`, `BUSINESS-PLAN-SPEC.md`. They are cited throughout
code comments. This review therefore treated the repository as source of truth,
which the brief explicitly permits. Recorded as TD-021 / ARCH-006.

---

## What was fixed

### Critical

**Unpatched Next.js RCE and middleware bypasses** — `npm audit` had never been
run. Next 15.4.5 carried 4 vulnerabilities (3 high, 1 critical) across ~30
advisories, including RCE in the React flight protocol and **multiple App Router
middleware bypasses**. Since all authentication here is gated in middleware, a
bypass makes every protected route publicly reachable. Upgraded to 15.5.23 (not
semver-major). Verified all 7 protected routes still 307 to `/login` under
`RSC: 1`, `Next-Router-Prefetch: 1` and `?_rsc=`.

**Lead capture lost data silently** — four public forms used `mailto:` and showed
success unconditionally; one posted to a personal Gmail. Replaced with
`POST /api/leads` persisting to a new `leads` table, with Zod validation,
honeypot, per-IP rate limiting, body-size cap and UTM capture.

### High

**Workspace authorization gap** — `features/projects/actions.ts` was the only
mutation path without a role check. Not exploitable today (all workspaces
personal), but the invitation flow would have shipped a Viewer-can-write bug.

**Lint covered under half the codebase** — `next lint` inspects only 5
directories; all of `features/`, `hooks/`, `types/`, `scripts/` and
`middleware.ts` were unchecked. Now `eslint . --max-warnings 0` repo-wide.

### Medium

- AI platform facade had **zero importers** — added the missing service entry
  points, routed 6 consumers through it
- REST preamble duplicated 11× → `withApiAuth`; this also fixed **two PDF routes
  with no `try/catch`** returning HTML instead of the JSON envelope
- No security headers → six added and verified live
- `metadataBase` hardcoded to staging → derived from `NEXT_PUBLIC_SITE_URL`

### Low

- Honeypot returned a 422 naming itself (introduced and caught during this
  review) → now accepts and discards silently
- No `typecheck` script → added

---

## Test results

```
npm run typecheck   exit 0
npm run lint        exit 0   (eslint . --max-warnings 0)
npm test            126/126 checks passed
npm run build       ✓ Compiled successfully — 44 routes
npm audit           3 high (all assessed unreachable — see SECURITY-REPORT)
```

| Suite | Checks | Covers |
| --- | ---: | --- |
| `test:engine` | 35 | Workflow Manager against a mock provider, both workflows |
| `test:report` | 23 | Validator document model + HTML render + UTC determinism |
| `test:plan` | 26 | Plan section catalog, render, PDF export |
| `test:pdf` | 6 | A4, multi-page, branded, size |
| `test:security` | **36 (new)** | Authorization, open redirect, header injection, rate limiting, lead validation, SEO consistency |

**The new suite was proven to fail.** Role drift was deliberately introduced
(granting Viewer edit rights); the suite failed with exit code 1 and the
offending assertion named. Reverted and re-verified green.

---

## Security status

**No Critical finding remains open.** 2 Critical found → both fixed.

| Open | Severity | Note |
| --- | --- | --- |
| SVG upload trusts client MIME | High | Bounded — Supabase Storage serves from its own origin |
| ~~Migration 0005 unapplied~~ | ~~Medium~~ | **RESOLVED 2026-08-10** — applied and verified end-to-end |

**Accepted with rationale:** no CSP (needs nonces for migrated inline blocks
first); 3 dependency advisories requiring `next@16` — postcss is build-time only
against attacker-controlled CSS, sharp is reached only via Next's Image
Optimizer which never runs because this app uses no `next/image`.

**Verified clean:** secrets, authentication, authorization, RLS, open redirect,
header injection, XSS, SQL injection, prompt injection, CSRF/CORS, rate limiting.

---

## Performance status

**Verified good:** no N+1 queries anywhere · 103 kB shared JS · zero hydration
warnings · clean third-party profile (GA4 only, conditional).

**Weak points:** 13 MB of MP4 from the origin · render-blocking fonts ·
`next/image` unused · `logo-ice2.png` at 419 KB.

**Not measured:** Core Web Vitals and Lighthouse. Both need a deployed URL; local
numbers mislead. This is the honest gap in the performance assessment.

**Mobile:** 6 of 7 breakpoints clean. 320px shows 7px overflow; a fix was
attempted and **reverted** because it did not work and would have changed two
unrelated containers.

---

## Architecture status

Sound. **0 circular dependencies** across 205 files. Dependency flow
`app/ → features/ → lib/ → types/` with no inversion.

**AI platform boundaries verified:** exactly one module constructs a model client;
exactly one function executes a workflow; **no React component calls an LLM**
(grep for `new OpenAI`, `openai.`, `chat.completions` outside the provider layer:
zero hits). `runWorkflow` owns input validation, rate limiting, provider
selection, prompt loading, response validation with repair/retry, cost estimation
and usage/history recording — a feature cannot skip a stage.

**Workspace isolation verified:** RLS enabled on all 15 tables; `security
definer` helpers correctly pin `search_path`; the new regression test parses
migration 0004 and fails if TypeScript role predicates drift from the SQL.

---

## What remains

| Priority | Item | Target |
| --- | --- | --- |
| ~~1~~ | ~~Apply migration 0005~~ — **DONE 2026-08-10**, verified end-to-end | Complete |
| 2 | Add CI (typecheck/lint/test/build) | Sprint 6 |
| 3 | Measure Core Web Vitals — **MANUAL** | After deploy |
| 4 | Harden SVG upload | Sprint 6 |
| 5 | Write the 16 missing spec documents | Sprint 6 |
| 6 | Nonce inline blocks, then land CSP | Sprint 6 |
| 7 | Video to CDN; `next/font` | Sprint 6 |
| 8 | API/RLS test coverage | Sprint 6 |
| 9 | `next@16` upgrade with regression pass | Sprint 7 |

---

## Sprint 6 blockers

1. ~~**Migration 0005 unapplied**~~ — **RESOLVED 2026-08-10.** Applied and
   verified: 18 structural checks, a conclusive RLS proof, and one lead
   submitted end-to-end through `/api/leads` with full attribution.
2. ~~**No CI**~~ — **RESOLVED 2026-08-10.** `.github/workflows/ci.yml`, five jobs on
   every pull request, verified to require no secrets.
3. **16 spec documents missing** — Medium. Sprint 6 cannot be reviewed against a
   spec that does not exist.
4. **No invitation flow** — Medium. The role model is enforced in RLS but
   unreachable; any collaboration work starts here.

---

## Recommended next actions

1. ~~Apply migration 0005~~ — **done and verified 2026-08-10.** Lead capture is
   live: anon can insert, cannot read back, and attribution persists correctly.
2. Add a GitHub Actions workflow — it makes every other finding here durable.
3. Deploy, then run PageSpeed Insights and fill in PERF-009.
4. Decide whether Sprint 6 is collaboration (needs invitations) or AI Business
   Intelligence (needs neither), and write the spec documents for whichever.

**Sprint 6 was not started.**
