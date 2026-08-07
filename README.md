# AIAutomix

The AIAutomix **AI Business Operating System**, built on **Next.js 15**.
Sprint 1 migrated the design handoff into a pixel-faithful marketing front end.
**Sprint 2** added Supabase authentication, a protected dashboard, and project
& profile management. **Sprint 3** shipped the flagship AI feature: the
**Business Idea Validator**. **Sprint 4** extracted the reusable **AI Platform
Core** that every AI product runs on — workflow manager, prompt registry,
provider layer, response validator, report engine, PDF engine, usage tracking
and AI history. **Sprint 5** adds the **Business Plan Generator** — the first
feature built entirely on that platform — and the **workspace foundation**
underneath everything.

## Stack

- **Next.js 15** (App Router) with **React 19**
- **TypeScript** in `strict` mode
- **Tailwind CSS** with the AIAutomix brand tokens
- **shadcn/ui**-style primitives (`components/ui`)
- **Supabase** — Auth, PostgreSQL (Row Level Security), and Storage
  (`@supabase/ssr`)
- **OpenAI** via the in-house **AI Workflow Engine** (server-side only)
- **@react-pdf/renderer** for branded A4 PDF export
- **Zod** for input validation · **lucide-react** for icons
- **ESLint** (flat config) + **Prettier**

## Requirements

