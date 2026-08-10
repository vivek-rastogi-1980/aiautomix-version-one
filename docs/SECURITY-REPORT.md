# SECURITY-REPORT

Sprint 5.5 stabilization review. Findings are evidence-based; each records what
was verified and how.

**Not verified:** Vercel settings, Supabase project configuration, DNS, and all
third-party consoles. I have no access to them and make no claim about them.

---

## Summary

| Severity | Found | Fixed | Open | Accepted |
| --- | ---: | ---: | ---: | ---: |
| Critical | 2 | 2 | 0 | 0 |
| High | 3 | 2 | 1 | 2 |
| Medium | 3 | 1 | 2 | 0 |
| Low | 1 | 1 | 0 | 0 |

**No Critical finding remains open.**

---

## SEC-001 — Unpatched critical RCE and middleware bypasses in Next.js

- **Severity:** Critical
- **Location:** `package.json` → `next@15.4.5`
- **Finding:** `npm audit` had never been run. Next 15.4.5 carried 4
  vulnerabilities (3 high, 1 critical) spanning ~30 advisories.
- **Risk:** Three were acute for this application:
  - `GHSA-9qr9-h5gf-34mp` — **RCE in the React flight protocol**. This is an App
    Router app built on RSC throughout.
  - `GHSA-267c-6grr-h53f` + `GHSA-26hh-7cqf-hhc6` — **middleware/proxy bypass via
    segment-prefetch routes**. All authentication here is gated in
    `middleware.ts`, so a bypass makes every protected dashboard route publicly
    reachable.
  - `GHSA-w37m-7fhw-fmv9` — Server Actions source code exposure (7 modules).

  Also present: SSRF via middleware redirects, HTTP request smuggling in
  rewrites, DoS in Server Components, RSC cache poisoning.
- **Evidence:** `npm audit --json` before upgrade — `{"high":3,"critical":1}`.
- **Remediation:** Upgraded to `next@15.5.23` (npm reports `isSemVerMajor:
  false`). Next now carries zero direct advisories.
- **Verification:** After upgrade, all seven protected routes still return 307 to
  `/login` — including under `RSC: 1`, `Next-Router-Prefetch: 1` and `?_rsc=`,
  the exact request shapes the bypass advisories describe. Build, typecheck, lint
  and 126 test checks pass.
- **Status:** **RESOLVED**

---

## SEC-002 — Lead capture lost data and leaked a personal address

- **Severity:** Critical (business) / Medium (security)
- **Location:** `features/home/home-view.tsx`, `features/contact/contact-view.tsx`,
  `features/dev-services/website-development/website-development-view.tsx`
- **Finding:** Four public forms handed off via `mailto:` and displayed a success
  state unconditionally. One posted to `vivek.rastogi.work@gmail.com`.
- **Risk:** Every submission from a visitor without a desktop mail client was
  silently lost while the UI reported success. No server-side validation, no spam
  protection, no rate limiting, no storage.
- **Remediation:** `POST /api/leads` persisting to a new `leads` table
  (migration 0005), with server-side Zod validation, honeypot, per-IP rate
  limiting, a body-size cap, and UTM/referrer capture. Personal address replaced
  with `contact@aiautomix.com`.
- **Verification:** Tested against the running endpoint — 422 invalid email with
  field errors · 422 unknown source · 400 malformed JSON · 413 oversized body ·
  201 honeypot with no signal · 429 at exactly the 6th request.
- **Status:** **RESOLVED** — and verified end-to-end against the live database on 2026-08-10 (see SEC-009).

---

## SEC-003 — Projects mutations lacked a workspace role check

- **Severity:** High
- **Location:** `features/projects/actions.ts`
- **Finding:** The only mutation module with `requireUser()` but no
  `canEdit(role)`. business-plans, business-ideas and workspaces all had one.
- **Risk:** `createProjectAction` stamps `workspace_id` without asking whether the
  caller may write to that workspace. Unexploitable today only because every
  workspace is personal, making every caller Owner. Once invitations ship, a
  Viewer could create projects into a workspace they may only read — the insert
  names them as `user_id`, so the owner-only RLS policy permits it.
