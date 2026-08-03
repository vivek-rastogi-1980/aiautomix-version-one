# Sprint 4 — Migration & Implementation Notes

The reusable **AI Platform Core** that every future AI product will run on.
This document records what changed, the decisions behind it, and how to verify
the sprint.

**No breaking changes.** Sprint 1 (marketing), Sprint 2 (auth, dashboard,
projects, profile) and Sprint 3 (Business Idea Validator) all behave exactly as
before. Sprint 3's validator was _rewired_ onto the platform rather than
rewritten — it is now a consumer, not an owner, of AI logic.

---

## 1. Required upgrade steps

### 1.1 Dependencies

**None added.** The platform is built on what Sprint 3 already installed.

```bash
npm install
```

### 1.2 Apply the database migration

Run `supabase/migrations/0003_sprint4_ai_platform.sql` (SQL Editor or
`supabase db push`). It is additive and idempotent.

> **Depends on `0002_sprint3_validator.sql`** — it extends `ai_requests` and
> `validation_reports`, and reuses the `public.set_updated_at()` trigger created
> in `0001`. Apply migrations in order.

### 1.3 Sync the workflow catalog

```bash
npm run sync:workflows
```

Upserts the code registry into `ai_workflows` / `ai_prompt_versions`. Needs
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the script loads
`.env.local` when present. The migration seeds the same rows, so this is only
required after adding a workflow or releasing a new prompt version.

### 1.4 Environment

| Variable         | Purpose                                            |
| ---------------- | -------------------------------------------------- |
| `OPENAI_API_KEY` | Required to execute any workflow                   |
| `OPENAI_MODEL`   | Optional model override (`gpt-4o-mini`)            |
| `AI_PROVIDER`    | **New.** Default provider id; defaults to `openai` |

Without credentials the app still builds and runs: the validator page shows a
"not configured" notice and the API returns `503 AI_NOT_CONFIGURED`.

---

## 2. Database changes

| Table                | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| `ai_workflows`       | Catalog of workflows registered in code                  |
| `ai_prompt_versions` | Prompt files and their checksums                         |
| `ai_requests`        | Every execution (extended with project, provider, input) |
| `ai_responses`       | The validated JSON each successful run produced          |
| `ai_usage_logs`      | Tokens, duration and estimated cost, per run             |

`validation_reports` gains `ai_request_id`, linking a stored report back to the
run that produced it so AI History can reopen it.

**RLS.** User-owned tables (`ai_requests`, `ai_responses`, `ai_usage_logs`) are
scoped on `auth.uid() = user_id` and carry **select + insert policies only** —
no update, no delete. Execution history and usage must not be editable by the
user it bills. The catalog tables (`ai_workflows`, `ai_prompt_versions`) are
readable by any authenticated user and have **no write policies at all**, so
only the service role can change them.

`ai_usage_logs` is deliberately denormalised. Usage reporting should not join
four tables, and the numbers must stay correct even if a workflow is later
renamed or retired.

---

## 3. The AI Platform

```
features/ai/
  index.ts                    Public surface — what a new AI product imports
  engine/
    types.ts                  Provider, workflow and run contracts
    errors.ts                 AiError + user-safe copy + HTTP status mapping
    response-validator.ts     JSON repair, output validation, input validation
    workflow-manager.ts       The single execution path
  registry/
    workflows.ts              Workflow Registry — the composition root
    prompts.ts                Prompt Registry — versioned markdown + checksums
    catalog.ts                DB-backed catalog reads
  providers/
    index.ts                  Provider factory + capability reporting
    openai.ts                 OpenAI implementation
  usage/
    pricing.ts                Model pricing + cost estimation
    tracker.ts                Writes request / response / usage rows
    data.ts                   Aggregated metrics
    usage-summary.tsx         Metrics UI
  history/
    data.ts                   Execution history reads
    run-list.tsx              History UI
  renderer/
    types.ts                  ReportDocumentModel — the report contract
    report-renderer.tsx       HTML Report Engine
    blocks/                   Header · Score · Cards · SWOT · Ranked · Timeline · Footer
    tone.ts  icons.ts         Semantic colour and icon vocabularies
  pdf/
    report-pdf.tsx            PDF Engine (same model, A4 output)
    brand.ts  logo.ts         Print palette and embedded brand mark
  schemas/                    Per-workflow JSON contracts
  services/                   Per-workflow orchestration
```

Pipeline (WORKFLOW-MANAGER-SPEC.md):

```
input → validation → prompt → provider → JSON validation → save → report → PDF
```

