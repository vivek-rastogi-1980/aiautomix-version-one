# AIAutoMix — Production Readiness Audit

**Target:** https://www.aiautomix.com (Vercel)
**Audit date:** 2026-08-08
**Scope:** Full repository. Phase 1 discovery — no code changed during this phase.

---

## Verdict

**The application is technically sound but not yet launch-ready as a marketing
site.**

The engineering foundation is genuinely strong: the build is clean, there are no
circular dependencies, the data layer has no N+1 queries, the AI platform
boundary is enforced, and a hardening pass already added security headers and
closed a workspace authorization gap.

What is missing is almost entirely the **public-facing/go-to-market layer**:
there is no sitemap, no robots.txt, no error pages, no canonical host, and — most
seriously — **lead capture does not work in a way most visitors can complete**.

Nine P0 issues must be fixed before this domain goes live.

---

## 1. Current Architecture

| Area | Finding |
| --- | --- |
| Framework | **Next.js 15.4.5**, App Router, React 19.1 |
| Language | TypeScript **strict**, clean under `tsc --noEmit` |
| Package manager | npm (`package-lock.json`) |
| Styling | Tailwind 3.4 + hand-tuned inline styles on migrated marketing pages |
| Routing | Route groups: `(marketing)`, `(auth)`, `(dashboard)` |
| Auth | Supabase Auth, `@supabase/ssr` 0.7 |
| Database | Supabase Postgres, RLS on every table, 4 ordered migrations |
| Storage | Supabase buckets: `avatars`, `logos`, `reports` |
| AI | OpenAI via an in-house workflow engine (server-only) |
| Middleware | Session refresh + protected-route gating |
| API | 11 REST routes, all through `withApiAuth` |
| Server Actions | 7 modules, all Zod-validated and role-guarded |
| Analytics | GA4 via `NEXT_PUBLIC_GA_MEASUREMENT_ID` — **pageview only** |
| Source files | 205 TS/TSX |

**Route inventory**

- **26 public marketing pages** — home, services, 8 solutions, 4 dev-services,
  6 industries, contact, privacy, news + 5 news articles
- **12 authenticated dashboard routes** — dashboard, validator, plans, reports,
  ai/history, projects, workspace, profile, settings
- **11 API routes** — all authenticated and rate-limited

---

## 2. Current Strengths

Worth stating explicitly, because these should not be disturbed by SEO work.

- **Build quality is real.** `tsc --noEmit` clean, ESLint 0 errors / 0 warnings
  across the whole repository, production build succeeds, 90/90 smoke checks
  pass.
- **Security posture is above average for this stage.** No secret is behind a
  `NEXT_PUBLIC_` prefix; the service-role key is used only by a local script and
  never at runtime. RLS is the enforcement point, mirrored (not replaced) by UI
  role checks. Prompt injection is fenced. PDF filenames are sanitised against
  header injection.
- **Six security headers already ship** — HSTS, nosniff, SAMEORIGIN,
  referrer-policy, Permissions-Policy, DNS prefetch control. Verified live.
- **Metadata discipline is good.** All 26 marketing pages have unique titles,
  descriptions and canonicals. Only 2 lack Open Graph.
- **No N+1 queries.** Every multi-entity read uses `Promise.all` with in-memory
  grouping.
- **`metadataBase` is environment-driven**, so canonical URLs and OG images
  follow the deploy rather than pointing at staging.
- **Accessibility basics are handled** — icon buttons have `aria-label`, forms
  wire `htmlFor`/`id` with `aria-invalid`, the modal has a real focus trap.
- **The premium visual identity is intact** and should stay that way.

---

## 3. Critical Issues (P0 — must fix before production)

### P0-1 — No `sitemap.xml`

No `app/sitemap.ts` and no static file. Search engines must discover all 31
public URLs by crawling alone. **Impact:** slow and incomplete indexing of every
page including the new News section.

### P0-2 — No `robots.txt`

No `app/robots.ts` and no static file. Consequences:

- `/dashboard`, `/login`, `/register`, `/settings`, `/profile`, `/projects`,
  `/plans`, `/reports`, `/validator`, `/workspace`, `/ai/history` and `/api/*`
  are **not disallowed**. They are auth-gated, so a crawler gets a redirect
  rather than content, but they still consume crawl budget and can surface as
  redirect-only URLs.
- No sitemap reference.

### P0-3 — Lead capture is `mailto:` only, and one form targets a personal Gmail

Both the contact form and the "Book a Free AI Strategy Session" modal build a
`mailto:` string and set `window.location.href`.

Two separate problems:

1. **Most leads are silently lost.** `mailto:` requires a configured desktop mail
   client. Visitors on mobile, or using Gmail/Outlook in a browser tab, get
   nothing or a broken handoff — but the UI still shows the success state, so the
   business believes the lead was captured. There is no server-side handling, no
   database row, no confirmation, no retry.
