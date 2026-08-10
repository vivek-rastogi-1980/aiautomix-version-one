# TECHNICAL-DEBT

Debt discovered during the Sprint 5.5 stabilization review of Sprints 1–5.

**Severity:** Critical (blocks production) · High (significant risk) · Medium
(fix soon) · Low (optimization)

**Status legend:** RESOLVED · OPEN · ACCEPTED (deliberate, with rationale)

---

## Resolved during this review

### TD-001 — `npm run lint` covered less than half the codebase
- **Severity:** High · **Area:** DevOps / Code Quality
- **Evidence:** `package.json` ran `next lint`, which by design inspects only
  `/src`, `/app`, `/pages`, `/components`, `/lib`. `features/` (the bulk of
  business logic), `hooks/`, `types/`, `scripts/` and `middleware.ts` were never
  linted. Verified by `npx next lint --dir features`, which surfaced warnings the
  default run never reported.
- **Impact:** "0 errors, 0 warnings" was a false green. `next lint` is also
  removed in Next 16.
- **Fix:** `lint` is now `eslint . --max-warnings 0`, with `.next`/`node_modules`
  ignores added to the flat config (without them a direct run reported ~1,850
  problems from compiled bundles).
- **Status:** RESOLVED · **Sprint:** 5.5

### TD-002 — Unpatched critical Next.js vulnerabilities
- **Severity:** Critical · **Area:** Security / DevOps
- **Evidence:** `npm audit` had never been run. Next 15.4.5 carried 4
  vulnerabilities (3 high, 1 critical) across ~30 advisories, including
  GHSA-9qr9-h5gf-34mp (RCE in the React flight protocol) and multiple App Router
  middleware bypasses.
- **Impact:** All authentication in this app is gated in middleware; a bypass
  makes every protected route publicly reachable.
- **Fix:** Upgraded to 15.5.23 (not semver-major). Next now carries zero direct
  advisories.
- **Status:** RESOLVED · **Sprint:** 5.5

### TD-003 — AI Platform facade was documented but unused
- **Severity:** Medium · **Area:** Architecture
- **Evidence:** `features/ai/index.ts` declared itself the platform contract, but
  a dependency scan showed **zero importers**. It omitted `services/*` — the
  entry points callers actually need — so all six server-side consumers reached
  past it into internals.
- **Impact:** The documented module boundary existed only in prose.
- **Fix:** Added the service entry points; routed all six consumers through
  `@/features/ai`. Pure import-path change.
- **Status:** RESOLVED · **Sprint:** 5.5

### TD-004 — REST preamble duplicated across 11 routes
- **Severity:** Medium · **Area:** API
- **Evidence:** Every route repeated resolve-user → 401 → rate limit →
  try/catch → log → 500.
- **Impact:** A new endpoint had to *remember* to be authenticated and throttled.
  Two PDF routes had **no `try/catch` at all**, returning Next's HTML error page
  instead of the JSON envelope.
- **Fix:** `lib/api/route-handler.ts` (`withApiAuth`) — cannot be used without a
  rate-limit scope; the handler only runs for a signed-in user.
- **Status:** RESOLVED · **Sprint:** 5.5

### TD-005 — Projects mutations skipped the workspace role check
- **Severity:** High · **Area:** Security / API
- **Evidence:** `features/projects/actions.ts` had `requireUser()` but no
  `canEdit(role)`, unlike business-plans, business-ideas and workspaces.
- **Impact:** Not exploitable today (all workspaces personal → every caller is
  Owner). Once invitations ship, a Viewer could create projects into a workspace
  they may only read.
- **Fix:** `canEdit` added to create, update and delete. No-op for current users.
- **Status:** RESOLVED · **Sprint:** 5.5

### TD-006 — Lead capture used `mailto:` and reported false success
- **Severity:** Critical · **Area:** API / Product
- **Evidence:** Four public forms built a `mailto:` string and set
  `window.location.href`, then showed a success state unconditionally. One posted
  to a personal Gmail address.
- **Impact:** Every visitor without a desktop mail client saw "sent" while the
  lead was lost. No storage, no attribution, no spam protection.
- **Fix:** `POST /api/leads` → `leads` table (migration 0005), with Zod
  validation, honeypot, per-IP rate limiting, body-size cap and UTM capture.
- **Status:** RESOLVED · **Sprint:** 5.5 · Migration applied and verified
  end-to-end against the live database 2026-08-10.

### TD-007 — `metadataBase` hardcoded to staging
- **Severity:** High · **Area:** SEO
- **Evidence:** `app/layout.tsx` pinned `https://staging.aiautomix.com`; 18 pages
  repeated that host in OG image URLs.
