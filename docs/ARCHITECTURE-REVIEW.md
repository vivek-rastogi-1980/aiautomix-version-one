# ARCHITECTURE-REVIEW

Sprint 5.5 review of the Sprint 1–5 implementation. Based on inspection of the
repository, not on the project description.

---

## Executive summary

**The architecture is sound and does not need restructuring.** 205 source files,
**zero circular dependencies**, no unused runtime dependencies, and a consistent
layering that has held across five sprints and two AI products.

The strongest signal is the **second AI product cost a fraction of the first**.
The Business Plan Generator contributes an input schema, a versioned prompt, an
output schema, a section catalog and its own persistence — and inherits
execution, retries, validation, history, usage tracking, HTML rendering and PDF
export. That is the test of whether a platform is real, and it passes.

One boundary was decorative rather than enforced and has been fixed. Everything
else needing attention is operational (CI, migrations) rather than structural.

---

## Architecture

```
                      Browser
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   Server Components  Server Actions  REST routes
   (all reads)        (all mutations) (withApiAuth)
        │                │                │
        └────────────────┼────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
      features/ai (facade)    features/* domains
              │                     │
      ┌───────┴────────┐            │
      │ runWorkflow    │            │
      │  ├ validate in │            │
      │  ├ rate limit  │            │
      │  ├ provider    │            │
      │  ├ prompt      │            │
      │  ├ validate out│            │
      │  └ track usage │            │
      └───────┬────────┘            │
              │                     │
        OpenAI provider        Supabase (RLS)
```

**Dependency direction:** `app/` → `features/` → `lib/` → `types/`. No inversion
found. `lib/` holds only cross-cutting infrastructure and imports no feature.

---

## Answers to the review questions

**1. Are module boundaries clear?** Yes, with one exception now fixed —
`features/ai/index.ts` declared itself the platform contract but had **zero
importers**, because it omitted the `services/*` entry points callers need. All
six server-side consumers now route through it.

**2. Do dependencies flow correctly?** Yes. Verified by a full import-graph scan:
**0 circular dependencies** across 205 files.

**3. Is AI functionality centralized?** Yes. Exactly one module constructs a
model client (`features/ai/providers/openai.ts`) and exactly one function
executes a workflow (`runWorkflow`). **No React component calls an LLM** —
verified by grep for `new OpenAI`, `openai.`, `chat.completions` outside the
provider layer: zero hits.

**4. Can a new AI workflow be added without duplicating infrastructure?** Yes —
four things: input schema, versioned prompt file, output schema, report
definition. Demonstrated by the Business Plan Generator.

**5. Is the workspace model ready for teams?** The **schema** is. Workspaces,
members and four roles are enforced by RLS through `security definer` helpers,
and the backfill gives every existing user a personal workspace. What is missing
is the invitation flow — UI plus an invite table, not a schema change. One latent
bug was found and fixed (see Risk 1).

**6. Are RLS policies safe?** Yes. Enabled on all 15 tables. Reads run under the
user's own session so RLS is the enforcement point rather than application code.
`leads` is deliberately asymmetric: anon may INSERT, **no role may SELECT**.

**7. Are APIs consistent?** Now, yes. All 11 routes go through `withApiAuth`,
which cannot be used without supplying a rate-limit scope. Before this review the
preamble was copy-pasted 11 times and two PDF routes had no error handling at
all.

**8. Are background jobs required?** Not yet. AI runs complete within a request;
PDF generation is synchronous and produces 34–41 KB documents in-process. This
becomes a constraint if plan generation grows past the platform timeout — the
Workflow Manager already records duration, so the data to decide exists.

**9. Scalability risks?** Three, none blocking today: the in-memory rate limiter
is per-instance and loosens under serverless; PDF rendering is synchronous and
CPU-bound; `home-view.tsx` is 6,301 lines shipped as one client component.

**10. What must be fixed before Sprint 6?** See blockers below.

---

## Findings

### ARCH-001 — AI facade was documented but unused · **RESOLVED**
`features/ai/index.ts` described itself as the contract every AI product must
consume. A dependency scan found **zero importers**: it re-exported the engine,
registry, providers and pricing but omitted `services/*`, so callers reached past
it. Added the service entry points and routed six consumers through the facade.
Pure import-path change.

### ARCH-002 — Duplicated REST preamble · **RESOLVED**
Eleven routes each spelled out resolve-user → 401 → rate limit → try/catch → log
→ 500. `withApiAuth` makes it structural. This also fixed a live defect: **both
PDF routes had no `try/catch`**, so a render failure returned Next's HTML error
page instead of the JSON envelope.

### ARCH-003 — Business logic in a UI module · **ACCEPTED**
`features/home/home-view.tsx` (6,301 lines) contains an imperative animation
controller and, until this review, lead-submission logic. Submission has been
extracted to `lib/leads/submit.ts`. The animation controller stays — it is a
faithful re-host of the original design, documented in `MIGRATION-NOTES.md`, and
rewriting it would be a redesign.

