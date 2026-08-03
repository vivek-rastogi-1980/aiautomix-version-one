# Sprint 5 — Migration & Implementation Notes

The **Business Plan Generator** and the **Workspace foundation**.

The plan generator is the first feature built entirely on the Sprint 4 AI
Platform: it adds no execution, validation, rendering or export logic of its
own. **No AI logic was duplicated** — the diff is a prompt file, two schemas, a
section catalog, a registry entry, and domain persistence.

**No breaking changes.** Sprints 1–4 behave exactly as before.

---

## 1. Required upgrade steps

### 1.1 Dependencies

**None added.**

```bash
npm install
```

### 1.2 Apply the database migration

Run `supabase/migrations/0004_sprint5_workspaces_and_plans.sql` (SQL Editor or
`supabase db push`). It is additive and idempotent.

> **Depends on `0003_sprint4_ai_platform.sql`** — it registers the new workflow
> in `ai_workflows` and links plans to `ai_requests`. Apply migrations in order.

The migration backfills: every existing user gets a personal workspace and an
owner membership, and their existing projects, business ideas and validation
reports are attached to it.

### 1.3 Sync the workflow catalog

```bash
npm run sync:workflows
```

Registers `business-plan` alongside `business-validator`. The migration seeds the
same rows, so this is only needed after a later prompt release.

### 1.4 Environment

Unchanged from Sprint 4.

---

## 2. Database changes

| Table                    | Purpose                                        |
| ------------------------ | ---------------------------------------------- |
| `workspaces`             | Top of the hierarchy; one personal per user    |
| `workspace_members`      | Role assignments: Owner, Admin, Member, Viewer |
| `business_plans`         | A generated plan and its provenance            |
| `business_plan_sections` | Current content of each of the eleven sections |
| `business_plan_versions` | Append-only revision history                   |

`projects`, `business_ideas` and `validation_reports` each gain a nullable
`workspace_id`, backfilled by the migration and populated on every new write.

### RLS

Membership checks run through **`security definer` helpers**
(`is_workspace_member`, `owns_workspace`, `workspace_role`, `can_edit_workspace`,
`can_manage_workspace`). This is not decoration: a policy on `workspaces` that
reads `workspace_members` — while that table's own policy reads `workspaces` —
recurses infinitely. Running the lookup as the definer breaks the cycle, and
`search_path` is pinned so the functions cannot be hijacked by a caller's session
settings.

Plans and sections are readable by any member and writable by Owner, Admin and
Member. Viewers read everything and change nothing. `business_plan_versions` has
**select and insert only** — a revision log that can be rewritten is not a
revision log.

The `workspaces` select policy checks `owner_id = auth.uid()` _or_ membership.
The owner clause is not redundant: it lets a freshly created workspace be read
back before its owner membership row exists, which is what makes lazy
bootstrapping work under RLS.

---

## 3. Decisions

### 3.1 The plan generator adds no AI logic

Everything the platform already owns stayed there. What Sprint 5 contributes:

| Piece              | File                                           |
| ------------------ | ---------------------------------------------- |
| Input contract     | `lib/validations/business-plan.ts`             |
| Prompt (versioned) | `prompts/business-plan/v1.md`                  |
| Output contract    | `features/ai/schemas/business-plan.ts`         |
| Registry entry     | `features/ai/registry/workflows.ts`            |
| Section catalog    | `features/business-plans/sections.ts`          |
| Report definition  | `features/business-plans/report-definition.ts` |
| Domain persistence | `features/ai/services/business-plan.ts`        |

Execution, retries, JSON repair, schema validation, rate limiting, AI History,
usage tracking, HTML rendering and PDF export are all inherited unchanged. The
engine smoke test now runs **both** workflows through the same manager, which is
the actual proof that the platform is reusable rather than merely factored.

### 3.2 Sections are prose, not nested JSON

Each section is one editable string. Structured JSON would model financials more
precisely, but every section must be editable by a human in a textarea and
versioned as a unit — asking someone to hand-edit nested JSON would make
"editable sections" hostile to use. The prompt instead requires the model to
_show its reasoning_ in `financials` rather than assert unsupported projections.

### 3.3 One catalog defines the eleven sections

`features/business-plans/sections.ts` is the single source of truth for section
keys, order, titles, icons and editor hints. `SECTION_META` is typed as a
`Record` over the schema's field union, so the compiler rejects the catalog if
the JSON contract ever gains a section nobody gave a title to.

`toPlanSectionContents()` — the mapping from a generated document to storable
rows — is a pure function used by _both_ the persistence path and the smoke test,
so the test asserts the real mapping rather than a second description of it.

### 3.4 History is written before the content it describes

`saveSectionRevision()` inserts the `business_plan_versions` row first, then
updates the section. `unique (section_id, version)` makes that insert the
concurrency guard: two simultaneous edits cannot both claim version N, and the
loser is rejected with "this section changed in another tab" rather than silently
overwriting. Ordering it this way also means a failure between the two writes
leaves an unused history row rather than current content with no record of how it
got there.

Restoring writes the old content **forward as a new version** rather than
rewinding the counter, so history stays append-only and the restore is itself
auditable.

### 3.5 The workspace bootstraps lazily, not from a signup trigger

Migration 0004 backfills existing users. New users get their workspace on first
read, in `features/workspaces/data.ts`.

The obvious alternative — extending the `handle_new_user` trigger on
`auth.users` — was rejected: an error inside that trigger fails **registration
itself**, and breaking sign-up to create a container is a bad trade. Lazy
creation costs one extra query on a cold workspace and can never block sign-up.
The unique `slug` handles the race between two concurrent first requests.

