-- ============================================================================
-- Migration 0009 — Sprint 8: Market Research Foundation
--
-- Workspace-scoped research domain: requests, runs, per-stage attempts,
-- sources, evidence and structured results — plus the centrally configured
-- depth/cost policy the stage engine charges against.
--
-- ---------------------------------------------------------------------------
-- THE DECISION THIS SCHEMA ENCODES: a citation cannot be fabricated
-- ---------------------------------------------------------------------------
-- `research_evidence.source_id` is NOT NULL and references `research_sources`.
-- Sources are written only by the retrieval stages, from what a web search
-- actually returned. The consequence is structural rather than procedural: a
-- model that invents "according to McKinsey (2024)" has no row to point at, so
-- the insert fails. Evidence integrity stops depending on the model behaving.
--
-- ---------------------------------------------------------------------------
-- AND: a run can always be resumed
-- ---------------------------------------------------------------------------
-- Execution is stage-at-a-time over separate HTTP requests, so the database is
-- the only thing that knows where a run is. `research_runs.current_stage` plus
-- one row per (run, stage, attempt) in `research_run_stages` means a closed
-- browser, a timeout or a crash all leave a resumable, auditable position.
--
-- Idempotent. Additive only. Does not modify any applied migration.
-- ============================================================================

-- ============================================================================
-- 1. Vocabulary
--
-- Kept as CHECK constraints rather than Postgres enums: adding a stage or a
-- depth later is an ALTER on a constraint, not a type migration that locks
-- every dependent table.
-- ============================================================================

-- Stages, in execution order. 'discovery' and 'collection' are the only
-- network-touching stages; everything after reasons over persisted evidence.
--   planning → discovery → collection → evidence → analysis → synthesis → report