A new AI product supplies four things — an input schema, a prompt file, an
output schema, and a report definition — and gets execution, retries, history,
usage tracking, HTML rendering and PDF export for free.

---

## 4. Decisions

### 4.1 The engine moved from `lib/ai` to `features/ai`

`SPRINT-04.md` specifies the `features/ai/{engine,providers,registry,renderer,
schemas,history,usage,pdf}` layout, so the Sprint 3 engine was relocated rather
than duplicated. Every import was updated; nothing was left behind.

One thing did **not** move with it: the fixed-window rate limiter now lives at
`lib/rate-limit.ts`. It is generic infrastructure used by the plain REST
endpoints as well as by AI runs, and `lib/api/response.ts` must not import from
`features/`. Keeping it in `lib/` preserves the layering.

### 4.2 One document model renders both HTML and PDF

Sprint 3's report existed twice: once in `report-view.tsx` and again in
`report-document.tsx`. Adding a section meant editing both, and the two could
silently drift.

A workflow now describes its report **once** as a `ReportDocumentModel` — plain,
serialisable data with no React nodes, no icon components and no CSS classes.
`renderer/report-renderer.tsx` renders it as HTML and `pdf/report-pdf.tsx`
renders it as A4. The business-validator's entire presentation layer is
`features/reports/report-definition.ts`.

Colour is expressed as a semantic _tone_ (`positive` / `caution` / `negative` /
`neutral`) that each renderer resolves into its own palette, so a tone means the
same thing on screen and on paper.

### 4.3 The PDF flows instead of being hand-paginated

Sprint 3 split content across three fixed `<Page>` elements. That only works for
one known report shape. The PDF engine now puts all sections in a single flowing
page and lets `@react-pdf/renderer` paginate, so a report with three sections and
one with thirty both lay out correctly.

### 4.4 The logo is embedded, closing the Sprint 3 gap

`PDF-STANDARDS.md` and `PDF-ENGINE-SPEC.md` both require the company logo;
Sprint 3 shipped a wordmark instead and documented it as a known gap.

The mark now appears on the cover and in the running header. It is stored as
base64 in `features/ai/pdf/logo.ts` rather than read from `public/` at render
time: files in `public/` are served by the CDN and are **not** reliably present
on a serverless function's filesystem, so a runtime read would work locally and
silently drop the logo in production.

The source asset is 419 KB, which would have made every PDF ~33x larger. It was
box-downscaled (premultiplied alpha, `node:zlib` only — no image dependency
added) to 180px wide / 23.7 KB, about 240 DPI at the 54pt cover size. Generated
PDFs are **41 KB**, up from 13 KB.

### 4.5 Providers are declared before they are implemented

`MODEL-PROVIDER-SPEC.md` asks for OpenAI now and Anthropic / Gemini / Azure
OpenAI later. `providers/index.ts` declares all four; the three future entries
have no factory, so `createProvider("anthropic")` throws a typed
`AI_PROVIDER_UNSUPPORTED` rather than failing obscurely or pretending to work.
Implementing one means writing an `AiProvider` and adding a factory to that
table — no workflow, service, route or component changes.

### 4.6 History is written once, at the end of the run

The tables are append-only by policy, so the manager writes a single
`ai_requests` row when the run finishes, then the response and usage rows against
its id. The alternative — insert `pending` first, update at the end — would have
required an update policy on execution history, which is exactly what must not
exist.

The cost: a run whose process dies mid-flight is not recorded. That is the right
trade for an audit log.

Tracking never breaks a request. Every failure in `usage/tracker.ts` is swallowed
after a console warning, and the workflow still returns the user's result. The
smoke tests demonstrate this — they run with no database configured, log the
warning, and pass.

### 4.7 Cost is an estimate, and says so

`usage/pricing.ts` holds USD-per-million-token rates, matched by longest prefix
so dated model ids (`gpt-4o-mini-2024-07-18`) resolve correctly. Unknown models
record `null` rather than a wrong number. The estimate is always stored
_alongside_ the raw token counts that produced it, so it can be recomputed when
prices change. It is a reporting aid, never a billing source of truth.

### 4.8 Code is the registry; the database is its mirror

`features/ai/registry/workflows.ts` is what the Workflow Manager actually
executes. `ai_workflows` exists so analytics and history filters can join on
workflow metadata in SQL. `npm run sync:workflows` keeps them in step, and
catalog reads fall back to the code registry, so a deployment that has not run
the sync still renders a correct catalog instead of an empty list.

### 4.9 Input is validated before the rate limiter charges for it

