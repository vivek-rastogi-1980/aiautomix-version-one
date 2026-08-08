# AIAutoMix — Production Deployment Runbook

**Production:** `https://www.aiautomix.com` (Vercel)
**Repository:** `vivek-rastogi-1980/aiautomix-version-one`

Items marked **MANUAL ACTION REQUIRED** happen outside this repository. Nothing
in this document about Vercel, DNS, Supabase or third-party consoles has been
verified from the codebase.

---

## Pre-deployment

Run from a clean tree, in this order. **All four must pass** — do not deploy past
a failure, and do not silence one to get a green.

```bash
git status              # expect a clean tree
git pull
npm install
npx tsc --noEmit        # expect no output
npm run lint            # eslint . --max-warnings 0
npm test                # 90 checks across 4 smoke suites
npm run build
```

Note `npm run lint` is **not** `next lint`. It runs ESLint over the whole
repository — `next lint` only covered `/app`, `/components` and `/lib`, leaving
`features/`, `hooks/`, `types/`, `scripts/` and `middleware.ts` unchecked. It is
also removed in Next 16.

### If the build fails immediately after a Next upgrade

Symptom: `PageNotFoundError` on routes that plainly exist, e.g.
`/opengraph-image` or `/news/[slug]`.

This is stale build output, not a regression:

```bash
rm -rf .next
npm run build
```

Confirmed during the Next 15.4.5 → 15.5.23 upgrade.

### Dependency audit

```bash
npm audit
```

Three high findings are expected and currently accepted: `postcss` and `sharp`
(both reachable only through paths this app does not use) and `next` inheriting
from them. All three require `next@16`, a breaking major. Rationale in
`docs/SECURITY-AUDIT.md`. **A new critical or a new direct Next advisory is a
release blocker.**

---

## Branch

```bash
git checkout main
git pull origin main
```

Vercel's production branch is `main`. **MANUAL ACTION REQUIRED** to confirm that
in Vercel → Settings → Git.

---

## Environment variables

**MANUAL ACTION REQUIRED** — Vercel → Settings → Environment Variables.

### Required in Production

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — set exactly one |
| `NEXT_PUBLIC_SITE_URL` | `https://www.aiautomix.com` |
| `OPENAI_API_KEY` | AI features return 503 without it |

`NEXT_PUBLIC_SITE_URL` is the one to get exactly right. Canonical URLs, the
sitemap, `robots.txt`, Open Graph images and auth email links all derive from it.
A typo breaks password reset and email confirmation.

### Optional

| Variable | If unset |
| --- | --- |
| `OPENAI_MODEL` | Defaults to `gpt-4o-mini` |
| `RESEND_API_KEY` | No lead notification email; **leads still persist** |
| `LEAD_NOTIFICATION_EMAIL` | Defaults to `contact@aiautomix.com` |
| `LEAD_NOTIFICATION_FROM` | Defaults to Resend's shared sender |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Analytics disabled entirely |

### Must NOT be set on Vercel

**`SUPABASE_SERVICE_ROLE_KEY`.** Nothing reads it at runtime — it is used only by
the local `sync:workflows` script — and it bypasses RLS. Setting it on Vercel
adds risk and buys nothing.

---

## Database migrations

**MANUAL ACTION REQUIRED** — Supabase SQL Editor, in order. Each depends on the
one before.

1. `0001_sprint2_foundation.sql`
2. `0002_sprint3_validator.sql`
3. `0003_sprint4_ai_platform.sql`
4. `0004_sprint5_workspaces_and_plans.sql`
5. `0005_leads.sql`

All are additive and idempotent.

**`0005_leads.sql` is required before launch.** Without it, every form submission
returns 500 and the lead is lost — gracefully, with a fallback address shown to
the visitor, but lost.

Verify: `select count(*) from public.leads;` should return `0`, not an error.

Then sync the workflow catalog, with the service-role key set **locally only**:

```bash
npm run sync:workflows
```

---

## Domain

**MANUAL ACTION REQUIRED.**

Attach **both** `www.aiautomix.com` and `aiautomix.com` in Vercel → Domains. The
apex → `www` 308 lives in `next.config.ts`, but only fires if the apex actually
reaches this deployment.

**Do not remove Hostinger email DNS records** unless email migration is
intentional. DNS is external to this repository.

Supabase → Authentication → URL Configuration:

- **Site URL:** `https://www.aiautomix.com`
- **Redirect URLs:** `…/auth/confirm` and `…/auth/callback`

---

## Post-deployment verification

Each is checkable from a browser.

- [ ] `https://aiautomix.com` 308s to `https://www.aiautomix.com`
- [ ] Homepage renders; console clean
- [ ] Navigation, service pages, industry pages, `/news` and an article
- [ ] `/robots.txt` — 200, disallows present, sitemap referenced
- [ ] `/sitemap.xml` — 200, 30 absolute `www` URLs
- [ ] `/manifest.webmanifest` — 200
- [ ] A nonsense path returns a **branded 404 with HTTP status 404**
- [ ] Six security headers present on a page response
- [ ] Registration → confirmation email links to `www.aiautomix.com`
- [ ] Sign in → dashboard → generate a plan → download the PDF
- [ ] **Submit a real lead and confirm the row lands in `leads`**
- [ ] Anonymous access to `/dashboard` redirects to `/login`
- [ ] Paste the URL into LinkedIn — 1200×630 card renders
- [ ] Vercel function logs show no unexpected errors

The lead submission is the one path that **could not be verified pre-launch**,
because migration 0005 has not been applied anywhere. Test it first.

---

## Rollback

Vercel keeps every previous deployment. Rolling back is a promotion, not a
rebuild.

1. Vercel → Deployments
2. Identify the last known-good deployment
3. Promote it to Production
4. Verify the homepage and one authenticated route
5. Open an issue recording what failed
6. Fix on a branch, re-run all four gates, redeploy

**Database migrations do not roll back with the deployment.** All five are
additive — they create tables and add nullable columns — so an older build runs
safely against a newer schema. It ignores what it does not know about. Never
write a destructive migration without a tested down-path.

---

## Release record

Record per release: date, commit SHA, deployment URL, major changes, migrations
applied, environment changes, and rollback notes if any.

| Date | Commit | Changes | Migrations | Notes |
| --- | --- | --- | --- | --- |
| _pending_ | _pending_ | Sprint 06 — production hardening, SEO foundation, lead capture, Next security patch | **0005 required** | First production deploy |
