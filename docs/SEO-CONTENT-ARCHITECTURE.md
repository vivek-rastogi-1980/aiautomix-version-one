# AIAutoMix — SEO Content Architecture

Recommended structure. **Nothing here has been built** — the brief was explicit
that these pages should be documented rather than generated, and speculative
thin pages would do more harm than the gap they fill.

Positioning this serves: *"Helping businesses validate, build, automate and
scale with AI."* Not a generic software-development agency.

---

## What exists today (26 public pages)

| Current URL | Role | Assessment |
| --- | --- | --- |
| `/` | Home | Strong. Premium hero, clear offer. |
| `/services` | Services hub | Strong. Has `ItemList` schema. |
| `/ai-strategies-and-consulting` | Consulting | Maps to the proposed `/ai-consulting` |
| `/ai-agents` | AI agents | Already at a good slug |
| `/ai-chatbot` | Chatbots | Maps to `/ai-chatbots` (plural) |
| `/crm` | CRM | Maps to `/crm-automation` |
| `/generate-leads` | Lead gen | Maps to `/lead-generation` |
| `/ai-business-idea-validation` | Validator marketing | Overlaps `/validate-your-idea` |
| `/validate-your-idea` | Validator marketing | **Overlaps the above** |
| `/create-a-business-plan` | Business plans | Good |
| `/create-marketing-plan` | Marketing plans | Good |
| `/growth-plan` | Growth | Thin-ish |
| `/get-your-funding` | Funding | Good |
| `/website-development` | Delivery | Off-positioning (agency, not AI) |
| `/saas-product-development` | Delivery | Off-positioning |
| `/mobile-app-development` | Delivery | Off-positioning |
| `/landing-page-design` | Delivery | Off-positioning |
| `/real-estate-ai-automation` | Industry | Should become `/industries/real-estate` |
| `/hospital-ai-automation` | Industry | → `/industries/healthcare` |
| `/restaurant-ai-automation` | Industry | → `/industries/restaurant` |
| `/education-ai-automation` | Industry | → `/industries/education` |
| `/travel-ai-automation` | Industry | → `/industries/travel` |
| `/news` + 5 articles | Insights | **New.** Foundation for `/insights` |
| `/contact` | Conversion | Fine |
| `/privacy-policy` | Legal | Fine |

---

## Findings

### Duplicate: idea validation has two pages

`/ai-business-idea-validation` and `/validate-your-idea` target the same intent.
Two pages competing for one query split link equity and force Google to choose.

**Recommendation:** keep `/ai-business-idea-validation` (clearer, more
descriptive), 301 the other to it, and fold any unique content across. Do not
delete without redirecting — `/validate-your-idea` is in the sitemap and may
have inbound links.

### Missing: no AI automation pillar page

The brief names `/ai-automation` as a target. There is no page for the single
term the business is named after. `/services` partially covers it but is a hub,
not a pillar.

**Priority: highest of any missing page.**

### Missing: voice AI

`/ai-voice-agents` is named in the positioning and in the brief's CTA list, but
no page exists.

### Off-positioning: four delivery-service pages

`/website-development`, `/saas-product-development`, `/mobile-app-development`
and `/landing-page-design` read as a web agency. They are real services and
rank for real queries, so **do not delete them** — but they should not sit at the
same level as the AI offer in navigation, and their internal links should route
toward the AI services rather than the reverse.

### Industries are flat, not nested

Five industry pages use `/{industry}-ai-automation` rather than
`/industries/{industry}`. Flat URLs work, but nesting creates a hub that can rank
for "AI automation for X" collectively and gives `BreadcrumbList` somewhere to
point.

**This is a migration with redirect cost.** Worth doing before the pages accrue
authority, not after. If deferred, defer permanently — churning URLs later is
worse than an imperfect structure.

Manufacturing is named in the brief and missing.

### Tools are unmarketed

`/validator` and `/plans` are real, working products behind authentication with
**no public marketing page**. The brief proposes `/tools/idea-validator`,
`/tools/ai-readiness`, `/tools/roi-calculator`.

A public, indexable page per tool — explaining it, showing sample output, and
converting to signup — is likely the highest-ROI content work available, because
the product already exists.

---

## Recommended target architecture

```
/                                  Home
/ai-automation                     ← MISSING. Highest priority pillar.
/ai-agents                         exists
/ai-consulting                     ← rename of /ai-strategies-and-consulting
/ai-voice-agents                   ← MISSING
/ai-chatbots                       ← rename of /ai-chatbot
/crm-automation                    ← rename of /crm
/lead-generation                   ← rename of /generate-leads
/website-development               exists (de-emphasise)

/industries/
  /healthcare                      ← from /hospital-ai-automation
  /real-estate                     ← from /real-estate-ai-automation
  /restaurant                      ← from /restaurant-ai-automation
  /education                       ← from /education-ai-automation
  /travel                          ← from /travel-ai-automation
  /manufacturing                   ← MISSING

/tools/
  /idea-validator                  ← MISSING (product exists)
  /ai-readiness                    ← MISSING (product does not exist)
  /roi-calculator                  ← MISSING (product does not exist)

/insights/                         ← /news becomes this, or /news stays and
  /ai                                 /insights is the hub above it
  /business
  /automation
  /funding
```

**On `/news` vs `/insights`:** both is worse than either. `/news` is company
announcements; `/insights` is educational content that ranks. Since `/news` was
just built, the cleaner path is to keep it for announcements and add `/insights`
as the SEO content hub — but only when there is genuine content to fill it.
An empty hub ranks for nothing and dilutes crawl budget.

---

## Priority order

| # | Action | Effort | Impact |
| --- | --- | --- | --- |
| 1 | Build `/ai-automation` pillar | M | **High** — the core term, no page |
| 2 | Resolve the validator duplicate (301) | S | **High** — stops self-competition |
| 3 | Build `/tools/idea-validator` | M | **High** — product exists, unmarketed |
| 4 | Build `/ai-voice-agents` | M | Medium-high — named in positioning |
| 5 | Add `Article` + `BreadcrumbList` to News | S | Medium — rich results |
| 6 | Structured data on the 17 bare pages | M | Medium |
| 7 | Nest industries under `/industries/` | L | Medium — do now or never |
| 8 | Add `/industries/manufacturing` | M | Medium |
| 9 | `/insights` hub | L | Medium — only with real content |
| 10 | Rename service slugs | M | Low — redirect cost, modest gain |

---

## Rules for whoever builds these

- **No page without unique substance.** A thin page is worse than no page: it
  competes with the strong ones and drags sitewide quality.
- **One intent per page.** The validator duplicate is what happens otherwise.
- **Redirect, never delete.** Every URL in the sitemap may have inbound links.
- **No location pages for their own sake.** The brief is explicit. AIAutoMix
  serves the US, UK, Canada, Australia, Europe and India — claiming local
  offices that do not exist is a credibility risk that outweighs any ranking.
- **Every new page joins the sitemap automatically** via `lib/seo/routes.ts`.
  Adding a route there is the only step needed.
