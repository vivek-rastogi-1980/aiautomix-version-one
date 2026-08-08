# AIAutoMix — Launch Checklist

For cutting `https://www.aiautomix.com` over to this codebase.

Items marked **MANUAL ACTION REQUIRED** happen outside the repository. Nothing in
this file about Vercel, DNS, Supabase, Google or Resend has been verified from
here — I have no access to those consoles and make no claim about their state.

---

## Blocking — the site is broken or leaking without these

### 1. Apply migration 0005 to production Supabase

**MANUAL ACTION REQUIRED**

Lead capture writes to a `leads` table that does not exist yet. Until this runs,
**every form submission returns a 500 and the lead is lost** — gracefully, with a
fallback email shown to the visitor, but lost.

Run in the Supabase SQL Editor, in order, if not already applied:

1. `0001_sprint2_foundation.sql`
2. `0002_sprint3_validator.sql`
3. `0003_sprint4_ai_platform.sql`
4. `0004_sprint5_workspaces_and_plans.sql`
5. `0005_leads.sql` ← **new**

Then verify: `select count(*) from public.leads;` should return `0`, not an
error.

### 2. Set environment variables on Vercel (Production)

**MANUAL ACTION REQUIRED**

| Variable | Value | Why it blocks |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | prod project URL | auth + database |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod anon key *(or `…PUBLISHABLE_KEY` — set one)* | auth + database |
| `NEXT_PUBLIC_SITE_URL` | `https://www.aiautomix.com` | canonicals, sitemap, robots, OG, auth email links |
| `OPENAI_API_KEY` | your key | AI features 503 without it |

Optional:

| Variable | Effect if unset |
| --- | --- |
| `OPENAI_MODEL` | defaults to `gpt-4o-mini` |
| `RESEND_API_KEY` | no lead email; leads still persist |
| `LEAD_NOTIFICATION_EMAIL` | defaults to `contact@aiautomix.com` |
| `LEAD_NOTIFICATION_FROM` | defaults to Resend's shared sender |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | analytics disabled entirely |

**Do not set `SUPABASE_SERVICE_ROLE_KEY` on Vercel.** Nothing at runtime reads
it; it is used only by the local `sync:workflows` script, and it bypasses RLS.

### 3. Attach both hosts to the Vercel project

**MANUAL ACTION REQUIRED**

Add `www.aiautomix.com` **and** `aiautomix.com`. The apex → www 308 is
implemented in `next.config.ts`, but it only fires if the apex actually reaches
this deployment.

### 4. Update Supabase Auth URLs

**MANUAL ACTION REQUIRED**

Authentication → URL Configuration:

- **Site URL:** `https://www.aiautomix.com`
- **Redirect URLs:** `https://www.aiautomix.com/auth/confirm` and
  `https://www.aiautomix.com/auth/callback`

Miss this and password reset and email confirmation links break.

### 5. Sync the AI workflow catalog against production

**MANUAL ACTION REQUIRED**

```bash
npm run sync:workflows
```

Pointed at the production project, with `SUPABASE_SERVICE_ROLE_KEY` set locally
(never on Vercel). Delete any temporary env file afterwards.

---

## Verify after deploying

Each of these is checkable from a browser once the domain is live.

- [ ] `https://aiautomix.com` 308-redirects to `https://www.aiautomix.com`
- [ ] `https://www.aiautomix.com/robots.txt` lists the disallows and the sitemap
- [ ] `https://www.aiautomix.com/sitemap.xml` returns 30 absolute `www` URLs
- [ ] A nonsense path returns a **branded 404 with HTTP status 404**
- [ ] **Submit a real lead** and confirm a row lands in `leads` — this is the one
      path that could not be verified from here
- [ ] The six security headers are present on a page response
- [ ] Paste the URL into LinkedIn — the 1200×630 card renders, not the logo
- [ ] Register an account; the confirmation email links to `www.aiautomix.com`
- [ ] Sign in, generate a plan, download the PDF
- [ ] Console shows no hydration warnings

---

## Post-launch (first week)

**MANUAL ACTION REQUIRED** for all four:

- [ ] Google Search Console — verify the `www` property, submit the sitemap
- [ ] GA4 — create the property, set `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- [ ] Resend — verify your sending domain and move
      `LEAD_NOTIFICATION_FROM` off the shared `onboarding@resend.dev`
- [ ] Validate the JSON-LD at `search.google.com/test/rich-results`

---

## Known gaps carried into launch

These are documented decisions, not oversights. Detail in
`docs/PRODUCTION-AUDIT.md`.

| Gap | Consequence | Priority |
| --- | --- | --- |
| No GA4 conversion events | No way to measure whether any CTA works | P1 |
| 17 of 26 pages lack structured data | Weaker rich-result eligibility | P1 |
| No `Article`/`BreadcrumbList` on News | Missed rich results on the best candidates | P1 |
| No CSP | Weaker XSS defence-in-depth; needs nonces first | P1 |
| SVG upload trusts client MIME | Phishing vector, sandboxed to Supabase's origin | P1 |
| `next/font` not used | Render-blocking font request delays LCP | P1 |
| 13 MB of MP4 from the origin | Slow on mobile connections | P1 |
| No CI | Clean state is unenforced | P1 |
| No tests for API/actions/RLS | Regressions in auth would be silent | P2 |
| `next/image` unused | Largest remaining perf win; high risk to pixel fidelity | P2 |
