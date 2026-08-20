# AIAutoMix — Security Audit

**Scope:** SPRINT-06 S06-07, S06-08 and `SPRINT-06-SECURITY.md`.
**Date:** 2026-08-08

Nothing here about Vercel, Supabase project settings, DNS or third-party
consoles has been verified — I have no access to them. Repository-level findings
were verified as stated.

---

## Sprint acceptance gate

`SPRINT-06-SECURITY.md` says the sprint cannot complete if any of these hold:

| Condition | Status |
| --- | --- |
| A production secret is exposed | **No** — verified |
| A protected route is public | **No** — verified against the live server |
| Cross-user private data is accessible | **No** — RLS denies by default |
| Privileged API operations lack authorization | **No** — all 11 routes go through `withApiAuth` |

---

## 1. The critical finding: unpatched Next.js

`npm audit` had never been run in this project. It reported **4 vulnerabilities
(3 high, 1 critical)** against Next 15.4.5, with roughly 30 advisories on Next
alone.

Three were acutely relevant:

| Advisory | Why it mattered here |
| --- | --- |
| **GHSA-9qr9-h5gf-34mp** — RCE in the React flight protocol (**critical**) | App Router app built on RSC throughout |
| **GHSA-267c-6grr-h53f** + **GHSA-26hh-7cqf-hhc6** — middleware/proxy bypass via segment-prefetch | **All authentication in this app is gated in middleware.** A bypass makes every dashboard route publicly reachable — which trips the sprint's own acceptance gate |
| **GHSA-w37m-7fhw-fmv9** — Server Actions source code exposure | Seven Server Action modules |

Also present: SSRF via middleware redirect handling, SSRF in Server Actions,
HTTP request smuggling in rewrites, multiple DoS vectors in Server Components,
and cache poisoning in RSC responses.

**Fixed:** upgraded to **Next 15.5.23**, which npm reports as *not* semver-major.
Next now carries zero direct advisories.

**Verified after upgrade:** all seven protected routes still 307 to `/login`,
including under `RSC: 1`, `Next-Router-Prefetch: 1` and `?_rsc=` — the exact
request shapes the bypass advisories describe.

### Remaining findings — assessed, not ignored

Three high findings remain. All require `next@16`, a breaking major that
`SPRINT-06-SECURITY.md` explicitly says not to take blindly. Each was assessed
for reachability:

| Package | Reachable here? |
| --- | --- |
| **postcss** | **No.** All four advisories are build-time `sourceMappingURL` attacks against attacker-controlled CSS. Every stylesheet in this repo is authored in-repo. |
| **sharp** | **No.** libvips CVEs reached through Next's Image Optimizer. This app uses **no `next/image`** anywhere — all images are plain `<img>` — so the optimizer is never invoked. |
| **next** | Inherited from the two above; no direct advisories remain. |

**Recommendation:** schedule the Next 16 upgrade as its own piece of work with
its own regression pass. Do not fold it into a hardening sprint.

---

## 2. Secrets

**Clean.** Verified by grep across the entire source tree.

- `OPENAI_API_KEY` — read only in `features/ai/providers/openai.ts`, server-side
- `SUPABASE_SERVICE_ROLE_KEY` — read only in `scripts/sync-workflows.ts`, which
  runs locally. **Never read at runtime**, so it should not be set on Vercel at
  all. Documented in the launch checklist.
- `SMTP_PASS` — server-only, read in `features/communications/mailer.ts` and nowhere else. Never logged: SMTP failures are classified into codes (`SMTP_AUTH_FAILED`, `SMTP_ENVELOPE_REJECTED`) before anything reaches a log line or `email_logs`.
- No secret is behind a `NEXT_PUBLIC_` prefix
- `.env.local` is gitignored; no secret appears in tracked files

---

## 3. Authentication and authorization

**Route protection** — `middleware.ts` gates `/dashboard`, `/projects`,
`/plans`, `/reports`, `/validator`, `/workspace`, `/profile`, `/settings`,
`/ai/history`. Uses `supabase.auth.getUser()`, which verifies the token against
Supabase rather than trusting the cookie. Verified live: all seven tested routes
307 to `/login` with the original path preserved in `redirectTo`.

**Server Actions** — all four mutation modules check the workspace role
(`canEdit` / `canManage`) in addition to `requireUser()`.

`features/projects/actions.ts` was the one gap and was closed during this work:
it stamped `workspace_id` with no role check. Not exploitable today (all
workspaces are personal, so every caller is Owner), but the moment invitations
ship, a Viewer could create projects into a workspace they may only read.

**REST** — all 11 routes go through `withApiAuth`, which cannot be used without
supplying a rate-limit scope. The only unauthenticated route is `POST
/api/leads`, deliberately, with its own controls (below).

**Open redirects** — `safeRedirectPath` in `lib/site.ts` constrains the
`redirectTo` parameter.

---