- **Node.js 18.18+** (developed and built on Node 22)
- npm (or your preferred package manager)
- A **Supabase** project (free tier is fine)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npm run dev
```

The site runs at [http://localhost:3000](http://localhost:3000).

### 1. Configure Supabase

Create a project at [supabase.com](https://supabase.com), then copy the URL and
anon key into `.env.local` (Project Settings → API):

| Variable                        | Purpose                                      |
| ------------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (or the publishable key)   |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only key (used by `sync:workflows`)   |
| `NEXT_PUBLIC_SITE_URL`          | Absolute site URL for auth email links       |
| `OPENAI_API_KEY`                | **Required to run any AI workflow** (server) |
| `OPENAI_MODEL`                  | Optional model override (`gpt-4o-mini`)      |
| `AI_PROVIDER`                   | Optional default provider id (`openai`)      |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Optional Google Analytics 4 measurement ID   |

Without `OPENAI_API_KEY` the app still builds and runs — the validator and plan
pages show a clear "not configured" notice instead of failing.

### 2. Apply the database schema

Run both migrations **in order** against your project — paste them into the
Supabase **SQL Editor**, or use the CLI (`supabase db push`):

1. [`0001_sprint2_foundation.sql`](./supabase/migrations/0001_sprint2_foundation.sql)
   — `profiles` + `projects`, RLS, the shared `updated_at` trigger, and the
   `avatars` / `logos` storage buckets.
2. [`0002_sprint3_validator.sql`](./supabase/migrations/0002_sprint3_validator.sql)
   — `business_ideas`, `validation_reports`, `ai_requests`, and the private
   `reports` bucket.
3. [`0003_sprint4_ai_platform.sql`](./supabase/migrations/0003_sprint4_ai_platform.sql)
   — `ai_workflows`, `ai_prompt_versions`, `ai_responses`, `ai_usage_logs`, plus
   additive columns on `ai_requests` and `validation_reports`.
4. [`0004_sprint5_workspaces_and_plans.sql`](./supabase/migrations/0004_sprint5_workspaces_and_plans.sql)
   — `workspaces`, `workspace_members`, the three business-plan tables, the
   membership RLS helpers, and a backfill that gives every existing user a
   personal workspace.

All four are additive and idempotent, and each depends on the one before it, so
apply them in order. Then sync the workflow catalog:

```bash
npm run sync:workflows
```

### 3. Email settings (optional but recommended)

In Supabase **Authentication → URL Configuration**, add your site URL and
`…/auth/confirm` and `…/auth/callback` as redirect URLs. Email confirmation is
on by default; disable it under **Authentication → Providers → Email** if you
want instant sign-in during local development.

## Sprint 5 — Business Plans & Workspaces

### Workspace foundation

`Workspace → Members → Projects → Business Ideas → Business Plans → Reports`.

Every user gets a personal workspace, created by the migration for existing
accounts and lazily on first read for new ones. Roles are **Owner, Admin, Member
and Viewer**, enforced by Row Level Security through `security definer`
membership helpers; `features/workspaces/roles.ts` mirrors them so the UI can
hide what a Viewer cannot do. `/workspace` shows the workspace, your role, the
member roster and what it contains.

Invitations, role changes and shared workspaces are collaboration features and
are **not** in this sprint — but the role model is already enforced in the
database, so they become UI plus an invitation flow rather than a schema change.

### Business Plan Generator

Describe the business once; get the eleven sections from `BUSINESS-PLAN-SPEC.md`
— executive summary, market analysis, customer persona, competition, business
model, marketing, operations, financials, funding, risks and roadmap.

- **Every section is editable** in place, and **versioned**: each save appends a
  revision, and any earlier revision can be restored.
- **PDF export** reuses the Sprint 4 PDF Engine unchanged.
- The feature adds **no AI logic**. It contributes an input schema, a versioned
  prompt, an output schema, a section catalog, a registry entry and its own
  persistence — execution, retries, validation, history, usage tracking and both
  renderers are inherited.

`/plans` · `/plans/new` · `/plans/[id]`

See [`MIGRATION-NOTES-SPRINT5.md`](./MIGRATION-NOTES-SPRINT5.md) for decisions
and known gaps.

## Sprint 4 — AI Platform Core

One reusable platform for every AI product (`features/ai`). **No feature calls a
model provider directly**, and no feature implements its own validation,
history, rendering or export.

```
input → validation → prompt → provider → JSON validation → save → report → PDF
```

| Module                 | Where                          | What it does                                       |
| ---------------------- | ------------------------------ | -------------------------------------------------- |
| **Workflow Manager**   | `engine/workflow-manager.ts`   | Routing, retries, error normalisation, metrics     |
| **Prompt Registry**    | `registry/prompts.ts`          | Versioned markdown + checksums                     |
| **Workflow Registry**  | `registry/workflows.ts`        | The one module that knows which AI products exist  |
| **Provider Layer**     | `providers/`                   | OpenAI today; Anthropic, Gemini, Azure declared    |
| **Response Validator** | `engine/response-validator.ts` | JSON repair, output + input validation             |
| **Report Engine**      | `renderer/`                    | One document model → consistent, accessible HTML   |
| **PDF Engine**         | `pdf/`                         | The _same_ model → branded A4 with logo and paging |
| **Usage Tracking**     | `usage/`                       | Tokens, duration, estimated cost, success/failure  |
| **AI History**         | `history/`                     | Every run, reopenable back to its report           |

Adding an AI product means supplying **four things** — an input schema, a
versioned prompt file, an output schema, and a report definition. Execution,
retries, persistence, usage tracking, HTML rendering and PDF export come for
free. Business features (Business Plan Generator, Marketing Strategy, and so on)
are deliberately **not** part of this sprint.

- **Prompts are versioned markdown** in [`prompts/`](./prompts) — never
  hardcoded in components — and every run records the prompt version and file
  checksum that produced it.
- **Every response is schema-validated** before anything is saved; malformed
  output is repaired and retried, then rejected with a user-safe message.
- **A report is described once.** The `ReportDocumentModel` is rendered by both
  the HTML and PDF engines, so the two can never drift.
- Untrusted input is fenced and explicitly marked as data, not instructions.
- `/ai/history` shows usage metrics and the full execution log.

See [`MIGRATION-NOTES-SPRINT4.md`](./MIGRATION-NOTES-SPRINT4.md) for the design
decisions, trade-offs and known gaps.

## Sprint 3 — AI Business Idea Validator

Submit a structured business idea and get back a scored, sectioned report you
can read in the app or download as a branded PDF. Since Sprint 4 it is a pure
consumer of the platform above: its entire presentation layer is
`features/reports/report-definition.ts`.

### Validator & reports

- **`/validator`** — the idea form: 8 required + 3 optional fields, Zod-validated
  with inline errors
- **`/reports`** — history, with empty and loading states
- **`/reports/[id]`** — the full report: executive summary, score gauge and
  weighted breakdown, problem/market/persona, SWOT grid, revenue models, risks,
  recommendations and a next-steps timeline
- **PDF export** — branded A4 with a cover page, running header/footer, page
  numbers and a generation timestamp

### REST API

| Method | Route                         | Purpose                                     |
| ------ | ----------------------------- | ------------------------------------------- |
| GET    | `/api/ai/workflows`           | Registered workflows + configuration status |
| GET    | `/api/ai/history`             | Execution history (`?workflow=`, `?limit=`) |
| GET    | `/api/ai/history/:id`         | One run, with its input and output JSON     |
| GET    | `/api/ai/usage`               | Token, duration and cost metrics (`?days=`) |
| GET    | `/api/business-plans`         | Plans in the caller's workspace             |
| POST   | `/api/business-plans`         | Generate a plan from a brief                |
| GET    | `/api/business-plans/:id`     | Plan, sections and revision counts          |
| GET    | `/api/business-plans/:id/pdf` | Download the plan PDF                       |
| GET    | `/api/business-ideas`         | List submitted ideas                        |
| POST   | `/api/business-ideas`         | Submit + run a validation                   |
| GET    | `/api/reports`                | Report history                              |
| GET    | `/api/reports/:id`            | One report + metadata                       |
| GET    | `/api/reports/:id/pdf`        | Download the PDF                            |

All are authenticated, rate-limited, and return the standard envelope:
`{"success":false,"error":{"code","message"}}`.

### Verification scripts

```bash
npm test              # engine + report + plan + PDF (no API key, database or network needed)
```

`test:engine` drives the real Workflow Manager against a mock provider — for
**both** registered workflows — covering prompt loading, missing prompts, input
and JSON validation, repair, retries, timeouts, API failures, injection
handling, provider selection, cost estimation and rate limiting. `test:report`
and `test:plan` build each product's document model and render it to static
HTML; `test:plan` also checks the section catalog against the schema and exports
a PDF. `test:pdf` renders the validator report and asserts a valid, multi-page,
branded A4 PDF.

## Sprints 1–2

### Authentication (`app/(auth)`, `features/auth`)

- Email **registration** with verification, **login**, **password reset**, and
  **email verification** — all via Supabase Auth
- Session refresh + route protection in [`middleware.ts`](./middleware.ts)
- OTP / code-exchange handlers under `app/auth/{confirm,callback}`

### Protected dashboard (`app/(dashboard)`, `features/dashboard`)

- Responsive shell with a sidebar (desktop) / drawer (mobile), top bar, and a
  user menu with sign-out
- **Overview** with workspace stats and recent projects
- Unauthenticated visitors are redirected to `/login`; signed-in users are
  bounced away from the auth pages

### Projects CRUD (`features/projects`)

- Create, edit, and (soft-)delete projects via modal forms and Server Actions
- Owner-only access enforced by RLS; Zod-validated input

### Profile CRUD + Storage (`features/profile`)

- Edit name, company, bio, and website
- **Avatar** and **company logo** uploads to Supabase Storage (owner-scoped)

### Settings (`features/settings`)

- Change email (with confirmation) and password

## Architecture notes

- **Every REST route goes through `withApiAuth`** (`lib/api/route-handler.ts`),
  which supplies authentication, per-user rate limiting and error handling. A new
  endpoint gets them by construction rather than by remembering to repeat them.
- **Every AI product imports from `features/ai`** — the platform facade — not
  from its internals. `runWorkflow` is the only execution path, and it owns
  validation, rate limiting, prompts, retries, usage tracking and history.
- **Reads** happen in Server Components via the Supabase server client (RLS
  applies). **Mutations** run through **Server Actions** with Zod validation and
  a consistent `ActionState` result shape (`lib/forms/action-state.ts`) — the
  clean API boundary for Sprint 2. (The REST surface in `API-STANDARDS.md`
  targets the AI/reports features, which are out of scope here.)
- New dashboard/auth UI is built from Tailwind tokens and the `components/ui`
  primitives (no inline styles); the migrated marketing pages keep their
  original inline styles for pixel fidelity (see `MIGRATION-NOTES.md`).
- Database Row types in `types/database.ts` are `type` aliases (not
  interfaces) — required for `@supabase/supabase-js` to type the client.

### Scripts

| Script                   | Purpose                                    |
| ------------------------ | ------------------------------------------ |
| `npm run dev`            | Start the dev server                       |
| `npm run build`          | Production build                           |
| `npm run start`          | Serve the production build                 |
| `npm run lint`           | ESLint over the whole repo (0 warnings)    |
| `npm run format`         | Format the repo with Prettier              |
| `npm run format:check`   | Verify formatting (CI-friendly)            |
| `npm test`               | Engine + report + plan + PDF smoke tests   |
| `npm run sync:workflows` | Mirror the code registry into the database |

## Project structure

```
app/
  (marketing)/            Public marketing routes (Sprint 1)
  (auth)/                 login · register · forgot/reset-password · verify-email
  (dashboard)/            Protected: dashboard · validator · plans · reports
                          · ai/history · projects · workspace · profile · settings
  api/                    ai/{workflows,history,usage} · business-ideas
                          · business-plans · reports
  auth/                   confirm + callback route handlers