### 3.6 Workspace columns are widened, not swapped

The `workspace_id` columns are additive and the Sprint 2/3 read policies were
**widened with an `OR`** rather than replaced:

```sql
using (auth.uid() = user_id or (workspace_id is not null and is_workspace_member(workspace_id)))
```

Today every user has exactly one personal workspace with exactly one member, so
access is byte-for-byte what it was. The moment collaboration ships, the
hierarchy already resolves correctly with no second migration of live data.

### 3.7 Permission checks exist twice, deliberately

`features/workspaces/roles.ts` mirrors the SQL helpers. **The database is the
enforcement point.** The TypeScript copy exists so the UI can hide affordances a
Viewer cannot use and actions can fail with a sentence instead of a database
error. If the two ever disagree, the SQL wins and `roles.ts` is the bug — that is
written at the top of the file.

### 3.8 The executive summary is lifted, not duplicated

Both renderers already print `model.summary` under an "Executive summary"
heading. The report definition therefore reads the executive summary from its
section row — so it reflects edits — and omits that section from the section
list, instead of rendering the same text twice.

### 3.9 Shared helpers extracted rather than copied

Three things were pulled out while wiring the second workflow, because a second
consumer is the point at which duplication becomes real:

- `lib/validations/text.ts` — field builders and input sanitisation, now shared
  by both input schemas. The control-character strip is a code-point scan rather
  than a regex class, so the source file contains no literal control bytes.
- `features/ai/pdf/filename.ts` — export filename sanitising, shared by both PDF
  routes.
- `features/ai/pdf/download-pdf-button.tsx` — the report-specific download button
  generalised to take an endpoint.

---

## 4. REST API

| Method | Route                         | Purpose                         |
| ------ | ----------------------------- | ------------------------------- |
| GET    | `/api/business-plans`         | Plans in the caller workspace   |
| POST   | `/api/business-plans`         | Generate a plan from a brief    |
| GET    | `/api/business-plans/:id`     | Plan, sections, revision counts |
| GET    | `/api/business-plans/:id/pdf` | Branded A4 plan PDF             |

New pages: `/plans`, `/plans/new`, `/plans/[id]` and `/workspace`. Section
editing and version restore run through Server Actions, consistent with the rest
of the app.

---

## 5. Verification

```bash
npx tsc --noEmit   # 0 errors
npm run lint       # 0 errors
npm run build      # succeeds
npm test           # engine + report + plan + PDF
```

Results at time of writing:

- **`npm run test:engine`** — 35/35 (was 30). The five new checks run the
  **business-plan workflow through the same manager**: its prompt loads, the
  workflow executes, all eleven sections come back, the run is attributed to its
  own workflow, and a response missing a section is rejected as
  `AI_VALIDATION_FAILED`.
- **`npm run test:plan`** — 26/26. Catalog completeness against the schema,
  unique keys and icons, ordering, the document→rows mapping, the report model
  (no score, executive summary lifted, ten remaining sections, paragraph
  splitting), HTML rendering, and a 3-page A4 PDF at 34 KB with the logo
  embedded.
- **`npm run test:report`** — 20/20, **`npm run test:pdf`** — 6/6, both unchanged.
- **Live route checks** against `npm run start`: `/` returns 200; `/plans`,
  `/plans/new`, `/workspace`, `/validator`, `/reports` and `/ai/history` all
  redirect unauthenticated users to `/login` with a `redirectTo`; `GET` and
  `POST /api/business-plans`, `/api/business-plans/:id`,
  `/api/business-plans/:id/pdf` and the Sprint 3/4 endpoints all return `401`
  with the standard error envelope.

---

## 6. Known gaps

1. **No AI workflow has ever run against a real model.** `.env.local` still has
   no `OPENAI_API_KEY`. Plan quality, real latency, and whether eleven sections
   fit the 9000-token ceiling are unmeasured. The token ceiling is a considered
   estimate, not a measurement.
2. **Migration `0004` has not been applied to a live database.** The RLS
   recursion argument, the `security definer` helpers and the backfill are
   written carefully but have not been executed.
3. **No authenticated end-to-end test.** Everything verified at runtime is the
   unauthenticated boundary. Generating a plan, editing a section, restoring a
   revision and exporting the PDF against a live session is unexercised — and
   the version-conflict path in particular has never run against Postgres.
4. **Neither PDF was visually inspected** — no PDF renderer was available in this
   environment. Structure is asserted programmatically.
5. **The member list shows roles, not names.** `profiles` is readable only by its
   owner, so other members' identities cannot be displayed. Fixing that needs a
   profile-visibility change that belongs with collaboration.
6. **Regenerating a single section is not implemented.** The generator writes all
   eleven at once; sections are then edited by hand. Per-section regeneration
   would need a second prompt and was not in scope.
7. **`business_plans.summary` is a snapshot** taken at generation. The UI and PDF
   read the live section row, so it is only used for the list preview and can
   drift after an edit.
8. **Usage is attributed to user and project, not workspace.** `ai_requests` has
   no `workspace_id`; per-workspace usage is the natural billing unit and billing
   is explicitly out of scope.

---

## 7. Explicitly out of scope

Billing and collaboration, per the brief. Also absent: Marketing Strategy,
Competitor Analysis, Funding Advisor and the admin panel. Workspace invitations,
role changes and shared workspaces are collaboration features — the role model
and its permissions are already enforced in the database, so those become UI plus
an invitation flow rather than a schema change.