### ARCH-004 — `lib/supabase/client.ts` unused · **ACCEPTED, correct as-is**
No client component touches the database: every read is a Server Component, every
mutation a Server Action. That is what keeps RLS the single enforcement point.
Retained as the third of the documented `client / server / middleware` trio with
a comment explaining that being unused is a sign of health.

### ARCH-005 — Platform service imports a feature module · **ACCEPTED**
`features/ai/services/business-plan.ts` imports
`@/features/business-plans/sections`. The `services/` layer is per-product
orchestration, so a product-specific import is consistent with its role, and no
cycle results. Worth watching if a third product repeats the pattern.

### ARCH-006 — Missing specification documents · **OPEN**
Sixteen documents referenced throughout code comments —
`ENGINEERING-HANDBOOK.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API-STANDARDS.md`,
`AI-WORKFLOW-ENGINE.md`, `WORKSPACE-ARCHITECTURE.md`, `BUSINESS-PLAN-SPEC.md`
and nine others — **exist nowhere on disk**. Comments cite standards nobody can
read, and no review can verify implementation against spec. This review fell back
to treating the code as source of truth.

---

## Database architecture

15 tables across 5 ordered migrations, all additive and idempotent.

- **Foreign keys:** every one indexed. 24 `on delete cascade`, 8 `on delete set
  null` — deliberate rather than defaulted.
- **Indexes:** 26. Covers `user_id`, `workspace_id`, `project_id`, `plan_id`,
  `section_id`, `request_id`, `workflow`, `owner_id`.
- **Constraints:** `unique (workspace_id, user_id)` on `workspace_members` — which
  also indexes the RLS hot path used by `is_workspace_member()`. `unique
  (plan_id, section_key)` and `unique (section_id, version)` prevent duplicate
  sections and version collisions. CHECK constraints on every status enum and on
  `score between 0 and 100`.
- **Security-definer functions:** `is_workspace_member`, `workspace_role`,
  `can_edit_workspace`, `can_manage_workspace`, `owns_workspace` — all with
  `set search_path = public`, which is the correct hardening for
  `security definer`.
- **Migration order:** enforced by dependency; each references the prior.

---

## Risks

**Risk 1 — Workspace isolation had a gap.** `features/projects/actions.ts`
stamped `workspace_id` with no role check. Not exploitable today (all workspaces
personal → every caller Owner), but the invitation flow would have shipped a
Viewer-can-write bug. **Fixed**, and now covered by a regression test that parses
migration 0004 and fails if the TypeScript role predicates drift from the SQL.

**Risk 2 — No CI. RESOLVED 2026-08-10** (`.github/workflows/ci.yml`, five jobs). Was: nothing enforced typecheck, lint, tests or build on push. The
clean state depends entirely on someone remembering. This is the highest-leverage
remaining item.

**Risk 3 — Rate limiter is per-instance.** In-memory `Map`, documented as sized
for a single Node instance. On serverless, effective limits are looser than
configured.

**Risk 4 — Synchronous PDF generation.** CPU-bound and in-request. Fine at
current document sizes; a scaling constraint later.

---

## Architecture decisions endorsed by this review

1. **RLS as the enforcement point**, with UI role checks as a usability mirror.
   `features/workspaces/roles.ts` states "if these two disagree, the SQL wins and
   this file is the bug" — now a failing test rather than a comment.
2. **One document model rendered by both HTML and PDF engines**, so an export
   cannot drift from what the user saw.
3. **Versioned prompt files with checksums**, recorded per run.
4. **Server Actions for mutations, Server Components for reads** — keeps query
   logic out of the bundle.
5. **News as typed module data rather than a table** — version-controlled,
   reviewable, statically rendered.

---

## Sprint 6 blockers

| # | Blocker | Severity | Owner |
| --- | --- | --- | --- |
| ~~1~~ | ~~Migration 0005 unapplied~~ — **RESOLVED.** Applied and verified 2026-08-10: 18 structural checks plus a conclusive RLS proof (anon may INSERT; cannot SELECT, UPDATE or DELETE), and one lead submitted end-to-end through `/api/leads` with full UTM attribution. | ~~Critical~~ | Done |
| ~~2~~ | ~~**No CI**~~ — **RESOLVED**, `.github/workflows/ci.yml`. Branch protection still to enable by hand. | ~~High~~ | Done |
| 3 | **16 spec documents missing** — Sprint 6 cannot be reviewed against a spec that does not exist | Medium | Product |
| 4 | **No invitation flow** — the role model is enforced but unreachable; any Sprint 6 collaboration work starts here | Medium | Product |

**Not blockers:** CSP, SVG upload, `next/image`, `next/font`, video CDN, the
320px overflow. All documented with rationale in `TECHNICAL-DEBT.md`.
