-- ============================================================================
-- AIAutomix — Sprint 4: AI Platform Core
--
-- The shared persistence layer behind the AI Platform (AI-PLATFORM-SPEC.md):
--   ai_workflows       catalog of workflows registered in code
--   ai_prompt_versions audit trail of versioned prompt files
--   ai_requests        every execution (extended from Sprint 3)
--   ai_responses       the validated JSON each execution produced
--   ai_usage_logs      tokens, duration and estimated cost, per run
--
-- UUID primary keys, timestamps and Row Level Security throughout (DATABASE.md).
-- Additive and idempotent. Apply after 0002_sprint3_validator.sql, which this
-- migration extends and which creates the shared public.set_updated_at()
-- trigger function.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- ai_workflows — catalog of the workflows the platform can execute
--
-- Code (features/ai/registry/workflows.ts) is the source of truth; this table is
-- the queryable mirror used by history filters and analytics. `npm run
-- sync:workflows` upserts the registry into it.
-- ============================================================================
create table if not exists public.ai_workflows (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  label                 text not null,
  description           text,
  provider              text not null default 'openai',
  model                 text,
  active_prompt_version text not null,
  is_active             boolean not null default true,
  created_at            timestamptz not null default timezone('utc', now()),
  updated_at            timestamptz not null default timezone('utc', now())
);

comment on table public.ai_workflows is
  'Catalog of AI workflows registered in the platform registry.';

drop trigger if exists ai_workflows_set_updated_at on public.ai_workflows;
create trigger ai_workflows_set_updated_at
  before update on public.ai_workflows
  for each row execute function public.set_updated_at();

alter table public.ai_workflows enable row level security;

-- The workflow catalog is not user data — any signed-in user may read it.
-- Writes are deliberately policy-less: only the service role can mutate it.
drop policy if exists "Signed-in users can read the workflow catalog" on public.ai_workflows;
create policy "Signed-in users can read the workflow catalog"
  on public.ai_workflows for select
  to authenticated
  using (true);

-- ============================================================================
-- ai_prompt_versions — audit trail of prompt files seen by the registry
-- ============================================================================
create table if not exists public.ai_prompt_versions (
  id            uuid primary key default gen_random_uuid(),
  workflow_slug text not null
                  references public.ai_workflows (slug)
                  on update cascade on delete cascade,
  version       text not null,
  checksum      text,
  is_active     boolean not null default false,
  created_at    timestamptz not null default timezone('utc', now()),
  unique (workflow_slug, version)
);

comment on table public.ai_prompt_versions is
  'Versioned prompt files (prompts/<workflow>/<version>.md) and their checksums.';

alter table public.ai_prompt_versions enable row level security;

drop policy if exists "Signed-in users can read prompt versions" on public.ai_prompt_versions;
create policy "Signed-in users can read prompt versions"
  on public.ai_prompt_versions for select
  to authenticated
  using (true);

-- ============================================================================
-- ai_requests — extended from Sprint 3 with project, provider and input
--
-- Still append-only: there is no update or delete policy, so execution history
-- cannot be rewritten by the user it belongs to.
-- ============================================================================
alter table public.ai_requests
  add column if not exists project_id uuid references public.projects (id) on delete set null,
  add column if not exists provider   text not null default 'openai',
  add column if not exists input_json jsonb;

comment on column public.ai_requests.input_json is
  'The validated workflow input that produced this run.';

create index if not exists ai_requests_project_idx
  on public.ai_requests (project_id);
create index if not exists ai_requests_workflow_idx
  on public.ai_requests (workflow, created_at desc);

-- ============================================================================
-- ai_responses — the schema-validated output of a successful run
-- ============================================================================
create table if not exists public.ai_responses (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null references public.ai_requests (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  workflow       text not null,
  prompt_version text not null,
  model          text not null,
  output_json    jsonb not null,
  created_at     timestamptz not null default timezone('utc', now())
);

comment on table public.ai_responses is
  'Validated JSON returned by each successful AI workflow execution.';

create index if not exists ai_responses_user_idx
  on public.ai_responses (user_id, created_at desc);
create index if not exists ai_responses_request_idx
  on public.ai_responses (request_id);

alter table public.ai_responses enable row level security;

drop policy if exists "Users can view their own AI responses" on public.ai_responses;
create policy "Users can view their own AI responses"
  on public.ai_responses for select
  using (auth.uid() = user_id);

drop policy if exists "Users can log their own AI responses" on public.ai_responses;
create policy "Users can log their own AI responses"
  on public.ai_responses for insert
  with check (auth.uid() = user_id);

-- ============================================================================
-- ai_usage_logs — metrics surface for analytics and future billing
--
-- Denormalised on purpose: usage reporting must not join four tables, and the
-- numbers must stay correct even if a workflow is later renamed or retired.
-- ============================================================================
create table if not exists public.ai_usage_logs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  project_id         uuid references public.projects (id) on delete set null,
  request_id         uuid references public.ai_requests (id) on delete cascade,
  workflow           text not null,
  provider           text not null,
  model              text not null,
  prompt_version     text not null,
  status             text not null check (status in ('success', 'failed')),
  prompt_tokens      integer,
  output_tokens      integer,
  total_tokens       integer,
  duration_ms        integer,
  estimated_cost_usd numeric(12, 6),
  created_at         timestamptz not null default timezone('utc', now())
);

comment on table public.ai_usage_logs is
  'Per-execution usage metrics: tokens, duration and estimated cost.';

create index if not exists ai_usage_logs_user_idx
  on public.ai_usage_logs (user_id, created_at desc);
create index if not exists ai_usage_logs_workflow_idx
  on public.ai_usage_logs (user_id, workflow);
create index if not exists ai_usage_logs_project_idx
  on public.ai_usage_logs (project_id);

alter table public.ai_usage_logs enable row level security;

drop policy if exists "Users can view their own usage" on public.ai_usage_logs;
create policy "Users can view their own usage"
  on public.ai_usage_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can log their own usage" on public.ai_usage_logs;
create policy "Users can log their own usage"
  on public.ai_usage_logs for insert
  with check (auth.uid() = user_id);

-- ============================================================================
-- validation_reports — link a stored report back to the run that produced it
-- so AI History can reopen it (AI-HISTORY-SPEC.md).
-- ============================================================================
alter table public.validation_reports
  add column if not exists ai_request_id uuid
    references public.ai_requests (id) on delete set null;

create index if not exists validation_reports_request_idx
  on public.validation_reports (ai_request_id);

-- ============================================================================
-- Seed the catalog with the workflows registered in this release
-- ============================================================================
insert into public.ai_workflows
  (slug, label, description, provider, active_prompt_version)
values
  (
    'business-validator',
    'Business Idea Validator',
    'Scores a structured business idea and returns a sectioned validation report.',
    'openai',
    'v1'
  )
on conflict (slug) do update set
  label                 = excluded.label,
  description           = excluded.description,
  provider              = excluded.provider,
  active_prompt_version = excluded.active_prompt_version;

insert into public.ai_prompt_versions (workflow_slug, version, is_active)
values ('business-validator', 'v1', true)
on conflict (workflow_slug, version) do update set
  is_active = excluded.is_active;
