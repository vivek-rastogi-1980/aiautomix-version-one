-- ============================================================
-- AIAutoMix migration bundle: part2_0016.sql
-- Paste into the Supabase SQL Editor and Run.
--
-- Contains, in order:
--   0016_phase8_financial_intelligence.sql
--
-- The SQL Editor runs this as one transaction, so any error rolls
-- the whole bundle back with nothing half-applied. Every statement
-- is idempotent, so re-running after a fix is safe.
-- ============================================================


-- >>>>>>>>>>>>>>>>>>>>>>>> 0016_phase8_financial_intelligence.sql >>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- Phase 8 — Financial & Funding Intelligence
--
-- Follows the same architecture as research (0009/0010) and competitors
-- (0014): workspace-scoped tables, no client write policies, every write via a
-- security-definer function, admin reads gated on `admin_has('ai.read')`.
--
-- ---------------------------------------------------------------------------
-- MONEY
-- ---------------------------------------------------------------------------
-- Every monetary column is `bigint` holding an INTEGER COUNT OF MINOR UNITS —
-- paise, cents, pence — never a float and never a decimal. `numeric` would be
-- exact too, but it round-trips through PostgREST as a string and every read
-- would need parsing before arithmetic; `bigint` arrives as a JS number that is
-- already the authoritative value.
--
-- The currency is stored ONCE, on the project, and every amount beneath it is
-- in that currency. There is deliberately no per-row currency column: two
-- currencies inside one model is not a feature, it is a bug waiting for
-- somebody to add them together.
--
-- Rates are `integer` BASIS POINTS (1 bp = 0.01%). Same reason.
--
-- No applied migration is modified.
-- ============================================================================

-- ============================================================================
-- 1. Entitlement
--
-- Financial Intelligence gets its OWN entitlement. Unlike Phase 7 — where
-- `competitor_analysis` already existed in the plan catalog — there is no
-- existing financial flag, so one is added here and seeded across every plan.
-- Without the seed, `canAccess` finds no row and fails closed, which would
-- leave the feature dark for every customer including enterprise.
-- ============================================================================

insert into public.plan_entitlements (plan_id, feature, is_enabled, limit_value)
values
  ('free','financial_intelligence',         false, 0),
  ('starter','financial_intelligence',      false, 0),
  ('growth','financial_intelligence',       true,  10),
  ('professional','financial_intelligence', true,  100),
  ('enterprise','financial_intelligence',   true,  null)
on conflict (plan_id, feature) do nothing;

-- ============================================================================
-- 2. Stage costs
--
-- Keyed by stage alone: financial modelling has no depth tiers, because the
-- work does not scale with a source budget the way research does.
--
-- The three COMPUTE stages cost ZERO. They run the deterministic engine in
-- process — no provider call, no tokens, no network — so charging for them
-- would be charging for arithmetic. That the number is 0 rather than "small"
-- is the point: it is checkable evidence that no model ran.
-- ============================================================================

create table if not exists public.financial_stage_costs (
  stage   text primary key check (stage in (
    'financial_planning', 'cost_modeling', 'revenue_modeling',
    'unit_economics', 'scenario_analysis', 'cashflow_break_even',
    'funding_analysis', 'financial_recommendations'
  )),
  credits integer not null check (credits >= 0)
);

comment on table public.financial_stage_costs is
  'Credits charged when a stage begins. Zero for compute stages, which run no model. Mirrored (and asserted) in features/financials/cost.ts.';

insert into public.financial_stage_costs (stage, credits) values
  ('financial_planning',        8),
  ('cost_modeling',            15),
  ('revenue_modeling',         15),
  ('unit_economics',            0),
  ('scenario_analysis',         0),
  ('cashflow_break_even',       0),
  ('funding_analysis',         30),
  ('financial_recommendations', 12)
on conflict (stage) do nothing;

-- ============================================================================
-- 3. Projects
-- ============================================================================

