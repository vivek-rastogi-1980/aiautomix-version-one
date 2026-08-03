-- ============================================================================
-- AIAutomix — Sprint 3: AI Business Idea Validator
--
-- business_ideas + validation_reports, plus ai_requests for AI Workflow Engine
-- observability (prompt version, model, duration, token usage).
--
-- UUID primary keys, created_at/updated_at, Row Level Security, soft delete
-- where appropriate — see DATABASE.md. Apply after 0001_sprint2_foundation.sql.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- business_ideas — a structured idea submission, owned via its project
-- ============================================================================
create table if not exists public.business_ideas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  project_id   uuid references public.projects (id) on delete set null,
  title        text not null,
  payload_json jsonb not null,
  status       text not null default 'draft'
                 check (status in ('draft', 'processing', 'completed', 'failed')),
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now()),
  deleted_at   timestamptz
);

comment on table public.business_ideas is
  'Structured business idea submissions fed to the AI Business Validator.';

create index if not exists business_ideas_user_idx
  on public.business_ideas (user_id, created_at desc)
  where deleted_at is null;
create index if not exists business_ideas_project_idx
  on public.business_ideas (project_id);

drop trigger if exists business_ideas_set_updated_at on public.business_ideas;
create trigger business_ideas_set_updated_at
  before update on public.business_ideas
  for each row execute function public.set_updated_at();

alter table public.business_ideas enable row level security;

drop policy if exists "Users can view their own business ideas" on public.business_ideas;
create policy "Users can view their own business ideas"
  on public.business_ideas for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own business ideas" on public.business_ideas;
create policy "Users can create their own business ideas"
  on public.business_ideas for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own business ideas" on public.business_ideas;
create policy "Users can update their own business ideas"
  on public.business_ideas for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own business ideas" on public.business_ideas;
create policy "Users can delete their own business ideas"
  on public.business_ideas for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- validation_reports — the AI-generated report for a business idea
-- ============================================================================
create table if not exists public.validation_reports (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  business_idea_id uuid not null references public.business_ideas (id) on delete cascade,
  score            integer not null check (score between 0 and 100),
  report_json      jsonb not null,
  pdf_url          text,
  workflow         text not null default 'business-validator',
  prompt_version   text not null,
  model            text not null,
  duration_ms      integer,
  tokens_used      integer,
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now()),
  deleted_at       timestamptz
);

comment on table public.validation_reports is
  'AI-generated validation reports, with the prompt/model metadata that produced them.';

create index if not exists validation_reports_user_idx
  on public.validation_reports (user_id, created_at desc)
  where deleted_at is null;
create index if not exists validation_reports_idea_idx
  on public.validation_reports (business_idea_id);

drop trigger if exists validation_reports_set_updated_at on public.validation_reports;
create trigger validation_reports_set_updated_at
  before update on public.validation_reports
  for each row execute function public.set_updated_at();

alter table public.validation_reports enable row level security;

drop policy if exists "Users can view their own reports" on public.validation_reports;
create policy "Users can view their own reports"
  on public.validation_reports for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own reports" on public.validation_reports;
create policy "Users can create their own reports"
  on public.validation_reports for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own reports" on public.validation_reports;
create policy "Users can update their own reports"
  on public.validation_reports for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own reports" on public.validation_reports;
create policy "Users can delete their own reports"
  on public.validation_reports for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- ai_requests — AI Workflow Engine observability log
-- (workflow, model, prompt version, tokens, duration, success/failure)
-- ============================================================================
create table if not exists public.ai_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  workflow       text not null,
  prompt_version text not null,
  model          text not null,
  status         text not null check (status in ('success', 'failed')),
  duration_ms    integer,
  prompt_tokens  integer,
  output_tokens  integer,
  total_tokens   integer,
  attempts       integer not null default 1,
  error_code     text,
  error_message  text,
  created_at     timestamptz not null default timezone('utc', now())
);

comment on table public.ai_requests is
  'Observability log for every AI Workflow Engine execution.';

create index if not exists ai_requests_user_idx
  on public.ai_requests (user_id, created_at desc);

alter table public.ai_requests enable row level security;

-- Users may read their own usage; inserts happen server-side under the user's
-- session, so an owner-scoped insert policy is sufficient.
drop policy if exists "Users can view their own AI requests" on public.ai_requests;
create policy "Users can view their own AI requests"
  on public.ai_requests for select
  using (auth.uid() = user_id);

drop policy if exists "Users can log their own AI requests" on public.ai_requests;
create policy "Users can log their own AI requests"
  on public.ai_requests for insert
  with check (auth.uid() = user_id);

-- ============================================================================
-- Storage — generated report PDFs (private; served via signed URLs)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

drop policy if exists "Users manage their own report files" on storage.objects;
create policy "Users manage their own report files"
  on storage.objects for all
  using (
    bucket_id = 'reports'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'reports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