- **Remediation:** `canEdit` added to create, update and delete. No-op for every
  existing user.
- **Verification:** `scripts/security-smoke.tsx` asserts the TypeScript role
  predicates match the SQL in migration 0004, and that Viewer cannot edit. Drift
  was deliberately introduced during review and the suite failed as intended.
- **Status:** **RESOLVED**

---

## SEC-004 — Honeypot disclosed itself to bots

- **Severity:** Low
- **Location:** `lib/validations/lead.ts`
- **Finding:** Introduced during this review. The honeypot used Zod `.max(0)`,
  which failed validation and returned **422 naming `website`** as the offending
  field.
- **Risk:** Told a bot exactly which field to leave alone next time — the
  opposite of a honeypot's purpose.
- **Remediation:** Validation accepts the value; the route inspects it and
  discards the submission behind a normal 201.
- **Verification:** `curl` returned `{"success":true,...}` with 201. Regression
  test added (`honeypot value passes validation`).
- **Status:** **RESOLVED**

---

## SEC-005 — No security headers

- **Severity:** Medium
- **Location:** `next.config.ts`
- **Finding:** No headers configured at all; transport security, framing and
  referrer leakage left to browser defaults.
- **Remediation:** Six headers added — HSTS, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy:
  strict-origin-when-cross-origin`, a deny-by-default `Permissions-Policy`, and
  DNS prefetch control.
- **Verification:** All six confirmed on a live response via `fetch` in the
  browser.
- **Status:** **RESOLVED**

---

## SEC-006 — SVG upload trusts client-declared MIME

- **Severity:** High
- **Location:** `lib/validations/profile.ts`, `features/profile/actions.ts`
- **Finding:** `imageFileSchema` validates `file.type`, which is browser-supplied
  and forgeable. SVG is an accepted type and can carry `<script>`.
- **Risk:** A crafted multipart request can store executable SVG in a public
  bucket. **Severity is bounded:** Supabase Storage serves from its own origin,
  so such a file cannot reach app cookies or session. It remains a phishing
  vector.
- **Evidence:** `ACCEPTED_IMAGE_TYPES` includes `image/svg+xml`; upload passes
  `contentType: parsed.data.type` straight through.
- **Remediation:** Magic-byte sniffing, server-side sanitisation, or dropping
  SVG. All change upload behaviour, so out of scope for a stabilization sprint.
- **Status:** **OPEN** — Sprint 6

---

## SEC-007 — No Content-Security-Policy

- **Severity:** High
- **Location:** `next.config.ts`
- **Finding:** No CSP. Defence-in-depth against XSS is absent.
- **Risk:** Mitigated in practice — every `dangerouslySetInnerHTML` site takes a
  **static module constant** (page CSS, a static icon map, static JSON-LD). No
  user input or AI output reaches an HTML sink; model output renders as text
  through the Report Engine.
- **Rationale for deferral:** The migrated marketing pages carry inline styles,
  inline `<style>` blocks and inline JSON-LD. A CSP strict enough to matter
  breaks them; one loose enough to pass (`unsafe-inline` on both) buys almost
  nothing. Requires nonce-ing those blocks first.
- **Remediation:** Nonce the inline blocks, then adopt `script-src 'self'
  'nonce-…' https://www.googletagmanager.com`.
- **Status:** **ACCEPTED** — rationale recorded in `next.config.ts`

---

## SEC-008 — Three dependency advisories remain

- **Severity:** High (nominal), unreachable in practice
- **Location:** `postcss`, `sharp`, `next` (inherited)
- **Finding:** `npm audit` reports 3 high after the Next upgrade. All require
  `next@16` — a breaking major.
- **Risk assessment (per `SPRINT-06-SECURITY.md`: review individually, do not
  blindly major-upgrade):**
  - **postcss** — all four advisories are build-time `sourceMappingURL` attacks
    against attacker-controlled CSS. Every stylesheet here is authored in-repo.
    **Not reachable in production.**
  - **sharp** — libvips CVEs reached through Next's Image Optimizer. This app
    uses **no `next/image`** anywhere, so the optimizer never runs. **Not
    reachable.**