2. **`features/home/home-view.tsx:2917` posts to
   `vivek.rastogi.work@gmail.com`** — a personal address, on the primary
   conversion path of a production business site. The contact page correctly uses
   `contact@aiautomix.com`; the highest-intent form does not.

No UTM, source or landing-page capture exists anywhere. There is no spam
protection, no duplicate-submission guard, and no server-side validation.

**This is the single highest-value fix in the audit.** Every SEO improvement
drives traffic to a funnel that currently leaks.

### P0-4 — No `not-found.tsx` or `error.tsx`

A 404 or a runtime error renders Next's unstyled default page: no branding, no
navigation, no route back into the site. Damaging for both credibility and SEO.

### P0-5 — No canonical host redirect

Nothing in `next.config.ts` or `middleware.ts` canonicalises apex → `www`. If DNS
resolves both, both serve HTTP 200 and every page exists at two URLs. `canonical`
tags mitigate but do not replace a redirect.

### P0-6 — Homepage title and description do not match the specified copy

Current title is `AIAutomix — AI-Powered Business Strategy, Automation &
Validation`. Requested: `AI Automation Agency & AI Business Solutions |
AIAutoMix`. The description differs likewise.

### P0-7 — No `Organization` or `WebSite` structured data

The site has `Service` and `SoftwareApplication` schemas on 9 pages, but no
`Organization` and no `WebSite` node anywhere. These are the two schemas Google
uses to establish brand identity and enable sitelinks.

### P0-8 — 17 of 26 marketing pages have no structured data

Only 9 carry JSON-LD. The 6 industry pages, 4 dev-services pages, contact, news
and all 5 news articles have none.

### P0-9 — Open Graph image is a logo, not a social card

`/assets/logo-ice2.png` is **890×827 and 419 KB**. Social platforms expect
**1200×630**. LinkedIn and Facebook will letterbox or centre-crop it, and 419 KB
is heavy for a preview asset. Every page shares this one image.

---

## 4. SEO Issues

| ID | Severity | Issue |
| --- | --- | --- |
| P0-1 | P0 | No sitemap |
| P0-2 | P0 | No robots.txt |
| P0-5 | P0 | No canonical host redirect |
| P0-6 | P0 | Homepage metadata does not match brief |
| P0-7 | P0 | No Organization / WebSite schema |
| P0-8 | P0 | 17 of 26 pages lack structured data |
| P0-9 | P0 | OG image wrong aspect ratio and oversized |
| SEO-1 | P1 | 2 pages (`/contact`, `/privacy-policy`) lack Open Graph |
| SEO-2 | P1 | No `BreadcrumbList` anywhere, including the nested News articles |
| SEO-3 | P1 | News articles have no `Article` schema despite being ideal candidates |
| SEO-4 | P2 | `keywords` meta present on 22 pages — ignored by Google since 2009; harmless but noise |
| SEO-5 | P2 | No `/insights` hub; News exists but is not positioned as a content pillar |

---

## 5. Security Issues

The hardening pass already resolved the major items. What remains:

| ID | Severity | Issue |
| --- | --- | --- |
| SEC-1 | P1 | **No Content-Security-Policy.** Deliberately deferred — migrated marketing pages use inline styles, inline `<style>` and inline JSON-LD, so a useful CSP requires nonces first. Documented in `next.config.ts`. |
| SEC-2 | P1 | **SVG upload accepted on client-declared MIME.** `imageFileSchema` trusts `file.type`; SVG can carry `<script>`. Severity limited — Supabase Storage serves from its own origin, so it cannot reach app cookies — but it is a phishing vector. |
| SEC-3 | P2 | Rate limiter is in-memory, so limits are per-instance. On Vercel's serverless model, effective limits are looser than configured. Needs a shared store (Upstash/Redis) at scale. |
| SEC-4 | P2 | No test coverage for API routes, Server Actions or RLS policies. `withApiAuth` is now the single auth chokepoint and is the highest-value thing to test. |