## 4. Row Level Security

Enabled on every table. Reads happen in Server Components under the user's own
session, so RLS is the enforcement point rather than application code.

**`leads` is deliberately asymmetric:** anon may `INSERT`; **no role may
`SELECT`.** A table that accepts anonymous writes and also allows anonymous
reads is a public dump of every prospect's name, email and phone — the most
common way a Supabase-backed marketing form leaks its own pipeline. Reads go
through the service role only.

---

## 5. Public form and API hardening

`POST /api/leads` is the only unauthenticated write, so the protections
`withApiAuth` supplies elsewhere are spelled out explicitly:

| Control | Implementation | Verified |
| --- | --- | --- |
| Rate limiting | 5 per IP per 10 min, from `x-forwarded-for` | Yes — 429 at exactly the 6th request |
| Body size cap | 16 KB, checked before parsing | Yes — 413 |
| Server-side validation | Zod as the authority, not the client's copy | Yes — 422 with field errors |
| Spam protection | Honeypot field | Yes — 201 with no signal to the bot |
| Safe error messages | No internals leaked; fallback address given | Yes |
| Length limits | Every field bounded | Yes |

**A bug found and fixed during this work:** the honeypot first used Zod
`.max(0)`, which failed validation and returned a 422 naming `website` as the
offending field — telling a bot exactly which field to leave alone next time.
Validation now accepts the value and the route discards it behind a normal 201.

**Duplicate submission:** partially handled — the UI switches to a success state
on submit, preventing a second click. There is no server-side idempotency key.
Recorded as P2; the rate limiter bounds the damage.

---

## 6. Input handling

- **XSS** — every `dangerouslySetInnerHTML` site takes a static module constant
  (page CSS, a static icon map, static JSON-LD). No user input or AI output
  reaches an HTML sink; model output renders as text through the Report Engine.
- **SQL injection** — no raw SQL anywhere; all access is through PostgREST
  filters.
- **Prompt injection** — user input is fenced with explicit BEGIN/END markers
  and labelled untrusted. System and developer content stays trusted.
- **Header injection** — `toPdfFilename` strips everything outside `[a-z0-9-]`,
  caps at 60 characters and has a fallback, so a user-supplied plan title cannot
  break out of `Content-Disposition`.

---

## 7. File uploads

| Check | Status |
| --- | --- |
| Size limit | 2 MB |
| Path safety | `${user.id}/…`, enforced by storage RLS |
| Access control | Owner-scoped bucket policies |
| MIME validation | **Weak** — trusts client-declared `file.type` |

**Open risk (P1):** SVG is an accepted type and `file.type` is client-declared,
so a crafted request can store an SVG containing `<script>` in a public bucket.
Severity is limited — Supabase Storage serves from its own origin, so it cannot
reach app cookies or session — but it remains a phishing vector. Fixing properly
means magic-byte sniffing or server-side sanitisation, both of which change
upload behaviour.

---

## 8. Security headers (S06-08)

Six headers ship, verified live in the browser:

| Header | Value |
| --- | --- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` |
| `X-DNS-Prefetch-Control` | `on` |

**Content-Security-Policy is deliberately absent.** The migrated Sprint 1
marketing pages carry hand-tuned inline styles, inline `<style>` blocks and
inline JSON-LD `<script>` tags for pixel fidelity. A CSP strict enough to be
worth having breaks them; one loose enough to pass (`unsafe-inline` on both
scripts and styles) buys almost nothing. `SPRINT-06-SECURITY.md` says not to
deploy a CSP that breaks legitimate services.

**Path to a real CSP:** nonce the inline blocks first, then adopt
`script-src 'self' 'nonce-…' https://www.googletagmanager.com`. That is its own
piece of work, not a line in a config file. The rationale is recorded in
`next.config.ts` so it is not mistaken for an oversight.

**CORS** — no permissive headers set; same-origin by default. Server Actions
carry Next's built-in origin check. API routes parse `request.json()`, which
browsers cannot issue cross-origin as a simple request.

---

## 9. Priorities

| Priority | Item |
| --- | --- |
| ~~P0~~ | ~~Unpatched critical Next.js RCE and middleware bypasses~~ — **fixed** |
| ~~P0~~ | ~~Projects Server Actions missing workspace role check~~ — **fixed** |
| ~~P0~~ | ~~No server-side validation on public forms~~ — **fixed** |
| P1 | SVG upload trusts client-declared MIME |
| P1 | No CSP (needs nonces first) |
| ~~P1~~ | ~~No CI enforcing the quality gates~~ — **RESOLVED**, includes `npm audit --audit-level=critical` |
| P2 | Rate limiter is per-instance; needs a shared store on serverless |
| P2 | No tests covering API routes, Server Actions or RLS policies |
| P2 | No server-side idempotency on lead submission |
| P2 | Plan the `next@16` upgrade to clear postcss/sharp |