components/
  layout/site-nav.tsx     Shared marketing navbar
  ui/                     Primitives: Button, Card, Input, Textarea, Select,
                          Label, Badge, Avatar, Modal, Skeleton, SubmitButton,
                          form-message
features/
  ai/                     ← the AI Platform Core (Sprint 4)
    index.ts              Public surface a new AI product imports
    engine/               types · errors · response-validator · workflow-manager
    registry/             workflows · prompts (versioned) · catalog
    providers/            provider factory · openai
    renderer/             report engine: types · report-renderer · blocks/
    pdf/                  pdf engine: report-pdf · brand · logo
    usage/                pricing · tracker · data · usage-summary
    history/              data · run-list
    schemas/              Per-workflow Zod JSON contracts
    services/             Per-workflow orchestration
  business-ideas/         idea form + submit action
  business-plans/         sections (the catalog) · data · actions · editor UI
                          · report-definition (the plan's report model)
  workspaces/             data (+ lazy bootstrap) · roles · actions · UI
  reports/                data · report-definition (the validator's report model)
  auth/  dashboard/  projects/  profile/  settings/
lib/
  api/response.ts         Standard JSON success/error envelope
  api/route-handler.ts    withApiAuth — auth + rate limit + error handling
  rate-limit.ts           Fixed-window limiter (AI runs + REST routes)
  supabase/               client · server · middleware (session) helpers
  auth/session.ts         getUser / requireUser guards
  validations/            Zod schemas (auth, project, profile, business-idea,
                          business-plan, workspace) + shared text/field builders
  forms/action-state.ts   Shared Server Action result shape
prompts/                  Versioned prompt markdown (business-validator/v1.md)
scripts/                  Smoke tests (engine · report · pdf) + workflow sync
middleware.ts             Session refresh + protected-route gating
types/database.ts         Row types + Database schema
supabase/migrations/      SQL: tables, RLS, triggers, storage buckets
```

## Not in this sprint

Billing and collaboration are explicitly **out of scope** for Sprint 5, along
with Marketing Strategy, Competitor Analysis, the Funding Advisor and the admin
panel. The AI Platform exists so those become thin consumers of it — the
Business Plan Generator is the worked example. See `PRODUCT-ROADMAP.md` for the
sequence.

A production hardening pass over Sprints 1–5 — architecture, security,
performance, accessibility and the review that found lint was only covering half
the codebase — is written up in [`HARDENING-NOTES.md`](./HARDENING-NOTES.md).

Implementation decisions, trade-offs and known gaps are documented per sprint in
[`MIGRATION-NOTES-SPRINT5.md`](./MIGRATION-NOTES-SPRINT5.md),
[`MIGRATION-NOTES-SPRINT4.md`](./MIGRATION-NOTES-SPRINT4.md) and
[`MIGRATION-NOTES-SPRINT3.md`](./MIGRATION-NOTES-SPRINT3.md).
