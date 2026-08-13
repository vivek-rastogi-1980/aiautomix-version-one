-- ============================================================================
-- Phase 7 — Competitor Intelligence
--
-- The schema deliberately mirrors the Market Research foundation (migrations
-- 0009/0010) rather than reusing its tables. Reuse was considered and rejected:
-- `research_sources` and `research_evidence` are keyed to a research request
-- and their RLS, their unique constraints and their meaning all assume one, so
-- adding a discriminator column would weaken a working security boundary to
-- save typing. What IS reused is the architecture — the same stage engine
-- shape, the same "sources come only from provider citations" rule, the same
-- claim-must-name-a-source constraint, the same versioned section results.
--
-- Competitor-specific entities exist only where the research model has no
-- equivalent: `competitors` (an entity that accumulates evidence across four
-- stages) and its verification/classification state.
--
-- No applied migration is modified. No existing policy is loosened.
--
-- ENTITLEMENT NOTE: this feature gates on the EXISTING `competitor_analysis`
-- entitlement, which migration 0007 already seeded across all five plans
-- (free/starter off, growth 25, professional 200, enterprise unlimited). The
-- Phase 7 brief names it `competitor_intelligence`, but it also says to reuse
-- an entitlement that already exists — and adding a second key for the same
-- capability would leave two flags to keep in sync and a priced plan catalog
-- that no longer describes what it sells.
-- ============================================================================

-- ============================================================================
-- 1. Depth catalog and stage costs
--
-- Same shape as `research_depths` / `research_stage_costs`: the database is the
-- authority for what a stage costs, and the TypeScript mirror in
-- `features/competitors/cost.ts` is asserted against this seed by the test
-- suite. If they disagree, the SQL wins.
-- ============================================================================

create table if not exists public.competitor_depths (
  id               text primary key,
  label            text not null,
  description      text not null,
  /** Candidate competitors carried past discovery. */
  max_competitors  integer not null check (max_competitors between 1 and 50),
  max_sources      integer not null check (max_sources between 1 and 200),
  max_queries      integer not null check (max_queries between 1 and 40),
  stage_timeout_ms integer not null check (stage_timeout_ms between 10000 and 300000),
  max_attempts     integer not null default 3 check (max_attempts between 1 and 5),
  sort_order       integer not null default 0,
  is_active        boolean not null default true
);

comment on table public.competitor_depths is
  'Competitor research depth tiers. The cost ceiling for a run lives here, not in application code.';

create table if not exists public.competitor_stage_costs (
  depth   text not null references public.competitor_depths (id) on delete cascade,
  stage   text not null check (stage in (
    'planning', 'discovery', 'verification', 'profiling',
    'pricing_positioning', 'analysis', 'recommendations'
  )),
  credits integer not null check (credits >= 0),
  primary key (depth, stage)
);

comment on table public.competitor_stage_costs is
  'Credits charged when a stage begins. Mirrored (and asserted) in features/competitors/cost.ts.';

insert into public.competitor_depths
  (id, label, description, max_competitors, max_sources, max_queries, stage_timeout_ms, max_attempts, sort_order)
values
  ('basic',    'Basic',    'A small set of the most obvious competitors, checked quickly.',        5,  15, 4,  60000, 3, 1),
  ('standard', 'Standard', 'A broader sweep with verification and pricing where it is published.', 10, 30, 8,  90000, 3, 2),
  ('deep',     'Deep',     'The widest permitted competitor set and the deepest evidence base.',   20, 60, 14, 120000, 3, 3)
on conflict (id) do nothing;

-- Retrieval stages cost more because they reach the network. `profiling`,
-- `analysis` and `recommendations` reason over stored rows and are cheap.
insert into public.competitor_stage_costs (depth, stage, credits) values
  ('basic','planning',5),            ('basic','discovery',12),
  ('basic','verification',10),       ('basic','profiling',10),
  ('basic','pricing_positioning',12),('basic','analysis',15),
  ('basic','recommendations',6),

  ('standard','planning',8),             ('standard','discovery',28),
  ('standard','verification',22),        ('standard','profiling',20),
  ('standard','pricing_positioning',28), ('standard','analysis',25),
  ('standard','recommendations',12),

  ('deep','planning',10),            ('deep','discovery',65),
  ('deep','verification',50),        ('deep','profiling',45),
  ('deep','pricing_positioning',60), ('deep','analysis',45),
  ('deep','recommendations',20)
on conflict (depth, stage) do nothing;

-- ============================================================================
-- 2. Projects
-- ============================================================================

