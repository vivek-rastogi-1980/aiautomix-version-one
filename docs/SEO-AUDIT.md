# AIAutoMix — SEO Audit

**Scope:** SPRINT-06 S06-05, S06-06 and `SPRINT-06-SEO.md`.
**Canonical domain:** `https://www.aiautomix.com`
**Date:** 2026-08-08

Search Console, GA4 and DNS are outside this repository and have not been
verified.

---

## Status against the sprint's Definition of Done

| Requirement | Status |
| --- | --- |
| Canonical domain defined | Done — apex 308s to `www` |
| `robots.txt` works | Done — verified 200 with correct content |
| `sitemap.xml` works | Done — verified 200, 30 absolute URLs |
| Public pages have unique metadata | Done — 26/26 unique title + description + canonical |
| OG metadata works | Done — 1200×630 card, verified |
| Structured data valid where implemented | Done — all blocks parse; see coverage gap below |
| Private pages not indexable | Done — disallowed in robots *and* auth-gated |

**No P0 SEO issue remains.**

---

## 1. What was missing entirely

Before this sprint the site had **no sitemap and no robots.txt**. Search engines
had to discover all 31 public URLs by crawling alone, and every auth-gated route
was free to consume crawl budget.

Both now exist as Next route handlers and — importantly — **derive from one
module**, `lib/seo/routes.ts`. A route listed in the sitemap but disallowed in
robots is a crawl error; a private route missing from the disallow list leaks
budget. Sharing the source makes that contradiction impossible to introduce by
editing one file and forgetting the other.

**Verified programmatically:** zero overlap between the 30 sitemap URLs and the
16 disallowed prefixes.

`robots.txt` deliberately does **not** block `/_next/` or `/assets/`. Google
renders pages before judging them; a crawler denied CSS and JS sees a broken
site and scores it accordingly. That mistake is common enough to be worth
stating.

---

## 2. Canonical domain

`metadataBase` was hardcoded to `https://staging.aiautomix.com`, and **18 pages
repeated that host** in their Open Graph and Twitter image URLs. On production
every share preview and canonical URL would have pointed back at staging — and
broken outright once staging is retired or password-protected.

Now derived from `NEXT_PUBLIC_SITE_URL` with the production domain as fallback,
so preview, staging and production each describe themselves correctly. The 18
per-page image URLs became relative and resolve against `metadataBase`, which is
what that field is for.

Apex → `www` is a 308 in `next.config.ts`. The `has` host condition scopes the
rule to exactly `aiautomix.com`, so the `www` response it redirects to no longer
matches — **no loop** — and `*.vercel.app` previews are unaffected.

---

## 3. Metadata

All 26 marketing pages carry a unique title, description and canonical. Two
lacked Open Graph (`/contact`, `/privacy-policy`) — recorded as P1.

Homepage now uses the copy specified in `SPRINT-06-SEO.md`:

- **Title:** `AI Automation Agency & AI Business Solutions | AIAutoMix`
- **Description:** `Transform your business with AI automation, AI agents, CRM, voice AI, business intelligence, and custom AI solutions. AIAutoMix helps businesses automate, grow, and scale.`

The title template moved from `%s | AIAutomix` to `%s | AIAutoMix`, matching the
brand's actual capitalisation.

**`keywords` meta is present on 22 pages.** Google has ignored it since 2009.
Harmless, but it is noise and mildly signals inexperience to anyone auditing the
source. P2 cleanup.

---

## 4. Open Graph

The previous `og:image` was `/assets/logo-ice2.png` — **890×827 and 419 KB**.
Social platforms compose for **1200×630**, so a near-square logo gets letterboxed
or centre-cropped, and 419 KB is heavy for a crawler fetch.

Replaced with a generated card via `next/og` (ships with Next — no dependency
added). Because the file sits at `app/` root, **every route inherits it** unless
it declares its own, so one file fixes the whole site. Verified: 1200×630, 147 KB,
correct branding.

---

## 5. Structured data

| Schema | Status |
| --- | --- |
| `Organization` | **Added** — root layout, inherited site-wide |
| `WebSite` | **Added** — same `@graph`, `publisher` cross-referenced by `@id` |
| `Service` | Pre-existing on 9 pages |
| `Article` | **Added** — News articles |
| `BreadcrumbList` | **Added** — News index and articles |
| `WebPage` | Not implemented — low marginal value given the above |

`Organization` and `WebSite` were both absent. The site had `Service` schemas on
nine pages but nothing establishing *who publishes them* — these two are what
search engines use to attach a brand to a domain and to consider sitelinks. They
are declared as one `@graph` with `@id` cross-references so the WebSite is
explicitly published *by* the Organization, rather than the two being unrelated
facts on the same page.

**Nothing is invented.** No ratings, review counts, awards, founding dates,
employee numbers or addresses are asserted. `areaServed` lists the markets named
in the brief — a factual claim about where the business operates, not a claim to
have offices there. News articles use `Article` rather than `NewsArticle`, which
Google reserves for journalism from a news publisher; overclaiming that risks a
manual action. `dateModified` equals `datePublished` because no modified date is
tracked — inflating it to look fresh is a detectable abuse.

**Verified:** all three JSON-LD blocks on an article page parse, with the
publisher `@id` reference intact.

### Remaining gap (P1)

**17 of 26 marketing pages still carry no structured data** — the five industry
pages, four dev-services pages, contact, privacy and the validator marketing
pages. `Service` schema on each is straightforward and is the largest remaining
SEO item.

---

## 6. Content architecture findings

Detail in `docs/SEO-CONTENT-ARCHITECTURE.md`. Two findings are worth surfacing
here because they cost rankings today:

**Duplicate intent.** `/ai-business-idea-validation` and `/validate-your-idea`
target the same query. Two pages competing for one intent split link equity and
force Google to choose. Recommend keeping the former and 301-ing the latter.

**No page for the core term.** `SPRINT-06-SEO.md` names `/ai-automation` as a
target. There is no page for the term the business is named after. `/services`
partially covers it but is a hub, not a pillar. This is the highest-priority
missing page.

Also: the idea validator and plan generator are **working products with no
public marketing page**. `/tools/idea-validator` is likely the highest-ROI
content work available, because the product already exists.

---

## 7. Priorities

| Priority | Item |
| --- | --- |
| ~~P0~~ | ~~No sitemap~~ — **fixed** |
| ~~P0~~ | ~~No robots.txt~~ — **fixed** |
| ~~P0~~ | ~~metadataBase pointed at staging~~ — **fixed** |
| ~~P0~~ | ~~No canonical host redirect~~ — **fixed** |
| ~~P0~~ | ~~No Organization / WebSite schema~~ — **fixed** |
| ~~P0~~ | ~~OG image wrong aspect ratio~~ — **fixed** |
| P1 | 17 of 26 pages lack structured data |
| P1 | `/contact` and `/privacy-policy` lack Open Graph |
| P1 | Resolve the validator duplicate with a 301 |
| P1 | Build the `/ai-automation` pillar page |
| P2 | Remove `keywords` meta from 22 pages |
| P2 | `/tools/*` marketing pages for existing products |

**MANUAL ACTION REQUIRED** after deploy: verify the `www` property in Google
Search Console, submit `https://www.aiautomix.com/sitemap.xml`, and validate the
JSON-LD at `search.google.com/test/rich-results`. None of this has been done.