create table if not exists public.financial_projects (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,

  -- Provenance across the whole product chain. `set null` rather than cascade:
  -- deleting the source must not destroy a model already paid for.
  business_idea_id     uuid references public.business_ideas (id) on delete set null,
  business_plan_id     uuid references public.business_plans (id) on delete set null,
  research_request_id  uuid references public.research_requests (id) on delete set null,
  competitor_project_id uuid references public.competitor_projects (id) on delete set null,

  title             text not null check (length(btrim(title)) between 1 and 200),
  description       text check (length(description) <= 4000),
  industry          text check (length(industry) <= 200),
  geography         text check (length(geography) <= 200),
  target_customer   text check (length(target_customer) <= 1000),

  -- ISO 4217. Required, never defaulted silently — a model whose currency was
  -- assumed is a model whose numbers mean nothing.
  currency          text not null check (currency ~ '^[A-Z]{3}$'),
  revenue_model     text not null check (revenue_model in (
                      'SUBSCRIPTION','SERVICES','ECOMMERCE','MARKETPLACE','ONE_TIME_SALES')),
  horizon_months    integer not null default 12 check (horizon_months between 1 and 60),
  -- Cash available at month 0, in minor units.
  opening_cash_minor bigint not null default 0 check (opening_cash_minor >= 0),

  status            text not null default 'draft'
                      check (status in ('draft','running','completed','failed','cancelled')),

  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

comment on column public.financial_projects.opening_cash_minor is
  'Integer minor units of the project currency. Never a float, never a major-unit value.';

drop trigger if exists financial_projects_set_updated_at on public.financial_projects;
create trigger financial_projects_set_updated_at
  before update on public.financial_projects
  for each row execute function public.set_updated_at();

create index if not exists financial_projects_workspace_idx
  on public.financial_projects (workspace_id, created_at desc);
create index if not exists financial_projects_status_idx
  on public.financial_projects (status, created_at desc);
create index if not exists financial_projects_plan_idx
  on public.financial_projects (business_plan_id) where business_plan_id is not null;

-- ============================================================================
-- 4. Runs and stage attempts
-- ============================================================================

create table if not exists public.financial_runs (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.financial_projects (id) on delete cascade,
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,

  status             text not null default 'pending'
                       check (status in ('pending','running','completed','failed','cancelled')),
  current_stage      text check (current_stage in (
                       'financial_planning','cost_modeling','revenue_modeling',
                       'unit_economics','scenario_analysis','cashflow_break_even',
                       'funding_analysis','financial_recommendations')),

  credits_charged    integer not null default 0 check (credits_charged >= 0),
  credits_refunded   integer not null default 0 check (credits_refunded >= 0),
  total_tokens       integer not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0,
  assumption_count   integer not null default 0,
  cost_line_count    integer not null default 0,
  funding_option_count integer not null default 0,
  source_count       integer not null default 0,

  error              text,
  locked_at          timestamptz,
  locked_stage       text,

  started_at              timestamptz,
  completed_at            timestamptz,
  last_stage_started_at   timestamptz,
  last_stage_completed_at timestamptz,
  created_at              timestamptz not null default timezone('utc', now()),
  updated_at              timestamptz not null default timezone('utc', now())
);

drop trigger if exists financial_runs_set_updated_at on public.financial_runs;
create trigger financial_runs_set_updated_at
  before update on public.financial_runs
  for each row execute function public.set_updated_at();

create index if not exists financial_runs_project_idx
  on public.financial_runs (project_id, created_at desc);
create index if not exists financial_runs_workspace_idx
  on public.financial_runs (workspace_id, created_at desc);
create index if not exists financial_runs_status_idx
  on public.financial_runs (status, created_at desc);

create table if not exists public.financial_run_stages (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references public.financial_runs (id) on delete cascade,
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,

  stage             text not null check (stage in (
                      'financial_planning','cost_modeling','revenue_modeling',
                      'unit_economics','scenario_analysis','cashflow_break_even',
                      'funding_analysis','financial_recommendations')),
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

create index if not exists financial_run_stages_run_idx
  on public.financial_run_stages (run_id, started_at);
create index if not exists financial_run_stages_status_idx
  on public.financial_run_stages (status, started_at desc);
create index if not exists financial_run_stages_workspace_idx
  on public.financial_run_stages (workspace_id);

-- ============================================================================
-- 5. Assumptions
--
-- The traceability table. Every figure in the model resolves to a row here, and
-- every row records WHERE THE NUMBER CAME FROM. `source` is NOT NULL with a
-- constrained vocabulary, so an AI proposal can never be stored looking like a
-- value the user chose.
--
-- One value column per unit rather than a polymorphic blob: `value_minor` is
-- money, `value_int` is a count or a basis-point rate. A check constraint makes
-- sure exactly the right one is populated for the declared unit, so a rate
-- cannot be silently read as an amount.
-- ============================================================================

create table if not exists public.financial_assumptions (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.financial_projects (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,

  -- Stable machine key, e.g. `starting_units`, `price_per_unit`.
  key           text not null check (key ~ '^[a-z][a-z0-9_]{1,60}$'),
  label         text not null check (length(btrim(label)) between 1 and 200),

  unit          text not null check (unit in ('money','count','bps','months')),
  -- Money only. Minor units of the project currency.
  value_minor   bigint,
  -- Counts, basis points and month counts.
  value_int     integer,

  source        text not null check (source in (
                  'USER','AI','INHERITED_PLAN','INHERITED_RESEARCH',
                  'INHERITED_COMPETITOR','DEFAULT')),
  confidence    text not null default 'medium'
                  check (confidence in ('low','medium','high')),
  rationale     text check (length(rationale) <= 2000),
  -- Where the supporting evidence lives, when there is any.
  evidence_url  text check (length(evidence_url) <= 2000),

  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),

  -- One current value per key per project.
  unique (project_id, key),

  -- The unit determines which value column is authoritative. This is what
  -- stops a 500 bp churn rate being read as 5 rupees.
  constraint financial_assumptions_value_matches_unit check (
    (unit = 'money' and value_minor is not null and value_int is null)
    or (unit <> 'money' and value_int is not null and value_minor is null)
  )
);

drop trigger if exists financial_assumptions_set_updated_at on public.financial_assumptions;
create trigger financial_assumptions_set_updated_at
  before update on public.financial_assumptions
  for each row execute function public.set_updated_at();

create index if not exists financial_assumptions_project_idx
  on public.financial_assumptions (project_id, key);
create index if not exists financial_assumptions_workspace_idx
  on public.financial_assumptions (workspace_id);
create index if not exists financial_assumptions_source_idx
  on public.financial_assumptions (project_id, source);

-- ============================================================================
-- 6. Cost lines
-- ============================================================================

create table if not exists public.financial_costs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.financial_projects (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,

  category      text not null check (category in (
                  'equipment','registration','technology','website','branding',
                  'inventory','salaries','rent','software','marketing',
                  'logistics','operations','professional_services','miscellaneous')),
  kind          text not null check (kind in ('ONE_TIME','RECURRING')),
  label         text not null check (length(btrim(label)) between 1 and 200),
  amount_minor  bigint not null check (amount_minor >= 0),
  -- RECURRING only: months between occurrences. 1 monthly, 12 annual.
  every_months  integer not null default 1 check (every_months between 1 and 60),

  source        text not null default 'AI' check (source in (
                  'USER','AI','INHERITED_PLAN','INHERITED_RESEARCH',
                  'INHERITED_COMPETITOR','DEFAULT')),
  confidence    text not null default 'medium'
                  check (confidence in ('low','medium','high')),
  rationale     text check (length(rationale) <= 2000),

  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),

  unique (project_id, kind, category, label)
);

drop trigger if exists financial_costs_set_updated_at on public.financial_costs;
create trigger financial_costs_set_updated_at
  before update on public.financial_costs
  for each row execute function public.set_updated_at();

create index if not exists financial_costs_project_idx
  on public.financial_costs (project_id, kind, category);
create index if not exists financial_costs_workspace_idx
  on public.financial_costs (workspace_id);

-- ============================================================================
-- 7. Funding sources and options
--
-- Sources come ONLY from provider citations, exactly as in research and
-- competitors. `funding_options.source_id` is nullable because a bootstrapping
-- recommendation legitimately has no external source — but an option that
-- claims an external scheme with no source is visibly unsourced in the UI.
-- ============================================================================

create table if not exists public.financial_sources (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.financial_projects (id) on delete cascade,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  run_id         uuid references public.financial_runs (id) on delete set null,

  url            text not null check (length(url) between 5 and 2000),
  canonical_url  text not null,
  title          text,
  publisher      text,
  published_at   timestamptz,
  retrieved_at   timestamptz not null default timezone('utc', now()),
  status         text not null default 'retrieved'
                   check (status in ('discovered','retrieved','failed','rejected','duplicate')),
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default timezone('utc', now()),

  unique (project_id, canonical_url)
);

create index if not exists financial_sources_project_idx
  on public.financial_sources (project_id, created_at);
create index if not exists financial_sources_workspace_idx
  on public.financial_sources (workspace_id);

create table if not exists public.funding_options (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.financial_projects (id) on delete cascade,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  source_id      uuid references public.financial_sources (id) on delete set null,

  name           text not null check (length(btrim(name)) between 1 and 300),
  provider       text check (length(provider) <= 300),
  funding_type   text not null check (funding_type in (
                   'BOOTSTRAP','BANK_LOAN','GOVERNMENT_SCHEME','GRANT','INCUBATOR',
                   'ACCELERATOR','ANGEL','VENTURE_CAPITAL','STRATEGIC','REVENUE_BASED')),
  geography      text check (length(geography) <= 200),
  eligibility    text check (length(eligibility) <= 4000),
  -- Published range, in minor units. Null means not published — which is
  -- different from zero and is rendered differently.
  amount_min_minor bigint check (amount_min_minor >= 0),
  amount_max_minor bigint check (amount_max_minor >= 0),
  terms          text check (length(terms) <= 4000),
  application_url text check (length(application_url) <= 2000),

  -- AIAutoMix's own read of fit. Labelled as such wherever drawn.
  suitability    text not null default 'POSSIBLE'
                   check (suitability in ('STRONG','POSSIBLE','UNLIKELY')),
  suitability_rationale text check (length(suitability_rationale) <= 2000),
  confidence     text not null default 'low'
                   check (confidence in ('low','medium','high')),

  created_at     timestamptz not null default timezone('utc', now()),

  unique (project_id, name)
);

comment on column public.funding_options.amount_min_minor is
  'Published range only, in minor units. Null means the provider does not publish it — never inferred.';

create index if not exists funding_options_project_idx
  on public.funding_options (project_id, funding_type);
create index if not exists funding_options_workspace_idx
  on public.funding_options (workspace_id);

-- ============================================================================
-- 8. Section results
-- ============================================================================

create table if not exists public.financial_results (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.financial_projects (id) on delete cascade,
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  run_id             uuid references public.financial_runs (id) on delete set null,

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

drop trigger if exists financial_results_set_updated_at on public.financial_results;
create trigger financial_results_set_updated_at
  before update on public.financial_results
  for each row execute function public.set_updated_at();

create unique index if not exists financial_results_current_uidx
  on public.financial_results (project_id, section_key) where is_current;
create index if not exists financial_results_project_idx
  on public.financial_results (project_id, section_key);
create index if not exists financial_results_history_idx
  on public.financial_results (project_id, section_key, version desc);
create index if not exists financial_results_workspace_idx
  on public.financial_results (workspace_id);

-- ============================================================================
-- 9. RLS — read for members, no client writes
-- ============================================================================

alter table public.financial_stage_costs enable row level security;
alter table public.financial_projects    enable row level security;
alter table public.financial_runs        enable row level security;
alter table public.financial_run_stages  enable row level security;
alter table public.financial_assumptions enable row level security;
alter table public.financial_costs       enable row level security;
alter table public.financial_sources     enable row level security;
alter table public.funding_options       enable row level security;
alter table public.financial_results     enable row level security;

drop policy if exists "Anyone signed in can read financial stage costs" on public.financial_stage_costs;
create policy "Anyone signed in can read financial stage costs"
  on public.financial_stage_costs for select to authenticated using (true);

drop policy if exists "Members read their workspace financial projects" on public.financial_projects;
create policy "Members read their workspace financial projects"
  on public.financial_projects for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace financial runs" on public.financial_runs;
create policy "Members read their workspace financial runs"
  on public.financial_runs for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace financial stages" on public.financial_run_stages;
create policy "Members read their workspace financial stages"
  on public.financial_run_stages for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace financial assumptions" on public.financial_assumptions;
create policy "Members read their workspace financial assumptions"
  on public.financial_assumptions for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace financial costs" on public.financial_costs;
create policy "Members read their workspace financial costs"
  on public.financial_costs for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace financial sources" on public.financial_sources;
create policy "Members read their workspace financial sources"
  on public.financial_sources for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace funding options" on public.funding_options;
create policy "Members read their workspace funding options"
  on public.funding_options for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace financial results" on public.financial_results;
create policy "Members read their workspace financial results"
  on public.financial_results for select using (public.is_workspace_member(workspace_id));

-- --- Admin read access (migration 0008 RBAC) --------------------------------

drop policy if exists "Admins read all financial projects" on public.financial_projects;
create policy "Admins read all financial projects"
  on public.financial_projects for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all financial runs" on public.financial_runs;
create policy "Admins read all financial runs"
  on public.financial_runs for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all financial stages" on public.financial_run_stages;
create policy "Admins read all financial stages"
  on public.financial_run_stages for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all financial assumptions" on public.financial_assumptions;
create policy "Admins read all financial assumptions"
  on public.financial_assumptions for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all financial costs" on public.financial_costs;
create policy "Admins read all financial costs"
  on public.financial_costs for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all financial sources" on public.financial_sources;
create policy "Admins read all financial sources"
  on public.financial_sources for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all funding options" on public.funding_options;
create policy "Admins read all funding options"
  on public.funding_options for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all financial results" on public.financial_results;
create policy "Admins read all financial results"
  on public.financial_results for select using (public.admin_has('ai.read'));

-- ============================================================================
-- 10. Cost estimation
-- ============================================================================

create or replace function public.financial_estimate_credits()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(credits), 0)::integer from public.financial_stage_costs;
$$;

grant execute on function public.financial_estimate_credits() to authenticated;

-- ============================================================================
-- 11. Create a project
-- ============================================================================

create or replace function public.financial_create_project(
  p_workspace_id       uuid,
  p_title              text,
  p_currency           text,
  p_revenue_model      text,
  p_description        text default null,
  p_industry           text default null,
  p_geography          text default null,
  p_target_customer    text default null,
  p_horizon_months     integer default 12,
  p_opening_cash_minor bigint default 0,
  p_business_idea_id   uuid default null,
  p_business_plan_id   uuid default null,
  p_research_request_id uuid default null,
  p_competitor_project_id uuid default null
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

  if not public.can_edit_workspace(p_workspace_id) then
    raise exception 'not permitted to create financial models in this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  -- Currency is validated here rather than trusted: a three-letter code that is
  -- not a real currency would produce a model whose numbers cannot be formatted
  -- and whose minor-unit scale is unknown.
  if p_currency !~ '^[A-Z]{3}$' then
    raise exception 'currency must be a three-letter ISO 4217 code'
      using errcode = 'check_violation';
  end if;

  -- Cross-workspace link checks. A client could otherwise staple another
  -- workspace's plan id onto its own model and have the detail page resolve it.
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

  if p_research_request_id is not null and not exists (
    select 1 from public.research_requests
    where id = p_research_request_id and workspace_id = p_workspace_id
  ) then
    raise exception 'market research does not belong to this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if p_competitor_project_id is not null and not exists (
    select 1 from public.competitor_projects
    where id = p_competitor_project_id and workspace_id = p_workspace_id
  ) then
    raise exception 'competitor project does not belong to this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.financial_projects (
    workspace_id, user_id,
    business_idea_id, business_plan_id, research_request_id, competitor_project_id,
    title, description, industry, geography, target_customer,
    currency, revenue_model, horizon_months, opening_cash_minor, status
  )
  values (
    p_workspace_id, v_user_id,
    p_business_idea_id, p_business_plan_id, p_research_request_id, p_competitor_project_id,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_industry, '')), ''),
    nullif(btrim(coalesce(p_geography, '')), ''),
    nullif(btrim(coalesce(p_target_customer, '')), ''),
    p_currency, p_revenue_model,
    coalesce(p_horizon_months, 12),
    greatest(coalesce(p_opening_cash_minor, 0), 0),
    'draft'
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.financial_create_project(uuid, text, text, text, text, text, text, text, integer, bigint, uuid, uuid, uuid, uuid) to authenticated;

