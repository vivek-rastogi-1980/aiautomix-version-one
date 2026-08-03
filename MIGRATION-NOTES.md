# Migration Notes — Sprint 1

This document records how the static AIAutomix design handoff became this
Next.js application, and every place where the migration intentionally departs
from the coding standards. Where the constitution documents conflict, the agreed
precedence is `ARCHITECTURE > CODING-STANDARDS > UI-DESIGN-SYSTEM > SPRINT-01`.

## Source material

The handoff contained 24 "design component" pages (`.dc.html`) authored in a
bespoke, React-like templating format: inline styles, `{{ expression }}`
bindings, `<sc-if>` / `<sc-for>` control tags, a `<helmet>` metadata block, and
a per-page `class Component extends DCLogic` script that mirrors a React class
component (`state`, `renderVals`, `componentDidMount`, callback refs).

A `design_handoff_backend_and_news/` folder held **older** snapshots of some
pages plus a README describing future backend work. The root-level files are the
newer versions (they carry the refined nav with the animated logo), so the
migration is built from the root files. The handoff's backend items are
deferred — see "Deferred to later sprints" below.

## How the migration was produced

Because the pages total roughly 850 KB of markup, they were converted with a
small, purpose-built pipeline rather than by hand, so the whole site can be
regenerated deterministically. The pipeline parses each `.dc.html`, converts the
markup to JSX (inline style strings to camelCased style objects, `class` to
`className`, `{{ }}` to `{ }`, `<sc-if>` to conditional expressions, `<sc-for>`
to `.map()`, internal `./page.dc.html` links to `next/link`, `./assets/…` to
`/assets/…`), and translates each page's class into a functional component.

## Route map

Routes are flat, kebab-case, and SEO-oriented:

| Design page                                                    | Route                           |
| -------------------------------------------------------------- | ------------------------------- |
| AIAutomix Homepage                                             | `/`                             |
| Services                                                       | `/services`                     |
| Contact Us                                                     | `/contact`                      |
| Privacy Policy                                                 | `/privacy-policy`               |
| Validate Your Idea                                             | `/validate-your-idea`           |
| AI Business Idea Validation                                    | `/ai-business-idea-validation`  |
| AI Chatbot                                                     | `/ai-chatbot`                   |
| AI Strategies and Consulting                                   | `/ai-strategies-and-consulting` |
| Add 24x7 Working AI Agents                                     | `/ai-agents`                    |
| CRM                                                            | `/crm`                          |
| Create Marketing Plan                                          | `/create-marketing-plan`        |
| Create a Business Plan                                         | `/create-a-business-plan`       |
| Generate Leads                                                 | `/generate-leads`               |
| Get Your Funding                                               | `/get-your-funding`             |
| Growth Plan                                                    | `/growth-plan`                  |
| Education/Hospital/Real Estate/Restaurant/Travel AI Automation | `/{name}-ai-automation`         |
| Website Development                                            | `/website-development`          |
| Mobile App Development                                         | `/mobile-app-development`       |
| SaaS Product Development                                       | `/saas-product-development`     |
| High-Converting Landing Page Design                            | `/landing-page-design`          |

## Architecture

Each route is a thin Server Component at
`app/(marketing)/<route>/page.tsx` that owns `export const metadata` (built from
the source `<helmet>` — title, description, keywords, canonical, Open Graph,
Twitter) and renders any JSON-LD the source page carried. It imports a matching
view from `features/<group>/<slug>/`. Feature groups are `home`, `services`,
`contact`, `legal`, `solutions` (11), `industries` (5), and `dev-services` (4).

Per-page CSS (keyframes and media queries from the source `<style>`) is embedded
in each view as a `PAGE_CSS` constant rendered through a scoped
`<style dangerouslySetInnerHTML>` tag, which prevents one page's keyframes from
leaking into another.

### Shared navigation

The navbar and slide-in menu overlay were **byte-identical across 19 of the 24
pages**, so they were extracted into a single `components/layout/site-nav.tsx`
client component with its own menu state. The homepage and the four
`dev-services` pages ship a visually distinct nav and keep their own inline
markup.

### Static vs. client components

Pages whose logic produces no dynamic values after the shared nav is removed —
the privacy policy and the five industry pages — are emitted as pure Server
Components with no `"use client"` directive. Everything else is a Client
Component.