**Verified clean:** no client-side secrets, no `NEXT_PUBLIC_` leakage of
`OPENAI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, no raw SQL, no open redirects
(`safeRedirectPath` guards them), no permissive CORS, Server Actions carry Next's
origin check, every `dangerouslySetInnerHTML` takes a static module constant.

---

## 6. Performance Issues

| ID | Severity | Issue |
| --- | --- | --- |
| PERF-1 | P1 | **`next/image` is used nowhere.** Every image is a plain `<img>` — no resizing, no WebP/AVIF, no lazy-loading, no `width`/`height` (CLS risk). Deliberate for the migrated pages' pixel fidelity, but it forfeits the largest available win. |
| PERF-2 | P1 | **`next/font` is not used.** Google Fonts loads via a render-blocking `<link>` in `app/layout.tsx`, delaying FCP/LCP and risking FOUT. |
| PERF-3 | P1 | **13 MB of MP4 served from the origin.** Five agent videos, 2.2–2.6 MB each, in `public/assets` — no CDN, no poster frames, no adaptive streaming. |
| PERF-4 | P2 | `public/assets` totals **23 MB**. |
| PERF-5 | P2 | `home-view.tsx` is **6,301 lines** and ships as one client component. It already defers below-the-fold mounting, which is good, but the hydration payload is large. |
| PERF-6 | P2 | React warns ~10× on the homepage about mixing the `animation` shorthand with `animationDelay` on hero cards. Cosmetic, but noisy and a real re-render hazard. |

**Bundle today:** 99.7 kB shared JS; marketing pages 105–113 kB first load. That
is healthy — the weight is in media, not JavaScript.

---

## 7. Accessibility Issues

Largely in good shape after the hardening pass.

| ID | Severity | Issue |
| --- | --- | --- |
| A11Y-1 | P1 | No `not-found.tsx` means the 404 has no landmarks, no nav, no skip target |
| A11Y-2 | P2 | No visible "skip to content" link |
| A11Y-3 | P2 | Heading hierarchy not verified across all 26 migrated pages |
| A11Y-4 | P2 | Colour contrast not measured — muted greys (`#6E6C7C`, `#8A87A0`) on `#0A0B0F` are near the 4.5:1 threshold and need checking |

**Verified good:** icon-only buttons have `aria-label`; forms wire `htmlFor`/`id`
with `aria-invalid`; the modal has a focus trap with restore; the user menu has
`menu`/`menuitem` roles and Escape-to-close; focus-visible rings are consistent.

---

## 8. Conversion Issues

| ID | Severity | Issue |
| --- | --- | --- |
| P0-3 | P0 | `mailto:` lead capture loses most leads; personal Gmail on the primary CTA |
| CONV-1 | P1 | **GA4 is pageview-only.** Zero conversion events — no `contact_form_submit`, no `book_consultation`, no CTA tracking. There is currently no way to measure whether anything works. |
| CONV-2 | P1 | No UTM / source / landing-page capture, so paid and organic attribution is impossible |
| CONV-3 | P2 | No WhatsApp or phone click-to-contact, despite the target markets |
| CONV-4 | P2 | The "Get AI Business Audit" CTA named in the brief does not exist |

---

## 9. DevOps Issues

| ID | Severity | Issue |
| --- | --- | --- |
| OPS-1 | P0 | No `vercel.json`. Acceptable — Next defaults work — but no explicit region or function config. |
| ~~OPS-2~~ | ~~P1~~ | **RESOLVED 2026-08-10** — `.github/workflows/ci.yml` runs typecheck, lint, format, tests, build and a dependency audit on every PR. |
| OPS-3 | P1 | `NEXT_PUBLIC_SITE_URL` must be set on Vercel or canonicals/OG/auth emails fall back to the hardcoded default |
| OPS-4 | P2 | No staging/production Supabase separation enforced in config |

**MANUAL ACTION REQUIRED — not verifiable from this repository:**
Vercel project settings, environment variables, domain attachment, DNS records,
Google Search Console, and GA4 property configuration. I have not inspected or
configured any of these and make no claim about their state.

---

## 10. Recommended Fix Order

### P0 — before the domain goes live

1. `app/robots.ts` — allow public, disallow private, reference sitemap
2. `app/sitemap.ts` — all 31 public URLs, absolute, from `NEXT_PUBLIC_SITE_URL`
3. **Replace `mailto:` lead capture** with a server-side API route: Zod
   validation, honeypot, Supabase persistence, UTM/source capture, real success
   and error states. Remove the personal Gmail address.
4. `app/not-found.tsx` + `app/error.tsx`, branded
5. Apex → `www` redirect in `next.config.ts`
6. Homepage title/description to the specified copy
7. `Organization` + `WebSite` JSON-LD in the root layout
8. Structured data on the 17 pages lacking it (`Service`, `Article` for News)
9. A real 1200×630 OG image

### P1 — first week after launch

10. GA4 conversion events for the named actions
11. `Article` + `BreadcrumbList` schema on News
12. Open Graph on `/contact` and `/privacy-policy`
13. `next/font` migration (self-hosted, non-blocking)
14. Move the 13 MB of video to a CDN, add poster frames
15. CI running tsc / lint / build / test
16. SVG upload hardening

### P2 — deliberate, not now

`next/image` migration for the marketing pages (high risk to pixel fidelity),
CSP with nonces, shared-store rate limiting, API/RLS test coverage, splitting
`home-view.tsx`.

---

## 11. Explicitly Out of Scope

- **DNS / Hostinger** — untouched, as instructed
- **The premium visual identity** — no design change is proposed. Every P0 fix
  above is metadata, routing or server-side; none alters the hero, animations or
  layout.
- **Building the full `/industries/*`, `/tools/*`, `/insights/*` architecture** —
  documented separately rather than generated speculatively.
