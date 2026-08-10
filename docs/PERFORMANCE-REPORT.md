# PERFORMANCE-REPORT

Sprint 5.5 review. Measured from the production build and the running
application.

**Lighthouse and Core Web Vitals were NOT measured.** Both need a deployed URL
and a stable network; local numbers mislead. Recorded as PERF-009.

---

## Measured baseline

| Metric | Value | Source |
| --- | --- | --- |
| Shared JS (all routes) | **103 kB** | production build |
| Marketing pages, first load | 105–116 kB | production build |
| Dashboard routes, first load | 106–131 kB | production build |
| Middleware | 92.1 kB | production build |
| Routes | 44 (34 prerendered static) | production build |
| Build time | ~21–46 s | production build |
| `public/assets` | **23 MB** | filesystem |
| Hydration warnings | **0** | browser console |
| PDF output | 34–41 KB, multi-page A4 | smoke tests |

---

## PERF-001 — 13 MB of video served from the origin
- **Severity:** High · **Metric:** Transfer size
- **Current:** Five agent MP4s in `public/assets`, 2.2–2.6 MB each. No CDN, no
  poster frames, no adaptive streaming.
- **Target:** Off-origin delivery with poster frames.
- **Recommendation:** Move to a CDN or video host; add `poster`; serve WebM
  alongside MP4.
- **Note:** `home-view.tsx` already defers below-the-fold media so it does not
  compete with first paint, and sets `preload="metadata"` on off-screen carousel
  video. Both are good decisions and should be kept.
- **Status:** OPEN

## PERF-002 — Fonts are render-blocking
- **Severity:** High · **Metric:** LCP / FCP
- **Current:** `app/layout.tsx` loads Bricolage Grotesque and Inter via a raw
  Google Fonts `<link>`. `preconnect` hints are present, which helps, but the
  request still blocks render.
- **Target:** Self-hosted, non-blocking, with fallback metrics.
- **Recommendation:** `next/font`. Deferred because the original design
  references literal family names throughout its inline styles.
- **Status:** OPEN (documented in `MIGRATION-NOTES.md`)

## PERF-003 — `next/image` unused sitewide
- **Severity:** Medium · **Metric:** Image transfer, CLS
- **Current:** Every image is a plain `<img>`. No resizing, no WebP/AVIF, no
  lazy loading, no intrinsic sizing.
- **Target:** Optimised delivery on non-migrated pages at minimum.
- **Recommendation:** Migrate page by page with visual comparison. **Never
  sitewide in one pass** — this is the largest remaining win and the highest risk
  to the visual identity.
- **Side effect worth noting:** because the Image Optimizer never runs, the
  outstanding `sharp` CVEs are unreachable (see `SECURITY-REPORT.md` SEC-008).
- **Status:** ACCEPTED — Sprint 7

## PERF-004 — `logo-ice2.png` is 419 KB
- **Severity:** Medium · **Metric:** Transfer size
- **Current:** 890×827, 419 KB, used as favicon and manifest icon.
- **Target:** Under 50 KB.
- **Recommendation:** Compress and generate proper icon sizes. Roughly 10× larger
  than it needs to be.
- **Status:** OPEN

## PERF-005 — `home-view.tsx` is a 6,301-line client component
- **Severity:** Medium · **Metric:** Hydration payload
- **Current:** One client component driving an imperative animation controller.
- **Mitigations already present and effective:** deferred mounting of 30+
  below-the-fold media slots; `preload="metadata"` on off-screen video; hero
  carousel hides side cards below 1100px rather than animating them off-screen.
- **Recommendation:** Measure with a real Lighthouse run before splitting. This is
  a large refactor of migrated code with real regression risk and no measured
  benefit yet.
- **Status:** ACCEPTED pending measurement

## PERF-006 — Database queries: no N+1 found
- **Severity:** — · **Metric:** Query count
- **Current:** **No N+1 patterns anywhere.** Verified by scanning for
  `await` inside loops and `.map(async`. Every multi-entity read uses
  `Promise.all` with in-memory grouping: `getBusinessPlan` fetches sections and
  versions concurrently then buckets versions into a `Map`; `getWorkspaceContext`
  fans out four counts; AI history collects ids then issues one follow-up query.
  Nine call sites parallelise.
- **Index coverage:** 26 indexes; every foreign key and RLS hot-path column
  covered, including `unique (workspace_id, user_id)` backing
  `is_workspace_member()`.
- **Status:** **PASS — no action**

## PERF-007 — Hydration
- **Severity:** — · **Metric:** Console warnings
- **Current:** **Zero hydration warnings**, verified in the browser console.
- **Two prior causes fixed:** `lib/format.ts` formatters had no pinned `timeZone`,
  so SSR used the server's zone and hydration the browser's — now pinned to UTC
  with a regression assertion. `home-view.tsx` read `window.innerWidth` in initial
  state — now adopts the real viewport in a layout effect after hydration matches.
- **Status:** **PASS — no action**

## PERF-008 — React animation shorthand conflict
- **Severity:** Low · **Metric:** Console warnings
- **Current:** ~10 warnings from hero `cardDefs` setting both `animation` and
  `animationDelay`. **Re-render-triggered, not initial load** — a fresh homepage
  load shows a clean console; the warnings appear once the animation controller
  updates those styles.
- **Recommendation:** Split the shorthand into longhand properties.
- **Status:** OPEN

## PERF-009 — Core Web Vitals unmeasured
- **Severity:** High (as a gap, not a defect) · **Metric:** LCP / INP / CLS
- **Current:** **Not measured.** Requires a deployed URL.
- **Expectations from the code:** LCP is the risk area (render-blocking fonts +
  hero media). CLS likely fine — layout is explicit. INP likely fine — animations
  are transform/opacity and stay on the compositor.
- **Recommendation:** Run PageSpeed Insights against
  `https://www.aiautomix.com` after deploy and record real values here.
- **Status:** **OPEN — MANUAL ACTION REQUIRED**

## PERF-010 — 320px horizontal overflow
- **Severity:** Low · **Metric:** `scrollWidth` vs `clientWidth`
- **Current:** 7px overflow at 320px. All six other breakpoints (375/390/414/
  768/1024/1440) measure **0**.
- **Investigation:** No element's bounding box sits in the overflow band, so it is
  a pseudo-element or transform artifact rather than a box-model issue. A
  media-query padding override was attempted and **reverted** — it did not fix
  the overflow and would have changed two unrelated containers.
- **Status:** OPEN

---

## Third-party scripts

Only GA4, `strategy="afterInteractive"`, and only when
`NEXT_PUBLIC_GA_MEASUREMENT_ID` is set. No tag manager, no chat widget, no
tracking pixels. A genuinely clean third-party profile.

---

## Caching

Static routes are prerendered at build (34 of 44). Dashboard routes are
`force-dynamic` by necessity — they are per-user and auth-gated. PDF responses
set `Cache-Control: private, no-store`, which is correct for per-user documents.
No additional caching layer is warranted at current scale.

---

## Priorities

| Priority | Item | Effort |
| --- | --- | --- |
| 1 | Run Lighthouse against production and record real numbers (PERF-009) | S |
| 2 | Move video off-origin, add poster frames (PERF-001) | M |
| 3 | `next/font` migration (PERF-002) | M |
| 4 | Compress `logo-ice2.png` (PERF-004) | S |
| 5 | Fix animation shorthand warnings (PERF-008) | S |
| 6 | `next/image`, page by page (PERF-003) | L |