- **Impact:** Every canonical URL and share preview on production would point at
  staging.
- **Fix:** Derived from `NEXT_PUBLIC_SITE_URL`; per-page image URLs made relative.
- **Status:** RESOLVED · **Sprint:** 5.5

### TD-008 — No `typecheck` script
- **Severity:** Low · **Area:** DevOps
- **Evidence:** `package.json` had no `typecheck`; CI-style checks required
  knowing to run `npx tsc --noEmit`.
- **Fix:** Added `"typecheck": "tsc --noEmit"`.
- **Status:** RESOLVED · **Sprint:** 5.5

---

## Open

### TD-022 — Database reconciliation (DB-001 / DB-002)
- **Severity:** Medium · **Area:** Database
- **Evidence:** Live production disagreed with migration 0004 — `business_ideas`
  and `validation_reports` had owner-only SELECT where 0004 specifies workspace
  membership. Separately, six foreign keys had no index, two of them
  `workspace_id` columns read inside RLS predicates.
- **Impact:** 0004 no longer reproduced production; RLS evaluation on the plan
  tables was a sequential scan.
- **Fix:** `0006_sprint5_6_database_reconciliation.sql` — applied in a
  transaction and verified (12 checks, including a re-apply to prove
  idempotency). 0004 was not modified.
- **Status:** RESOLVED · **Sprint:** 5.5 · 2026-08-10

---

## Open

### TD-009 — No CI pipeline · **RESOLVED**
- **Severity:** ~~High~~ · **Area:** DevOps
- **Evidence:** No `.github/workflows`. Nothing ran typecheck, lint, tests or
  build on push. Two findings in this document are direct consequences: lint had
  been covering under half the codebase unnoticed (TD-001), and `npm audit` had
  never been run, which is how an unpatched critical Next.js RCE reached
  production (TD-002).
- **Fix:** `.github/workflows/ci.yml` — five parallel jobs (TypeScript, ESLint
  + Prettier, tests, build, dependency audit) on every pull request and push to
  `main`, aggregated into a single `CI` check for branch protection.
  Requires no secrets: verified by removing `.env.local` and running the full
  suite (126/126) and a production build, both of which pass.
  The audit gate is set to `critical` rather than `high` so the three accepted
  findings (SEC-008) do not fail every run and train people to ignore it;
  verified that it exits 1 at `high` and 0 at `critical`, so the threshold is
  real rather than inert.
- **Status:** RESOLVED · **Sprint:** 5.5 · 2026-08-10
- **Remaining manual step:** branch protection on `main` requiring the `CI`
  check — a GitHub repository setting, not a repository file.

### TD-010 — SVG upload trusts client-declared MIME
- **Severity:** High · **Area:** Security
- **Evidence:** `lib/validations/profile.ts` validates `file.type`, which is
  browser-supplied. SVG is accepted and can contain `<script>`.
- **Impact:** Stored XSS on the Supabase Storage origin. Limited — that origin
  holds no app cookies — but a phishing vector.
- **Fix:** Magic-byte sniffing, or drop SVG, or sanitise server-side. All change
  upload behaviour, so out of scope for a stabilization sprint.
- **Status:** OPEN · **Target:** Sprint 6

### TD-011 — No test coverage for API routes or RLS policies
- **Severity:** Medium · **Area:** Testing
- **Evidence:** 126 checks now pass, but `withApiAuth` and every RLS policy are
  exercised only manually. Sprint 5.5 added `scripts/security-smoke.tsx` covering
  the pure authorization functions; the wrapper itself needs a Supabase test
  double the harness does not have.
- **Impact:** A regression in API auth would be silent.
- **Status:** OPEN (partially mitigated) · **Target:** Sprint 6

### TD-012 — Rate limiter is per-instance
- **Severity:** Medium · **Area:** API / DevOps
- **Evidence:** `lib/rate-limit.ts` uses an in-memory `Map`, documented as sized
  for a single Node instance.
- **Impact:** On Vercel's serverless model each instance keeps its own counters,
  so effective limits are looser than configured.
- **Fix:** Shared store (Upstash/Redis). Call sites do not change.
- **Status:** OPEN · **Target:** Sprint 7

### TD-013 — 320px viewport has 7px horizontal overflow
- **Severity:** Low · **Area:** Performance / UX
- **Evidence:** Measured at all seven breakpoints in the test plan. 375/390/414/
  768/1024/1440 are clean; 320 shows `scrollWidth 327` vs `clientWidth 320`. No
  element's bounding box sits in the overflow band, so it is a pseudo-element or
  transform artifact.
