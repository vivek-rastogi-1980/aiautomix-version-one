# Sprint 3 — Migration & Implementation Notes

AI Business Idea Validator MVP. This document records what changed, the
decisions behind it, and how to verify the sprint. **No breaking changes** were
made to Sprint 1 (marketing) or Sprint 2 (auth, dashboard, projects, profile).

---

## 1. Required upgrade steps

### 1.1 Install dependencies

```bash
npm install
```

New runtime dependencies:

| Package               | Why                                               |
| --------------------- | ------------------------------------------------- |
| `openai`              | AI provider SDK (server-side only)                |
| `@react-pdf/renderer` | A4 PDF generation for report export               |
| `server-only`         | Hard build-time guard on server modules (see 4.3) |
| `tsx` (dev)           | Runs the verification scripts in `scripts/`       |

### 1.2 Apply the database migration

Run `supabase/migrations/0002_sprint3_validator.sql` against your project
(SQL Editor or `supabase db push`). It is idempotent and additive.

It creates `business_ideas`, `validation_reports`, and `ai_requests`, plus a
private `reports` storage bucket — all with UUID PKs, timestamps, and RLS.

> **Depends on `0001_sprint2_foundation.sql`** for the shared
> `public.set_updated_at()` trigger function. Apply 0001 first.

### 1.3 Add the OpenAI key

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini   # optional
```

The app degrades gracefully without it: the validator page shows a clear
"not configured" notice and the API returns `503 AI_NOT_CONFIGURED` rather
than failing obscurely.

---

## 2. Database changes

| Table                | Purpose                                           | Soft delete       |
| -------------------- | ------------------------------------------------- | ----------------- |
| `business_ideas`     | Structured idea submissions (`payload_json`)      | `deleted_at`      |
| `validation_reports` | Generated reports + provenance metadata           | `deleted_at`      |
| `ai_requests`        | Engine observability log (tokens, duration, etc.) | n/a (append-only) |

**RLS** — every table is owner-scoped on `auth.uid() = user_id`. `ai_requests`
is deliberately select/insert only: usage history must not be editable.

**Why `user_id` on `validation_reports` rather than joining through
`business_ideas`?** RLS policies that join another table run a subquery on
every row. Denormalising the owner keeps policies to a simple index-backed
equality check, which matters as report volume grows.

`business_ideas.project_id` uses `on delete set null` — deleting a project
must not destroy validation history.

---

## 3. AI Workflow Engine

Implemented per `AI-WORKFLOW-ENGINE.md`. **No feature calls an LLM directly.**

```
lib/ai/
  types.ts              Provider + workflow interfaces
  registry.ts           Workflow id -> prompt version + output schema
  prompts.ts            Loads/parses versioned markdown, builds messages
  providers/openai.ts   OpenAI implementation of AiProvider
  engine.ts             runWorkflow(): the single execution path
  rate-limit.ts         Fixed-window per-user limiter
  logger.ts             Writes ai_requests rows
  errors.ts             AiError + user-safe messages
prompts/business-validator/v1.md
features/ai/schemas/business-validator.ts    Zod JSON contract
features/ai/services/business-validator.ts   Idea -> report orchestration
```

Execution path:

```
rate limit → load prompt (md) → build messages → provider → JSON repair
          → Zod validation → (retry on failure) → persist → log