The manager validates input against the workflow's schema first, so a malformed
payload never consumes an AI-run budget and never reaches a provider. Abuse is
still bounded — the REST layer applies its own per-route limit before the
manager is reached.

Callers still parse with the same schema before calling the service, because the
form needs field-level errors. The double parse is cheap and keeps the platform's
guarantee independent of its callers.

---

## 5. REST API

| Method | Route                 | Purpose                                     |
| ------ | --------------------- | ------------------------------------------- |
| GET    | `/api/ai/workflows`   | Registered workflows + configuration status |
| GET    | `/api/ai/history`     | Execution history (`?workflow=`, `?limit=`) |
| GET    | `/api/ai/history/:id` | One run, with its input and output JSON     |
| GET    | `/api/ai/usage`       | Token, duration and cost metrics (`?days=`) |

Sprint 3's `/api/business-ideas` and `/api/reports*` endpoints are unchanged,
except that AI failures now map to HTTP status through `AiError.status` so every
route responds consistently.

`/ai/history` is a new protected dashboard page showing usage metrics and the
full execution log, with a link back to the report each run produced.

---

## 6. Verification

```bash
npx tsc --noEmit   # 0 errors
npm run lint       # 0 errors
npm run build      # succeeds
npm test           # engine + report + PDF
```

Results at time of writing:

- **`npm run test:engine`** — 30/30. Prompt loading, checksums, **missing
  prompt**, placeholder interpolation, injection delimiting, end-to-end
  execution, metadata capture, **prompt-injection input still schema-validated**,
  fenced-JSON repair, **invalid JSON** retried, out-of-range score rejected,
  **invalid input** rejected without reaching the provider, **timeout** retried,
  non-retryable **API failure** failing fast without burning attempts, unknown
  workflow, unimplemented provider, cost estimation, **rate limiting**.
- **`npm run test:report`** — 20/20. Document model shape, section uniqueness,
  navigation coverage, then static HTML rendering asserting the title, summary,
  score, SWOT, ranked items, mitigations, timeline, metric weights, disclaimer,
  section anchors and accessible score labelling.
- **`npm run test:pdf`** — 6/6. 4-page A4 PDF, `%PDF-` header, embedded logo,
  41 KB.
- **Live route checks** against `npm run start`: `/` returns 200;
  `/validator`, `/reports` and `/ai/history` redirect unauthenticated users to
  `/login`; `/api/ai/history`, `/api/ai/history/:id`, `/api/ai/usage`,
  `/api/ai/workflows`, `/api/reports`, `/api/business-ideas` and
  `/api/reports/:id/pdf` all return `401` with the standard error envelope.
  This is the "Unauthorized access" case from `AI-PLATFORM-TEST-CASES.md`.

The smoke tests use a mock provider and need no OpenAI key, no database and no
network, so they are safe to run in CI. `/ai` was added to the middleware's
protected prefixes so the new page redirects with a `redirectTo` like the rest.

---

## 7. Known gaps

1. **The platform has never called a real model.** `.env.local` still has no
   `OPENAI_API_KEY`, so every test runs against a mock provider. Prompt quality,
   real latency and real token cost remain unmeasured.
2. **Migration `0003` has not been applied to a live database.** It is written to
   be idempotent and additive, but it has not been executed here.
3. **No authenticated end-to-end test.** Everything verified at runtime is the
   unauthenticated boundary. The full submit → validate → persist → history →
   render → PDF path against a live session is still unexercised.
4. **The PDF was not visually inspected** — no PDF renderer was available in this
   environment. Its structure (page count, A4 media box, embedded image, byte
   size) is asserted programmatically.
5. **Anthropic, Gemini and Azure OpenAI are declared, not implemented.** This is
   the specified scope ("ready for"), not an oversight.
6. **Usage aggregation runs in application code** over a trailing window capped
   at 1000 rows. The upgrade is a Postgres view or materialised rollup once a
   single user's log volume makes the scan expensive.
7. **The rate limiter is still in-memory**, sized for one instance. Multi-instance
   deployments need a shared store; the call sites will not change.
8. **`ai_responses` stores validated output only.** Raw provider text is not
   retained, so a response that failed validation cannot be inspected after the
   fact — only its error code and message in `ai_requests`.
9. **`validation_reports.pdf_url`** and the private `reports` bucket still exist
   unused; PDFs are generated on demand.

---

## 8. Explicitly out of scope (per `SPRINT-04.md`)

Business Plan Generator, Marketing Strategy, Competitor Analysis, Funding
Advisor, Billing and the Admin Panel. None are present in the codebase. The
platform exists so they can be built as thin consumers.