-- ============================================================================
-- 12. Start (or reuse) a run
-- ============================================================================

create or replace function public.financial_start_run(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.financial_projects%rowtype;
  v_run_id  uuid;
begin
  select * into v_project from public.financial_projects where id = p_project_id;
  if v_project.id is null then
    raise exception 'financial project not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_project.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  select id into v_run_id
  from public.financial_runs
  where project_id = p_project_id and status in ('pending','running')
  order by created_at desc
  limit 1;

  if v_run_id is not null then
    return v_run_id;
  end if;

  insert into public.financial_runs (project_id, workspace_id, status, current_stage)
  values (p_project_id, v_project.workspace_id, 'pending', 'financial_planning')
  returning id into v_run_id;

  update public.financial_projects set status = 'running' where id = p_project_id;

  return v_run_id;
end;
$$;

grant execute on function public.financial_start_run(uuid) to authenticated;

-- ============================================================================
-- 13. Claim the next stage
-- ============================================================================

create or replace function public.financial_claim_stage(
  p_run_id          uuid,
  p_max_attempts    integer default 3,
  p_lock_timeout_ms integer default 300000
)
returns table (
  stage        text,
  attempt      integer,
  workspace_id uuid,
  project_id   uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run     public.financial_runs%rowtype;
  v_stage   text;
  v_attempt integer;
  v_failed  integer;
begin
  select * into v_run from public.financial_runs r where r.id = p_run_id for update;

  if v_run.id is null then
    raise exception 'financial run not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;
  if v_run.status = 'completed' then
    raise exception 'this financial run is already complete'
      using errcode = 'invalid_parameter_value';
  end if;
  if v_run.status = 'cancelled' then
    raise exception 'this financial run was cancelled'
      using errcode = 'invalid_parameter_value';
  end if;

  if v_run.locked_at is not null
     and v_run.locked_at > timezone('utc', now()) - make_interval(secs => p_lock_timeout_ms / 1000.0)
  then
    raise exception 'stage % is already running for this run', coalesce(v_run.locked_stage, '?')
      using errcode = 'lock_not_available';
  end if;

  v_stage := coalesce(v_run.current_stage, 'financial_planning');

  select count(*) into v_failed
  from public.financial_run_stages s
  where s.run_id = p_run_id and s.stage = v_stage and s.status = 'failed';

  if exists (
    select 1 from public.financial_run_stages s
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

  insert into public.financial_run_stages (run_id, workspace_id, stage, attempt, status)
  values (p_run_id, v_run.workspace_id, v_stage, v_attempt, 'running');

  update public.financial_runs
     set status                = 'running',
         current_stage         = v_stage,
         locked_at             = timezone('utc', now()),
         locked_stage          = v_stage,
         last_stage_started_at = timezone('utc', now()),
         started_at            = coalesce(started_at, timezone('utc', now()))
   where id = p_run_id;

  return query select v_stage, v_attempt, v_run.workspace_id, v_run.project_id;
end;
$$;

grant execute on function public.financial_claim_stage(uuid, integer, integer) to authenticated;

-- ============================================================================
-- 14. Complete a stage
--
-- Persists assumptions, costs, sources, funding options and section results,
-- then advances — in ONE transaction.
--
-- Assumptions UPSERT with a source-precedence guard: a value the USER set is
-- never overwritten by an AI proposal. That rule lives here, in SQL, because it
-- has to hold even if a future caller forgets it.
-- ============================================================================

create or replace function public.financial_complete_stage(
  p_run_id        uuid,
  p_stage         text,
  p_attempt       integer,
  p_next_stage    text,
  p_results       jsonb default '[]'::jsonb,
  p_assumptions   jsonb default '[]'::jsonb,
  p_costs         jsonb default '[]'::jsonb,
  p_sources       jsonb default '[]'::jsonb,
  p_funding       jsonb default '[]'::jsonb,
  p_usage         jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run        public.financial_runs%rowtype;
  v_project_id uuid;
  v_item       jsonb;
  v_source_id  uuid;
  v_canonical  text;
  v_new_assumptions integer := 0;
  v_new_costs       integer := 0;
  v_new_sources     integer := 0;
  v_new_funding     integer := 0;
begin
  select * into v_run from public.financial_runs where id = p_run_id for update;
  if v_run.id is null then
    raise exception 'financial run not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  v_project_id := v_run.project_id;

  -- --- Assumptions ---------------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_assumptions)
  loop
    continue when nullif(btrim(coalesce(v_item->>'key','')), '') is null;

    insert into public.financial_assumptions
      (project_id, workspace_id, key, label, unit, value_minor, value_int,
       source, confidence, rationale, evidence_url)
    values
      (v_project_id, v_run.workspace_id,
       v_item->>'key',
       coalesce(nullif(v_item->>'label',''), v_item->>'key'),
       coalesce(nullif(v_item->>'unit',''), 'count'),
       case when v_item->>'unit' = 'money' then (v_item->>'value_minor')::bigint else null end,
       case when v_item->>'unit' = 'money' then null else (v_item->>'value_int')::integer end,
       coalesce(nullif(v_item->>'source',''), 'AI'),
       coalesce(nullif(v_item->>'confidence',''), 'medium'),
       nullif(v_item->>'rationale',''),
       nullif(v_item->>'evidence_url',''))
    on conflict (project_id, key) do update set
      -- A user-set assumption is never replaced by a proposal. This is the
      -- rule the whole provenance model rests on, so it lives in SQL rather
      -- than in whichever caller happens to be writing.
      label        = case when financial_assumptions.source = 'USER'
                          then financial_assumptions.label else excluded.label end,
      unit         = case when financial_assumptions.source = 'USER'
                          then financial_assumptions.unit else excluded.unit end,
      value_minor  = case when financial_assumptions.source = 'USER'
                          then financial_assumptions.value_minor else excluded.value_minor end,
      value_int    = case when financial_assumptions.source = 'USER'
                          then financial_assumptions.value_int else excluded.value_int end,
      source       = case when financial_assumptions.source = 'USER'
                          then 'USER' else excluded.source end,
      confidence   = case when financial_assumptions.source = 'USER'
                          then financial_assumptions.confidence else excluded.confidence end,
      rationale    = case when financial_assumptions.source = 'USER'
                          then financial_assumptions.rationale else excluded.rationale end,
      evidence_url = case when financial_assumptions.source = 'USER'
                          then financial_assumptions.evidence_url else excluded.evidence_url end;

    v_new_assumptions := v_new_assumptions + 1;
  end loop;

  -- --- Cost lines ----------------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_costs)
  loop
    continue when nullif(btrim(coalesce(v_item->>'label','')), '') is null;

    insert into public.financial_costs
      (project_id, workspace_id, category, kind, label, amount_minor,
       every_months, source, confidence, rationale)
    values
      (v_project_id, v_run.workspace_id,
       v_item->>'category',
       v_item->>'kind',
       btrim(v_item->>'label'),
       greatest(coalesce((v_item->>'amount_minor')::bigint, 0), 0),
       greatest(least(coalesce((v_item->>'every_months')::integer, 1), 60), 1),
       coalesce(nullif(v_item->>'source',''), 'AI'),
       coalesce(nullif(v_item->>'confidence',''), 'medium'),
       nullif(v_item->>'rationale',''))
    on conflict (project_id, kind, category, label) do update set
      amount_minor = case when financial_costs.source = 'USER'
                          then financial_costs.amount_minor else excluded.amount_minor end,
      every_months = case when financial_costs.source = 'USER'
                          then financial_costs.every_months else excluded.every_months end,
      source       = case when financial_costs.source = 'USER'
                          then 'USER' else excluded.source end,
      confidence   = case when financial_costs.source = 'USER'
                          then financial_costs.confidence else excluded.confidence end,
      rationale    = case when financial_costs.source = 'USER'
                          then financial_costs.rationale else excluded.rationale end;

    v_new_costs := v_new_costs + 1;
  end loop;

  -- --- Sources -------------------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_sources)
  loop
    v_canonical := coalesce(v_item->>'canonical_url', v_item->>'url');
    continue when v_canonical is null or v_item->>'url' is null;

    insert into public.financial_sources
      (project_id, workspace_id, run_id, url, canonical_url, title, publisher,
       published_at, status, metadata)
    values
      (v_project_id, v_run.workspace_id, p_run_id,
       v_item->>'url', v_canonical,
       nullif(v_item->>'title',''),
       nullif(v_item->>'publisher',''),
       (v_item->>'published_at')::timestamptz,
       coalesce(nullif(v_item->>'status',''), 'retrieved'),
       coalesce(v_item->'metadata', '{}'::jsonb))
    on conflict (project_id, canonical_url) do nothing;

    if found then v_new_sources := v_new_sources + 1; end if;
  end loop;

  -- --- Funding options -----------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_funding)
  loop
    continue when nullif(btrim(coalesce(v_item->>'name','')), '') is null;

    v_source_id := null;
    if v_item->>'canonical_url' is not null then
      select id into v_source_id
      from public.financial_sources
      where project_id = v_project_id and canonical_url = v_item->>'canonical_url'
      limit 1;
    end if;

    insert into public.funding_options
      (project_id, workspace_id, source_id, name, provider, funding_type,
       geography, eligibility, amount_min_minor, amount_max_minor, terms,
       application_url, suitability, suitability_rationale, confidence)
    values
      (v_project_id, v_run.workspace_id, v_source_id,
       btrim(v_item->>'name'),
       nullif(v_item->>'provider',''),
       coalesce(nullif(v_item->>'funding_type',''), 'GRANT'),
       nullif(v_item->>'geography',''),
       nullif(v_item->>'eligibility',''),
       (v_item->>'amount_min_minor')::bigint,
       (v_item->>'amount_max_minor')::bigint,
       nullif(v_item->>'terms',''),
       nullif(v_item->>'application_url',''),
       coalesce(nullif(v_item->>'suitability',''), 'POSSIBLE'),
       nullif(v_item->>'suitability_rationale',''),
       coalesce(nullif(v_item->>'confidence',''), 'low'))
    on conflict (project_id, name) do update set
      source_id             = coalesce(excluded.source_id, funding_options.source_id),
      provider              = coalesce(excluded.provider, funding_options.provider),
      eligibility           = coalesce(excluded.eligibility, funding_options.eligibility),
      amount_min_minor      = coalesce(excluded.amount_min_minor, funding_options.amount_min_minor),
      amount_max_minor      = coalesce(excluded.amount_max_minor, funding_options.amount_max_minor),
      terms                 = coalesce(excluded.terms, funding_options.terms),
      application_url       = coalesce(excluded.application_url, funding_options.application_url),
      suitability           = excluded.suitability,
      suitability_rationale = coalesce(excluded.suitability_rationale, funding_options.suitability_rationale),
      confidence            = excluded.confidence;

    v_new_funding := v_new_funding + 1;
  end loop;

  -- --- Section results -----------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_results)
  loop
    update public.financial_results
       set is_current = false
     where project_id = v_project_id
       and section_key = v_item->>'section_key'
       and is_current;

    insert into public.financial_results
      (project_id, workspace_id, run_id, section_key, structured_content,
       confidence, status, version, is_current)
    values
      (v_project_id, v_run.workspace_id, p_run_id,
       v_item->>'section_key',
       coalesce(v_item->'structured_content', '{}'::jsonb),
       coalesce(nullif(v_item->>'confidence',''), 'medium'),
       coalesce(nullif(v_item->>'status',''), 'complete'),
       coalesce((
         select max(version) + 1 from public.financial_results
         where project_id = v_project_id and section_key = v_item->>'section_key'
       ), 1),
       true);
  end loop;

  -- --- Stage attempt -------------------------------------------------------
  update public.financial_run_stages
     set status          = 'succeeded',
         completed_at    = timezone('utc', now()),
         prompt_tokens   = (p_usage->>'prompt_tokens')::integer,
         output_tokens   = (p_usage->>'output_tokens')::integer,
         total_tokens    = (p_usage->>'total_tokens')::integer,
         duration_ms     = (p_usage->>'duration_ms')::integer,
         ai_usage_log_id = (p_usage->>'ai_usage_log_id')::uuid
   where run_id = p_run_id and stage = p_stage and attempt = p_attempt;

  -- --- Advance -------------------------------------------------------------
  update public.financial_runs
     set current_stage           = p_next_stage,
         status                  = case when p_next_stage is null then 'completed' else 'running' end,
         completed_at            = case when p_next_stage is null then timezone('utc', now()) else completed_at end,
         locked_at               = null,
         locked_stage            = null,
         last_stage_completed_at = timezone('utc', now()),
         total_tokens            = total_tokens + coalesce((p_usage->>'total_tokens')::integer, 0),
         estimated_cost_usd      = estimated_cost_usd + coalesce((p_usage->>'estimated_cost_usd')::numeric, 0),
         assumption_count        = (select count(*) from public.financial_assumptions where project_id = v_project_id),
         cost_line_count         = (select count(*) from public.financial_costs where project_id = v_project_id),
         funding_option_count    = (select count(*) from public.funding_options where project_id = v_project_id),
         source_count            = (select count(*) from public.financial_sources where project_id = v_project_id)
   where id = p_run_id;

  if p_next_stage is null then
    update public.financial_projects set status = 'completed' where id = v_project_id;
  end if;

  return jsonb_build_object(
    'assumptions_written', v_new_assumptions,
    'costs_written',       v_new_costs,
    'sources_added',       v_new_sources,
    'funding_written',     v_new_funding,
    'next_stage',          p_next_stage
  );
