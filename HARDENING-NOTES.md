# Production Hardening — pre-Sprint 6

A review of Sprints 1–5 with no new user-facing features. Everything below is
either a refactor, a configuration change, or a finding. No schema changed, no
functionality was removed, and no UI was altered.

**Quality gates after this pass**

| Gate                  | Before                     | After                     |
| --------------------- | -------------------------- | ------------------------- |
| TypeScript (`tsc`)    | clean                      | clean                     |
| ESLint                | clean **over 5 of 9 dirs** | clean over the whole repo |
| Production build      | succeeds                   | succeeds                  |
| Smoke tests           | 90/90                      | 90/90                     |
| Circular dependencies | 0                          | 0                         |
| Hydration warnings    | 0                          | 0                         |
| Security headers      | none                       | 6                         |

---

## 1. Architecture Review

**Verdict: sound.** 205 source files, 0 circular dependencies, no unused
dependencies in `package.json`, and a consistent `app / components / features /
lib / hooks / types` layering. The `features/*` split by domain, with `lib/`
holding only cross-cutting infrastructure, is holding up well at this size.

Two boundary problems were found and one was fixed.

**Fixed — the AI Platform facade was decorative.** `features/ai/index.ts`
described itself as the platform contract ("every AI product must consume these
shared services instead of implementing its own logic"), but **nothing imported
it**. The reason was structural rather than cultural: the facade re-exported the
engine, registry, providers and pricing, but omitted `services/*` — the
per-product entry points (`generateBusinessPlan`, `validateBusinessIdea`) that
callers actually need. With the one useful symbol missing, all six server-side
consumers reached past it into internals, and the documented boundary existed
only in prose. The services are now on the facade and those six consumers import
from `@/features/ai`. Pure import-path change.

**Noted — `lib/supabase/client.ts` is unused, and that is correct.** No client
component touches the database: every read is a Server Component, every mutation
a Server Action. That is what keeps RLS the single enforcement point. The file is
retained as the third of the documented `client / server / middleware` trio, with
a comment explaining that being unused is a sign of health rather than dead code,
so the next reviewer does not delete it.

---

## 2. Technical Debt Report

### Fixed: lint was reporting a false green

The headline finding. `npm run lint` ran `next lint`, which by design only
inspects `/src`, `/app`, `/pages`, `/components` and `/lib`. Everything in
**`features/` — the bulk of the business logic — plus `hooks/`, `types/`,
`scripts/` and `middleware.ts` was never linted at all.** "✔ No ESLint warnings
or errors" was true only of a minority of the codebase.

Compounding it, `eslint.config.mjs` had no `ignores`, so invoking ESLint directly
(the migration path, since `next lint` is deprecated and removed in Next 16)
linted the compiled bundles in `.next/` and reported ~1,850 phantom problems.

Both fixed: `lint` is now `eslint . --max-warnings 0`, with build output ignored.
That surfaced 7 real warnings, all resolved at the rule level rather than with
scattered disable comments:

- The `_`-prefix convention for deliberately-unused signature params (Server
  Action `(_prev, _formData)`, destructuring-to-omit in tests) is now encoded in
  `no-unused-vars`, so the intent stays visible at the call site.
- `jsx-a11y/alt-text` is scoped off `features/ai/pdf/**`, where `Image` is a
  `@react-pdf/renderer` drawing primitive that never reaches the DOM and has no
  `alt` in its API.

### Fixed: eleven copies of the REST preamble

Every route opened identically — resolve user, 401, rate limit, try/catch, log, 500. Eleven copies meant a new endpoint had to _remember_ to be authenticated and
throttled; one that forgot would be unauthenticated in production, not merely
inconsistent. `lib/api/route-handler.ts` (`withApiAuth`) makes it structural: it
cannot be called without a rate-limit scope, and the handler it wraps only runs
for a signed-in user.

This also fixed a live bug — **both PDF routes had no `try/catch` at all**, so a
render failure returned Next's HTML error page instead of the documented JSON
envelope. They are now covered.

The two AI `POST` routes deliberately keep a local `catch`: `AiError` carries its
own code, user-safe message and HTTP status (rate limits, provider outages,
validation failures), and folding those into a generic 500 would discard exactly
the detail a client needs.

### Remaining debt (deliberate, not oversight)

| Item                                                            | Assessment                                                                                                                                                                                               |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/projects/data.ts → getProject`                        | Genuinely unreferenced. 10 lines, harmless; left rather than churn a data module.                                                                                                                        |
| `features/business-plans/actions.ts → deleteBusinessPlanAction` | Fully implemented and correctly guarded (`requireUser` → `canEdit` → workspace-scoped), but no UI calls it. Groundwork for a delete affordance, not a risk.                                              |
| Marketing views (6,301-line `home-view.tsx` and ~20 others)     | Faithful re-hosts of the original imperative design, carrying blanket eslint-disables by design. Out of scope under "never change UI"; the migration debt is already documented in `MIGRATION-NOTES.md`. |
| `next/font` migration                                           | Fonts still load via a raw `<link>` to match the original design 1:1. Pre-existing follow-up.                                                                                                            |

---

## 3. Security Report

**Audited clean:**

- **Secrets.** `OPENAI_API_KEY` and the service-role key are read server-side
  only; nothing sensitive is behind a `NEXT_PUBLIC_` prefix.
- **Prompt injection.** User input is fenced with explicit BEGIN/END markers and
  labelled untrusted; system and developer content stays trusted.
- **XSS.** Every `dangerouslySetInnerHTML` site takes a static module constant
  (page CSS, a static icon lookup, static JSON-LD). No AI output or user input
  reaches an HTML sink — model output is rendered as text through the Report
  Engine.
- **Header injection.** `toPdfFilename` strips everything outside `[a-z0-9-]`,
  caps at 60 characters and has a fallback, so a user-supplied plan title cannot
  break out of `Content-Disposition`.
- **Uploads.** Paths are `${user.id}/…`, enforced by storage RLS.
- **CSRF/CORS.** Server Actions carry Next's built-in origin check; API routes
  parse `request.json()`, which browsers cannot issue cross-origin as a simple
  request. No permissive CORS headers are set.
- **SQL injection.** No raw SQL — everything goes through PostgREST filters.

**Fixed — no security headers at all.** `next.config.ts` set none, leaving
transport security, framing and referrer leakage to browser defaults. Added
HSTS, `nosniff`, `SAMEORIGIN`, `strict-origin-when-cross-origin`, a
deny-by-default `Permissions-Policy`, and DNS prefetch control. All six verified
served in the browser.

CSP is **deliberately** omitted, not forgotten. The migrated marketing pages
carry inline styles, inline `<style>` blocks and inline JSON-LD scripts for pixel
fidelity, so a CSP strict enough to be worth having would break them, and one
loose enough to pass (`unsafe-inline` on scripts _and_ styles) buys almost
nothing. A real CSP means nonce-ing those blocks first — recorded in the config
as follow-up rather than smuggled into a sprint whose rule is "never change UI".

**Fixed — projects skipped the workspace role check.** `features/projects/
actions.ts` was the only mutation path without one; business-plans, business-ideas
and workspaces all had it. RLS still held (project write policies are owner-only),
but `createProjectAction` stamped `workspace_id` without asking whether the caller
may write to that workspace. It was unexploitable only because every workspace is
currently personal, making every caller an Owner. **The day invitations ship, a
Viewer could create a project into a workspace they are only meant to read** —
the insert names them as `user_id`, so the owner-only policy permits it. `canEdit`
now guards create, update and delete: a no-op for every existing user, and one
less thing the Sprint 6 invitation flow has to remember.

**Open risk (documented, not changed): SVG upload.** `imageFileSchema` validates
size and MIME, but `file.type` is client-declared, and SVG is an accepted type.
A crafted request can store an SVG containing `<script>` in a public bucket.
Severity is limited — Supabase Storage serves from its own origin, so such a file
cannot reach app cookies or session — but it remains a phishing vector.
Fixing it properly means magic-byte sniffing or server-side sanitisation; both
change upload behaviour, so it is recorded here rather than done under a
"never remove functionality" rule.

---

## 4. Performance Report

**No changes were needed, which is the finding.**

- **No N+1 queries anywhere.** Every multi-entity read uses `Promise.all` and
  groups in memory — `getBusinessPlan` fetches sections and versions
  concurrently then buckets versions into a `Map`; `getWorkspaceContext` fans out
  four counts at once; the AI history list collects ids and issues one follow-up
  query. Nine call sites parallelise rather than awaiting in sequence.
- **Index coverage is complete.** 26 indexes; every foreign key and every
  RLS-hot-path column is covered, including the `unique (workspace_id, user_id)`
  on `workspace_members` that backs `is_workspace_member()`.
- **Bundle.** 99.7 kB shared JS; dashboard routes land at 103–129 kB first load.
  Reasonable for the feature set.
- **Dependencies.** All 13 runtime dependencies are used. No duplicates.

Two dev-only console warnings about preloaded-but-unused images are a benign
consequence of the intentional deferred-mount optimisation in `home-view.tsx`
(below-the-fold media is held back so it does not compete with first paint). The
assets _are_ used, just after the deferral window.

---

## 5. Code Quality Report

TypeScript is strict and clean, and the database Row types are correctly
`type` aliases rather than interfaces — a subtle requirement for
`@supabase/supabase-js` to type the client instead of silently resolving every
table to `never`. That constraint is documented at the definition, which is the
right place for it.

The strongest quality signal is the **document-model pattern**: a report is
described once as a `ReportDocumentModel` and rendered by both the HTML and PDF
engines, so an export cannot drift from what the user saw. Both AI products reuse
it, and the Business Plan Generator adds no AI logic at all — it contributes a
schema, a prompt, a section catalog and persistence, and inherits execution,
retries, validation, history, usage tracking and both renderers.

Comment quality throughout is unusually high: comments explain _why_ (the
`type`-vs-`interface` constraint, the UTC pinning rationale, the RLS-is-the-
enforcement-point note in `roles.ts`) rather than restating the code.

---

## 6. AI Platform Review

**Verdict: the boundary is real, and now enforced by imports too.**

- **Nothing calls a model provider directly.** The only file that constructs an
  OpenAI client is `features/ai/providers/openai.ts`.
- **`runWorkflow` is the only execution path,** and it owns every stage: input
  validation, rate limiting, provider selection, prompt loading, message
  building, response validation with JSON repair and retries, cost estimation
  and usage/history recording. A feature _cannot_ skip a stage, because none of
  them are the feature's to call.
- **Prompts are versioned markdown with checksums,** never inline strings, and
  every run records the version and checksum that produced it.
- Both services are thin consumers that add only domain persistence.

The one gap — that the documented facade was bypassed by everyone — is fixed
(§1).

---

## 7. Accessibility Report

**Fixed — the modal's `aria-modal` was lying.** `Modal` announced
`aria-modal="true"`, which tells assistive technology that everything outside is
inert, but Tab could still walk out into the page behind it, and focus was
neither moved into the dialog on open nor returned to the trigger on close. A
keyboard user could end up typing into content they could not see, then lose
their place entirely on close. It now does the three things that make the
announcement honest: focus in on open (falling back to the panel itself), Tab
and Shift+Tab cycle within it, and focus returns to the opener on unmount. The
docstring previously claimed a trap that was only ever Escape handling; it now
describes what the code does.

**Fixed — `UserMenu` could not be closed from the keyboard.** It dismissed on
outside `mousedown`, a pointer affordance with no keyboard equivalent, so an
opened menu could only be escaped by tabbing through every item. Escape now
closes it and returns focus to the trigger, per the WAI-ARIA menu pattern.

**Audited clean:** every icon-only button already carries an `aria-label`; form
controls are wired `htmlFor`/`id` with `aria-invalid` on error; the menu already
had correct `menu`/`menuitem` roles; focus-visible rings are consistent.

---

## 8. Testing

The suite covers the AI platform well — 90 checks across four smoke tests,
running the real Workflow Manager against a mock provider for **both** registered
workflows, plus document-model and PDF rendering. It needs no API key, database
or network, which is why it is fast enough to run every time.

**Gap, unchanged by this pass:** there is no coverage of the REST layer, Server
Actions, or RLS policies. `withApiAuth` is now the single chokepoint for API
authentication and rate limiting, which makes it both the highest-value thing to
test and newly practical to test — one suite would cover all eleven routes.
Doing so requires a Supabase test double the current harness does not have, so it
is recorded as the top testing priority for Sprint 6 rather than half-built here.

---

## Migration Notes

**No database migration.** No schema, policy or index changed.

**No environment changes.** No new variables.

**One behavioural change to be aware of**, and it is a no-op today: project
create/update/delete now require `canEdit` on the caller's workspace role. Every
existing user is the Owner of their personal workspace, so nothing changes for
anyone currently using the app. It matters only once shared workspaces exist.

**If you have tooling that shells out to `next lint`,** point it at `npm run
lint` instead — that script now runs ESLint directly over the whole repository.
Expect it to inspect roughly twice as many files as before.
