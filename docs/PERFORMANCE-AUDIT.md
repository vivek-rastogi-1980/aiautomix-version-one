# AIAutoMix — Performance Audit

**Scope:** SPRINT-06 S06-11.
**Date:** 2026-08-08

**Lighthouse was not run.** Scoring needs a deployed URL and a stable network;
running it against a local dev server produces numbers that mislead rather than
inform. The targets in the sprint (Performance ≥ 90, Accessibility ≥ 90, Best
Practices ≥ 90, SEO ≥ 95) therefore remain **unverified** — marked below as
MANUAL ACTION REQUIRED. Everything else here was measured from the build output
or the running application.

---

## 1. Bundle

From the production build on Next 15.5.23:

| Metric | Value |
| --- | --- |
| Shared JS (all routes) | **103 kB** |
| Marketing pages, first load | 105–116 kB |
| Dashboard routes, first load | 106–131 kB |
| Middleware | 92.1 kB |

Healthy for the feature set. **The weight of this site is media, not
JavaScript** — so bundle-splitting work would be optimising the wrong thing.

43 routes; 34 prerendered as static, including all five News articles, plus
`robots.txt`, `sitemap.xml`, `manifest.webmanifest` and `opengraph-image`.

---

## 2. The real cost: media

| Asset class | Size |
| --- | --- |
| `public/assets` total | **23 MB** |
| Five agent MP4 videos | **13 MB** (2.2–2.6 MB each) |
| `logo-ice2.png` | 419 KB |

**This is the single largest performance problem.** The videos are served from
the origin with no CDN, no poster frames and no adaptive streaming. On a mobile
connection this dominates every other factor.

The homepage already mitigates it partially: below-the-fold media is deferred so
it does not compete with first paint. That is a genuinely good decision and
should be kept.

**Recommendations (P1):**
- Move the MP4s to a CDN or a video host
- Add `poster` frames so the layout is stable before playback
- Serve WebM alongside MP4
- Compress `logo-ice2.png` — 419 KB for a logo is roughly 10× what it needs

---

## 3. `next/image` — not used anywhere

Every image on the site is a plain `<img>`. This forfeits automatic resizing,
WebP/AVIF conversion, lazy loading and intrinsic sizing.

This is **deliberate**, not an oversight: the Sprint 1 marketing pages are
pixel-faithful re-hosts of the original design, and `next/image` changes layout
behaviour in ways that would disturb them.

Assessment: **the largest remaining performance win, and the highest risk to the
visual identity.** `SPRINT-06-ARCHITECTURE.md` says to preserve intentional
AIAutoMix visual effects, and the brief says not to sacrifice the identity for a
Lighthouse score.

**Recommendation:** migrate page by page with visual comparison, starting with
pages that are not part of the migrated set. Do not attempt it sitewide in one
pass. **P2.**

One consequence worth noting: because `next/image` is unused, Next's Image
Optimizer never runs — which is why the outstanding `sharp` CVEs are not
reachable (see `SECURITY-AUDIT.md`).

---

## 4. Fonts — render-blocking

`app/layout.tsx` loads Bricolage Grotesque and Inter through a raw Google Fonts
`<link>`, which blocks render. `preconnect` hints are present, which helps, but
does not remove the blocking request.

`next/font` would self-host the files, eliminate the third-party round trip and
remove layout shift via automatic fallback metrics.

Kept as-is because the original design references the literal family names
throughout its inline styles, so swapping in generated CSS variables touches a
lot of migrated markup. Pre-existing follow-up, recorded in `MIGRATION-NOTES.md`.

**P1** — this is a straightforward LCP improvement whenever it is scheduled.

---

## 5. Client components

`features/home/home-view.tsx` is **6,301 lines** and ships as a single client
component driving an imperative animation controller.

Mitigations already in place, and they are sound:

- Below-the-fold image and video components mount in a later commit than the
  hero, so 30+ media slots do not compete with first paint
- Off-screen carousel videos use `preload="metadata"` rather than buffering
- The hero carousel hides side cards below 1100px instead of animating them
  off-screen

**P2:** splitting the file would reduce the hydration payload, but it is a large
refactor of migrated code with real regression risk and no measured benefit yet.
Measure first with a real Lighthouse run.

---

## 6. Hydration

**Zero hydration warnings** — verified in the browser console.

Two earlier causes were fixed:

- `lib/format.ts` formatters had no pinned `timeZone`, so they rendered the
  server's zone during SSR and the browser's during hydration. Now pinned to UTC,
  with a regression assertion in the smoke tests.
- `home-view.tsx` read `window.innerWidth` in its initial state, so server and
  client disagreed on viewport. Now adopts the real viewport in a layout effect
  after hydration has matched.

---

## 7. Third-party scripts

Only GA4, loaded with `strategy="afterInteractive"` and **only when
`NEXT_PUBLIC_GA_MEASUREMENT_ID` is set**. No tag manager, no chat widget, no
tracking pixels. This is a genuinely clean third-party profile.

---

## 8. Known console noise

The homepage emits ~10 React warnings about mixing the `animation` shorthand with
`animationDelay` on the same element, from the hero `cardDefs`. Cosmetic, but it
is a real re-render hazard and clutters the console during debugging. **P2** —
split the shorthand into longhand properties.

---

## 9. Core Web Vitals

**MANUAL ACTION REQUIRED.** LCP, INP and CLS have not been measured. They cannot
be measured meaningfully from a local dev server.

After deploying, run PageSpeed Insights against `https://www.aiautomix.com` and
record real values. Expectations based on what is in the repository:

| Metric | Expectation | Dominant factor |
| --- | --- | --- |
| **LCP** | The risk area | Render-blocking fonts + hero media |
| **CLS** | Likely fine | Layout is explicit; no `next/image` means no automatic sizing, but also no late-arriving intrinsic dimensions |
| **INP** | Likely fine | Animations are transform/opacity, which stay on the compositor |

---

## 10. Priorities

| Priority | Item | Effort |
| --- | --- | --- |
| P1 | Move 13 MB of video to a CDN, add poster frames | M |
| P1 | `next/font` migration | M |
| P1 | Compress `logo-ice2.png` (419 KB) | S |
| P2 | `next/image` migration, page by page | L |
| P2 | Fix the `animation`/`animationDelay` shorthand warnings | S |
| P2 | Split `home-view.tsx` — only if measurement justifies it | L |
| — | **Run Lighthouse against production and record real numbers** | S |