create table if not exists public.competitor_projects (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,

  -- Provenance. `set null` rather than cascade: deleting the source idea must
  -- not destroy competitor research that has already been paid for and cited.
  business_idea_id  uuid references public.business_ideas (id) on delete set null,
  business_plan_id  uuid references public.business_plans (id) on delete set null,

  title             text not null check (length(btrim(title)) between 1 and 200),
  -- What the user is building. Feeds the competitor criteria.
  description       text check (length(description) <= 4000),
  category          text check (length(category) <= 200),
  geography         text check (length(geography) <= 200),
  target_customer   text check (length(target_customer) <= 1000),
  customer_problem  text check (length(customer_problem) <= 2000),
  business_model    text check (length(business_model) <= 1000),
  -- Names the user already knows about, as a starting point. Still verified
  -- like any other candidate; a seed is a hint, not a fact.
  known_competitors jsonb not null default '[]'::jsonb,

  depth             text not null default 'standard'
                      references public.competitor_depths (id),

  status            text not null default 'draft'
                      check (status in ('draft','running','completed','failed','cancelled')),

  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

comment on table public.competitor_projects is
  'A competitor intelligence brief. Workspace-scoped; the workspace is the security boundary.';

drop trigger if exists competitor_projects_set_updated_at on public.competitor_projects;
create trigger competitor_projects_set_updated_at
  before update on public.competitor_projects
  for each row execute function public.set_updated_at();

create index if not exists competitor_projects_workspace_idx
  on public.competitor_projects (workspace_id, created_at desc);
create index if not exists competitor_projects_status_idx
  on public.competitor_projects (status, created_at desc);
create index if not exists competitor_projects_idea_idx
  on public.competitor_projects (business_idea_id) where business_idea_id is not null;
create index if not exists competitor_projects_plan_idx
  on public.competitor_projects (business_plan_id) where business_plan_id is not null;

-- ============================================================================
-- 3. Runs and stage attempts
-- ============================================================================

create table if not exists public.competitor_runs (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.competitor_projects (id) on delete cascade,
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,

  status              text not null default 'pending'
                        check (status in ('pending','running','completed','failed','cancelled')),
  -- The resume point. Null once the run finishes.
  current_stage       text check (current_stage in (
                        'planning','discovery','verification','profiling',
                        'pricing_positioning','analysis','recommendations')),
  depth               text not null references public.competitor_depths (id),

  credits_charged     integer not null default 0 check (credits_charged >= 0),
  credits_refunded    integer not null default 0 check (credits_refunded >= 0),
  total_tokens        integer not null default 0,
  estimated_cost_usd  numeric(12,6) not null default 0,
  competitor_count    integer not null default 0,
  verified_count      integer not null default 0,
  source_count        integer not null default 0,
  evidence_count      integer not null default 0,

  error               text,
  -- Concurrency control. A non-null `locked_at` inside the timeout means a
  -- stage is executing; this is what stops two tabs both charging for one.
  locked_at           timestamptz,
  locked_stage        text,

  started_at              timestamptz,
  completed_at            timestamptz,
  last_stage_started_at   timestamptz,
  last_stage_completed_at timestamptz,
  created_at              timestamptz not null default timezone('utc', now()),
  updated_at              timestamptz not null default timezone('utc', now())
);

drop trigger if exists competitor_runs_set_updated_at on public.competitor_runs;
create trigger competitor_runs_set_updated_at
  before update on public.competitor_runs
  for each row execute function public.set_updated_at();

create index if not exists competitor_runs_project_idx
  on public.competitor_runs (project_id, created_at desc);
create index if not exists competitor_runs_workspace_idx
  on public.competitor_runs (workspace_id, created_at desc);
create index if not exists competitor_runs_status_idx
  on public.competitor_runs (status, created_at desc);

/**
 * One row per attempt at a stage.
 *
 * Keyed (run, stage, attempt) rather than (run, stage): a retry is a new
 * attempt with its own credit charge and its own error, so the ledger and the
 * stage history agree about what was paid for and why.
 */
create table if not exists public.competitor_run_stages (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references public.competitor_runs (id) on delete cascade,
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,

  stage             text not null check (stage in (
                      'planning','discovery','verification','profiling',
                      'pricing_positioning','analysis','recommendations')),
  attempt           integer not null default 1 check (attempt >= 1),
  status            text not null default 'running'
                      check (status in ('running','succeeded','failed','skipped')),

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

create index if not exists competitor_run_stages_run_idx
  on public.competitor_run_stages (run_id, started_at);
create index if not exists competitor_run_stages_status_idx
  on public.competitor_run_stages (status, started_at desc);
create index if not exists competitor_run_stages_workspace_idx
  on public.competitor_run_stages (workspace_id);

-- ============================================================================
-- 4. Sources
--
-- Written ONLY from provider citations. Nothing else in the system inserts
-- here, and no stage may write a URL the model composed — that rule is what
-- makes a citation checkable.
-- ============================================================================

create table if not exists public.competitor_sources (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.competitor_projects (id) on delete cascade,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  run_id         uuid references public.competitor_runs (id) on delete set null,

  url            text not null check (length(url) between 5 and 2000),
  -- Tracking params and fragments removed; this is what dedup matches on.
  canonical_url  text not null,
  title          text,
  publisher      text,
  source_type    text not null default 'web' check (source_type in (
                   'web','news','report','government','academic',
                   'industry','company','statistics','other')),
  -- Nullable by design: a missing publication date is recorded, never invented.
  published_at   timestamptz,
  retrieved_at   timestamptz not null default timezone('utc', now()),
  status         text not null default 'retrieved'
                   check (status in ('discovered','retrieved','failed','rejected','duplicate')),
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default timezone('utc', now()),

  unique (project_id, canonical_url)
);

comment on column public.competitor_sources.metadata is
  'Retrieval metadata only — never raw page content. Nothing here is rendered as HTML.';

create index if not exists competitor_sources_project_idx
  on public.competitor_sources (project_id, created_at);
create index if not exists competitor_sources_workspace_idx
  on public.competitor_sources (workspace_id);

-- ============================================================================
-- 5. Competitors
--
-- The one genuinely new entity. A competitor is discovered once and then
-- enriched by three later stages, so the row accumulates rather than being
-- rewritten — `competitor_complete_stage` merges with `coalesce`, and a stage
-- that learns nothing new cannot blank a field an earlier stage established.
-- ============================================================================

create table if not exists public.competitors (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.competitor_projects (id) on delete cascade,
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,

  name                text not null check (length(btrim(name)) between 1 and 200),
  website             text check (length(website) <= 2000),
  -- Registrable host, lowercased, `www.` stripped. The dedup key: two searches
  -- returning the same company under different paths must not create two rows.
  canonical_domain    text not null,

  competitor_type     text not null default 'UNCLASSIFIED'
                        check (competitor_type in ('DIRECT','INDIRECT','EMERGING','UNCLASSIFIED')),
  verification_status text not null default 'PENDING'
                        check (verification_status in
                          ('VERIFIED','PARTIALLY_VERIFIED','UNVERIFIED','PENDING')),
  -- Why verification landed where it did. Shown to the user verbatim.
  verification_notes  text check (length(verification_notes) <= 2000),

  -- Structured, stage-written. Shapes are validated by Zod before they land
  -- here; jsonb keeps the four enrichment stages from needing four migrations.
  profile             jsonb not null default '{}'::jsonb,
  pricing             jsonb not null default '{}'::jsonb,
  positioning         jsonb not null default '{}'::jsonb,

  confidence          text not null default 'low'
                        check (confidence in ('low','medium','high')),
  /** 0-100, only where discovery had evidence to rank on. */
  relevance           integer check (relevance between 0 and 100),

  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now()),

  unique (project_id, canonical_domain)
);

comment on table public.competitors is
  'A discovered competitor, enriched across the verification, profiling and pricing stages.';
comment on column public.competitors.pricing is
  'Publicly observable pricing only. Absent values are stored as NOT_PUBLICLY_AVAILABLE, never as a guess.';

drop trigger if exists competitors_set_updated_at on public.competitors;
create trigger competitors_set_updated_at
  before update on public.competitors
  for each row execute function public.set_updated_at();

create index if not exists competitors_project_idx
  on public.competitors (project_id, competitor_type);
create index if not exists competitors_workspace_idx
  on public.competitors (workspace_id);
create index if not exists competitors_verification_idx
  on public.competitors (project_id, verification_status);

-- ============================================================================
-- 6. Evidence
--
-- `source_id` is NOT NULL. That single constraint is the fabrication control:
-- a claim that cannot name the source it came from cannot be stored at all,
-- so there is no code path — however buggy — that persists an uncited claim.
-- ============================================================================

create table if not exists public.competitor_evidence (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.competitor_projects (id) on delete cascade,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  source_id      uuid not null references public.competitor_sources (id) on delete cascade,
  -- Null for project-level claims (a market gap belongs to the analysis, not
  -- to one competitor).
  competitor_id  uuid references public.competitors (id) on delete cascade,

  section_key    text not null,
  claim          text not null check (length(btrim(claim)) between 1 and 2000),
  -- What in the source supports it. Quoted or closely paraphrased.
  evidence_reference text check (length(evidence_reference) <= 1000),
  -- STATED / OBSERVED / INFERRED / RECOMMENDED. Required, never defaulted to
  -- the strongest value.
  claim_kind     text not null default 'OBSERVED'
                   check (claim_kind in ('STATED','OBSERVED','INFERRED','RECOMMENDED')),
  confidence     text not null default 'medium'
                   check (confidence in ('low','medium','high')),
  is_contradictory boolean not null default false,
  created_at     timestamptz not null default timezone('utc', now())
);

create index if not exists competitor_evidence_project_idx
  on public.competitor_evidence (project_id, section_key);
create index if not exists competitor_evidence_competitor_idx
  on public.competitor_evidence (competitor_id) where competitor_id is not null;
create index if not exists competitor_evidence_source_idx
  on public.competitor_evidence (source_id);
create index if not exists competitor_evidence_workspace_idx
  on public.competitor_evidence (workspace_id);

-- ============================================================================
-- 7. Section results
--
-- Versioned exactly like `research_results`: a new version supersedes rather
-- than overwrites, so regenerating never destroys an earlier analysis.
-- ============================================================================

create table if not exists public.competitor_results (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.competitor_projects (id) on delete cascade,
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  run_id             uuid references public.competitor_runs (id) on delete set null,

  section_key        text not null,
  structured_content jsonb not null default '{}'::jsonb,
  confidence         text not null default 'medium'
                       check (confidence in ('low','medium','high')),
  status             text not null default 'complete'
                       check (status in ('complete','partial','insufficient_evidence','failed')),
  version            integer not null default 1 check (version >= 1),
  is_current         boolean not null default true,

  created_at         timestamptz not null default timezone('utc', now()),
  updated_at         timestamptz not null default timezone('utc', now())
);

drop trigger if exists competitor_results_set_updated_at on public.competitor_results;
create trigger competitor_results_set_updated_at
  before update on public.competitor_results
  for each row execute function public.set_updated_at();

-- Exactly one current version per section per project.
create unique index if not exists competitor_results_current_uidx
  on public.competitor_results (project_id, section_key) where is_current;
create index if not exists competitor_results_project_idx
  on public.competitor_results (project_id, section_key);
create index if not exists competitor_results_history_idx
  on public.competitor_results (project_id, section_key, version desc);
create index if not exists competitor_results_workspace_idx
  on public.competitor_results (workspace_id);

-- ============================================================================
-- 8. RLS
--
-- Workspace membership for read; NO client write policies. Every write happens
-- through the security-definer functions below — the same shape as credits in
-- 0007, the admin platform in 0008 and research in 0009/0010.
--
-- Admin read access is additive and consults `admin_has('ai.read')`, so a
-- non-admin's workspace isolation is unchanged.
-- ============================================================================

alter table public.competitor_depths      enable row level security;
alter table public.competitor_stage_costs enable row level security;
alter table public.competitor_projects    enable row level security;
alter table public.competitor_runs        enable row level security;
alter table public.competitor_run_stages  enable row level security;
alter table public.competitor_sources     enable row level security;
alter table public.competitors            enable row level security;
alter table public.competitor_evidence    enable row level security;
alter table public.competitor_results     enable row level security;

-- Catalog: readable by any signed-in user (the estimator on /competitors/new
-- needs it) and containing no customer data.
drop policy if exists "Anyone signed in can read competitor depths" on public.competitor_depths;
create policy "Anyone signed in can read competitor depths"
  on public.competitor_depths for select to authenticated using (is_active);

drop policy if exists "Anyone signed in can read competitor stage costs" on public.competitor_stage_costs;
create policy "Anyone signed in can read competitor stage costs"
  on public.competitor_stage_costs for select to authenticated using (true);

drop policy if exists "Members read their workspace competitor projects" on public.competitor_projects;
create policy "Members read their workspace competitor projects"
  on public.competitor_projects for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace competitor runs" on public.competitor_runs;
create policy "Members read their workspace competitor runs"
  on public.competitor_runs for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace competitor stages" on public.competitor_run_stages;
create policy "Members read their workspace competitor stages"
  on public.competitor_run_stages for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace competitor sources" on public.competitor_sources;
create policy "Members read their workspace competitor sources"
  on public.competitor_sources for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace competitors" on public.competitors;
create policy "Members read their workspace competitors"
  on public.competitors for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace competitor evidence" on public.competitor_evidence;
create policy "Members read their workspace competitor evidence"
  on public.competitor_evidence for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace competitor results" on public.competitor_results;
create policy "Members read their workspace competitor results"
  on public.competitor_results for select
  using (public.is_workspace_member(workspace_id));

-- --- Admin read access (migration 0008 RBAC) --------------------------------

drop policy if exists "Admins read all competitor projects" on public.competitor_projects;
create policy "Admins read all competitor projects"
  on public.competitor_projects for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all competitor runs" on public.competitor_runs;
create policy "Admins read all competitor runs"
  on public.competitor_runs for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all competitor stages" on public.competitor_run_stages;
create policy "Admins read all competitor stages"
  on public.competitor_run_stages for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all competitor sources" on public.competitor_sources;
create policy "Admins read all competitor sources"
  on public.competitor_sources for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all competitors" on public.competitors;
create policy "Admins read all competitors"
  on public.competitors for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all competitor evidence" on public.competitor_evidence;
create policy "Admins read all competitor evidence"
  on public.competitor_evidence for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all competitor results" on public.competitor_results;
create policy "Admins read all competitor results"
  on public.competitor_results for select using (public.admin_has('ai.read'));

-- ============================================================================
-- 9. Cost estimation
-- ============================================================================

create or replace function public.competitor_estimate_credits(p_depth text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(credits), 0)::integer
  from public.competitor_stage_costs
  where depth = p_depth;
$$;

grant execute on function public.competitor_estimate_credits(text) to authenticated;

-- ============================================================================
-- 10. Create a project
--
-- Authorisation is re-derived from `auth.uid()`, so the workspace id the caller
-- passes is a claim to be checked, never a grant.
-- ============================================================================

create or replace function public.competitor_create_project(
  p_workspace_id      uuid,
  p_title             text,
  p_depth             text,
  p_description       text default null,
  p_category          text default null,
  p_geography         text default null,
  p_target_customer   text default null,
  p_customer_problem  text default null,
  p_business_model    text default null,
  p_known_competitors jsonb default '[]'::jsonb,
  p_business_idea_id  uuid default null,
  p_business_plan_id  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id      uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  -- Viewers may read competitor research but not commission it.
  if not public.can_edit_workspace(p_workspace_id) then
    raise exception 'not permitted to create competitor research in this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.competitor_depths where id = p_depth and is_active
  ) then
    raise exception 'unknown competitor research depth: %', p_depth
      using errcode = 'check_violation';
  end if;

  -- Cross-workspace link check. A client could otherwise staple another
  -- workspace's idea id onto its own project and have the detail page resolve
  -- it — the reason this is a function rather than an INSERT policy, which
  -- could only see the row being written.
  if p_business_idea_id is not null and not exists (
    select 1 from public.business_ideas
    where id = p_business_idea_id and workspace_id = p_workspace_id and deleted_at is null
  ) then
    raise exception 'business idea does not belong to this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if p_business_plan_id is not null and not exists (
    select 1 from public.business_plans
    where id = p_business_plan_id and workspace_id = p_workspace_id and deleted_at is null
  ) then
    raise exception 'business plan does not belong to this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(coalesce(p_known_competitors, '[]'::jsonb)) <> 'array' then
    raise exception 'known competitors must be a JSON array'
      using errcode = 'check_violation';
  end if;
  if jsonb_array_length(coalesce(p_known_competitors, '[]'::jsonb)) > 10 then
    raise exception 'at most 10 known competitors'
      using errcode = 'check_violation';
  end if;

  insert into public.competitor_projects (
    workspace_id, user_id, business_idea_id, business_plan_id,
    title, description, category, geography, target_customer,
    customer_problem, business_model, known_competitors, depth, status
  )
  values (
    p_workspace_id, v_user_id, p_business_idea_id, p_business_plan_id,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_category, '')), ''),
    nullif(btrim(coalesce(p_geography, '')), ''),
    nullif(btrim(coalesce(p_target_customer, '')), ''),
    nullif(btrim(coalesce(p_customer_problem, '')), ''),
    nullif(btrim(coalesce(p_business_model, '')), ''),
    coalesce(p_known_competitors, '[]'::jsonb),
    p_depth,
    'draft'
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.competitor_create_project(uuid, text, text, text, text, text, text, text, text, jsonb, uuid, uuid) to authenticated;