- **Remediation:** Schedule `next@16` as its own upgrade with a regression pass.
- **Status:** **ACCEPTED** — Sprint 7

---

## SEC-009 — Lead table not provisioned

- **Severity:** Medium (availability, not confidentiality)
- **Location:** `supabase/migrations/0005_leads.sql`
- **Finding:** ~~The migration has not been applied to any database.~~ **Applied and verified 2026-08-10.**
- **Risk:** Every lead submission returns 500 and is lost. Failure is graceful —
  a user-safe message with a fallback email — but the data is gone.
- **Remediation:** Applied. Verified with 18 structural checks and a conclusive
  RLS proof: with a row known to exist, the anon key returned `[]` on both a full
  and a targeted read, and could neither UPDATE nor DELETE. PostgREST answers
  those two with HTTP 204 — a success-shaped response that changes nothing,
  because zero rows match the RLS-filtered set. An end-to-end submission through
  `/api/leads` persisted every field including UTM attribution.
- **Status:** **RESOLVED**

---

## Verified clean

Each checked and found sound.

| Area | Evidence |
| --- | --- |
| **Secrets** | `OPENAI_API_KEY` read only in `features/ai/providers/openai.ts`; `SUPABASE_SERVICE_ROLE_KEY` only in `scripts/sync-workflows.ts` (never at runtime — must **not** be set on Vercel). Nothing sensitive behind `NEXT_PUBLIC_`. `.env.local` gitignored. |
| **Authentication** | `middleware.ts` uses `supabase.auth.getUser()`, verifying against Supabase rather than trusting the cookie. Verified live: 7/7 protected routes 307 to `/login`. |
| **Authorization** | All 11 REST routes go through `withApiAuth`, which cannot be used without a rate-limit scope. All four Server Action modules check workspace role. |
| **RLS** | Enabled on every table. `leads` is deliberately asymmetric — anon may INSERT, **no role may SELECT** — so a table accepting anonymous writes cannot become a public dump of prospect contact details. |
| **Open redirect** | `safeRedirectPath` rejects `//evil.com`, absolute URLs and backslash-prefixed paths. Six regression assertions. |
| **Header injection** | `toPdfFilename` strips everything outside `[a-z0-9-]`, caps at 60 chars, has a fallback. Six regression assertions including CRLF and path traversal. |
| **XSS** | Every `dangerouslySetInnerHTML` takes a static module constant. No user input or AI output reaches an HTML sink. |
| **SQL injection** | No raw SQL; all access through PostgREST filters. |
| **Prompt injection** | User input fenced with explicit BEGIN/END markers and labelled untrusted; system/developer content stays trusted. |
| **CSRF / CORS** | Server Actions carry Next's origin check. API routes parse `request.json()`, which browsers cannot issue cross-origin as a simple request. No permissive CORS headers. |
| **Rate limiting** | AI runs 10/hour/user; REST 60/min/user; leads 5/10min/IP. Four regression assertions. |

---

## Release-gate addendum (2026-08-10)

Workspace isolation was verified against production with a real authenticated
session, not only by reading policies: a disposable account was created, its
workspace bootstrapped on first read with role `owner`, section edits and version
restores were written and confirmed at the database, and after logout every
`sb-*` cookie was gone and protected routes redirected. All test data and the
account were removed afterwards; `auth.users` returned to its prior count.

## Remaining actions

| Priority | Action | Owner |
| --- | --- | --- |
| ~~1~~ | ~~Apply migration 0005 (SEC-009)~~ — **done 2026-08-10** | Complete |
| 2 | Add CI so these gates are enforced (TD-009) | Engineering |
| 3 | Harden SVG upload (SEC-006) | Sprint 6 |
| 4 | Nonce inline blocks, then land CSP (SEC-007) | Sprint 6 |
| 5 | Plan the `next@16` upgrade (SEC-008) | Sprint 7 |
