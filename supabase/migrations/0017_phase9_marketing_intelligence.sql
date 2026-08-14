-- ============================================================================
-- Sprint 8 / Phase 9 — Marketing & Go-To-Market Intelligence
--
-- Additive only. Migrations 0001–0016 are applied and are never edited: this
-- file creates new objects and uses `create or replace` for the two shared
-- admin aggregates it extends, exactly as 0016 did to 0013's versions.
--
-- ---------------------------------------------------------------------------
-- The two structural guarantees this schema enforces
-- ---------------------------------------------------------------------------
-- 1. NO NUMBER A MODEL WROTE IS AUTHORITATIVE.
--    `gtm_channels.score_bps` and `.priority` are written by the deterministic
--    rubric in `features/marketing/scoring.ts`, never by a completion.
--    `gtm_results` rows for acquisition economics come from
--    `features/marketing/calc/acquisition.ts`. The stage that produces them
--    (`acquisition_economics`) is seeded at ZERO credits precisely because it
--    calls no provider — a non-zero cost there would mean a model had entered
--    the arithmetic path.
--
-- 2. EVERY STATEMENT CARRIES ITS EPISTEMIC STATUS.
--    `gtm_claims.kind` is NOT NULL over a constrained vocabulary, and a row of
--    kind 'FACT' must carry a source. A marketing plan is mostly claims about
--    people who are not in the room; the difference between "dentists book by
--    phone" and "we assume dentists book by phone" is the difference between a
--    plan and a wish.
--
-- There is no client INSERT or UPDATE policy on any table below. Every write
-- goes through a security-definer function that re-derives permission from
-- auth.uid(). No service-role client exists anywhere in the application.
-- ============================================================================

-- ============================================================================
-- 1. Entitlement
--
-- Seeded across every plan. Without a row `canAccess` finds nothing and fails
-- closed for every customer including enterprise — the bug Phase 8 hit.
--
-- §25: a dedicated entitlement. Access is NOT inferred from `market_research`
-- or any other flag; owning market research says nothing about whether a plan
-- includes go-to-market work.
-- ============================================================================

insert into public.plan_entitlements (plan_id, feature, is_enabled, limit_value)
values
  ('free','marketing_intelligence',         false, 0),
  ('starter','marketing_intelligence',      false, 0),
  ('growth','marketing_intelligence',       true,  10),
  ('professional','marketing_intelligence', true,  100),
  ('enterprise','marketing_intelligence',   true,  null)
on conflict (plan_id, feature) do nothing;

-- ============================================================================
-- 2. Stage costs
--
-- The single authority. The engine charges from these rows and the estimator
-- sums the same ones, so a quote and a charge cannot drift apart.
-- ============================================================================

create table if not exists public.gtm_stage_costs (
  stage    text primary key check (stage in (
             'gtm_planning','icp_persona','positioning_messaging',
             'channel_strategy','content_campaign_strategy','sales_funnel',
             'acquisition_economics','gtm_90_day_plan')),
  credits  integer not null check (credits >= 0)
);

comment on table public.gtm_stage_costs is
  'Credit cost per GTM stage. acquisition_economics is 0 because it runs a deterministic calculation, not a model.';

insert into public.gtm_stage_costs (stage, credits) values
  ('gtm_planning',              8),
  ('icp_persona',              15),
  ('positioning_messaging',    15),
  ('channel_strategy',         30),
  ('content_campaign_strategy',15),
  ('sales_funnel',             10),
  ('acquisition_economics',     0),
  ('gtm_90_day_plan',          12)
on conflict (stage) do nothing;

-- ============================================================================
-- 3. Projects
-- ============================================================================

