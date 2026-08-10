# CODE-QUALITY

Sprint 5.5 assessment against the stated quality gates.

---

## Quality gates

| Gate | Status | Evidence |
| --- | --- | --- |
| TypeScript strict mode | **PASS** | `strict: true`; `npm run typecheck` exits 0 |
| Zero ESLint errors | **PASS** | `eslint . --max-warnings 0` exits 0 **across the whole repo** |
| No unsafe `any` without justification | **PARTIAL** | Clean in platform code; migrated marketing views carry blanket disables by design |
| No circular dependencies | **PASS** | Import-graph scan of 205 files: **0 cycles** |
| No dead code | **PASS (2 accepted)** | 2 unreferenced exports, both deliberate |
| No duplicated business logic | **PASS** | 11× REST preamble eliminated; lead submission extracted to one module |
| Reusable components | **PASS** | 13 `components/ui` primitives; one `ReportDocumentModel` drives both HTML and PDF |
| Clear module boundaries | **PASS** | `app/ → features/ → lib/ → types/`, no inversion |

### The gate that was lying

`npm run lint` ran `next lint`, which inspects only `/src`, `/app`, `/pages`,
`/components`, `/lib`. **All of `features/` — the bulk of business logic — plus
`hooks/`, `types/`, `scripts/` and `middleware.ts` was never linted.** The green
tick covered a minority of the codebase.

Now `eslint . --max-warnings 0`. The seven real warnings this surfaced were fixed
at the rule level rather than with scattered disables:

- The `_`-prefix convention for deliberately-unused signature params (Server
  Action `(_prev, _formData)`, destructuring-to-omit) is encoded in
  `no-unused-vars`, so intent stays visible at the call site.
- `jsx-a11y/alt-text` is scoped off `features/ai/pdf/**`, where `Image` is a
  `@react-pdf/renderer` primitive with no `alt` in its API.

---

## React / Next.js

| Principle | Status |
| --- | --- |
| Server Components by default | **PASS** — every read is a Server Component; `lib/supabase/client.ts` is unused, which is the correct outcome |
| Client Components only when required | **PASS in platform code**; migrated marketing views are client by necessity (imperative animation) |
| Business logic outside presentation | **IMPROVED** — lead submission extracted from `home-view.tsx` and `contact-view.tsx` to `lib/leads/submit.ts` |
| Avoid oversized page components | **FAIL (accepted)** — `home-view.tsx` is 6,301 lines |

### Oversized components

| File | Lines | Assessment |
| --- | ---: | --- |
| `features/home/home-view.tsx` | 6,301 | Migrated animation controller. Accepted. |
| `features/solutions/ai-business-idea-validation/…` | 2,444 | Migrated. Accepted. |
| ~20 further marketing views | 800–2,200 | Migrated. Accepted. |
| `types/database.ts` | 610 | Appropriate — one type per table, hand-authored |
| `features/ai/pdf/report-pdf.tsx` | 461 | Appropriate for a PDF layout |

The marketing views are faithful re-hosts of the original design carrying
blanket eslint-disables **by design**, documented in `MIGRATION-NOTES.md`.
Rewriting them would be a redesign, which this sprint explicitly excludes.

---

## Review checklist

**Correctness** — 126 automated checks pass across five suites. Two real defects
found and fixed during review: both PDF routes had no `try/catch` (returning
HTML instead of the JSON envelope), and the honeypot returned a 422 naming
itself.

**Maintainability** — comments explain *why*, not *what*. Strong examples: the
`type`-vs-`interface` constraint in `types/database.ts` (using `interface` makes
the Supabase client silently resolve every table to `never`), the UTC-pinning
rationale in `lib/format.ts`, and the RLS-is-the-enforcement-point note in
`features/workspaces/roles.ts`.

**Testability** — improved this sprint. `scripts/security-smoke.tsx` adds 36
checks covering authorization, open redirect, header injection, rate limiting,
lead validation and SEO-surface consistency — all without a database. The
role-parity test parses migration 0004 and fails if TypeScript drifts from SQL;
verified by deliberately introducing drift and confirming the failure.

**Accessibility** — modal has a real focus trap with restore; icon buttons carry
`aria-label`; forms wire `htmlFor`/`id` with `aria-invalid`; the user menu has
correct `menu`/`menuitem` roles and Escape-to-close.

**Performance** — no N+1 queries; 103 kB shared JS; zero hydration warnings.

**Security** — see `SECURITY-REPORT.md`. No Critical finding remains open.

---

## Naming and consistency

Consistent throughout: `kebab-case` files, `PascalCase` components,
`camelCase` functions, `SCREAMING_SNAKE` module constants, `snake_case` database
columns mapped explicitly at the boundary. Feature modules follow a predictable
`data.ts` / `actions.ts` / `*-view.tsx` shape.

One deliberate exception: `types/database.ts` Row types are **`type` aliases, not
interfaces** — required for `@supabase/supabase-js` to type the client. Documented
at the definition, which is the right place for a constraint that surprising.

---

## Remaining quality debt

| Item | Severity | Target |
| --- | --- | --- |
| No CI enforcing these gates | High | Sprint 6 |
| `animation`/`animationDelay` shorthand conflict (~10 warnings) | Low | Sprint 6 |
| 2 unreferenced exports (`getProject`, `deleteBusinessPlanAction`) | Low | When UI lands |
| `home-view.tsx` size | Medium | Only if measurement justifies it |

Full records in `TECHNICAL-DEBT.md`.