- **Impact:** Minor horizontal scroll on the narrowest devices.
- **Note:** One fix was attempted (a media-query padding override) and
  **reverted** — it did not resolve the overflow and would have changed padding
  on two unrelated containers.
- **Status:** OPEN · **Target:** Sprint 6

### TD-014 — React `animation` / `animationDelay` shorthand conflict
- **Severity:** Low · **Area:** Code Quality
- **Evidence:** ~10 console warnings on the homepage from hero `cardDefs`
  setting both the shorthand and the longhand.
- **Impact:** Console noise; a genuine re-render hazard.
- **Status:** OPEN · **Target:** Sprint 6

---

## Accepted (deliberate, documented)

### TD-015 — No Content-Security-Policy
- **Severity:** High · **Area:** Security
- **Rationale:** The migrated Sprint 1 marketing pages carry inline styles,
  inline `<style>` blocks and inline JSON-LD. A CSP strict enough to matter
  breaks them; one loose enough to pass (`unsafe-inline` on scripts and styles)
  buys almost nothing. Requires nonce-ing those blocks first — its own piece of
  work. Rationale recorded in `next.config.ts` so it is not mistaken for an
  oversight.
- **Status:** ACCEPTED · **Target:** Sprint 6

### TD-016 — Three `npm audit` high findings remain
- **Severity:** High (nominal) · **Area:** Security
- **Rationale:** `postcss`, `sharp`, and `next` inheriting from them. All require
  `next@16`, a breaking major. Assessed for reachability: postcss advisories are
  build-time `sourceMappingURL` attacks on attacker-controlled CSS (all CSS here
  is authored in-repo); sharp CVEs are reached through Next's Image Optimizer,
  which never runs because **this app uses no `next/image`**.
- **Status:** ACCEPTED · **Target:** Sprint 7 (as its own upgrade with a
  regression pass)

### TD-017 — `next/image` unused sitewide
- **Severity:** Medium · **Area:** Performance
- **Rationale:** Every image is a plain `<img>` for pixel fidelity on the
  migrated pages. This is the largest remaining performance win and the highest
  risk to the visual identity. Should be migrated page by page with visual
  comparison, never sitewide in one pass.
- **Status:** ACCEPTED · **Target:** Sprint 7

### TD-018 — `next/font` unused; fonts render-blocking
- **Severity:** Medium · **Area:** Performance
- **Rationale:** The original design references literal family names throughout
  its inline styles, so swapping to generated CSS variables touches a lot of
  migrated markup. Pre-existing, recorded in `MIGRATION-NOTES.md`.
- **Status:** ACCEPTED · **Target:** Sprint 6

### TD-019 — 13 MB of MP4 served from the origin
- **Severity:** Medium · **Area:** Performance
- **Evidence:** Five agent videos, 2.2–2.6 MB each; `public/assets` totals 23 MB.
- **Rationale:** No CDN, poster frames or adaptive streaming. Deferred mounting
  already mitigates first-paint impact.
- **Status:** ACCEPTED · **Target:** Sprint 6

### TD-020 — Two unreferenced exports
- **Severity:** Low · **Area:** Code Quality
- **Evidence:** `features/projects/data.ts → getProject` (never called);
  `features/business-plans/actions.ts → deleteBusinessPlanAction` (fully
  implemented and correctly guarded, but no UI calls it).
- **Rationale:** The Server Action is groundwork for a delete affordance and is
  properly authorized, so it is not a risk. `getProject` is 10 harmless lines.
- **Status:** ACCEPTED · **Target:** whenever the UI lands

### TD-021 — 16 referenced specification documents do not exist
- **Severity:** Medium · **Area:** Documentation
- **Evidence:** `ENGINEERING-HANDBOOK.md`, `ARCHITECTURE.md`, `DATABASE.md`,
  `API-STANDARDS.md`, `CODING-STANDARDS.md`, `UI-DESIGN-SYSTEM.md`,
  `PRODUCT-ROADMAP.md`, `AI-WORKFLOW-ENGINE.md`, `JSON-SCHEMAS.md`,
  `PROMPT-STANDARDS.md`, `OPENAI-INTEGRATION.md`, `REPORT-DESIGN-SYSTEM.md`,
  `PDF-STANDARDS.md`, `TEST-CASES.md`, `WORKSPACE-ARCHITECTURE.md` and
  `BUSINESS-PLAN-SPEC.md` are referenced in code comments throughout the
  codebase but exist nowhere on disk.
- **Impact:** Comments cite standards no one can read. Reviews cannot verify
  implementation against spec — including this one, which fell back to treating
  the code as source of truth.
- **Status:** OPEN · **Target:** Sprint 6