end;
$$;

grant execute on function public.financial_complete_stage(uuid, text, integer, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- ============================================================================
-- 15. Fail a stage
-- ============================================================================

create or replace function public.financial_fail_stage(
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
  v_run public.financial_runs%rowtype;
begin
  select * into v_run from public.financial_runs where id = p_run_id for update;
  if v_run.id is null then
    raise exception 'financial run not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  update public.financial_run_stages
     set status        = 'failed',
         completed_at  = timezone('utc', now()),
         error_code    = p_error_code,
         error_message = left(coalesce(p_error_message, ''), 2000),
         duration_ms   = (p_usage->>'duration_ms')::integer
   where run_id = p_run_id and stage = p_stage and attempt = p_attempt;

  -- current_stage is NOT touched. That is the whole point of this function.
  update public.financial_runs
     set status       = case when p_terminal then 'failed' else 'running' end,
         error        = left(coalesce(p_error_message, ''), 2000),
         locked_at    = null,
         locked_stage = null
   where id = p_run_id;

  if p_terminal then
    update public.financial_projects set status = 'failed' where id = v_run.project_id;
  end if;
end;
$$;

grant execute on function public.financial_fail_stage(uuid, text, integer, text, text, boolean, jsonb) to authenticated;

-- ============================================================================
-- 16. Update an assumption (the user override path)
--
-- The ONLY way a user edits the model. They change an assumption; the engine
-- recalculates. Calculated outputs are never writable — there is no function
-- here that accepts a revenue figure, because a revenue figure is not an input.
-- ============================================================================

create or replace function public.financial_set_assumption(
  p_project_id  uuid,
  p_key         text,
  p_unit        text,
  p_value_minor bigint default null,
  p_value_int   integer default null,
  p_label       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.financial_projects%rowtype;
  v_id      uuid;
begin
  select * into v_project from public.financial_projects where id = p_project_id;
  if v_project.id is null then
    raise exception 'financial project not found' using errcode = 'no_data_found';
  end if;
  if not public.can_edit_workspace(v_project.workspace_id) then
    raise exception 'not permitted to edit this financial model'
      using errcode = 'insufficient_privilege';
  end if;

  if p_unit not in ('money','count','bps','months') then
    raise exception 'unknown assumption unit: %', p_unit using errcode = 'check_violation';
  end if;
  if p_unit = 'money' and p_value_minor is null then
    raise exception 'a money assumption needs value_minor' using errcode = 'check_violation';
  end if;
  if p_unit <> 'money' and p_value_int is null then
    raise exception 'a non-money assumption needs value_int' using errcode = 'check_violation';
  end if;

  insert into public.financial_assumptions
    (project_id, workspace_id, key, label, unit, value_minor, value_int,
     source, confidence)
  values
    (p_project_id, v_project.workspace_id, p_key,
     coalesce(nullif(btrim(coalesce(p_label,'')),''), p_key),
     p_unit,
     case when p_unit = 'money' then p_value_minor else null end,
     case when p_unit = 'money' then null else p_value_int end,
     'USER', 'high')
  on conflict (project_id, key) do update set
    label       = coalesce(nullif(btrim(coalesce(p_label,'')),''), financial_assumptions.label),
    unit        = excluded.unit,
    value_minor = excluded.value_minor,
    value_int   = excluded.value_int,
    -- Editing promotes the row to USER, which is what stops the next run
    -- overwriting it.
    source      = 'USER',
    confidence  = 'high'
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.financial_set_assumption(uuid, text, text, bigint, integer, text) to authenticated;

-- ============================================================================
-- 17. Admin observability
--
-- Most of the admin panel picks this feature up for free: `ai_usage_logs` gains
-- `financial-*` rows the moment a stage runs, so /admin/ai, /admin/usage and
-- cost-by-workflow all include it without a line of code.
--
-- What does NOT come for free is the `feature` dimension of
-- `admin_cost_breakdown`, which would bucket financial spend as 'Other'. An
-- operator asking what Financial Intelligence costs would get a wrong answer
-- rather than no answer, which is worse. The function is REPLACED here rather
-- than edited in 0013/0015 — the applied files are untouched.
-- ============================================================================

create or replace function public.admin_cost_breakdown(
  p_dimension text,
  p_since     timestamptz default null,
  p_until     timestamptz default null,
  p_limit     integer     default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz := coalesce(p_since, timezone('utc', now()) - interval '30 days');
  v_until timestamptz := coalesce(p_until, timezone('utc', now()));
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 200);
  v_out   jsonb;
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = 'insufficient_privilege';
  end if;

  if not public.admin_has('usage.read') then
    raise exception 'permission denied: usage.read'
      using errcode = 'insufficient_privilege';
  end if;

  if p_dimension not in ('day', 'provider', 'model', 'workflow', 'feature', 'workspace') then
    raise exception 'unknown cost dimension: %', p_dimension
      using errcode = 'invalid_parameter_value';
  end if;

  with scoped as (
    select
      l.provider,
      l.model,
      l.workflow,
      l.workspace_id,
      l.status,
      l.total_tokens,
      l.estimated_cost_usd,
      date_trunc('day', l.created_at) as day,
      case
        when l.workflow like 'financial-%'      then 'Financial intelligence'
        when l.workflow like 'competitor-%'     then 'Competitor intelligence'
        when l.workflow like 'research-%'       then 'Market research'
        when l.workflow = 'business-plan'       then 'Business plans'
        when l.workflow = 'business-validator'  then 'Idea validator'
        else 'Other'
      end as feature
    from public.ai_usage_logs l
    where l.created_at >= v_since
      and l.created_at <= v_until
  ),
  grouped as (
    select
      case p_dimension
        when 'day'       then to_char(s.day, 'YYYY-MM-DD')
        when 'provider'  then coalesce(s.provider, 'unknown')
        when 'model'     then coalesce(s.model, 'unknown')
        when 'workflow'  then coalesce(s.workflow, 'unknown')
        when 'feature'   then s.feature
        when 'workspace' then coalesce(s.workspace_id::text, 'unassigned')
      end as key,
      count(*)                                        as requests,
      count(*) filter (where s.status = 'failed')     as failures,
      coalesce(sum(s.total_tokens), 0)                as tokens,
      coalesce(sum(s.estimated_cost_usd), 0)::numeric as cost
    from scoped s
    group by 1
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key',      g.key,
        'label',    case
                      when p_dimension = 'workspace' then coalesce(w.name, g.key)
                      else g.key
                    end,
        'requests', g.requests,
        'failures', g.failures,
        'tokens',   g.tokens,
        'cost',     g.cost::text
      )
      order by
        case when p_dimension = 'day' then g.key end asc,
        case when p_dimension <> 'day' then g.cost end desc
    ),
    '[]'::jsonb
  )
  into v_out
  from (
    select * from grouped
    order by
      case when p_dimension = 'day' then key end asc,
      case when p_dimension <> 'day' then cost end desc
    limit v_limit
  ) g
  left join public.workspaces w
    on p_dimension = 'workspace' and w.id::text = g.key;

  return jsonb_build_object(
    'dimension', p_dimension,
    'since',     v_since,
    'until',     v_until,
    'rows',      v_out
  );
end;
$$;

comment on function public.admin_cost_breakdown(text, timestamptz, timestamptz, integer) is
  'AI cost and usage aggregated in SQL. Phase 8 added the financial feature bucket.';

-- Financial operational counters, additive like the research and competitor
-- ones. Permission-gated per block, so an absent key means "you may not see
-- this" rather than zero.
create or replace function public.admin_financial_stats(
  p_since timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz := coalesce(p_since, timezone('utc', now()) - interval '30 days');
  v_out   jsonb := '{}'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = 'insufficient_privilege';
  end if;

  if public.admin_has('ai.read') then
    v_out := v_out || jsonb_build_object(
      'financial_projects',  (select count(*) from public.financial_projects where created_at >= v_since),
      'financial_runs',      (select count(*) from public.financial_runs where created_at >= v_since),
      'financial_completed', (select count(*) from public.financial_runs where created_at >= v_since and status = 'completed'),
      'financial_failed',    (select count(*) from public.financial_runs where created_at >= v_since and status = 'failed'),
      'financial_assumptions', (select count(*) from public.financial_assumptions where created_at >= v_since),
      'funding_options',     (select count(*) from public.funding_options where created_at >= v_since),
      'financial_stage_failures', (select count(*) from public.financial_run_stages
                                    where started_at >= v_since and status = 'failed')
    );
  end if;

  if public.admin_has('credits.read') then
    v_out := v_out || jsonb_build_object(
      'financial_credits_charged',  (select coalesce(sum(credits_charged), 0)
                                       from public.financial_run_stages where started_at >= v_since),
      'financial_credits_refunded', (select coalesce(sum(credits_refunded), 0)
                                       from public.financial_run_stages where started_at >= v_since)
    );
  end if;

  return v_out || jsonb_build_object('since', v_since);
end;
$$;

grant execute on function public.admin_financial_stats(timestamptz) to authenticated;
revoke all on function public.admin_financial_stats(timestamptz) from anon;