-- ============================================================================
-- 11. Start (or reuse) a run
--
-- A project may only have one active run; a second would charge twice for the
-- same work and leave two pointers disagreeing about where the research is.
-- ============================================================================

create or replace function public.competitor_start_run(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.competitor_projects%rowtype;
  v_run_id  uuid;
begin
  select * into v_project from public.competitor_projects where id = p_project_id;
  if v_project.id is null then
    raise exception 'competitor project not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_project.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  select id into v_run_id
  from public.competitor_runs
  where project_id = p_project_id and status in ('pending','running')
  order by created_at desc
  limit 1;

  if v_run_id is not null then
    return v_run_id;
  end if;

  insert into public.competitor_runs (project_id, workspace_id, depth, status, current_stage)
  values (p_project_id, v_project.workspace_id, v_project.depth, 'pending', 'planning')
  returning id into v_run_id;

  update public.competitor_projects set status = 'running' where id = p_project_id;

  return v_run_id;
end;
$$;

grant execute on function public.competitor_start_run(uuid) to authenticated;

-- ============================================================================
-- 12. Claim the next stage
--
-- The row lock is the concurrency control. Everything authoritative — which
-- stage, which attempt, which depth — is derived here, never supplied by the
-- caller. A client that could name its own stage could skip to
-- `recommendations` and pay for advice with no competitors behind it.
-- ============================================================================

create or replace function public.competitor_claim_stage(
  p_run_id          uuid,
  p_max_attempts    integer default 3,
  p_lock_timeout_ms integer default 300000
)
returns table (
  stage        text,
  attempt      integer,
  depth        text,
  workspace_id uuid,
  project_id   uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run     public.competitor_runs%rowtype;
  v_stage   text;
  v_attempt integer;
  v_failed  integer;
begin
  select * into v_run from public.competitor_runs r where r.id = p_run_id for update;

  if v_run.id is null then
    raise exception 'competitor run not found' using errcode = 'no_data_found';
  end if;

  -- Re-derived inside the transaction: membership could have been revoked
  -- between the HTTP check and this statement.
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if v_run.status = 'completed' then
    raise exception 'this competitor run is already complete'
      using errcode = 'invalid_parameter_value';
  end if;
  if v_run.status = 'cancelled' then
    raise exception 'this competitor run was cancelled'
      using errcode = 'invalid_parameter_value';
  end if;

  if v_run.locked_at is not null
     and v_run.locked_at > timezone('utc', now()) - make_interval(secs => p_lock_timeout_ms / 1000.0)
  then
    raise exception 'stage % is already running for this run', coalesce(v_run.locked_stage, '?')
      using errcode = 'lock_not_available';
  end if;

  v_stage := coalesce(v_run.current_stage, 'planning');

  select count(*) into v_failed
  from public.competitor_run_stages s
  where s.run_id = p_run_id and s.stage = v_stage and s.status = 'failed';

  -- A stage that already succeeded is never re-run: that is what makes a
  -- repeated request free rather than a second charge.
  if exists (
    select 1 from public.competitor_run_stages s
    where s.run_id = p_run_id and s.stage = v_stage and s.status = 'succeeded'
  ) then
    raise exception 'stage % has already succeeded', v_stage
      using errcode = 'invalid_parameter_value';
  end if;

  if v_failed >= p_max_attempts then
    raise exception 'stage % has failed % times and cannot be retried', v_stage, v_failed
      using errcode = 'invalid_parameter_value';
  end if;

  v_attempt := v_failed + 1;

  insert into public.competitor_run_stages (run_id, workspace_id, stage, attempt, status)
  values (p_run_id, v_run.workspace_id, v_stage, v_attempt, 'running');

  update public.competitor_runs
     set status                = 'running',
         current_stage         = v_stage,
         locked_at             = timezone('utc', now()),
         locked_stage          = v_stage,
         last_stage_started_at = timezone('utc', now()),
         started_at            = coalesce(started_at, timezone('utc', now()))
   where id = p_run_id;

  return query
    select v_stage, v_attempt, v_run.depth, v_run.workspace_id, v_run.project_id;
end;
$$;

grant execute on function public.competitor_claim_stage(uuid, integer, integer) to authenticated;

-- ============================================================================
-- 13. Complete a stage
--
-- Persists sources, competitors, evidence and section results, then advances
-- the pointer — in ONE transaction. `p_next_stage` null means finished.
--
-- Competitors are UPSERTED with coalesce on every enrichment column: discovery
-- creates the row, and verification/profiling/pricing add to it. A later stage
-- that learns nothing about a field must not blank what an earlier one found.
-- ============================================================================

create or replace function public.competitor_complete_stage(
  p_run_id      uuid,
  p_stage       text,
  p_attempt     integer,
  p_next_stage  text,
  p_results     jsonb default '[]'::jsonb,
  p_sources     jsonb default '[]'::jsonb,
  p_competitors jsonb default '[]'::jsonb,
  p_evidence    jsonb default '[]'::jsonb,
  p_usage       jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run             public.competitor_runs%rowtype;
  v_project_id      uuid;
  v_item            jsonb;
  v_source_id       uuid;
  v_competitor_id   uuid;
  v_new_sources     integer := 0;
  v_new_competitors integer := 0;
  v_new_evidence    integer := 0;
  v_canonical       text;
  v_domain          text;
begin
  select * into v_run from public.competitor_runs where id = p_run_id for update;
  if v_run.id is null then
    raise exception 'competitor run not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  v_project_id := v_run.project_id;

  -- --- Sources -------------------------------------------------------------
  -- Deduplicated by canonical_url via the unique constraint; a repeat is
  -- absorbed rather than raising, so a retry that rediscovers the same pages
  -- is harmless.
  for v_item in select * from jsonb_array_elements(p_sources)
  loop
    v_canonical := coalesce(v_item->>'canonical_url', v_item->>'url');
    continue when v_canonical is null or v_item->>'url' is null;

    insert into public.competitor_sources
      (project_id, workspace_id, run_id, url, canonical_url,
       title, publisher, source_type, published_at, status, metadata)
    values
      (v_project_id, v_run.workspace_id, p_run_id,
       v_item->>'url', v_canonical,
       nullif(v_item->>'title', ''),
       nullif(v_item->>'publisher', ''),
       coalesce(nullif(v_item->>'source_type', ''), 'web'),
       (v_item->>'published_at')::timestamptz,
       coalesce(nullif(v_item->>'status', ''), 'retrieved'),
       coalesce(v_item->'metadata', '{}'::jsonb))
    on conflict (project_id, canonical_url) do nothing;

    if found then v_new_sources := v_new_sources + 1; end if;
  end loop;

  -- --- Competitors ---------------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_competitors)
  loop
    v_domain := nullif(btrim(coalesce(v_item->>'canonical_domain', '')), '');
    -- A competitor with no resolvable domain came from somewhere other than a
    -- citation. Dropped rather than stored.
    continue when v_domain is null or nullif(btrim(coalesce(v_item->>'name','')), '') is null;

    insert into public.competitors
      (project_id, workspace_id, name, website, canonical_domain,
       competitor_type, verification_status, verification_notes,
       profile, pricing, positioning, confidence, relevance)
    values
      (v_project_id, v_run.workspace_id,
       btrim(v_item->>'name'),
       nullif(v_item->>'website', ''),
       lower(v_domain),
       coalesce(nullif(v_item->>'competitor_type', ''), 'UNCLASSIFIED'),
       coalesce(nullif(v_item->>'verification_status', ''), 'PENDING'),
       nullif(v_item->>'verification_notes', ''),
       coalesce(v_item->'profile', '{}'::jsonb),
       coalesce(v_item->'pricing', '{}'::jsonb),
       coalesce(v_item->'positioning', '{}'::jsonb),
       coalesce(nullif(v_item->>'confidence', ''), 'low'),
       (v_item->>'relevance')::integer)
    -- The existing row is referred to unqualified (`competitors.x`); a
    -- schema-qualified reference is not accepted in an ON CONFLICT target.
    on conflict (project_id, canonical_domain) do update set
      -- Enrichment, not replacement.
      name                = coalesce(nullif(excluded.name, ''), competitors.name),
      website             = coalesce(excluded.website, competitors.website),
      competitor_type     = case
                              when excluded.competitor_type = 'UNCLASSIFIED'
                                then competitors.competitor_type
                              else excluded.competitor_type
                            end,
      verification_status = case
                              when excluded.verification_status = 'PENDING'
                                then competitors.verification_status
                              else excluded.verification_status
                            end,
      verification_notes  = coalesce(excluded.verification_notes, competitors.verification_notes),
      -- `||` merges the objects, so the profiling and pricing stages each add
      -- their own keys without erasing the other's.
      profile             = competitors.profile     || excluded.profile,
      pricing             = competitors.pricing     || excluded.pricing,
      positioning         = competitors.positioning || excluded.positioning,
      confidence          = excluded.confidence,
      relevance           = coalesce(excluded.relevance, competitors.relevance);

    -- Counts rows WRITTEN, insert or update — an upsert always reports FOUND,
    -- so this is not a count of new competitors. The authoritative totals are
    -- recomputed from `count(*)` when the run row is advanced below.
    v_new_competitors := v_new_competitors + 1;
  end loop;

  -- --- Evidence ------------------------------------------------------------
  -- Resolved against STORED sources by canonical url. An item that resolves to
  -- nothing is dropped here rather than persisted: the NOT NULL on `source_id`
  -- would refuse it anyway, and dropping keeps a retry from failing wholesale
  -- because one claim referenced a URL the provider did not return.
  for v_item in select * from jsonb_array_elements(p_evidence)
  loop
    select id into v_source_id
    from public.competitor_sources
    where project_id = v_project_id
      and canonical_url = v_item->>'canonical_url'
    limit 1;

    continue when v_source_id is null;

    v_competitor_id := null;
    if v_item->>'canonical_domain' is not null then
      select id into v_competitor_id
      from public.competitors
      where project_id = v_project_id
        and canonical_domain = lower(v_item->>'canonical_domain')
      limit 1;
    end if;

    insert into public.competitor_evidence
      (project_id, workspace_id, source_id, competitor_id, section_key,
       claim, evidence_reference, claim_kind, confidence, is_contradictory)
    values
      (v_project_id, v_run.workspace_id, v_source_id, v_competitor_id,
       coalesce(nullif(v_item->>'section_key', ''), 'competitor_profiles'),
       v_item->>'claim',
       nullif(v_item->>'evidence_reference', ''),
       coalesce(nullif(v_item->>'claim_kind', ''), 'OBSERVED'),
       coalesce(nullif(v_item->>'confidence', ''), 'medium'),
       coalesce((v_item->>'is_contradictory')::boolean, false));

    v_new_evidence := v_new_evidence + 1;
  end loop;

  -- --- Section results -----------------------------------------------------
  -- Superseding: the previous current version is stood down first, so the
  -- one-current-version index holds throughout.
  for v_item in select * from jsonb_array_elements(p_results)
  loop
    update public.competitor_results
       set is_current = false
     where project_id = v_project_id
       and section_key = v_item->>'section_key'
       and is_current;

    insert into public.competitor_results
      (project_id, workspace_id, run_id, section_key,
       structured_content, confidence, status, version, is_current)
    values
      (v_project_id, v_run.workspace_id, p_run_id,
       v_item->>'section_key',
       coalesce(v_item->'structured_content', '{}'::jsonb),
       coalesce(nullif(v_item->>'confidence', ''), 'medium'),
       coalesce(nullif(v_item->>'status', ''), 'complete'),
       coalesce((
         select max(version) + 1 from public.competitor_results
         where project_id = v_project_id and section_key = v_item->>'section_key'
       ), 1),
       true);
  end loop;

  -- --- Stage attempt -------------------------------------------------------
  update public.competitor_run_stages
     set status          = 'succeeded',
         completed_at    = timezone('utc', now()),
         prompt_tokens   = (p_usage->>'prompt_tokens')::integer,
         output_tokens   = (p_usage->>'output_tokens')::integer,
         total_tokens    = (p_usage->>'total_tokens')::integer,
         duration_ms     = (p_usage->>'duration_ms')::integer,
         ai_usage_log_id = (p_usage->>'ai_usage_log_id')::uuid
   where run_id = p_run_id and stage = p_stage and attempt = p_attempt;

  -- --- Advance -------------------------------------------------------------
  update public.competitor_runs
     set current_stage           = p_next_stage,
         status                  = case when p_next_stage is null then 'completed' else 'running' end,
         completed_at            = case when p_next_stage is null then timezone('utc', now()) else completed_at end,
         locked_at               = null,
         locked_stage            = null,
         last_stage_completed_at = timezone('utc', now()),
         total_tokens            = total_tokens + coalesce((p_usage->>'total_tokens')::integer, 0),
         estimated_cost_usd      = estimated_cost_usd + coalesce((p_usage->>'estimated_cost_usd')::numeric, 0),
         source_count            = (select count(*) from public.competitor_sources where project_id = v_project_id),
         competitor_count        = (select count(*) from public.competitors where project_id = v_project_id),
         verified_count          = (select count(*) from public.competitors
                                     where project_id = v_project_id
                                       and verification_status in ('VERIFIED','PARTIALLY_VERIFIED')),
         evidence_count          = (select count(*) from public.competitor_evidence where project_id = v_project_id)
   where id = p_run_id;

  if p_next_stage is null then
    update public.competitor_projects set status = 'completed' where id = v_project_id;
  end if;

  return jsonb_build_object(
    'sources_added',       v_new_sources,
    'competitors_written', v_new_competitors,
    'evidence_added',      v_new_evidence,
    'next_stage',          p_next_stage
  );
end;
$$;

grant execute on function public.competitor_complete_stage(uuid, text, integer, text, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- ============================================================================
-- 14. Fail a stage
--
-- Records the failure and releases the lock WITHOUT advancing. The pointer
-- stays put, so the next request retries the same stage.
-- ============================================================================

create or replace function public.competitor_fail_stage(
  p_run_id        uuid,
  p_stage         text,
  p_attempt       integer,
  p_error_code    text,
  p_error_message text,
  p_terminal      boolean default false,
  p_usage         jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.competitor_runs%rowtype;
begin
  select * into v_run from public.competitor_runs where id = p_run_id for update;
  if v_run.id is null then
    raise exception 'competitor run not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  update public.competitor_run_stages
     set status        = 'failed',
         completed_at  = timezone('utc', now()),
         error_code    = p_error_code,
         error_message = left(coalesce(p_error_message, ''), 2000),
         duration_ms   = (p_usage->>'duration_ms')::integer
   where run_id = p_run_id and stage = p_stage and attempt = p_attempt;

  -- current_stage is NOT touched. That is the whole point of this function.
  update public.competitor_runs
     set status       = case when p_terminal then 'failed' else 'running' end,
         error        = left(coalesce(p_error_message, ''), 2000),
         locked_at    = null,
         locked_stage = null
   where id = p_run_id;

  if p_terminal then
    update public.competitor_projects set status = 'failed' where id = v_run.project_id;
  end if;
end;
$$;

grant execute on function public.competitor_fail_stage(uuid, text, integer, text, text, boolean, jsonb) to authenticated;