create table if not exists public.gtm_projects (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,

  -- Provenance across the whole product chain. `set null` rather than cascade:
  -- deleting the source must not destroy a plan already paid for.
  business_idea_id      uuid references public.business_ideas (id) on delete set null,
  business_plan_id      uuid references public.business_plans (id) on delete set null,
  research_request_id   uuid references public.research_requests (id) on delete set null,
  competitor_project_id uuid references public.competitor_projects (id) on delete set null,
  financial_project_id  uuid references public.financial_projects (id) on delete set null,

  title             text not null check (length(btrim(title)) between 1 and 200),
  description       text check (length(description) <= 4000),
  industry          text check (length(industry) <= 200),
  geography         text check (length(geography) <= 200),

  -- ISO 4217. Required, never defaulted silently — a budget whose currency was
  -- assumed is a budget that means nothing.
  currency          text not null check (currency ~ '^[A-Z]{3}$'),

  -- The motion decides the funnel template, which decides almost everything
  -- downstream. Constrained so a restaurant cannot be handed a SaaS funnel.
  motion            text check (motion in (
                      'SELF_SERVE','INBOUND_SALES','OUTBOUND_SALES',
                      'FIELD_LOCAL','MARKETPLACE_LISTING','RETAIL_ECOMMERCE')),

  -- A TARGET chosen by the business, not a forecast. Named so it reads that way
  -- everywhere it is selected.
  target_new_customers  integer not null default 0 check (target_new_customers >= 0),
  target_horizon_months integer not null default 12 check (target_horizon_months between 1 and 24),

  -- Acquisition policy. Both are business choices, both feed the deterministic
  -- CAC ceiling, and neither is ever proposed by a model.
  payback_months        integer not null default 6 check (payback_months between 1 and 60),
  target_ltv_cac_bps    integer not null default 30000 check (target_ltv_cac_bps between 10000 and 200000),

  status            text not null default 'draft'
                      check (status in ('draft','in_progress','completed','cancelled')),

  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

comment on column public.gtm_projects.target_new_customers is
  'A target the business chose. Every derived volume is what the target would require, never a prediction.';
comment on column public.gtm_projects.target_ltv_cac_bps is
  'Basis points. 30000 = 3.0x. Feeds the deterministic allowable-CAC ceiling.';

drop trigger if exists gtm_projects_set_updated_at on public.gtm_projects;
create trigger gtm_projects_set_updated_at
  before update on public.gtm_projects
  for each row execute function public.set_updated_at();

create index if not exists gtm_projects_workspace_idx
  on public.gtm_projects (workspace_id, created_at desc);
create index if not exists gtm_projects_status_idx
  on public.gtm_projects (status, created_at desc);
create index if not exists gtm_projects_plan_idx
  on public.gtm_projects (business_plan_id) where business_plan_id is not null;
create index if not exists gtm_projects_financial_idx
  on public.gtm_projects (financial_project_id) where financial_project_id is not null;

-- ============================================================================
-- 4. Runs and stage attempts
-- ============================================================================

create table if not exists public.gtm_runs (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.gtm_projects (id) on delete cascade,
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,

  status             text not null default 'pending'
                       check (status in ('pending','running','completed','failed','cancelled')),
  current_stage      text check (current_stage in (
                       'gtm_planning','icp_persona','positioning_messaging',
                       'channel_strategy','content_campaign_strategy','sales_funnel',
                       'acquisition_economics','gtm_90_day_plan')),

  credits_charged    integer not null default 0 check (credits_charged >= 0),
  credits_refunded   integer not null default 0 check (credits_refunded >= 0),
  total_tokens       integer not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0,
  claim_count        integer not null default 0,
  persona_count      integer not null default 0,
  channel_count      integer not null default 0,
  campaign_count     integer not null default 0,
  action_count       integer not null default 0,
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

drop trigger if exists gtm_runs_set_updated_at on public.gtm_runs;
create trigger gtm_runs_set_updated_at
  before update on public.gtm_runs
  for each row execute function public.set_updated_at();

create index if not exists gtm_runs_project_idx
  on public.gtm_runs (project_id, created_at desc);
create index if not exists gtm_runs_workspace_idx
  on public.gtm_runs (workspace_id, created_at desc);
create index if not exists gtm_runs_status_idx
  on public.gtm_runs (status, created_at desc);

create table if not exists public.gtm_run_stages (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references public.gtm_runs (id) on delete cascade,
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,

  stage             text not null check (stage in (
                      'gtm_planning','icp_persona','positioning_messaging',
                      'channel_strategy','content_campaign_strategy','sales_funnel',
                      'acquisition_economics','gtm_90_day_plan')),
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

create index if not exists gtm_run_stages_run_idx
  on public.gtm_run_stages (run_id, started_at);
create index if not exists gtm_run_stages_status_idx
  on public.gtm_run_stages (status, started_at desc);
create index if not exists gtm_run_stages_workspace_idx
  on public.gtm_run_stages (workspace_id);

-- ============================================================================
-- 5. Claims
--
-- The traceability table, and the analogue of `financial_assumptions`.
--
-- `kind` is NOT NULL over a constrained vocabulary. A row of kind 'FACT' must
-- carry `source_url`, enforced by a check constraint rather than by convention:
-- an uncited fact is the single most damaging thing a go-to-market plan can
-- contain, because it is the one a founder will repeat to an investor.
-- ============================================================================

create table if not exists public.gtm_claims (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.gtm_projects (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  run_id        uuid references public.gtm_runs (id) on delete set null,

  -- Which stage asserted it, and which part of the plan it belongs to.
  stage         text not null check (stage in (
                  'gtm_planning','icp_persona','positioning_messaging',
                  'channel_strategy','content_campaign_strategy','sales_funnel',
                  'acquisition_economics','gtm_90_day_plan')),
  topic         text not null check (length(topic) between 1 and 60),

  statement     text not null check (length(btrim(statement)) between 1 and 2000),
  kind          text not null check (kind in (
                  'FACT','EVIDENCE','INFERENCE','ASSUMPTION','RECOMMENDATION','TARGET')),
  rationale     text check (length(rationale) <= 2000),

  source_url    text check (length(source_url) <= 2000),
  source_host   text check (length(source_host) <= 253),

  confidence    text not null default 'medium' check (confidence in ('low','medium','high')),

  created_at    timestamptz not null default timezone('utc', now()),

  -- The rule, in the schema rather than in a code comment.
  constraint gtm_claims_fact_needs_source
    check (kind <> 'FACT' or source_url is not null)
);

comment on constraint gtm_claims_fact_needs_source on public.gtm_claims is
  'A FACT without a citation is an assumption wearing a costume. Store it as ASSUMPTION or INFERENCE instead.';

create index if not exists gtm_claims_project_idx
  on public.gtm_claims (project_id, stage, created_at);
create index if not exists gtm_claims_workspace_idx
  on public.gtm_claims (workspace_id);
create index if not exists gtm_claims_kind_idx
  on public.gtm_claims (project_id, kind);

-- ============================================================================
-- 6. Personas
--
-- Attribute lists live in jsonb because each entry is a claim object with its
-- own kind and confidence, and normalising six parallel one-to-many tables
-- would buy nothing: nothing queries "all pain points across all projects".
-- ============================================================================

create table if not exists public.gtm_personas (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.gtm_projects (id) on delete cascade,
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,

  name              text not null check (length(btrim(name)) between 1 and 300),
  role              text not null check (length(role) <= 300),
  segment           text check (length(segment) <= 300),
  company_type      text check (length(company_type) <= 300),
  company_size      text check (length(company_size) <= 300),
  geography         text check (length(geography) <= 300),

  -- Arrays of claim objects: {statement, kind, confidence, rationale?}.
  pain_points       jsonb not null default '[]'::jsonb,
  goals             jsonb not null default '[]'::jsonb,
  buying_triggers   jsonb not null default '[]'::jsonb,
  objections        jsonb not null default '[]'::jsonb,
  decision_criteria jsonb not null default '[]'::jsonb,

  urgency           text check (length(urgency) <= 2000),
  budget_signals    text check (length(budget_signals) <= 2000),
  is_decision_maker boolean not null default false,
  confidence        text not null default 'medium' check (confidence in ('low','medium','high')),

  display_order     integer not null default 0,
  created_at        timestamptz not null default timezone('utc', now())
);

create index if not exists gtm_personas_project_idx
  on public.gtm_personas (project_id, display_order);
create index if not exists gtm_personas_workspace_idx
  on public.gtm_personas (workspace_id);

-- ============================================================================
-- 7. Channels
--
-- `score_bps` and `priority` are written by the deterministic rubric. The model
-- supplies `ratings` (0–5 per dimension) and prose; it has no field anywhere in
-- its contract for a score or a priority.
--
-- `contributions` stores the per-dimension breakdown so the report can show its
-- working — the whole answer to §10's ban on unexplained "Channel X = 93%".
-- ============================================================================

create table if not exists public.gtm_channels (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.gtm_projects (id) on delete cascade,
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,

  channel               text not null check (channel in (
                          'seo','google_search','linkedin','facebook','instagram',
                          'youtube','email','outbound_sales','partnerships',
                          'referrals','communities','marketplaces','local_offline')),

  rationale             text check (length(rationale) <= 2000),
  target_audience       text check (length(target_audience) <= 2000),
  acquisition_mechanism text check (length(acquisition_mechanism) <= 2000),

  effort                text not null check (effort in ('LOW','MEDIUM','HIGH')),
  cost_band             text not null check (cost_band in ('LOW','MEDIUM','HIGH','VARIABLE')),

  strengths             jsonb not null default '[]'::jsonb,
  weaknesses            jsonb not null default '[]'::jsonb,
  prerequisites         jsonb not null default '[]'::jsonb,

  -- The model's contribution: integers 0–5 on the published dimensions.
  ratings               jsonb not null default '{}'::jsonb,
  -- The engine's: per-dimension contribution in basis points.
  contributions         jsonb not null default '[]'::jsonb,

  score_bps             integer not null default 0 check (score_bps between 0 and 10000),
  priority              text not null check (priority in (
                          'PRIMARY','SECONDARY','EXPERIMENTAL','NOT_RECOMMENDED')),
  priority_note         text check (length(priority_note) <= 500),

  evidence_url          text check (length(evidence_url) <= 2000),
  evidence_host         text check (length(evidence_host) <= 253),
  evidence_note         text check (length(evidence_note) <= 2000),

  confidence            text not null default 'medium' check (confidence in ('low','medium','high')),

  created_at            timestamptz not null default timezone('utc', now()),

  unique (project_id, channel)
);

comment on column public.gtm_channels.score_bps is
  'Computed by features/marketing/scoring.ts from the ratings column. No model writes this.';

create index if not exists gtm_channels_project_idx
  on public.gtm_channels (project_id, score_bps desc);
create index if not exists gtm_channels_workspace_idx
  on public.gtm_channels (workspace_id);
create index if not exists gtm_channels_priority_idx
  on public.gtm_channels (project_id, priority);

-- ============================================================================
-- 8. Funnel steps
--
-- A first-class table rather than jsonb because the compute stage READS these
-- rows to back-solve required volumes. Anything the calculation engine consumes
-- has to be queryable and constrained, not parsed out of a blob.
-- ============================================================================

create table if not exists public.gtm_funnel_steps (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.gtm_projects (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,

  step_order    integer not null check (step_order >= 0),
  from_stage    text not null check (length(from_stage) <= 40),
  to_stage      text not null check (length(to_stage) <= 40),

  -- Basis points. 10000 = 100%. Integer, so a rate cannot be a float.
  rate_bps      integer not null check (rate_bps between 0 and 10000),
  kind          text not null default 'ASSUMPTION' check (kind in (
                  'FACT','EVIDENCE','INFERENCE','ASSUMPTION','RECOMMENDATION','TARGET')),
  rationale     text check (length(rationale) <= 2000),
  confidence    text not null default 'medium' check (confidence in ('low','medium','high')),

  created_at    timestamptz not null default timezone('utc', now()),

  unique (project_id, step_order)
);

comment on column public.gtm_funnel_steps.rate_bps is
  'Whole basis points. Read by the deterministic acquisition engine; never multiplied by a model.';

create index if not exists gtm_funnel_steps_project_idx
  on public.gtm_funnel_steps (project_id, step_order);
create index if not exists gtm_funnel_steps_workspace_idx
  on public.gtm_funnel_steps (workspace_id);

-- ============================================================================
-- 9. Campaigns
-- ============================================================================

create table if not exists public.gtm_campaigns (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.gtm_projects (id) on delete cascade,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,

  name           text not null check (length(btrim(name)) between 1 and 300),
  objective      text not null check (objective in (
                   'AWARENESS','LEAD_GENERATION','DEMO_CONSULTATION',
                   'CONVERSION','RETARGETING','RETENTION_REFERRAL')),
  audience       text check (length(audience) <= 2000),
  message        text check (length(message) <= 2000),
  offer          text check (length(offer) <= 2000),
  channels       jsonb not null default '[]'::jsonb,
  call_to_action text check (length(call_to_action) <= 300),
  funnel_band    text not null check (funnel_band in ('TOFU','MOFU','BOFU')),
  measurement_kpi text not null check (length(measurement_kpi) <= 40),
  confidence     text not null default 'medium' check (confidence in ('low','medium','high')),

  display_order  integer not null default 0,
  created_at     timestamptz not null default timezone('utc', now())
);

create index if not exists gtm_campaigns_project_idx
  on public.gtm_campaigns (project_id, display_order);
create index if not exists gtm_campaigns_workspace_idx
  on public.gtm_campaigns (workspace_id);

-- ============================================================================
-- 10. 90-day plan actions
-- ============================================================================

create table if not exists public.gtm_plan_actions (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.gtm_projects (id) on delete cascade,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,

  period          text not null check (period in ('DAYS_1_30','DAYS_31_60','DAYS_61_90')),
  objective       text not null check (length(objective) <= 300),
  action          text not null check (length(btrim(action)) between 1 and 2000),
  channel         text check (length(channel) <= 40),
  owner_role      text not null check (owner_role in (
                    'FOUNDER','MARKETING','SALES','PRODUCT','AGENCY_FREELANCER')),
  kpi             text not null check (length(kpi) <= 40),
  expected_output text check (length(expected_output) <= 2000),
  dependency      text check (length(dependency) <= 300),
  priority        text not null check (priority in ('P1','P2','P3')),

  display_order   integer not null default 0,
  created_at      timestamptz not null default timezone('utc', now())
);

create index if not exists gtm_plan_actions_project_idx
  on public.gtm_plan_actions (project_id, period, display_order);
create index if not exists gtm_plan_actions_workspace_idx
  on public.gtm_plan_actions (workspace_id);

-- ============================================================================
-- 11. Sources
--
-- Provider citations only. A URL a model wrote is not a source, and the mapper
-- drops any host the retrieval provider did not actually return.
-- ============================================================================

create table if not exists public.gtm_sources (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.gtm_projects (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  run_id        uuid references public.gtm_runs (id) on delete set null,

  url           text not null check (length(url) <= 2000),
  canonical_url text check (length(canonical_url) <= 2000),
  title         text check (length(title) <= 500),
  publisher     text check (length(publisher) <= 300),
  published_at  timestamptz,
  status        text not null default 'retrieved'
                  check (status in ('retrieved','unreachable','rejected')),
  metadata      jsonb not null default '{}'::jsonb,

  retrieved_at  timestamptz not null default timezone('utc', now()),
  created_at    timestamptz not null default timezone('utc', now())
);

create index if not exists gtm_sources_project_idx
  on public.gtm_sources (project_id, retrieved_at desc);
create index if not exists gtm_sources_workspace_idx
  on public.gtm_sources (workspace_id);

-- ============================================================================
-- 12. Results (report sections, versioned)
-- ============================================================================

create table if not exists public.gtm_results (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.gtm_projects (id) on delete cascade,
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  run_id             uuid references public.gtm_runs (id) on delete set null,

  section_key        text not null,
  structured_content jsonb not null default '{}'::jsonb,
  confidence         text not null default 'medium' check (confidence in ('low','medium','high')),
  status             text not null default 'complete'
                       check (status in ('complete','partial','insufficient_evidence')),

  version            integer not null default 1 check (version >= 1),
  is_current         boolean not null default true,

  created_at         timestamptz not null default timezone('utc', now()),
  updated_at         timestamptz not null default timezone('utc', now())
);

drop trigger if exists gtm_results_set_updated_at on public.gtm_results;
create trigger gtm_results_set_updated_at
  before update on public.gtm_results
  for each row execute function public.set_updated_at();

create unique index if not exists gtm_results_current_idx
  on public.gtm_results (project_id, section_key) where is_current;
create index if not exists gtm_results_project_idx
  on public.gtm_results (project_id, section_key);
create index if not exists gtm_results_history_idx
  on public.gtm_results (project_id, section_key, version desc);
create index if not exists gtm_results_workspace_idx
  on public.gtm_results (workspace_id);

-- ============================================================================
-- 13. Row level security
--
-- Read-only for members. There is deliberately NO insert or update policy on
-- any table above: every write goes through a security-definer function below,
-- which is the only place workspace ownership of a linked record can actually
-- be validated.
-- ============================================================================

alter table public.gtm_stage_costs   enable row level security;
alter table public.gtm_projects      enable row level security;
alter table public.gtm_runs          enable row level security;
alter table public.gtm_run_stages    enable row level security;
alter table public.gtm_claims        enable row level security;
alter table public.gtm_personas      enable row level security;
alter table public.gtm_channels      enable row level security;
alter table public.gtm_funnel_steps  enable row level security;
alter table public.gtm_campaigns     enable row level security;
alter table public.gtm_plan_actions  enable row level security;
alter table public.gtm_sources       enable row level security;
alter table public.gtm_results       enable row level security;

drop policy if exists "Anyone signed in can read gtm stage costs" on public.gtm_stage_costs;
create policy "Anyone signed in can read gtm stage costs"
  on public.gtm_stage_costs for select to authenticated using (true);

drop policy if exists "Members read their workspace gtm projects" on public.gtm_projects;
create policy "Members read their workspace gtm projects"
  on public.gtm_projects for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace gtm runs" on public.gtm_runs;
create policy "Members read their workspace gtm runs"
  on public.gtm_runs for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace gtm stages" on public.gtm_run_stages;
create policy "Members read their workspace gtm stages"
  on public.gtm_run_stages for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace gtm claims" on public.gtm_claims;
create policy "Members read their workspace gtm claims"
  on public.gtm_claims for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace gtm personas" on public.gtm_personas;
create policy "Members read their workspace gtm personas"
  on public.gtm_personas for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace gtm channels" on public.gtm_channels;
create policy "Members read their workspace gtm channels"
  on public.gtm_channels for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace gtm funnel steps" on public.gtm_funnel_steps;
create policy "Members read their workspace gtm funnel steps"
  on public.gtm_funnel_steps for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace gtm campaigns" on public.gtm_campaigns;
create policy "Members read their workspace gtm campaigns"
  on public.gtm_campaigns for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace gtm plan actions" on public.gtm_plan_actions;
create policy "Members read their workspace gtm plan actions"
  on public.gtm_plan_actions for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace gtm sources" on public.gtm_sources;
create policy "Members read their workspace gtm sources"
  on public.gtm_sources for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace gtm results" on public.gtm_results;
create policy "Members read their workspace gtm results"
  on public.gtm_results for select using (public.is_workspace_member(workspace_id));

-- --- Admin read access (migration 0008 RBAC) --------------------------------
--
-- The same grant that governs the research, competitor and financial tables. An
-- admin reads across workspaces through a policy, never through a service-role
-- key — there is no service-role client anywhere in this application.

drop policy if exists "Admins read all gtm projects" on public.gtm_projects;
create policy "Admins read all gtm projects"
  on public.gtm_projects for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all gtm runs" on public.gtm_runs;
create policy "Admins read all gtm runs"
  on public.gtm_runs for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all gtm stages" on public.gtm_run_stages;
create policy "Admins read all gtm stages"
  on public.gtm_run_stages for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all gtm claims" on public.gtm_claims;
create policy "Admins read all gtm claims"
  on public.gtm_claims for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all gtm channels" on public.gtm_channels;
create policy "Admins read all gtm channels"
  on public.gtm_channels for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all gtm results" on public.gtm_results;
create policy "Admins read all gtm results"
  on public.gtm_results for select using (public.admin_has('ai.read'));

-- ============================================================================
-- 14. Credit estimate
-- ============================================================================

create or replace function public.gtm_estimate_credits()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(credits), 0)::integer from public.gtm_stage_costs;
$$;

grant execute on function public.gtm_estimate_credits() to authenticated;
revoke all on function public.gtm_estimate_credits() from anon;

-- ============================================================================
-- 15. Create a project
--
-- The ONLY write path. Re-derives workspace edit permission from auth.uid()
-- and refuses any linked record that belongs to a different workspace — a
-- check an RLS policy cannot express, which is why there is no insert policy.
-- ============================================================================

create or replace function public.gtm_create_project(
  p_workspace_id           uuid,
  p_title                  text,
  p_currency               text,
  p_description            text default null,
  p_industry               text default null,
  p_geography              text default null,
  p_motion                 text default null,
  p_target_new_customers   integer default 0,
  p_target_horizon_months  integer default 12,
  p_payback_months         integer default 6,
  p_target_ltv_cac_bps     integer default 30000,
  p_business_idea_id       uuid default null,
  p_business_plan_id       uuid default null,
  p_research_request_id    uuid default null,
  p_competitor_project_id  uuid default null,
  p_financial_project_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select role into v_role
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = auth.uid();

  if v_role is null then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;
  if v_role not in ('owner', 'admin', 'editor') then
    raise exception 'your role cannot create a marketing plan'
      using errcode = 'insufficient_privilege';
  end if;

  -- Cross-workspace linkage is refused rather than silently nulled: a plan that
  -- claims to be built on a business plan from another workspace is a leak.
  if p_business_idea_id is not null and not exists (
    select 1 from public.business_ideas
    where id = p_business_idea_id and workspace_id = p_workspace_id
  ) then
    raise exception 'that business idea belongs to another workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if p_business_plan_id is not null and not exists (
    select 1 from public.business_plans
    where id = p_business_plan_id and workspace_id = p_workspace_id
  ) then
    raise exception 'that business plan belongs to another workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if p_research_request_id is not null and not exists (
    select 1 from public.research_requests
    where id = p_research_request_id and workspace_id = p_workspace_id
  ) then
    raise exception 'that research request belongs to another workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if p_competitor_project_id is not null and not exists (
    select 1 from public.competitor_projects
    where id = p_competitor_project_id and workspace_id = p_workspace_id
  ) then
    raise exception 'that competitor project belongs to another workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if p_financial_project_id is not null and not exists (
    select 1 from public.financial_projects
    where id = p_financial_project_id and workspace_id = p_workspace_id
  ) then
    raise exception 'that financial model belongs to another workspace'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.gtm_projects (
    workspace_id, user_id, title, currency, description, industry, geography,
    motion, target_new_customers, target_horizon_months,
    payback_months, target_ltv_cac_bps,
    business_idea_id, business_plan_id, research_request_id,
    competitor_project_id, financial_project_id, status
  ) values (
    p_workspace_id, auth.uid(), p_title, upper(p_currency), p_description,
    p_industry, p_geography, p_motion,
    greatest(coalesce(p_target_new_customers, 0), 0),
    least(greatest(coalesce(p_target_horizon_months, 12), 1), 24),
    least(greatest(coalesce(p_payback_months, 6), 1), 60),
    least(greatest(coalesce(p_target_ltv_cac_bps, 30000), 10000), 200000),
    p_business_idea_id, p_business_plan_id, p_research_request_id,
    p_competitor_project_id, p_financial_project_id, 'draft'
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.gtm_create_project(
  uuid, text, text, text, text, text, text, integer, integer, integer, integer,
  uuid, uuid, uuid, uuid, uuid
) to authenticated;

-- ============================================================================
-- 16. Start (or resume) a run
--
-- One open run per project. A second parallel run would double-charge and race
-- on the same rows, so this returns the existing one instead of creating another.
-- ============================================================================

create or replace function public.gtm_start_run(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.gtm_projects%rowtype;
  v_run_id  uuid;
begin
  select * into v_project from public.gtm_projects where id = p_project_id;

  if v_project.id is null then
    raise exception 'marketing project not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_project.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;
  if v_project.status = 'completed' then
    raise exception 'this marketing plan is already complete'
      using errcode = 'invalid_parameter_value';
  end if;

  select id into v_run_id
  from public.gtm_runs
  where project_id = p_project_id and status in ('pending', 'running', 'failed')
  order by created_at desc
  limit 1;

  if v_run_id is not null then
    return v_run_id;
  end if;

  insert into public.gtm_runs (project_id, workspace_id, status, current_stage)
  values (p_project_id, v_project.workspace_id, 'pending', 'gtm_planning')
  returning id into v_run_id;

  update public.gtm_projects
     set status = case when status = 'draft' then 'in_progress' else status end
   where id = p_project_id;

  return v_run_id;
end;
$$;

grant execute on function public.gtm_start_run(uuid) to authenticated;

-- ============================================================================
-- 17. Claim a stage
--
-- Row lock first, then every precondition, then the attempt row. The lock is
-- what stops two browser tabs running the same stage and being charged twice.
-- ============================================================================

create or replace function public.gtm_claim_stage(
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
  v_run     public.gtm_runs%rowtype;
  v_stage   text;
  v_attempt integer;
  v_failed  integer;
begin
  select * into v_run from public.gtm_runs r where r.id = p_run_id for update;

  if v_run.id is null then
    raise exception 'marketing run not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;
  if v_run.status = 'completed' then
    raise exception 'this marketing run is already complete'
      using errcode = 'invalid_parameter_value';
  end if;
  if v_run.status = 'cancelled' then
    raise exception 'this marketing run was cancelled'
      using errcode = 'invalid_parameter_value';
  end if;

  if v_run.locked_at is not null
     and v_run.locked_at > timezone('utc', now()) - make_interval(secs => p_lock_timeout_ms / 1000.0)
  then
    raise exception 'stage % is already running for this run', coalesce(v_run.locked_stage, '?')
      using errcode = 'lock_not_available';
  end if;

  v_stage := coalesce(v_run.current_stage, 'gtm_planning');

  select count(*) into v_failed
  from public.gtm_run_stages s
  where s.run_id = p_run_id and s.stage = v_stage and s.status = 'failed';

  if exists (
    select 1 from public.gtm_run_stages s
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

  insert into public.gtm_run_stages (run_id, workspace_id, stage, attempt, status)
  values (p_run_id, v_run.workspace_id, v_stage, v_attempt, 'running');

  update public.gtm_runs
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

grant execute on function public.gtm_claim_stage(uuid, integer, integer) to authenticated;

-- ============================================================================
-- 18. Complete a stage
--
-- Persists everything the stage produced and advances the pointer, in ONE
-- transaction. A stage that persisted its rows but failed to advance would be
-- re-run and re-charged on the next click.
--
-- Note what this function does NOT accept: no score, no priority, no budget.
-- Those arrive inside `p_channels` and `p_results` already computed by the
-- deterministic modules, and the constraint on `gtm_channels.score_bps` is the
-- backstop.
-- ============================================================================

create or replace function public.gtm_complete_stage(
  p_run_id        uuid,
  p_stage         text,
  p_attempt       integer,
  p_next_stage    text default null,
  p_results       jsonb default '[]'::jsonb,
  p_claims        jsonb default '[]'::jsonb,
  p_personas      jsonb default '[]'::jsonb,
  p_channels      jsonb default '[]'::jsonb,
  p_funnel_steps  jsonb default '[]'::jsonb,
  p_campaigns     jsonb default '[]'::jsonb,
  p_plan_actions  jsonb default '[]'::jsonb,
  p_sources       jsonb default '[]'::jsonb,
  p_project_patch jsonb default '{}'::jsonb,
  p_usage         jsonb default '{}'::jsonb,
  p_credits       integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run        public.gtm_runs%rowtype;
  v_project_id uuid;
  v_ws         uuid;
  v_item       jsonb;
  v_version    integer;
  v_order      integer;
begin
  select * into v_run from public.gtm_runs where id = p_run_id for update;

  if v_run.id is null then
    raise exception 'marketing run not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  v_project_id := v_run.project_id;
  v_ws         := v_run.workspace_id;

  -- --- Project-level fields the planning stage establishes -----------------
  if p_project_patch ? 'motion' then
    update public.gtm_projects
       set motion = p_project_patch->>'motion'
     where id = v_project_id;
  end if;
  if p_project_patch ? 'target_new_customers' then
    update public.gtm_projects
       set target_new_customers = greatest((p_project_patch->>'target_new_customers')::integer, 0)
     where id = v_project_id;
  end if;
  if p_project_patch ? 'target_horizon_months' then
    update public.gtm_projects
       set target_horizon_months = least(greatest((p_project_patch->>'target_horizon_months')::integer, 1), 24)
     where id = v_project_id;
  end if;

  -- --- Claims ---------------------------------------------------------------
  for v_item in select * from jsonb_array_elements(coalesce(p_claims, '[]'::jsonb))
  loop
    insert into public.gtm_claims (
      project_id, workspace_id, run_id, stage, topic, statement, kind,
      rationale, source_url, source_host, confidence
    ) values (
      v_project_id, v_ws, p_run_id, p_stage,
      coalesce(v_item->>'topic', 'general'),
      v_item->>'statement',
      coalesce(v_item->>'kind', 'ASSUMPTION'),
      v_item->>'rationale',
      v_item->>'source_url',
      v_item->>'source_host',
      coalesce(v_item->>'confidence', 'medium')
    );
  end loop;

  -- --- Personas (replace: a re-run supersedes, it does not accumulate) ------
  if jsonb_array_length(coalesce(p_personas, '[]'::jsonb)) > 0 then
    delete from public.gtm_personas where project_id = v_project_id;
    v_order := 0;
    for v_item in select * from jsonb_array_elements(p_personas)
    loop
      insert into public.gtm_personas (
        project_id, workspace_id, name, role, segment, company_type, company_size,
        geography, pain_points, goals, buying_triggers, objections,
        decision_criteria, urgency, budget_signals, is_decision_maker,
        confidence, display_order
      ) values (
        v_project_id, v_ws,
        v_item->>'name', coalesce(v_item->>'role', ''), v_item->>'segment',
        v_item->>'company_type', v_item->>'company_size', v_item->>'geography',
        coalesce(v_item->'pain_points', '[]'::jsonb),
        coalesce(v_item->'goals', '[]'::jsonb),
        coalesce(v_item->'buying_triggers', '[]'::jsonb),
        coalesce(v_item->'objections', '[]'::jsonb),
        coalesce(v_item->'decision_criteria', '[]'::jsonb),
        v_item->>'urgency', v_item->>'budget_signals',
        coalesce((v_item->>'is_decision_maker')::boolean, false),
        coalesce(v_item->>'confidence', 'medium'), v_order
      );
      v_order := v_order + 1;
    end loop;
  end if;

  -- --- Channels -------------------------------------------------------------
  for v_item in select * from jsonb_array_elements(coalesce(p_channels, '[]'::jsonb))
  loop
    insert into public.gtm_channels (
      project_id, workspace_id, channel, rationale, target_audience,
      acquisition_mechanism, effort, cost_band, strengths, weaknesses,
      prerequisites, ratings, contributions, score_bps, priority, priority_note,
      evidence_url, evidence_host, evidence_note, confidence
    ) values (
      v_project_id, v_ws, v_item->>'channel', v_item->>'rationale',
      v_item->>'target_audience', v_item->>'acquisition_mechanism',
      coalesce(v_item->>'effort', 'MEDIUM'),
      coalesce(v_item->>'cost_band', 'MEDIUM'),
      coalesce(v_item->'strengths', '[]'::jsonb),
      coalesce(v_item->'weaknesses', '[]'::jsonb),
      coalesce(v_item->'prerequisites', '[]'::jsonb),
      coalesce(v_item->'ratings', '{}'::jsonb),
      coalesce(v_item->'contributions', '[]'::jsonb),
      coalesce((v_item->>'score_bps')::integer, 0),
      coalesce(v_item->>'priority', 'NOT_RECOMMENDED'),
      v_item->>'priority_note',
      v_item->>'evidence_url', v_item->>'evidence_host', v_item->>'evidence_note',
      coalesce(v_item->>'confidence', 'medium')
    )
    on conflict (project_id, channel) do update set
      rationale             = excluded.rationale,
      target_audience       = excluded.target_audience,
      acquisition_mechanism = excluded.acquisition_mechanism,
      effort                = excluded.effort,
      cost_band             = excluded.cost_band,
      strengths             = excluded.strengths,
      weaknesses            = excluded.weaknesses,
      prerequisites         = excluded.prerequisites,
      ratings               = excluded.ratings,
      contributions         = excluded.contributions,
      score_bps             = excluded.score_bps,
      priority              = excluded.priority,
      priority_note         = excluded.priority_note,
      evidence_url          = excluded.evidence_url,
      evidence_host         = excluded.evidence_host,
      evidence_note         = excluded.evidence_note,
      confidence            = excluded.confidence;
  end loop;

  -- --- Funnel steps (replace as a set: the funnel is one object) ------------
  if jsonb_array_length(coalesce(p_funnel_steps, '[]'::jsonb)) > 0 then
    delete from public.gtm_funnel_steps where project_id = v_project_id;
    v_order := 0;
    for v_item in select * from jsonb_array_elements(p_funnel_steps)
    loop
      insert into public.gtm_funnel_steps (
        project_id, workspace_id, step_order, from_stage, to_stage,
        rate_bps, kind, rationale, confidence
      ) values (
        v_project_id, v_ws, v_order, v_item->>'from_stage', v_item->>'to_stage',
        least(greatest(coalesce((v_item->>'rate_bps')::integer, 0), 0), 10000),
        coalesce(v_item->>'kind', 'ASSUMPTION'),
        v_item->>'rationale',
        coalesce(v_item->>'confidence', 'medium')
      );
      v_order := v_order + 1;
    end loop;
  end if;

  -- --- Campaigns ------------------------------------------------------------
  if jsonb_array_length(coalesce(p_campaigns, '[]'::jsonb)) > 0 then
    delete from public.gtm_campaigns where project_id = v_project_id;
    v_order := 0;
    for v_item in select * from jsonb_array_elements(p_campaigns)
    loop
      insert into public.gtm_campaigns (
        project_id, workspace_id, name, objective, audience, message, offer,
        channels, call_to_action, funnel_band, measurement_kpi, confidence,
        display_order
      ) values (
        v_project_id, v_ws, v_item->>'name', v_item->>'objective',
        v_item->>'audience', v_item->>'message', v_item->>'offer',
        coalesce(v_item->'channels', '[]'::jsonb),
        v_item->>'call_to_action',
        coalesce(v_item->>'funnel_band', 'TOFU'),
        coalesce(v_item->>'measurement_kpi', 'leads'),
        coalesce(v_item->>'confidence', 'medium'), v_order
      );
      v_order := v_order + 1;
    end loop;
  end if;

  -- --- 90-day plan actions --------------------------------------------------
  if jsonb_array_length(coalesce(p_plan_actions, '[]'::jsonb)) > 0 then
    delete from public.gtm_plan_actions where project_id = v_project_id;
    v_order := 0;
    for v_item in select * from jsonb_array_elements(p_plan_actions)
    loop
      insert into public.gtm_plan_actions (
        project_id, workspace_id, period, objective, action, channel,
        owner_role, kpi, expected_output, dependency, priority, display_order
      ) values (
        v_project_id, v_ws,
        coalesce(v_item->>'period', 'DAYS_1_30'),
        coalesce(v_item->>'objective', ''),
        v_item->>'action', v_item->>'channel',
        coalesce(v_item->>'owner_role', 'FOUNDER'),
        coalesce(v_item->>'kpi', 'leads'),
        v_item->>'expected_output', v_item->>'dependency',
        coalesce(v_item->>'priority', 'P2'), v_order
      );
      v_order := v_order + 1;
    end loop;
  end if;

  -- --- Sources --------------------------------------------------------------
  for v_item in select * from jsonb_array_elements(coalesce(p_sources, '[]'::jsonb))
  loop
    insert into public.gtm_sources (
      project_id, workspace_id, run_id, url, canonical_url, title, publisher,
      published_at, status, metadata
    ) values (
      v_project_id, v_ws, p_run_id, v_item->>'url', v_item->>'canonical_url',
      v_item->>'title', v_item->>'publisher',
      nullif(v_item->>'published_at', '')::timestamptz,
      coalesce(v_item->>'status', 'retrieved'),
      coalesce(v_item->'metadata', '{}'::jsonb)
    );
  end loop;

  -- --- Report sections, versioned ------------------------------------------
  for v_item in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb))
  loop
    select coalesce(max(version), 0) + 1 into v_version
    from public.gtm_results
    where project_id = v_project_id
      and section_key = v_item->>'section_key';

    update public.gtm_results
       set is_current = false
     where project_id = v_project_id
       and section_key = v_item->>'section_key'
       and is_current;

    insert into public.gtm_results (
      project_id, workspace_id, run_id, section_key, structured_content,
      confidence, status, version, is_current
    ) values (
      v_project_id, v_ws, p_run_id, v_item->>'section_key',
      coalesce(v_item->'structured_content', '{}'::jsonb),
      coalesce(v_item->>'confidence', 'medium'),
      coalesce(v_item->>'status', 'complete'),
      v_version, true
    );
  end loop;

  -- --- Attempt bookkeeping --------------------------------------------------
  update public.gtm_run_stages
     set status          = 'succeeded',
         completed_at    = timezone('utc', now()),
         credits_charged = coalesce(p_credits, 0),
         prompt_tokens   = nullif(p_usage->>'prompt_tokens', '')::integer,
         output_tokens   = nullif(p_usage->>'output_tokens', '')::integer,
         total_tokens    = nullif(p_usage->>'total_tokens', '')::integer,
         duration_ms     = nullif(p_usage->>'duration_ms', '')::integer,
         ai_usage_log_id = nullif(p_usage->>'ai_usage_log_id', '')::uuid
   where run_id = p_run_id and stage = p_stage and attempt = p_attempt;

  update public.gtm_runs
     set current_stage           = p_next_stage,
         status                  = case when p_next_stage is null then 'completed' else 'running' end,
         completed_at            = case when p_next_stage is null then timezone('utc', now()) else completed_at end,
         locked_at               = null,
         locked_stage            = null,
         last_stage_completed_at = timezone('utc', now()),
         credits_charged         = credits_charged + coalesce(p_credits, 0),
         total_tokens            = total_tokens + coalesce(nullif(p_usage->>'total_tokens', '')::integer, 0),
         estimated_cost_usd      = estimated_cost_usd + coalesce(nullif(p_usage->>'estimated_cost_usd', '')::numeric, 0),
         claim_count             = (select count(*) from public.gtm_claims where project_id = v_project_id),
         persona_count           = (select count(*) from public.gtm_personas where project_id = v_project_id),
         channel_count           = (select count(*) from public.gtm_channels where project_id = v_project_id),
         campaign_count          = (select count(*) from public.gtm_campaigns where project_id = v_project_id),
         action_count            = (select count(*) from public.gtm_plan_actions where project_id = v_project_id),
         source_count            = (select count(*) from public.gtm_sources where project_id = v_project_id)
   where id = p_run_id;

  if p_next_stage is null then
    update public.gtm_projects set status = 'completed' where id = v_project_id;
  end if;
end;
$$;

grant execute on function public.gtm_complete_stage(
  uuid, text, integer, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb,
  jsonb, jsonb, jsonb, integer
) to authenticated;

-- ============================================================================
-- 19. Fail a stage
--
-- Records the failure WITHOUT advancing the pointer, so a retry runs the same
-- stage. The refund is issued by the engine against the attempt's own key.
-- ============================================================================

create or replace function public.gtm_fail_stage(
  p_run_id        uuid,
  p_stage         text,
  p_attempt       integer,
  p_error_code    text,
  p_error_message text,
  p_credits_refunded integer default 0,
  p_usage         jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.gtm_runs%rowtype;
begin
  select * into v_run from public.gtm_runs where id = p_run_id for update;

  if v_run.id is null then
    raise exception 'marketing run not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  update public.gtm_run_stages
     set status           = 'failed',
         completed_at     = timezone('utc', now()),
         error_code       = p_error_code,
         error_message    = left(coalesce(p_error_message, ''), 2000),
         credits_refunded = coalesce(p_credits_refunded, 0),
         duration_ms      = nullif(p_usage->>'duration_ms', '')::integer
   where run_id = p_run_id and stage = p_stage and attempt = p_attempt;

  update public.gtm_runs
     set status           = 'failed',
         error            = left(coalesce(p_error_message, ''), 2000),
         locked_at        = null,
         locked_stage     = null,
         credits_refunded = credits_refunded + coalesce(p_credits_refunded, 0)
   where id = p_run_id;
end;
$$;

grant execute on function public.gtm_fail_stage(uuid, text, integer, text, text, integer, jsonb) to authenticated;

-- ============================================================================
-- 20. Admin observability
--
-- Additive, like the research/competitor/financial aggregates before it, and
-- counted in SQL. A JavaScript reduce over a PostgREST-capped result set
-- returns a plausible but short total, which is worse than no total.
--
-- Permission-gated per block, so an absent key means "you may not see this"
-- rather than zero.
-- ============================================================================

create or replace function public.admin_gtm_stats(
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
      'gtm_projects',       (select count(*) from public.gtm_projects where created_at >= v_since),
      'gtm_runs',           (select count(*) from public.gtm_runs where created_at >= v_since),
      'gtm_completed',      (select count(*) from public.gtm_runs where created_at >= v_since and status = 'completed'),
      'gtm_failed',         (select count(*) from public.gtm_runs where created_at >= v_since and status = 'failed'),
      'gtm_personas',       (select count(*) from public.gtm_personas where created_at >= v_since),
      'gtm_channels',       (select count(*) from public.gtm_channels where created_at >= v_since),
      'gtm_primary_channels', (select count(*) from public.gtm_channels
                                where created_at >= v_since and priority = 'PRIMARY'),
      'gtm_claims',         (select count(*) from public.gtm_claims where created_at >= v_since),
      'gtm_facts',          (select count(*) from public.gtm_claims
                              where created_at >= v_since and kind = 'FACT'),
      'gtm_assumptions',    (select count(*) from public.gtm_claims
                              where created_at >= v_since and kind = 'ASSUMPTION'),
      'gtm_stage_failures', (select count(*) from public.gtm_run_stages
                              where started_at >= v_since and status = 'failed')
    );
  end if;

  if public.admin_has('credits.read') then
    v_out := v_out || jsonb_build_object(
      'gtm_credits_charged',  (select coalesce(sum(credits_charged), 0)
                                 from public.gtm_run_stages where started_at >= v_since),
      'gtm_credits_refunded', (select coalesce(sum(credits_refunded), 0)
                                 from public.gtm_run_stages where started_at >= v_since)
    );
  end if;

  return v_out || jsonb_build_object('since', v_since);
end;
$$;

grant execute on function public.admin_gtm_stats(timestamptz) to authenticated;
revoke all on function public.admin_gtm_stats(timestamptz) from anon;

-- ============================================================================
-- 21. Cost analytics — add the marketing bucket
--
-- `create or replace` of the aggregate 0016 last replaced. The body is
-- identical apart from one additional bucket, so an already-deployed dashboard
-- keeps returning what it returned before, plus marketing.
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
        when l.workflow like 'gtm-%'            then 'Marketing intelligence'
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
  'AI cost and usage aggregated in SQL. Phase 9 added the marketing feature bucket.';