```

### Decisions

- **Retries (3 attempts, 0.6s/1.8s backoff)** apply only to _retryable_
  failures — timeouts, 429s, 5xx, and schema-validation misses. A 400-class
  provider error fails fast rather than burning quota.
- **JSON repair before parsing** strips markdown fences and trims to the
  outermost object. OpenAI JSON mode makes this rare; the engine stays
  defensive because a malformed response otherwise costs the user a full run.
- **Prompt caching** is per-process and keyed by `workflow/version`. Prompt
  files are immutable once released — new wording means a new version file.
- **The rate limiter is in-memory**, sized for a single instance. Multi-instance
  deployments need a shared store (Upstash/Redis); the call sites won't change.
- **Logging never breaks a request.** `logger.ts` swallows its own failures
  after a console warning — observability must not cost the user their report.

### Prompt-injection handling

Untrusted input is fenced inside `BEGIN/END USER INPUT` markers, and both the
developer instructions and the user message state that content inside the
markers is data, never instructions. Input is also stripped of C0/C1 control
characters before it reaches the prompt.

---

## 4. Notable implementation details

### 4.1 Server Actions _and_ REST, one service

`API-STANDARDS.md` specifies `/api/business-ideas` and `/api/reports`; the app
UI is Server-Component-first and uses Server Actions. Both call the **same**
`features/ai/services/business-validator.ts`, so validation, persistence, and
logging exist once (`CODING-STANDARDS.md`: no duplicated business logic).

Endpoints delivered:

| Method | Route                  | Notes                    |
| ------ | ---------------------- | ------------------------ |
| GET    | `/api/business-ideas`  | List caller's ideas      |
| POST   | `/api/business-ideas`  | Submit + run validation  |
| GET    | `/api/reports`         | Report history           |
| GET    | `/api/reports/:id`     | Single report + metadata |
| GET    | `/api/reports/:id/pdf` | Branded A4 PDF download  |

All use the standard envelope from `JSON-SCHEMAS.md`:
`{"success":false,"error":{"code","message"}}`.

### 4.2 Stored reports are re-validated before rendering

`app/(dashboard)/reports/[id]/page.tsx` re-parses `report_json` with the Zod
schema. A report written by an older prompt version renders a clear message
instead of crashing the page — important once `v2` prompts ship.

### 4.3 `server-only` is now a real dependency

Next aliases `server-only` internally, so it previously resolved at build time
without being installed. Installing it makes the guard genuine and lets the
verification scripts run under plain Node. Node needs the `react-server`
export condition, which is why `test:engine` passes `--conditions=react-server`.

### 4.4 PDF generation

`@react-pdf/renderer` renders in the Node runtime (`runtime = "nodejs"` on the
route). Uses built-in Helvetica so no font files are bundled — smaller output
and a portable build, per `PDF-STANDARDS.md` ("optimized file size").

Delivered: cover page, A4 (595×842pt), running header/footer, `Page X of Y`,
generation timestamp, brand colours, consistent typography.

**Known gap:** `PDF-STANDARDS.md` also asks for the company **logo** on the
cover. The current cover uses the AIAutomix wordmark rather than the raster
logo, because embedding the PNG requires either bundling the asset into the
serverless function or a network fetch at render time. Dropping in the logo is
a small change once we decide how the asset should ship. `validation_reports.pdf_url`
and the private `reports` bucket exist for a future "store the generated PDF"
step; today PDFs are generated on demand.

### 4.5 `scripts/tsconfig.json`

The root config sets `jsx: "preserve"` (Next owns that transform). Standalone
scripts run through esbuild need the runtime named, so `scripts/` extends the
root config with `jsx: "react-jsx"`.

---

## 5. Verification

```bash
npm install        # succeeds
npm run lint       # 0 errors
npx tsc --noEmit   # 0 errors
npm run build      # succeeds
npm run test       # engine + PDF smoke tests
```

Results at time of writing:

- **`npm run test:engine`** — 17/17 checks: prompt loading and interpolation,
  injection delimiting, valid JSON accepted, fenced JSON repaired, malformed
  JSON retried then succeeded, out-of-range score rejected
  (`AI_VALIDATION_FAILED`), unknown workflow rejected, rate limit enforced.
- **`npm run test:pdf`** — renders a 4-page, 13 KB PDF with a verified `%PDF-`
  header and A4 MediaBox.
- **Route checks** — `/validator` and `/reports` redirect unauthenticated users
  to `/login`; `/api/reports` and `/api/business-ideas` return `401` with the
  standard error envelope; marketing `/` still returns `200`.

These smoke tests use a mock provider and need no OpenAI key or network access,
so they are safe to run in CI.

---

## 6. Explicitly out of scope (per `SPRINT-03.md`)

Billing, credits, admin panel, multi-agent orchestration, external search
providers, business plan generator, marketing strategy generator. None are
present in the codebase.