### State hook

`hooks/use-merged-state.ts` provides `useMergedState`, a `useState` variant with
class-component-style partial merging (`setState({ field })` and
`setState(prev => ({ field }))`). This lets the design pages' interaction logic
port over with minimal change while remaining functional components.

## Intentional deviations from the coding standards

Each of these trades a style rule for the higher-priority requirement of
**pixel-identical fidelity** (ARCHITECTURE and the handoff both mark the designs
as final, high-fidelity, "recreate pixel-for-pixel").

- **Inline styles are preserved 1:1.** The designs encode their exact look in
  inline styles; reproducing them as inline `style` objects is the only way to
  guarantee identical rendering in this sprint. Extracting them into Tailwind or
  CSS Modules would risk visual drift and is deferred. `lib/styles.ts` widens
  the design's plain style objects to React's `CSSProperties`.

- **`<img>` instead of `next/image`.** The pages rely on precise, inline-styled
  image boxes (many sourced from an external CDN) and a custom `<image-slot>`
  placeholder element. Swapping in `next/image` would change layout and loading
  behaviour, so `@next/next/no-img-element` is turned off with a note in the
  ESLint config. The design tool's `<image-slot>` elements are converted to
  plain `<img>` tags that render the same source with the same shape and crop.

- **Google Fonts via `<link>` rather than `next/font`.** The design specifies
  Bricolage Grotesque + Inter loaded from Google Fonts; the link is kept literal
  in the root layout for exact parity. Moving to `next/font` is a safe later
  optimisation.

- **The five complex pages are re-hosted as controller classes.** The homepage
  and the AI Business Idea Validation, AI Chatbot, and Services pages contain
  heavy imperative animation logic (IntersectionObservers, scroll/resize
  listeners, auto-scrolling carousels, per-video refs, mouse-parallax). Rather
  than risk-rewriting that behaviour, each original class is re-hosted almost
  verbatim as a typed controller instantiated once via `useRef` and driven by a
  thin `usePageVals()` hook; lifecycle runs in a client-only `useEffect`. These
  controllers use `any`-typed scratch fields and carry a file-scoped
  `eslint-disable` for `@typescript-eslint/no-explicit-any` (and, where
  applicable, `no-unused-vars`) — a deliberate, localized exception so the
  animation behaviour ports over exactly. Eager browser-API field initializers
  are guarded with `typeof window === "undefined"` so static prerendering
  doesn't touch client-only globals.

- **`style-hover` / `style-active` reproduced imperatively.** The design tool's
  hover/pressed style attributes are converted to `onMouseEnter` / `onMouseLeave`
  / `onMouseDown` / `onMouseUp` handlers that swap the styles, matching the
  original interaction.

## Rendering caveat to verify

The homepage's responsive rules use attribute selectors such as
`[style*="padding:22px 64px"]` to target inline-styled elements at breakpoints.
These continue to match the migrated inline styles, but because they depend on
exact style-string formatting they should be spot-checked in a browser at mobile
and desktop widths. (This environment has no browser, so verification here was
limited to HTTP/HTML smoke tests: every route returns 200 with full,
metadata-correct HTML and all 27 pages prerender as static content.)

## Supabase

`lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (RSC/route
handlers) are configured with `@supabase/ssr` but **not used anywhere** in this
sprint. They read their URL and keys from the environment and throw a clear
error only if invoked without configuration, so the site builds and runs with no
secrets present.

## Analytics

Google Analytics is wired in the root layout behind
`NEXT_PUBLIC_GA_MEASUREMENT_ID` using `next/script`. With no ID set, no analytics
code is emitted.

## Deferred to later sprints

The handoff README describes backend work that is explicitly **out of scope for
Sprint 1** and is not built here: the `leads`, `generated_reports`, `files`, and
`newsletter_subscribers` tables; `POST /api/leads` and `POST /api/newsletter`
(the forms currently keep their original client-only behaviour); the live News
section and its data source (the homepage still renders the design's hardcoded
"Latest Insights" items); and any authentication. The form UI design tokens and
News card spec in that README are already reflected in the migrated markup, so
wiring them to real endpoints later should not require visual changes.