-- ============================================================================
-- 2. Depth and cost policy
--
-- Centrally configured, per RESEARCH-COST-CONTROL-SPEC.md ("Exact limits must
-- be centrally configured"). Prices and limits change with a SQL update rather
-- than a deploy — the same pattern `plans` already uses.
-- ============================================================================

create table if not exists public.research_depths (
  id              text primary key check (id in ('basic', 'standard', 'deep')),
  label           text not null,
  description     text not null,
  -- Retrieval budget. These are the real cost drivers.
  max_sources     integer not null check (max_sources > 0),
  max_queries     integer not null check (max_queries > 0),
  -- Guardrails per stage, enforced by the stage engine.
  stage_timeout_ms integer not null default 90000 check (stage_timeout_ms between 10000 and 300000),
  max_attempts    integer not null default 3 check (max_attempts between 1 and 10),
  sort_order      integer not null default 0,
  is_active       boolean not null default true
);

comment on table public.research_depths is
  'Research budget tiers. The source and query caps are the primary cost control.';

create table if not exists public.research_stage_costs (
  depth   text not null references public.research_depths (id) on delete cascade,
  stage   text not null check (stage in (
    'planning', 'discovery', 'collection', 'evidence',
    'analysis', 'synthesis', 'report'
  )),
  credits integer not null check (credits >= 0),
  primary key (depth, stage)
);

comment on table public.research_stage_costs is
  'Credits charged when a stage begins. Mirrored (and asserted) in features/research/cost.ts.';

insert into public.research_depths
  (id, label, description, max_sources, max_queries, stage_timeout_ms, max_attempts, sort_order)
values
  ('basic',    'Basic',    'A focused scan of the market with a small, high-signal source set.',           8,  3, 60000,  3, 1),
  ('standard', 'Standard', 'Broader research with stronger evidence coverage across each section.',       20,  6, 90000,  3, 2),
  ('deep',     'Deep',     'The largest permitted research budget and the widest source set.',            40, 12, 120000, 3, 3)
on conflict (id) do nothing;

-- Costs rise with retrieval, not with reasoning: discovery and collection scale
-- with the source budget, while planning and report are near-flat.
insert into public.research_stage_costs (depth, stage, credits) values
  ('basic','planning',    5),  ('basic','discovery',   10), ('basic','collection', 10),
  ('basic','evidence',    10), ('basic','analysis',    15), ('basic','synthesis',   5),
  ('basic','report',       5),

  ('standard','planning',  8), ('standard','discovery', 25), ('standard','collection', 25),
  ('standard','evidence',  20), ('standard','analysis',  25), ('standard','synthesis',  10),
  ('standard','report',    12),

  ('deep','planning',     10), ('deep','discovery',     60), ('deep','collection',    60),
  ('deep','evidence',     45), ('deep','analysis',      45), ('deep','synthesis',     20),
  ('deep','report',       20)
on conflict (depth, stage) do nothing;

-- ============================================================================
-- 3. Requests
-- ============================================================================

create table if not exists public.research_requests (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,

  -- A request may be seeded from an idea or a plan, or be a manual brief.
  -- `set null` rather than cascade: deleting the source idea must not destroy
  -- research that has already been paid for and cited.
  business_idea_id  uuid references public.business_ideas (id) on delete set null,
  business_plan_id  uuid references public.business_plans (id) on delete set null,

  title             text not null check (length(btrim(title)) between 1 and 200),
  scope             text check (length(scope) <= 4000),
  industry          text check (length(industry) <= 200),
  geography         text check (length(geography) <= 200),
  target_customer   text check (length(target_customer) <= 1000),
  business_model    text check (length(business_model) <= 1000),
  -- Free-form research questions, capped in the application layer too.
  questions         jsonb not null default '[]'::jsonb,

  depth             text not null default 'standard'
                      references public.research_depths (id),

  status            text not null default 'draft'
                      check (status in ('draft', 'running', 'completed', 'failed', 'cancelled')),

  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

comment on table public.research_requests is
  'A market research brief. Workspace-scoped; the workspace is the security boundary.';

drop trigger if exists research_requests_set_updated_at on public.research_requests;
create trigger research_requests_set_updated_at
  before update on public.research_requests
  for each row execute function public.set_updated_at();

create index if not exists research_requests_workspace_idx
  on public.research_requests (workspace_id, created_at desc);
create index if not exists research_requests_user_idx
  on public.research_requests (user_id, created_at desc);
create index if not exists research_requests_status_idx
  on public.research_requests (status, created_at desc);
create index if not exists research_requests_idea_idx
  on public.research_requests (business_idea_id) where business_idea_id is not null;
create index if not exists research_requests_plan_idx
  on public.research_requests (business_plan_id) where business_plan_id is not null;

-- ============================================================================
-- 4. Runs and stage attempts
--
-- One run per execution of a request. Re-running a request creates a NEW run
-- rather than mutating the old one, so a user can compare and an auditor can
-- see what was charged for each.
-- ============================================================================

create table if not exists public.research_runs (
  id                  uuid primary key default gen_random_uuid(),
  research_request_id uuid not null references public.research_requests (id) on delete cascade,
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,

  status              text not null default 'pending'
                        check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- The resume point. NULL once the run completes.
  current_stage       text check (current_stage in (
    'planning', 'discovery', 'collection', 'evidence',
    'analysis', 'synthesis', 'report'
  )),

  depth               text not null references public.research_depths (id),

  -- Running totals, so the UI and admin never have to aggregate stage rows.
  credits_charged     integer not null default 0 check (credits_charged >= 0),
  credits_refunded    integer not null default 0 check (credits_refunded >= 0),
  total_tokens        integer not null default 0 check (total_tokens >= 0),
  estimated_cost_usd  numeric(12, 6) not null default 0,
  source_count        integer not null default 0 check (source_count >= 0),
  evidence_count      integer not null default 0 check (evidence_count >= 0),

  error               text,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

drop trigger if exists research_runs_set_updated_at on public.research_runs;
create trigger research_runs_set_updated_at
  before update on public.research_runs
  for each row execute function public.set_updated_at();

create index if not exists research_runs_request_idx
  on public.research_runs (research_request_id, created_at desc);
create index if not exists research_runs_workspace_idx
  on public.research_runs (workspace_id, created_at desc);
create index if not exists research_runs_status_idx
  on public.research_runs (status, created_at desc);

/**
 * One row per attempt at a stage.
 *
 * The unique key is (run, stage, attempt) rather than (run, stage): a retry is
 * a new attempt with its own credit charge and its own error, so the ledger and
 * the stage history agree about what was paid for and why.
 */
create table if not exists public.research_run_stages (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references public.research_runs (id) on delete cascade,
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,

  stage             text not null check (stage in (
    'planning', 'discovery', 'collection', 'evidence',
    'analysis', 'synthesis', 'report'
  )),
  attempt           integer not null default 1 check (attempt >= 1),

  status            text not null default 'running'
                      check (status in ('running', 'succeeded', 'failed', 'skipped')),

  -- Links this attempt to the AI usage row the engine wrote, so cost is
  -- traceable from the stage rather than only from the usage log.
  ai_usage_log_id   uuid references public.ai_usage_logs (id) on delete set null,

  credits_charged   integer not null default 0 check (credits_charged >= 0),
  credits_refunded  integer not null default 0 check (credits_refunded >= 0),
  prompt_tokens     integer,
  output_tokens     integer,
  total_tokens      integer,
  duration_ms       integer,

  error_code        text,
  error_message     text,

  started_at        timestamptz not null default timezone('utc', now()),
  completed_at      timestamptz,

  unique (run_id, stage, attempt)
);

create index if not exists research_run_stages_run_idx
  on public.research_run_stages (run_id, started_at);
create index if not exists research_run_stages_status_idx
  on public.research_run_stages (status, started_at desc);
create index if not exists research_run_stages_workspace_idx
  on public.research_run_stages (workspace_id);

-- ============================================================================
-- 5. Sources
--
-- Written ONLY by the retrieval stages, from what a search actually returned.
-- Nothing else in the system inserts here.
-- ============================================================================

create table if not exists public.research_sources (
  id                  uuid primary key default gen_random_uuid(),
  research_request_id uuid not null references public.research_requests (id) on delete cascade,
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  run_id              uuid references public.research_runs (id) on delete set null,

  url                 text not null check (url ~* '^https?://'),
  -- Normalised for deduplication: scheme/host lowercased, tracking params and
  -- fragments stripped. Two results pointing at the same page collapse to one.
  canonical_url       text not null,
  title               text,
  publisher           text,
  source_type         text not null default 'web'
                        check (source_type in (
                          'web', 'news', 'report', 'government', 'academic',
                          'industry', 'company', 'statistics', 'other'
                        )),

  -- Nullable on purpose: RESEARCH-TEST-CASES.md requires missing publication
  -- dates to be supported rather than invented.
  published_at        timestamptz,
  retrieved_at        timestamptz not null default timezone('utc', now()),

  status              text not null default 'retrieved'
                        check (status in ('discovered', 'retrieved', 'failed', 'rejected', 'duplicate')),

  -- Retrieval metadata (search query, rank, http status). Never page content:
  -- storing raw untrusted HTML invites it being re-fed into a prompt later.
  metadata            jsonb not null default '{}'::jsonb,

  created_at          timestamptz not null default timezone('utc', now()),

  -- Deduplication is a constraint, not a convention.
  unique (research_request_id, canonical_url)
);

comment on column public.research_sources.canonical_url is
  'Normalised URL used for deduplication. Unique per request.';
comment on column public.research_sources.metadata is
  'Retrieval metadata only. Never raw page content — see the injection controls in docs/SPRINT-08-ARCHITECTURE.md.';

create index if not exists research_sources_request_idx
  on public.research_sources (research_request_id, created_at);
create index if not exists research_sources_workspace_idx
  on public.research_sources (workspace_id);
create index if not exists research_sources_status_idx
  on public.research_sources (research_request_id, status);

-- ============================================================================
-- 6. Evidence
--
-- `source_id` is NOT NULL. This is the fabrication control: a claim must point
-- at a row that a retrieval stage created, or it cannot be stored at all.
-- ============================================================================

create table if not exists public.research_evidence (
  id                  uuid primary key default gen_random_uuid(),
  research_request_id uuid not null references public.research_requests (id) on delete cascade,
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  source_id           uuid not null references public.research_sources (id) on delete cascade,

  section_key         text not null,
  claim               text not null check (length(btrim(claim)) > 0),
  -- What in the source supports the claim: a quotation or a locator. Not a
  -- summary — the point is that a reader can go and check.
  evidence_reference  text,

  confidence          text not null default 'medium'
                        check (confidence in ('low', 'medium', 'high')),

  -- Set when this evidence contradicts other evidence for the same section.
  -- RESEARCH-EVIDENCE-SPEC.md: "Conflicting evidence must be flagged."
  is_contradictory    boolean not null default false,
  contradicts_id      uuid references public.research_evidence (id) on delete set null,

  created_at          timestamptz not null default timezone('utc', now())
);

create index if not exists research_evidence_request_idx
  on public.research_evidence (research_request_id, section_key);
create index if not exists research_evidence_source_idx
  on public.research_evidence (source_id);
create index if not exists research_evidence_workspace_idx
  on public.research_evidence (workspace_id);
create index if not exists research_evidence_contradictory_idx
  on public.research_evidence (research_request_id) where is_contradictory;

-- ============================================================================
-- 7. Structured results
--
-- One row per report section. Structure first, rendering second: the UI and the
-- PDF both read these rows, so they cannot disagree, and neither is parsed out
-- of a generated blob.
-- ============================================================================

create table if not exists public.research_results (
  id                  uuid primary key default gen_random_uuid(),
  research_request_id uuid not null references public.research_requests (id) on delete cascade,
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  run_id              uuid references public.research_runs (id) on delete set null,

  section_key         text not null,
  structured_content  jsonb not null,

  confidence          text not null default 'medium'
                        check (confidence in ('low', 'medium', 'high')),

  -- 'insufficient_evidence' is a first-class outcome. MARKET-RESEARCH-SPEC.md:
  -- a claim without evidence must be qualified, not presented as fact.
  status              text not null default 'complete'
                        check (status in ('complete', 'partial', 'insufficient_evidence', 'failed')),

  -- Re-running a stage supersedes the previous version rather than deleting it.
  version             integer not null default 1 check (version >= 1),
  is_current          boolean not null default true,

  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

drop trigger if exists research_results_set_updated_at on public.research_results;
create trigger research_results_set_updated_at
  before update on public.research_results
  for each row execute function public.set_updated_at();

-- Exactly one current version per section per request.
create unique index if not exists research_results_current_uidx
  on public.research_results (research_request_id, section_key) where is_current;
create index if not exists research_results_request_idx
  on public.research_results (research_request_id, section_key);
create index if not exists research_results_workspace_idx
  on public.research_results (workspace_id);

-- ============================================================================
-- 8. RLS
--
-- Workspace membership for read; NO client write policies. Every write happens
-- through server-side code holding the user's session, via security definer
-- functions added in Phase 3 — the same shape as credits in migration 0007 and
-- the admin platform in 0008.
--
-- Admin read access is additive and consults `admin_has(...)`, so a non-admin's
-- workspace isolation is unchanged.
-- ============================================================================

alter table public.research_depths      enable row level security;
alter table public.research_stage_costs enable row level security;
alter table public.research_requests    enable row level security;
alter table public.research_runs        enable row level security;
alter table public.research_run_stages  enable row level security;
alter table public.research_sources     enable row level security;
alter table public.research_evidence    enable row level security;
alter table public.research_results     enable row level security;

-- Depth catalog and costs are readable by any signed-in user: the estimator on
-- /research/new needs them, and they contain no customer data.
drop policy if exists "Anyone signed in can read research depths" on public.research_depths;
create policy "Anyone signed in can read research depths"
  on public.research_depths for select
  to authenticated
  using (is_active);

drop policy if exists "Anyone signed in can read stage costs" on public.research_stage_costs;
create policy "Anyone signed in can read stage costs"
  on public.research_stage_costs for select
  to authenticated
  using (true);

drop policy if exists "Members read their workspace research requests" on public.research_requests;
create policy "Members read their workspace research requests"
  on public.research_requests for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace research runs" on public.research_runs;
create policy "Members read their workspace research runs"
  on public.research_runs for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace research stages" on public.research_run_stages;
create policy "Members read their workspace research stages"
  on public.research_run_stages for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace research sources" on public.research_sources;
create policy "Members read their workspace research sources"
  on public.research_sources for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace research evidence" on public.research_evidence;
create policy "Members read their workspace research evidence"
  on public.research_evidence for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace research results" on public.research_results;
create policy "Members read their workspace research results"
  on public.research_results for select
  using (public.is_workspace_member(workspace_id));

-- --- Admin read access (migration 0008 RBAC) --------------------------------

drop policy if exists "Admins read all research requests" on public.research_requests;
create policy "Admins read all research requests"
  on public.research_requests for select
  using (public.admin_has('ai.read'));

drop policy if exists "Admins read all research runs" on public.research_runs;
create policy "Admins read all research runs"
  on public.research_runs for select
  using (public.admin_has('ai.read'));

drop policy if exists "Admins read all research stages" on public.research_run_stages;
create policy "Admins read all research stages"
  on public.research_run_stages for select
  using (public.admin_has('ai.read'));

drop policy if exists "Admins read all research sources" on public.research_sources;
create policy "Admins read all research sources"
  on public.research_sources for select
  using (public.admin_has('ai.read'));

drop policy if exists "Admins read all research evidence" on public.research_evidence;
create policy "Admins read all research evidence"
  on public.research_evidence for select
  using (public.admin_has('ai.read'));

drop policy if exists "Admins read all research results" on public.research_results;
create policy "Admins read all research results"
  on public.research_results for select
  using (public.admin_has('ai.read'));

-- ============================================================================
-- 9. Cost estimation
--
-- The estimator on /research/new must show a real number, not a guess. Summing
-- in SQL keeps the figure and the charge derived from the same rows.
-- ============================================================================

create or replace function public.research_estimate_credits(p_depth text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(credits), 0)::integer
  from public.research_stage_costs
  where depth = p_depth;
$$;

comment on function public.research_estimate_credits(text) is
  'Total credits a full run at this depth will cost, summed from the same rows the stage engine charges against.';

grant execute on function public.research_estimate_credits(text) to authenticated;
