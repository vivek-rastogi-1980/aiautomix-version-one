-- ============================================================
-- AIAutoMix migration bundle: part4_0018-0019.sql
-- Paste into the Supabase SQL Editor and Run.
--
-- Contains, in order:
--   0018_phase10_execution_foundation.sql
--   0019_client_onboarding.sql
--
-- The SQL Editor runs this as one transaction, so any error rolls
-- the whole bundle back with nothing half-applied. Every statement
-- is idempotent, so re-running after a fix is safe.
-- ============================================================


-- >>>>>>>>>>>>>>>>>>>>>>>> 0018_phase10_execution_foundation.sql >>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- Phase 10.1 — AI Business Execution Foundation
--
-- Additive only. Migrations 0001-0017 are applied and are never edited.
--
-- ---------------------------------------------------------------------------
-- The three guarantees this schema enforces
-- ---------------------------------------------------------------------------
-- 1. NO ACTION EXECUTES WITHOUT AN APPROVAL IT ACTUALLY HAS.
--    `execution_actions` carries a check constraint that an action in a
--    post-approval state must have both `approved_by` and `approved_at`. The
--    application enforces the state machine; this constraint means a bug in the
--    application cannot leave an unapproved row looking approved.
--
-- 2. NO EXTERNAL EFFECT HAPPENS TWICE BY ACCIDENT.
--    `execution_runs.idempotency_key` is UNIQUE. A duplicate dispatch does not
--    race — it collides, and the service reads the existing row instead of
--    creating a second one.
--
-- 3. THE APPROVAL RECORD CANNOT BE EDITED.
--    `execution_audit_logs` reuses `public.reject_audit_mutation()` from
--    migration 0008, so UPDATE and DELETE are refused for every role. Someone
--    who can rewrite the record of what they approved has a diary, not an audit
--    trail.
--
-- A NOTE ON REUSING THE AUDIT SYSTEM
-- ----------------------------------
-- Migration 0008's `admin_audit_logs` is for PLATFORM STAFF: `admin_log()`
-- raises unless `admin_role()` returns a role, and the table has no workspace
-- column. A workspace Editor approving their own action is not an admin, and
-- making them one — or granting normal users write access to the admin audit
-- log — would be a real security regression to satisfy a naming preference.
--
-- So this reuses the MECHANISM (the same append-only trigger function, the same
-- column shape, the same immutability guarantee) with a workspace-scoped table.
-- Admins read it through the same `admin_has('ai.read')` policy they use for
-- every other feature.
--
-- There is no client INSERT or UPDATE policy on any table below. Every write
-- goes through a security-definer function.
-- ============================================================================

-- ============================================================================
-- 1. Entitlement
--
-- Its own flag. Owning Marketing Intelligence means a workspace can PLAN
-- go-to-market work; it says nothing about whether that workspace may reach
-- outside AIAutoMix and change things. Different product, different risk.
-- ============================================================================

insert into public.plan_entitlements (plan_id, feature, is_enabled, limit_value)
values
  ('free','business_execution',         false, 0),
  ('starter','business_execution',      false, 0),
  ('growth','business_execution',       true,  25),
  ('professional','business_execution', true,  250),
  ('enterprise','business_execution',   true,  null)
on conflict (plan_id, feature) do nothing;

-- ============================================================================
-- 2. Execution plans
-- ============================================================================

create table if not exists public.execution_plans (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,

  -- Where the strategy came from. `set null` rather than cascade: deleting the
  -- source plan must not destroy the record of what was executed from it.
  gtm_project_id    uuid references public.gtm_projects (id) on delete set null,
  business_plan_id  uuid references public.business_plans (id) on delete set null,

  title             text not null check (length(btrim(title)) between 1 and 200),
  description       text check (length(description) <= 4000),

  status            text not null default 'DRAFT'
                      check (status in ('DRAFT','ACTIVE','PAUSED','COMPLETED','CANCELLED')),

  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

comment on table public.execution_plans is
  'A set of executable actions derived from an AI strategy. Pausing a plan blocks execution of every action in it.';

drop trigger if exists execution_plans_set_updated_at on public.execution_plans;
create trigger execution_plans_set_updated_at
  before update on public.execution_plans
  for each row execute function public.set_updated_at();

create index if not exists execution_plans_workspace_idx
  on public.execution_plans (workspace_id, created_at desc);
create index if not exists execution_plans_status_idx
  on public.execution_plans (status, created_at desc);
create index if not exists execution_plans_gtm_idx
  on public.execution_plans (gtm_project_id) where gtm_project_id is not null;

-- ============================================================================
-- 3. Execution actions
--
-- `retry_count` is server-owned: no RPC below accepts it as a parameter, and
-- the only thing that changes it is `execution_record_result`.
-- ============================================================================

create table if not exists public.execution_actions (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  execution_plan_id     uuid not null references public.execution_plans (id) on delete cascade,

  action_type           text not null check (action_type in (
                          'CREATE_LANDING_PAGE','GENERATE_CONTENT','CREATE_SOCIAL_POST',
                          'CREATE_BLOG_POST','CREATE_LEAD_FORM','CREATE_CRM_PIPELINE',
                          'CREATE_EMAIL_SEQUENCE','CREATE_ANALYTICS_CONFIGURATION')),

  title                 text not null check (length(btrim(title)) between 1 and 300),
  description           text check (length(description) <= 4000),

  -- Validated against the action type's registered Zod schema before it is
  -- ever stored, and again before dispatch.
  input                 jsonb not null default '{}'::jsonb,
  expected_output       jsonb not null default '{}'::jsonb,

  status                text not null default 'DRAFT'
                          check (status in (
                            'DRAFT','READY','AWAITING_APPROVAL','APPROVED',
                            'EXECUTING','COMPLETED','FAILED','CANCELLED')),

  approval_required     boolean not null default true,
  approved_by           uuid references auth.users (id) on delete set null,
  approved_at           timestamptz,

  execution_provider    text not null default 'mock' check (length(execution_provider) <= 40),
  external_execution_id text check (length(external_execution_id) <= 300),

  result                jsonb,
  error                 text check (length(error) <= 2000),
  error_code            text check (length(error_code) <= 60),

  -- Server-owned. No RPC accepts this as an argument.
  retry_count           integer not null default 0 check (retry_count >= 0 and retry_count <= 5),

  -- A completed action is terminal. Running the thing again means a NEW action
  -- that points back at this one, which keeps "did this run?" answerable.
  revision_of           uuid references public.execution_actions (id) on delete set null,

  display_order         integer not null default 0,

  created_at            timestamptz not null default timezone('utc', now()),
  updated_at            timestamptz not null default timezone('utc', now()),
  completed_at          timestamptz,

  -- GUARANTEE 1. An action past the approval gate must carry the approval.
  constraint execution_actions_approval_recorded check (
    approval_required = false
    or status not in ('APPROVED','EXECUTING','COMPLETED')
    or (approved_by is not null and approved_at is not null)
  )
);

comment on constraint execution_actions_approval_recorded on public.execution_actions is
  'An approval-required action cannot sit in a post-approval state without a named approver and a timestamp.';
comment on column public.execution_actions.retry_count is
  'Server-owned. No RPC accepts it as a parameter; only execution_record_result changes it.';
comment on column public.execution_actions.revision_of is
  'Set when this action was created to re-run a COMPLETED one. Completed actions are never re-executed in place.';

drop trigger if exists execution_actions_set_updated_at on public.execution_actions;
create trigger execution_actions_set_updated_at
  before update on public.execution_actions
  for each row execute function public.set_updated_at();

create index if not exists execution_actions_plan_idx
  on public.execution_actions (execution_plan_id, display_order);
create index if not exists execution_actions_workspace_idx
  on public.execution_actions (workspace_id, created_at desc);
create index if not exists execution_actions_status_idx
  on public.execution_actions (status, created_at desc);

-- ============================================================================
-- 4. Execution runs
--
-- One row per ATTEMPT, never overwritten. The history of what was tried is the
-- observability surface (§33) and the evidence for §16.
-- ============================================================================

create table if not exists public.execution_runs (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  action_id             uuid not null references public.execution_actions (id) on delete cascade,

  provider              text not null check (length(provider) <= 40),
  attempt               integer not null check (attempt >= 1),

  -- GUARANTEE 2. A duplicate dispatch collides here instead of racing.
  idempotency_key       text not null unique check (length(idempotency_key) <= 200),

  status                text not null default 'RUNNING'
                          check (status in ('RUNNING','SUCCEEDED','FAILED')),

  external_execution_id text check (length(external_execution_id) <= 300),
  -- A one-line summary, never a dump of the provider response. §16.
  result_summary        text check (length(result_summary) <= 1000),
  error_code            text check (length(error_code) <= 60),
  error_message         text check (length(error_message) <= 2000),

  started_at            timestamptz not null default timezone('utc', now()),
  completed_at          timestamptz,
  duration_ms           integer,

  unique (action_id, attempt)
);

comment on table public.execution_runs is
  'One row per execution attempt. Never contains credentials, tokens or full external payloads.';
comment on column public.execution_runs.idempotency_key is
  'Server-derived as exec:{action_id}:{attempt}. Unique, so a repeated dispatch collides rather than duplicating an external effect.';

create index if not exists execution_runs_action_idx
  on public.execution_runs (action_id, attempt);
create index if not exists execution_runs_workspace_idx
  on public.execution_runs (workspace_id, started_at desc);
create index if not exists execution_runs_status_idx
  on public.execution_runs (status, started_at desc);

-- ============================================================================
-- 5. Audit log
--
-- Workspace-scoped, append-only, reusing 0008's trigger function verbatim.
-- ============================================================================

create table if not exists public.execution_audit_logs (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  -- `restrict`: an actor cannot be deleted out from under the record of what
  -- they approved.
  actor_user_id     uuid not null references auth.users (id) on delete restrict,
  -- Denormalised on purpose: the actor's workspace role AT THE TIME. If they
  -- are later demoted, the record must still say what authority was used.
  actor_role        text not null check (length(actor_role) <= 40),

  event             text not null check (event in (
                      'PLAN_CREATED','PLAN_PAUSED','PLAN_RESUMED','PLAN_CANCELLED',
                      'ACTION_CREATED','ACTION_READY','ACTION_SUBMITTED_FOR_APPROVAL',
                      'ACTION_APPROVED','ACTION_REJECTED','ACTION_EXECUTION_STARTED',
                      'ACTION_EXECUTION_SUCCEEDED','ACTION_EXECUTION_FAILED',
                      'ACTION_RETRIED','ACTION_CANCELLED','ACTION_REVISED')),

  entity_type       text not null check (entity_type in ('execution_plan','execution_action')),
  entity_id         uuid not null,

  previous_state    text check (length(previous_state) <= 40),
  new_state         text check (length(new_state) <= 40),

  reason            text check (length(reason) <= 2000),
  metadata          jsonb not null default '{}'::jsonb,

  created_at        timestamptz not null default timezone('utc', now())
);

comment on table public.execution_audit_logs is
  'Immutable, workspace-scoped record of execution decisions. UPDATE and DELETE are rejected by trigger for every role. Must never contain secrets or provider credentials.';

drop trigger if exists execution_audit_logs_no_update on public.execution_audit_logs;
create trigger execution_audit_logs_no_update
  before update on public.execution_audit_logs
  for each row execute function public.reject_audit_mutation();

drop trigger if exists execution_audit_logs_no_delete on public.execution_audit_logs;
create trigger execution_audit_logs_no_delete
  before delete on public.execution_audit_logs
  for each row execute function public.reject_audit_mutation();

create index if not exists execution_audit_logs_workspace_idx
  on public.execution_audit_logs (workspace_id, created_at desc);
create index if not exists execution_audit_logs_entity_idx
  on public.execution_audit_logs (entity_type, entity_id, created_at desc);
create index if not exists execution_audit_logs_event_idx
  on public.execution_audit_logs (event, created_at desc);

-- ============================================================================
-- 6. Row level security
-- ============================================================================

alter table public.execution_plans      enable row level security;
alter table public.execution_actions    enable row level security;
alter table public.execution_runs       enable row level security;
alter table public.execution_audit_logs enable row level security;

drop policy if exists "Members read their workspace execution plans" on public.execution_plans;
create policy "Members read their workspace execution plans"
  on public.execution_plans for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace execution actions" on public.execution_actions;
create policy "Members read their workspace execution actions"
  on public.execution_actions for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace execution runs" on public.execution_runs;
create policy "Members read their workspace execution runs"
  on public.execution_runs for select using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace execution audit" on public.execution_audit_logs;
create policy "Members read their workspace execution audit"
  on public.execution_audit_logs for select using (public.is_workspace_member(workspace_id));

-- --- Admin read access (migration 0008 RBAC) --------------------------------

drop policy if exists "Admins read all execution plans" on public.execution_plans;
create policy "Admins read all execution plans"
  on public.execution_plans for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all execution actions" on public.execution_actions;
create policy "Admins read all execution actions"
  on public.execution_actions for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all execution runs" on public.execution_runs;
create policy "Admins read all execution runs"
  on public.execution_runs for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all execution audit" on public.execution_audit_logs;
create policy "Admins read all execution audit"
  on public.execution_audit_logs for select using (public.admin_has('ai.read'));

-- ============================================================================
-- 7. Audit helper
--
-- Internal: called by the functions below inside their own transaction, so an
-- action can never change state without the change being recorded.
-- ============================================================================

create or replace function public.execution_audit(
  p_workspace_id   uuid,
  p_event          text,
  p_entity_type    text,
  p_entity_id      uuid,
  p_previous_state text default null,
  p_new_state      text default null,
  p_reason         text default null,
  p_metadata       jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_id   uuid;
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

  insert into public.execution_audit_logs (
    workspace_id, actor_user_id, actor_role, event, entity_type, entity_id,
    previous_state, new_state, reason, metadata
  ) values (
    p_workspace_id, auth.uid(), v_role, p_event, p_entity_type, p_entity_id,
    p_previous_state, p_new_state, p_reason, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.execution_audit(
  uuid, text, text, uuid, text, text, text, jsonb
) to authenticated;

-- ============================================================================
-- 8. Create a plan
-- ============================================================================

create or replace function public.execution_create_plan(
  p_workspace_id     uuid,
  p_title            text,
  p_description      text default null,
  p_gtm_project_id   uuid default null,
  p_business_plan_id uuid default null
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
    raise exception 'your role cannot create an execution plan'
      using errcode = 'insufficient_privilege';
  end if;

  -- Cross-workspace linkage is refused rather than silently nulled.
  if p_gtm_project_id is not null and not exists (
    select 1 from public.gtm_projects
    where id = p_gtm_project_id and workspace_id = p_workspace_id
  ) then
    raise exception 'that marketing plan belongs to another workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if p_business_plan_id is not null and not exists (
    select 1 from public.business_plans
    where id = p_business_plan_id and workspace_id = p_workspace_id
  ) then
    raise exception 'that business plan belongs to another workspace'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.execution_plans (
    workspace_id, user_id, title, description, gtm_project_id, business_plan_id, status
  ) values (
    p_workspace_id, auth.uid(), p_title, p_description,
    p_gtm_project_id, p_business_plan_id, 'ACTIVE'
  )
  returning id into v_id;

  perform public.execution_audit(
    p_workspace_id, 'PLAN_CREATED', 'execution_plan', v_id, null, 'ACTIVE'
  );

  return v_id;
end;
$$;

grant execute on function public.execution_create_plan(uuid, text, text, uuid, uuid) to authenticated;

-- ============================================================================
-- 9. Add an action
--
-- `p_approval_required` comes from the registry, computed on the server from
-- the action type's side effect. It is passed rather than looked up here so the
-- rule lives in ONE place (TypeScript), but the constraint above means a
-- mistaken `false` still cannot produce an unapproved execution of an
-- approval-required action — the state machine and the check constraint both
-- refuse.
-- ============================================================================

create or replace function public.execution_add_action(
  p_plan_id           uuid,
  p_action_type       text,
  p_title             text,
  p_description       text default null,
  p_input             jsonb default '{}'::jsonb,
  p_expected_output   jsonb default '{}'::jsonb,
  p_approval_required boolean default true,
  p_provider          text default 'mock',
  p_display_order     integer default 0,
  p_revision_of       uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.execution_plans%rowtype;
  v_role text;
  v_id   uuid;
begin
  select * into v_plan from public.execution_plans where id = p_plan_id;

  if v_plan.id is null then
    raise exception 'execution plan not found' using errcode = 'no_data_found';
  end if;

  select role into v_role
  from public.workspace_members
  where workspace_id = v_plan.workspace_id and user_id = auth.uid();

  if v_role is null then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;
  if v_role not in ('owner', 'admin', 'editor') then
    raise exception 'your role cannot add execution actions'
      using errcode = 'insufficient_privilege';
  end if;

  if v_plan.status in ('CANCELLED', 'COMPLETED') then
    raise exception 'this plan is % and cannot take new actions', lower(v_plan.status)
      using errcode = 'invalid_parameter_value';
  end if;

  -- A revision must point at a completed action in the SAME plan.
  if p_revision_of is not null and not exists (
    select 1 from public.execution_actions
    where id = p_revision_of
      and execution_plan_id = p_plan_id
      and status = 'COMPLETED'
  ) then
    raise exception 'a revision must supersede a completed action in this plan'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.execution_actions (
    workspace_id, execution_plan_id, action_type, title, description,
    input, expected_output, approval_required, execution_provider,
    display_order, revision_of, status
  ) values (
    v_plan.workspace_id, p_plan_id, p_action_type, p_title, p_description,
    coalesce(p_input, '{}'::jsonb), coalesce(p_expected_output, '{}'::jsonb),
    coalesce(p_approval_required, true), coalesce(p_provider, 'mock'),
    coalesce(p_display_order, 0), p_revision_of, 'DRAFT'
  )
  returning id into v_id;

  perform public.execution_audit(
    v_plan.workspace_id,
    case when p_revision_of is null then 'ACTION_CREATED' else 'ACTION_REVISED' end,
    'execution_action', v_id, null, 'DRAFT', null,
    jsonb_build_object('action_type', p_action_type, 'revision_of', p_revision_of)
  );

  return v_id;
end;
$$;

grant execute on function public.execution_add_action(
  uuid, text, text, text, jsonb, jsonb, boolean, text, integer, uuid
) to authenticated;

-- ============================================================================
-- 10. Transition an action
--
-- The single write path for status. Takes the state the caller BELIEVES the
-- action is in and refuses if it has moved — an optimistic-concurrency check
-- that stops two tabs approving and executing the same action in a race.
--
-- The transition table is duplicated here from TypeScript on purpose. The
-- application is the primary enforcement point; this is the backstop, and a
-- backstop that trusts the thing it is backing up is decorative. The smoke
-- suite asserts the two agree.
-- ============================================================================

create or replace function public.execution_transition(
  p_action_id      uuid,
  p_expected_state text,
  p_new_state      text,
  p_reason         text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action public.execution_actions%rowtype;
  v_plan   public.execution_plans%rowtype;
  v_role   text;
  v_event  text;
begin
  select * into v_action from public.execution_actions where id = p_action_id for update;

  if v_action.id is null then
    raise exception 'execution action not found' using errcode = 'no_data_found';
  end if;

  select role into v_role
  from public.workspace_members
  where workspace_id = v_action.workspace_id and user_id = auth.uid();

  if v_role is null then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;
  if v_role not in ('owner', 'admin', 'editor') then
    raise exception 'your role cannot change execution actions'
      using errcode = 'insufficient_privilege';
  end if;

  if v_action.status <> p_expected_state then
    raise exception 'this action is now %, not %', v_action.status, p_expected_state
      using errcode = 'invalid_parameter_value';
  end if;

  -- The transition table.
  if not (
       (p_expected_state = 'DRAFT'             and p_new_state in ('READY','CANCELLED'))
    or (p_expected_state = 'READY'             and p_new_state in ('AWAITING_APPROVAL','EXECUTING','DRAFT','CANCELLED'))
    or (p_expected_state = 'AWAITING_APPROVAL' and p_new_state in ('APPROVED','READY','CANCELLED'))
    or (p_expected_state = 'APPROVED'          and p_new_state in ('EXECUTING','CANCELLED'))
    or (p_expected_state = 'EXECUTING'         and p_new_state in ('COMPLETED','FAILED'))
    or (p_expected_state = 'FAILED'            and p_new_state in ('EXECUTING','CANCELLED'))
  ) then
    raise exception 'an action cannot go from % to %', p_expected_state, p_new_state
      using errcode = 'invalid_parameter_value';
  end if;

  -- THE approval gate, restated in SQL.
  if p_new_state = 'EXECUTING'
     and v_action.approval_required
     and (v_action.approved_by is null or v_action.approved_at is null)
  then
    raise exception 'this action needs approval before it can run'
      using errcode = 'insufficient_privilege';
  end if;

  -- A paused or cancelled plan blocks execution of everything in it.
  if p_new_state = 'EXECUTING' then
    select * into v_plan from public.execution_plans where id = v_action.execution_plan_id;
    if v_plan.status <> 'ACTIVE' then
      raise exception 'this plan is % — resume it before running actions', lower(v_plan.status)
        using errcode = 'invalid_parameter_value';
    end if;
  end if;

  if p_new_state = 'APPROVED' then
    update public.execution_actions
       set status = p_new_state, approved_by = auth.uid(), approved_at = timezone('utc', now())
     where id = p_action_id;
  elsif p_new_state = 'READY' and p_expected_state = 'AWAITING_APPROVAL' then
    -- A rejection clears the approval, so a later approve cannot inherit it.
    update public.execution_actions
       set status = p_new_state, approved_by = null, approved_at = null
     where id = p_action_id;
  elsif p_new_state = 'CANCELLED' then
    update public.execution_actions
       set status = p_new_state, completed_at = timezone('utc', now())
     where id = p_action_id;
  else
    update public.execution_actions set status = p_new_state where id = p_action_id;
  end if;

  v_event := case
    when p_new_state = 'READY' and p_expected_state = 'AWAITING_APPROVAL' then 'ACTION_REJECTED'
    when p_new_state = 'READY' then 'ACTION_READY'
    when p_new_state = 'AWAITING_APPROVAL' then 'ACTION_SUBMITTED_FOR_APPROVAL'
    when p_new_state = 'APPROVED' then 'ACTION_APPROVED'
    when p_new_state = 'EXECUTING' and p_expected_state = 'FAILED' then 'ACTION_RETRIED'
    when p_new_state = 'EXECUTING' then 'ACTION_EXECUTION_STARTED'
    when p_new_state = 'COMPLETED' then 'ACTION_EXECUTION_SUCCEEDED'
    when p_new_state = 'FAILED' then 'ACTION_EXECUTION_FAILED'
    when p_new_state = 'CANCELLED' then 'ACTION_CANCELLED'
    else 'ACTION_READY'
  end;

  perform public.execution_audit(
    v_action.workspace_id, v_event, 'execution_action', p_action_id,
    p_expected_state, p_new_state, p_reason
  );

  return p_new_state;
end;
$$;

grant execute on function public.execution_transition(uuid, text, text, text) to authenticated;

-- ============================================================================
-- 11. Claim an execution run
--
-- Inserts the attempt row. The UNIQUE index on `idempotency_key` is what makes
-- a duplicate dispatch collide instead of duplicating an external effect: on
-- conflict this returns the EXISTING run id rather than creating a second.
-- ============================================================================

create or replace function public.execution_claim_run(
  p_action_id       uuid,
  p_provider        text,
  p_attempt         integer,
  p_idempotency_key text
)
returns table (run_id uuid, was_existing boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action   public.execution_actions%rowtype;
  v_existing uuid;
  v_id       uuid;
begin
  select * into v_action from public.execution_actions where id = p_action_id;

  if v_action.id is null then
    raise exception 'execution action not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_action.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  select id into v_existing
  from public.execution_runs
  where idempotency_key = p_idempotency_key;

  if v_existing is not null then
    return query select v_existing, true;
    return;
  end if;

  insert into public.execution_runs (
    workspace_id, action_id, provider, attempt, idempotency_key, status
  ) values (
    v_action.workspace_id, p_action_id, p_provider, p_attempt, p_idempotency_key, 'RUNNING'
  )
  returning id into v_id;

  return query select v_id, false;
end;
$$;

grant execute on function public.execution_claim_run(uuid, text, integer, text) to authenticated;

-- ============================================================================
-- 12. Record a result
--
-- Closes the run, moves the action to its terminal state and increments the
-- server-owned retry count — all in one transaction, so an action can never be
-- COMPLETED with no run row, or EXECUTING with a finished run.
-- ============================================================================

create or replace function public.execution_record_result(
  p_run_id       uuid,
  p_status       text,
  p_external_id  text default null,
  p_summary      text default null,
  p_error_code   text default null,
  p_error_message text default null,
  p_result       jsonb default null,
  p_duration_ms  integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run    public.execution_runs%rowtype;
  v_action public.execution_actions%rowtype;
  v_new    text;
begin
  select * into v_run from public.execution_runs where id = p_run_id for update;

  if v_run.id is null then
    raise exception 'execution run not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('SUCCEEDED', 'FAILED') then
    raise exception 'a run result must be SUCCEEDED or FAILED'
      using errcode = 'invalid_parameter_value';
  end if;

  update public.execution_runs
     set status                = p_status,
         external_execution_id = p_external_id,
         result_summary        = left(coalesce(p_summary, ''), 1000),
         error_code            = p_error_code,
         error_message         = left(coalesce(p_error_message, ''), 2000),
         completed_at          = timezone('utc', now()),
         duration_ms           = p_duration_ms
   where id = p_run_id;

  select * into v_action from public.execution_actions
   where id = v_run.action_id for update;

  v_new := case when p_status = 'SUCCEEDED' then 'COMPLETED' else 'FAILED' end;

  update public.execution_actions
     set status                = v_new,
         result                = coalesce(p_result, result),
         external_execution_id = coalesce(p_external_id, external_execution_id),
         error                 = case when p_status = 'FAILED'
                                      then left(coalesce(p_error_message, ''), 2000)
                                      else null end,
         error_code            = case when p_status = 'FAILED' then p_error_code else null end,
         -- Server-owned, and the ONLY place it changes.
         retry_count           = least(v_action.retry_count + 1, 5),
         completed_at          = case when p_status = 'SUCCEEDED'
                                      then timezone('utc', now())
                                      else completed_at end
   where id = v_run.action_id;

  perform public.execution_audit(
    v_run.workspace_id,
    case when p_status = 'SUCCEEDED'
         then 'ACTION_EXECUTION_SUCCEEDED'
         else 'ACTION_EXECUTION_FAILED' end,
    'execution_action', v_run.action_id, 'EXECUTING', v_new, p_error_message,
    jsonb_build_object('provider', v_run.provider, 'attempt', v_run.attempt)
  );
end;
$$;

grant execute on function public.execution_record_result(
  uuid, text, text, text, text, text, jsonb, integer
) to authenticated;

-- ============================================================================
-- 13. Plan status
-- ============================================================================

create or replace function public.execution_set_plan_status(
  p_plan_id uuid,
  p_status  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.execution_plans%rowtype;
  v_role text;
begin
  select * into v_plan from public.execution_plans where id = p_plan_id for update;

  if v_plan.id is null then
    raise exception 'execution plan not found' using errcode = 'no_data_found';
  end if;

  select role into v_role
  from public.workspace_members
  where workspace_id = v_plan.workspace_id and user_id = auth.uid();

  if v_role is null or v_role not in ('owner', 'admin', 'editor') then
    raise exception 'your role cannot change this plan'
      using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('ACTIVE', 'PAUSED', 'CANCELLED') then
    raise exception 'unsupported plan status: %', p_status
      using errcode = 'invalid_parameter_value';
  end if;
  if v_plan.status = 'CANCELLED' then
    raise exception 'this plan was cancelled and cannot be changed'
      using errcode = 'invalid_parameter_value';
  end if;

  update public.execution_plans set status = p_status where id = p_plan_id;

  perform public.execution_audit(
    v_plan.workspace_id,
    case p_status
      when 'PAUSED'    then 'PLAN_PAUSED'
      when 'ACTIVE'    then 'PLAN_RESUMED'
      else 'PLAN_CANCELLED'
    end,
    'execution_plan', p_plan_id, v_plan.status, p_status
  );
end;
$$;

grant execute on function public.execution_set_plan_status(uuid, text) to authenticated;

-- ============================================================================
-- 14. Admin observability
--
-- Counted in SQL, permission-gated per block, additive like every aggregate
-- before it.
-- ============================================================================

create or replace function public.admin_execution_stats(
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
      'execution_plans',    (select count(*) from public.execution_plans where created_at >= v_since),
      'execution_actions',  (select count(*) from public.execution_actions where created_at >= v_since),
      'actions_awaiting_approval', (select count(*) from public.execution_actions
                                     where created_at >= v_since and status = 'AWAITING_APPROVAL'),
      'actions_completed',  (select count(*) from public.execution_actions
                              where created_at >= v_since and status = 'COMPLETED'),
      'actions_failed',     (select count(*) from public.execution_actions
                              where created_at >= v_since and status = 'FAILED'),
      'execution_runs',     (select count(*) from public.execution_runs where started_at >= v_since),
      'runs_failed',        (select count(*) from public.execution_runs
                              where started_at >= v_since and status = 'FAILED'),
      'runs_retried',       (select count(*) from public.execution_runs
                              where started_at >= v_since and attempt > 1),
      'approvals_recorded', (select count(*) from public.execution_audit_logs
                              where created_at >= v_since and event = 'ACTION_APPROVED'),
      'median_duration_ms', (select coalesce(
                                percentile_cont(0.5) within group (order by duration_ms), 0)::integer
                              from public.execution_runs
                              where started_at >= v_since and duration_ms is not null)
    );
  end if;

  return v_out || jsonb_build_object('since', v_since);
end;
$$;

grant execute on function public.admin_execution_stats(timestamptz) to authenticated;
revoke all on function public.admin_execution_stats(timestamptz) from anon;


-- >>>>>>>>>>>>>>>>>>>>>>>> 0019_client_onboarding.sql >>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- 0019 — Client Onboarding & Lead Conversion
--
-- Additive only. Migrations 0001-0018 are applied or pending and are never
-- edited. This file EXTENDS what already exists rather than replacing it:
--
--   public.leads              EXISTS (0005). Extended with identity links, a
--                             longer lifecycle and an idempotency key. Not
--                             recreated, not replaced.
--   public.business_ideas     EXISTS (0002). Untouched — the funnel writes to
--                             it through the existing model.
--   public.validation_reports EXISTS (0002). Untouched.
--   public.profiles           EXISTS (0001). Untouched.
--   public.workspaces         EXISTS (0004), with personal-workspace
--                             provisioning already in place. Untouched.
--   public.admin_audit_logs   EXISTS (0008). Reused via admin_log().
--   admin RBAC                EXISTS (0008). Extended with six permissions.
--
-- New tables, and why each could not be an extension of something existing:
--
--   lead_events        Leads had no timeline. A status column records where a
--                      lead IS; this records how it GOT there, which is what an
--                      admin actually needs to work it.
--   bookings           MISSING entirely. No calendar, no appointment model.
--   email_templates    MISSING. The only email in the codebase is a hardcoded
--                      plain-text admin notification in lib/leads/notify.ts.
--   email_template_versions  Templates that have been sent must never change
--                      retroactively — otherwise "what did we send them?" is
--                      unanswerable.
--   email_logs         MISSING. Nothing records what was sent to whom.
--
-- ---------------------------------------------------------------------------
-- THE PASSWORD RULE
-- ---------------------------------------------------------------------------
-- No column below stores a password, a temporary password, a token or a
-- provider credential, and none ever will. Account activation uses Supabase's
-- own one-time-link mechanism, which never hands a secret to this application.
-- The smoke suite asserts the absence by column name.
-- ============================================================================

-- ============================================================================
-- 1. Extend the existing leads table
--
-- `add column if not exists` throughout: this table is live and holds real
-- rows, so every addition is nullable or defaulted and nothing is dropped.
-- ============================================================================

alter table public.leads
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists workspace_id uuid references public.workspaces (id) on delete set null,
  add column if not exists business_idea_id uuid references public.business_ideas (id) on delete set null,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists industry text,
  add column if not exists target_customer text,
  add column if not exists target_market text,
  add column if not exists business_stage text,
  add column if not exists problem_solved text,
  add column if not exists website text,
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null,
  add column if not exists last_activity_at timestamptz,
  -- THE duplicate-submission control. A repeated browser POST carries the same
  -- key and collides here instead of creating a second lead, a second user and
  -- a second workspace.
  add column if not exists idempotency_key text;

comment on column public.leads.idempotency_key is
  'Server-derived from the normalised email and source. Unique, so a resubmitted form collides rather than duplicating a lead.';
comment on column public.leads.user_id is
  'Set once the visitor has an auth account. Null while the lead is anonymous.';

-- A partial unique index rather than a column constraint: historical rows have
-- no key and must stay valid.
create unique index if not exists leads_idempotency_key_idx
  on public.leads (idempotency_key) where idempotency_key is not null;

create index if not exists leads_user_idx
  on public.leads (user_id) where user_id is not null;
create index if not exists leads_workspace_idx
  on public.leads (workspace_id) where workspace_id is not null;
create index if not exists leads_owner_idx
  on public.leads (owner_user_id) where owner_user_id is not null;
create index if not exists leads_activity_idx
  on public.leads (last_activity_at desc nulls last);

-- ---------------------------------------------------------------------------
-- The lifecycle.
--
-- 0005 constrained status to new|contacted|qualified|archived. The funnel needs
-- more stages, so the old constraint is replaced by a wider one that still
-- accepts every historical value. Existing rows are migrated where the meaning
-- is unambiguous; 'archived' becomes 'LOST', which is what it meant.
-- ---------------------------------------------------------------------------

alter table public.leads drop constraint if exists leads_status_check;

update public.leads set status = 'NEW'       where status = 'new';
update public.leads set status = 'CONTACTED' where status = 'contacted';
update public.leads set status = 'QUALIFIED' where status = 'qualified';
update public.leads set status = 'LOST'      where status = 'archived';

alter table public.leads
  alter column status set default 'NEW';

alter table public.leads
  add constraint leads_status_check check (status in (
    'NEW','CONTACTED','QUALIFIED','STRATEGY_BOOKED','STRATEGY_COMPLETED',
    'PROPOSAL','CUSTOMER','LOST'));

-- ============================================================================
-- 2. Lead timeline
-- ============================================================================

create table if not exists public.lead_events (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads (id) on delete cascade,

  event       text not null check (event in (
                'LANDING_VIEW','IDEA_FORM_STARTED','IDEA_SUBMITTED','LEAD_CREATED',
                'ACCOUNT_INVITED','ACCOUNT_CREATED','WORKSPACE_CREATED',
                'VALIDATION_STARTED','VALIDATION_COMPLETED','VALIDATION_FAILED',
                'REPORT_READY','REPORT_VIEWED','REPORT_DOWNLOADED',
                'STRATEGY_CTA_CLICKED','BOOKING_STARTED','BOOKING_CREATED',
                'BOOKING_CANCELLED','BOOKING_RESCHEDULED','BOOKING_COMPLETED',
                'STRATEGY_COMPLETED','LEAD_QUALIFIED','STATUS_CHANGED',
                'EMAIL_SENT','NOTE_ADDED')),

  -- Null for events the system raised on its own.
  actor_user_id uuid references auth.users (id) on delete set null,
  previous_status text check (length(previous_status) <= 40),
  new_status      text check (length(new_status) <= 40),
  note            text check (length(note) <= 4000),
  -- Never contains a token, a password or a provider credential.
  metadata        jsonb not null default '{}'::jsonb,

  created_at  timestamptz not null default timezone('utc', now())
);

comment on table public.lead_events is
  'Lead timeline. A status column says where a lead is; this says how it got there.';

create index if not exists lead_events_lead_idx
  on public.lead_events (lead_id, created_at desc);
create index if not exists lead_events_event_idx
  on public.lead_events (event, created_at desc);

-- ============================================================================
-- 3. Bookings
--
-- Deliberately small. §5 says do not build a calendar SaaS: this stores a
-- requested slot and its lifecycle, and nothing else. There is no availability
-- engine, no recurrence, no timezone arithmetic beyond storing the visitor's
-- own IANA zone alongside an absolute instant.
-- ============================================================================

create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),

  -- A booking belongs to a person, and optionally to a workspace and a lead.
  -- `user_id` is nullable because the secondary funnel books first and has an
  -- account a moment later.
  user_id       uuid references auth.users (id) on delete set null,
  workspace_id  uuid references public.workspaces (id) on delete set null,
  lead_id       uuid references public.leads (id) on delete set null,

  -- Contact details captured at booking time, so a booking is actionable even
  -- if the account is never activated.
  full_name     text not null check (length(btrim(full_name)) between 1 and 200),
  email         text not null check (length(email) between 3 and 254),
  phone         text check (length(phone) <= 40),

  -- The absolute instant. The visitor's IANA zone is stored beside it so a
  -- confirmation email can say "3pm your time" rather than a UTC timestamp.
  scheduled_at  timestamptz not null,
  timezone      text not null default 'UTC' check (length(timezone) <= 64),
  duration_minutes integer not null default 30 check (duration_minutes between 15 and 180),

  status        text not null default 'PENDING' check (status in (
                  'PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')),

  -- Set by an admin once a real call is arranged. Never a credential.
  meeting_url   text check (length(meeting_url) <= 2000),
  notes         text check (length(notes) <= 4000),
  cancellation_reason text check (length(cancellation_reason) <= 1000),

  -- Duplicate-booking control, derived from the email and the slot.
  idempotency_key text,

  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),
  cancelled_at  timestamptz,
  completed_at  timestamptz
);

comment on table public.bookings is
  'Free AI strategy sessions. Minimal by design — a requested slot and its lifecycle, not a calendar product.';

create unique index if not exists bookings_idempotency_key_idx
  on public.bookings (idempotency_key) where idempotency_key is not null;

create index if not exists bookings_user_idx
  on public.bookings (user_id, scheduled_at desc);
create index if not exists bookings_workspace_idx
  on public.bookings (workspace_id, scheduled_at desc);
create index if not exists bookings_lead_idx
  on public.bookings (lead_id);
create index if not exists bookings_status_idx
  on public.bookings (status, scheduled_at);

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 4. Email templates
--
-- Two tables rather than one, because §7 requires that a template which has
-- been used is never deleted or rewritten. `email_templates` is the mutable
-- pointer; `email_template_versions` is append-only history, and an email log
-- references the VERSION it sent. Without that split, "what exactly did we send
-- that customer?" becomes unanswerable the moment anyone edits a subject line.
-- ============================================================================

create table if not exists public.email_templates (
  id            uuid primary key default gen_random_uuid(),

  -- The event this template answers. One active template per trigger.
  trigger       text not null check (trigger in (
                  'ACCOUNT_WELCOME','ACCOUNT_ACTIVATION','IDEA_SUBMITTED',
                  'VALIDATION_STARTED','VALIDATION_COMPLETED','VALIDATION_FAILED',
                  'REPORT_READY','STRATEGY_SESSION_INVITATION','BOOKING_CONFIRMATION',
                  'BOOKING_REMINDER_24H','BOOKING_REMINDER_1H','BOOKING_CANCELLED',
                  'BOOKING_RESCHEDULED','PASSWORD_RESET','GENERAL_NOTIFICATION')),

  name          text not null check (length(btrim(name)) between 1 and 200),
  description   text check (length(description) <= 1000),

  status        text not null default 'DRAFT'
                  check (status in ('DRAFT','ACTIVE','ARCHIVED')),

  -- Points at the version currently in force. Null for a template that has
  -- never been saved with content.
  current_version integer not null default 0 check (current_version >= 0),

  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

comment on table public.email_templates is
  'Mutable pointer. The content that was actually sent lives in email_template_versions and is never rewritten.';

-- Exactly one ACTIVE template per trigger, enforced rather than hoped for: two
-- active templates would make "which one fires?" a race.
create unique index if not exists email_templates_active_trigger_idx
  on public.email_templates (trigger) where status = 'ACTIVE';

create index if not exists email_templates_status_idx
  on public.email_templates (status, updated_at desc);

drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

create table if not exists public.email_template_versions (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.email_templates (id) on delete cascade,
  version       integer not null check (version >= 1),

  subject       text not null check (length(btrim(subject)) between 1 and 300),
  body_html     text not null check (length(body_html) <= 200000),
  body_text     text check (length(body_text) <= 200000),

  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default timezone('utc', now()),

  unique (template_id, version)
);

comment on table public.email_template_versions is
  'Append-only. A version that has been sent must never change, or the record of what a customer received becomes fiction.';

-- The immutability guarantee, reusing 0008's trigger function verbatim.
drop trigger if exists email_template_versions_no_update on public.email_template_versions;
create trigger email_template_versions_no_update
  before update on public.email_template_versions
  for each row execute function public.reject_audit_mutation();

drop trigger if exists email_template_versions_no_delete on public.email_template_versions;
create trigger email_template_versions_no_delete
  before delete on public.email_template_versions
  for each row execute function public.reject_audit_mutation();

create index if not exists email_template_versions_template_idx
  on public.email_template_versions (template_id, version desc);

-- ============================================================================
-- 5. Email logs
-- ============================================================================

create table if not exists public.email_logs (
  id            uuid primary key default gen_random_uuid(),

  -- The exact version sent. Not the template — the version.
  template_id   uuid references public.email_templates (id) on delete set null,
  template_version_id uuid references public.email_template_versions (id) on delete set null,
  trigger       text check (length(trigger) <= 60),

  recipient_email text not null check (length(recipient_email) between 3 and 254),
  user_id       uuid references auth.users (id) on delete set null,
  workspace_id  uuid references public.workspaces (id) on delete set null,
  lead_id       uuid references public.leads (id) on delete set null,
  booking_id    uuid references public.bookings (id) on delete set null,

  -- Rendered subject, kept so support can see what the customer actually read
  -- in their inbox list. The body is NOT stored: it is reproducible from the
  -- version plus the context, and storing it would duplicate personal data.
  subject       text check (length(subject) <= 300),

  -- The provider's own id, for reconciling a bounce or a complaint later.
  provider           text check (length(provider) <= 40),
  provider_message_id text check (length(provider_message_id) <= 300),

  status        text not null default 'QUEUED' check (status in (
                  'QUEUED','SENT','FAILED','SKIPPED')),
  error_code    text check (length(error_code) <= 60),
  error_message text check (length(error_message) <= 2000),
  retry_count   integer not null default 0 check (retry_count >= 0 and retry_count <= 5),

  -- True when this was an admin test send. Test sends must never look like
  -- customer communication in the log.
  is_test       boolean not null default false,

  created_at    timestamptz not null default timezone('utc', now()),
  sent_at       timestamptz,
  failed_at     timestamptz
);

comment on table public.email_logs is
  'What was sent, to whom, from which template version. Never stores provider credentials or message bodies.';

create index if not exists email_logs_recipient_idx
  on public.email_logs (recipient_email, created_at desc);
create index if not exists email_logs_user_idx
  on public.email_logs (user_id, created_at desc);
create index if not exists email_logs_lead_idx
  on public.email_logs (lead_id, created_at desc);
create index if not exists email_logs_status_idx
  on public.email_logs (status, created_at desc);
create index if not exists email_logs_template_idx
  on public.email_logs (template_id, created_at desc);

-- ============================================================================
-- 6. Row level security
--
-- The shapes differ per table because the audiences differ, and getting this
-- uniform would be getting it wrong:
--
--   leads          Already insert-only for anon (0005), and that stays. A
--                  signed-in user may read leads that are THEIRS. Admins with
--                  leads.read see all.
--   lead_events    Admin-only. A visitor has no business reading their own
--                  sales timeline.
--   bookings       The person who booked reads their own; admins see all.
--   email_*        Admin-only throughout. Email logs are a record of personal
--                  communication and must never become broadly readable.
-- ============================================================================

alter table public.lead_events            enable row level security;
alter table public.bookings               enable row level security;
alter table public.email_templates        enable row level security;
alter table public.email_template_versions enable row level security;
alter table public.email_logs             enable row level security;

-- --- leads: add a scoped read for the owning user ---------------------------
-- 0005 deliberately granted NO select. That stays true for anonymous visitors;
-- this adds the narrowest possible read, so a signed-in user can see the lead
-- that is about them and nothing else.
drop policy if exists "Users read their own lead" on public.leads;
create policy "Users read their own lead"
  on public.leads for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admins read all leads" on public.leads;
create policy "Admins read all leads"
  on public.leads for select
  using (public.admin_has('leads.read'));

-- --- lead_events ------------------------------------------------------------
drop policy if exists "Admins read lead events" on public.lead_events;
create policy "Admins read lead events"
  on public.lead_events for select
  using (public.admin_has('leads.read'));

-- --- bookings ---------------------------------------------------------------
drop policy if exists "Users read their own bookings" on public.bookings;
create policy "Users read their own bookings"
  on public.bookings for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admins read all bookings" on public.bookings;
create policy "Admins read all bookings"
  on public.bookings for select
  using (public.admin_has('bookings.read'));

-- --- email templates and logs: admin only -----------------------------------
drop policy if exists "Admins read email templates" on public.email_templates;
create policy "Admins read email templates"
  on public.email_templates for select
  using (public.admin_has('communications.read'));

drop policy if exists "Admins read email template versions" on public.email_template_versions;
create policy "Admins read email template versions"
  on public.email_template_versions for select
  using (public.admin_has('communications.read'));

drop policy if exists "Admins read email logs" on public.email_logs;
create policy "Admins read email logs"
  on public.email_logs for select
  using (public.admin_has('communications.read'));

-- ============================================================================
-- 7. Admin RBAC — six new permissions
--
-- Added to the EXISTING matrix in 0008 rather than a parallel system.
-- Deliberate allocation: SUPPORT can read leads and bookings (they answer "what
-- happened to my booking?") but cannot change a lead's lifecycle or touch
-- templates. Sending a test email is separated from writing a template, because
-- it is the one communications action that leaves the building.
-- ============================================================================

insert into public.admin_role_permissions (role, permission) values
  ('SUPPORT',     'leads.read'),
  ('SUPPORT',     'bookings.read'),
  ('SUPPORT',     'communications.read'),

  ('ADMIN',       'leads.read'),
  ('ADMIN',       'leads.update'),
  ('ADMIN',       'bookings.read'),
  ('ADMIN',       'bookings.update'),
  ('ADMIN',       'communications.read'),
  ('ADMIN',       'communications.write'),
  ('ADMIN',       'communications.send_test'),

  ('SUPER_ADMIN', 'leads.read'),
  ('SUPER_ADMIN', 'leads.update'),
  ('SUPER_ADMIN', 'bookings.read'),
  ('SUPER_ADMIN', 'bookings.update'),
  ('SUPER_ADMIN', 'communications.read'),
  ('SUPER_ADMIN', 'communications.write'),
  ('SUPER_ADMIN', 'communications.send_test')
on conflict (role, permission) do nothing;

-- ============================================================================
-- 8. Public lead capture
--
-- Callable by anon. This is the ONE anonymous write in the application, and it
-- was already so before this migration — 0005 grants anon INSERT on leads. This
-- function replaces that raw insert with something that can enforce
-- idempotency and record a timeline entry in the same transaction.
--
-- What it deliberately does NOT do: create an auth user, create a workspace,
-- create a business idea, or start an AI validation. All four require a
-- verified email. Provisioning for an unverified address is how an attacker
-- turns a public form into a bill.
-- ============================================================================

create or replace function public.lead_capture(
  p_email            text,
  p_source           text,
  p_idempotency_key  text,
  p_first_name       text default null,
  p_last_name        text default null,
  p_phone            text default null,
  p_company          text default null,
  p_message          text default null,
  p_industry         text default null,
  p_target_customer  text default null,
  p_target_market    text default null,
  p_business_stage   text default null,
  p_problem_solved   text default null,
  p_website          text default null,
  p_landing_page     text default null,
  p_referrer         text default null,
  p_utm_source       text default null,
  p_utm_medium       text default null,
  p_utm_campaign     text default null,
  p_utm_term         text default null,
  p_utm_content      text default null
)
returns table (lead_id uuid, was_existing boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
  v_id    uuid;
  v_name  text;
begin
  if v_email is null or position('@' in v_email) = 0 then
    raise exception 'a valid email is required'
      using errcode = 'invalid_parameter_value';
  end if;

  -- THE duplicate control. A resubmitted form collides here.
  select id into v_id from public.leads
   where idempotency_key = p_idempotency_key;

  if v_id is not null then
    update public.leads
       set last_activity_at = timezone('utc', now())
     where id = v_id;
    return query select v_id, true;
    return;
  end if;

  v_name := btrim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, ''));
  if v_name = '' then v_name := null; end if;

  insert into public.leads (
    email, name, first_name, last_name, phone, company, message, source,
    industry, target_customer, target_market, business_stage, problem_solved,
    website, landing_page, referrer, utm_source, utm_medium, utm_campaign,
    utm_term, utm_content, idempotency_key, status, last_activity_at
  ) values (
    v_email, v_name, p_first_name, p_last_name, p_phone, p_company, p_message,
    coalesce(p_source, 'unknown'), p_industry, p_target_customer, p_target_market,
    p_business_stage, p_problem_solved, p_website, p_landing_page, p_referrer,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content,
    p_idempotency_key, 'NEW', timezone('utc', now())
  )
  returning id into v_id;

  insert into public.lead_events (lead_id, event, metadata)
  values (v_id, 'LEAD_CREATED', jsonb_build_object('source', p_source));

  if p_source = 'idea-validation' then
    insert into public.lead_events (lead_id, event) values (v_id, 'IDEA_SUBMITTED');
  end if;

  return query select v_id, false;
end;
$$;

grant execute on function public.lead_capture(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- ============================================================================
-- 9. Claim a lead after activation
--
-- Runs as the newly-activated user, under their own identity. This is where a
-- verified email finally becomes an account-linked lead — and where the
-- workspace and idea get attached.
--
-- Matching on email is the join: the lead was created anonymously and the user
-- has now proven they control that address by following a one-time link.
-- ============================================================================

create or replace function public.lead_claim_for_user(
  p_workspace_id     uuid,
  p_business_idea_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_lead  public.leads%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select lower(btrim(email)) into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return null;
  end if;

  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  -- The most recent unclaimed lead for this verified address.
  select * into v_lead from public.leads
   where lower(btrim(email)) = v_email
     and user_id is null
   order by created_at desc
   limit 1;

  if v_lead.id is null then
    return null;
  end if;

  update public.leads
     set user_id          = auth.uid(),
         workspace_id     = p_workspace_id,
         business_idea_id = coalesce(p_business_idea_id, business_idea_id),
         last_activity_at = timezone('utc', now())
   where id = v_lead.id;

  insert into public.lead_events (lead_id, event, actor_user_id, metadata)
  values (v_lead.id, 'ACCOUNT_CREATED', auth.uid(),
          jsonb_build_object('workspace_id', p_workspace_id));

  insert into public.lead_events (lead_id, event, actor_user_id)
  values (v_lead.id, 'WORKSPACE_CREATED', auth.uid());

  return v_lead.id;
end;
$$;

grant execute on function public.lead_claim_for_user(uuid, uuid) to authenticated;

-- ============================================================================
-- 10. Record a funnel event
--
-- Callable by the owning user (for their own lead) or by an admin. Used for the
-- analytics events in §16 that happen after activation — report viewed,
-- downloaded, strategy CTA clicked.
-- ============================================================================

create or replace function public.lead_record_event(
  p_lead_id  uuid,
  p_event    text,
  p_note     text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_id   uuid;
begin
  select * into v_lead from public.leads where id = p_lead_id;
  if v_lead.id is null then
    raise exception 'lead not found' using errcode = 'no_data_found';
  end if;

  if v_lead.user_id is distinct from auth.uid()
     and not public.admin_has('leads.update') then
    raise exception 'not permitted' using errcode = 'insufficient_privilege';
  end if;

  insert into public.lead_events (lead_id, event, actor_user_id, note, metadata)
  values (p_lead_id, p_event, auth.uid(), p_note, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  update public.leads set last_activity_at = timezone('utc', now())
   where id = p_lead_id;

  return v_id;
end;
$$;

grant execute on function public.lead_record_event(uuid, text, text, jsonb) to authenticated;

-- ============================================================================
-- 11. Admin: change a lead's lifecycle status
--
-- Writes to the shared admin audit log as well as the lead timeline, so the
-- change appears both in the lead's own history and in the platform-wide record
-- of what staff did.
-- ============================================================================

create or replace function public.lead_set_status(
  p_lead_id uuid,
  p_status  text,
  p_note    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
begin
  if not public.admin_has('leads.update') then
    raise exception 'permission denied: leads.update'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_lead from public.leads where id = p_lead_id for update;
  if v_lead.id is null then
    raise exception 'lead not found' using errcode = 'no_data_found';
  end if;

  update public.leads
     set status = p_status, last_activity_at = timezone('utc', now())
   where id = p_lead_id;

  insert into public.lead_events (
    lead_id, event, actor_user_id, previous_status, new_status, note
  ) values (
    p_lead_id, 'STATUS_CHANGED', auth.uid(), v_lead.status, p_status, p_note
  );

  -- The existing platform audit log. Reused, not duplicated.
  perform public.admin_log(
    'lead.status_changed', 'lead', p_lead_id::text,
    jsonb_build_object('status', v_lead.status),
    jsonb_build_object('status', p_status),
    p_note
  );
end;
$$;

grant execute on function public.lead_set_status(uuid, text, text) to authenticated;

-- ============================================================================
-- 12. Bookings — create
--
-- Callable by anon so the secondary funnel (book first, account later) works.
-- Idempotent on (email, slot): a double-clicked confirm button collides.
-- ============================================================================

create or replace function public.booking_create(
  p_full_name       text,
  p_email           text,
  p_scheduled_at    timestamptz,
  p_timezone        text,
  p_idempotency_key text,
  p_phone           text default null,
  p_lead_id         uuid default null,
  p_duration        integer default 30,
  p_notes           text default null
)
returns table (booking_id uuid, was_existing boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
  v_id    uuid;
  v_ws    uuid;
begin
  if v_email is null or position('@' in v_email) = 0 then
    raise exception 'a valid email is required'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_scheduled_at <= timezone('utc', now()) then
    raise exception 'that time is in the past'
      using errcode = 'invalid_parameter_value';
  end if;

  select id into v_id from public.bookings
   where idempotency_key = p_idempotency_key;

  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  -- Attach the workspace when the booker is signed in. A booking made while
  -- signed out is still valid; it simply has no workspace yet.
  if auth.uid() is not null then
    select workspace_id into v_ws
      from public.workspace_members
     where user_id = auth.uid()
     limit 1;
  end if;

  insert into public.bookings (
    user_id, workspace_id, lead_id, full_name, email, phone,
    scheduled_at, timezone, duration_minutes, status, notes, idempotency_key
  ) values (
    auth.uid(), v_ws, p_lead_id, p_full_name, v_email, p_phone,
    p_scheduled_at, coalesce(p_timezone, 'UTC'),
    least(greatest(coalesce(p_duration, 30), 15), 180),
    'PENDING', p_notes, p_idempotency_key
  )
  returning id into v_id;

  if p_lead_id is not null then
    insert into public.lead_events (lead_id, event, actor_user_id, metadata)
    values (p_lead_id, 'BOOKING_CREATED', auth.uid(),
            jsonb_build_object('booking_id', v_id));

    update public.leads
       set status = case when status in ('NEW','CONTACTED')
                         then 'STRATEGY_BOOKED' else status end,
           last_activity_at = timezone('utc', now())
     where id = p_lead_id;
  end if;

  return query select v_id, false;
end;
$$;

grant execute on function public.booking_create(
  text, text, timestamptz, text, text, text, uuid, integer, text
) to anon, authenticated;

-- ============================================================================
-- 13. Bookings — change status
--
-- The owner may cancel their own. An admin with bookings.update may set any
-- state. Confirming, completing and marking a no-show are staff decisions.
-- ============================================================================

create or replace function public.booking_set_status(
  p_booking_id uuid,
  p_status     text,
  p_reason     text default null,
  p_meeting_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_is_admin boolean := public.admin_has('bookings.update');
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'booking not found' using errcode = 'no_data_found';
  end if;

  if p_status not in ('PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW') then
    raise exception 'unknown booking status: %', p_status
      using errcode = 'invalid_parameter_value';
  end if;

  -- A customer may only cancel, and only their own.
  if not v_is_admin then
    if v_booking.user_id is distinct from auth.uid() then
      raise exception 'not permitted' using errcode = 'insufficient_privilege';
    end if;
    if p_status <> 'CANCELLED' then
      raise exception 'you can cancel a booking, but not change it to %', p_status
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if v_booking.status in ('COMPLETED','CANCELLED') and not v_is_admin then
    raise exception 'this booking is already %', lower(v_booking.status)
      using errcode = 'invalid_parameter_value';
  end if;

  update public.bookings
     set status       = p_status,
         meeting_url  = coalesce(p_meeting_url, meeting_url),
         cancellation_reason = case when p_status = 'CANCELLED'
                                    then p_reason else cancellation_reason end,
         cancelled_at = case when p_status = 'CANCELLED'
                             then timezone('utc', now()) else cancelled_at end,
         completed_at = case when p_status = 'COMPLETED'
                             then timezone('utc', now()) else completed_at end
   where id = p_booking_id;

  if v_booking.lead_id is not null then
    insert into public.lead_events (lead_id, event, actor_user_id, metadata)
    values (
      v_booking.lead_id,
      case p_status
        when 'CANCELLED' then 'BOOKING_CANCELLED'
        when 'COMPLETED' then 'BOOKING_COMPLETED'
        else 'BOOKING_CREATED'
      end,
      auth.uid(),
      jsonb_build_object('booking_id', p_booking_id, 'status', p_status)
    );

    if p_status = 'COMPLETED' then
      update public.leads
         set status = case when status = 'STRATEGY_BOOKED'
                           then 'STRATEGY_COMPLETED' else status end
       where id = v_booking.lead_id;
    end if;
  end if;

  if v_is_admin then
    perform public.admin_log(
      'booking.status_changed', 'booking', p_booking_id::text,
      jsonb_build_object('status', v_booking.status),
      jsonb_build_object('status', p_status), p_reason
    );
  end if;
end;
$$;

grant execute on function public.booking_set_status(uuid, text, text, text) to authenticated;

-- ============================================================================
-- 14. Email templates — save a version
--
-- Saving ALWAYS creates a new version. There is no update path for content, and
-- the append-only trigger above means there cannot be one.
-- ============================================================================

create or replace function public.email_template_save(
  p_template_id uuid,
  p_subject     text,
  p_body_html   text,
  p_body_text   text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if not public.admin_has('communications.write') then
    raise exception 'permission denied: communications.write'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce(max(version), 0) + 1 into v_next
    from public.email_template_versions where template_id = p_template_id;

  insert into public.email_template_versions (
    template_id, version, subject, body_html, body_text, created_by
  ) values (
    p_template_id, v_next, p_subject, p_body_html, p_body_text, auth.uid()
  );

  update public.email_templates
     set current_version = v_next
   where id = p_template_id;

  perform public.admin_log(
    'email_template.version_saved', 'email_template', p_template_id::text,
    null, jsonb_build_object('version', v_next)
  );

  return v_next;
end;
$$;

grant execute on function public.email_template_save(uuid, text, text, text) to authenticated;

-- ============================================================================
-- 15. Email templates — change status
--
-- Activating one template for a trigger deactivates any other, so the unique
-- partial index above can never be violated by a race.
-- ============================================================================

create or replace function public.email_template_set_status(
  p_template_id uuid,
  p_status      text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.email_templates%rowtype;
begin
  if not public.admin_has('communications.write') then
    raise exception 'permission denied: communications.write'
      using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('DRAFT','ACTIVE','ARCHIVED') then
    raise exception 'unknown template status: %', p_status
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_template from public.email_templates
   where id = p_template_id for update;
  if v_template.id is null then
    raise exception 'template not found' using errcode = 'no_data_found';
  end if;

  if p_status = 'ACTIVE' then
    if v_template.current_version < 1 then
      raise exception 'save some content before activating this template'
        using errcode = 'invalid_parameter_value';
    end if;
    -- One active template per trigger.
    update public.email_templates
       set status = 'DRAFT'
     where trigger = v_template.trigger
       and status = 'ACTIVE'
       and id <> p_template_id;
  end if;

  update public.email_templates set status = p_status where id = p_template_id;

  perform public.admin_log(
    'email_template.status_changed', 'email_template', p_template_id::text,
    jsonb_build_object('status', v_template.status),
    jsonb_build_object('status', p_status)
  );
end;
$$;

grant execute on function public.email_template_set_status(uuid, text) to authenticated;

-- ============================================================================
-- 16. Email log — record a send
--
-- Called by the communication service after it has attempted delivery. Separate
-- from the send itself so a provider failure still leaves a record.
-- ============================================================================

create or replace function public.email_log_record(
  p_recipient   text,
  p_status      text,
  p_trigger     text default null,
  p_template_id uuid default null,
  p_version_id  uuid default null,
  p_subject     text default null,
  p_provider    text default null,
  p_message_id  text default null,
  p_error_code  text default null,
  p_error_message text default null,
  p_user_id     uuid default null,
  p_workspace_id uuid default null,
  p_lead_id     uuid default null,
  p_booking_id  uuid default null,
  p_is_test     boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.email_logs (
    template_id, template_version_id, trigger, recipient_email, user_id,
    workspace_id, lead_id, booking_id, subject, provider, provider_message_id,
    status, error_code, error_message, is_test,
    sent_at, failed_at
  ) values (
    p_template_id, p_version_id, p_trigger, lower(btrim(p_recipient)), p_user_id,
    p_workspace_id, p_lead_id, p_booking_id, p_subject, p_provider, p_message_id,
    p_status, p_error_code, left(coalesce(p_error_message, ''), 2000), p_is_test,
    case when p_status = 'SENT' then timezone('utc', now()) end,
    case when p_status = 'FAILED' then timezone('utc', now()) end
  )
  returning id into v_id;

  -- A test send must never look like customer communication on a lead's
  -- timeline. §23 is explicit that it triggers no business automation.
  if p_lead_id is not null and not p_is_test then
    insert into public.lead_events (lead_id, event, metadata)
    values (p_lead_id, 'EMAIL_SENT',
            jsonb_build_object('trigger', p_trigger, 'status', p_status));
  end if;

  return v_id;
end;
$$;

grant execute on function public.email_log_record(
  text, text, text, uuid, uuid, text, text, text, text, text,
  uuid, uuid, uuid, uuid, boolean
) to authenticated;

-- ============================================================================
-- 17. Seed the fifteen templates
--
-- Seeded as DRAFT, deliberately. An ACTIVE template sends real email to real
-- customers, and that should be a decision somebody makes in the admin panel
-- after reading the copy — not something a migration turns on.
-- ============================================================================

insert into public.email_templates (trigger, name, description, status)
values
  ('ACCOUNT_WELCOME','Welcome','Sent after a workspace is provisioned.','DRAFT'),
  ('ACCOUNT_ACTIVATION','Activate your account','Secure one-time activation link.','DRAFT'),
  ('IDEA_SUBMITTED','Idea received','Confirms the idea reached us.','DRAFT'),
  ('VALIDATION_STARTED','Validation started','Analysis has begun.','DRAFT'),
  ('VALIDATION_COMPLETED','Validation complete','Score and report link.','DRAFT'),
  ('VALIDATION_FAILED','Validation could not complete','Apology and next step.','DRAFT'),
  ('REPORT_READY','Report ready','The report can now be read.','DRAFT'),
  ('STRATEGY_SESSION_INVITATION','Strategy session invitation','Invites a qualified lead to book.','DRAFT'),
  ('BOOKING_CONFIRMATION','Booking confirmed','Date, time, timezone and joining details.','DRAFT'),
  ('BOOKING_REMINDER_24H','Reminder — tomorrow','24 hours before the session.','DRAFT'),
  ('BOOKING_REMINDER_1H','Reminder — in an hour','1 hour before the session.','DRAFT'),
  ('BOOKING_CANCELLED','Booking cancelled','Confirms a cancellation.','DRAFT'),
  ('BOOKING_RESCHEDULED','Booking rescheduled','Confirms the new time.','DRAFT'),
  ('PASSWORD_RESET','Password reset','Handled by the auth provider; here for completeness.','DRAFT'),
  ('GENERAL_NOTIFICATION','General notification','Ad-hoc operational message.','DRAFT')
on conflict do nothing;

-- ============================================================================
-- 18. Admin funnel metrics
--
-- Counted in SQL. A JavaScript reduce over a PostgREST-capped result set
-- returns a plausible but short total, which is worse than no total.
-- ============================================================================

create or replace function public.admin_funnel_stats(
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

  if public.admin_has('leads.read') then
    v_out := v_out || jsonb_build_object(
      'total_leads',      (select count(*) from public.leads where created_at >= v_since),
      'new_leads',        (select count(*) from public.leads
                            where created_at >= v_since and status = 'NEW'),
      'qualified_leads',  (select count(*) from public.leads
                            where created_at >= v_since and status in
                              ('QUALIFIED','STRATEGY_BOOKED','STRATEGY_COMPLETED','PROPOSAL','CUSTOMER')),
      'customers',        (select count(*) from public.leads
                            where created_at >= v_since and status = 'CUSTOMER'),
      'accounts_created', (select count(*) from public.leads
                            where created_at >= v_since and user_id is not null),
      'validated_ideas',  (select count(distinct lead_id) from public.lead_events
                            where created_at >= v_since and event = 'VALIDATION_COMPLETED'),
      'reports_viewed',   (select count(distinct lead_id) from public.lead_events
                            where created_at >= v_since and event = 'REPORT_VIEWED'),
      'reports_downloaded', (select count(distinct lead_id) from public.lead_events
                            where created_at >= v_since and event = 'REPORT_DOWNLOADED')
    );
  end if;

  if public.admin_has('bookings.read') then
    v_out := v_out || jsonb_build_object(
      'sessions_booked',    (select count(*) from public.bookings where created_at >= v_since),
      'sessions_completed', (select count(*) from public.bookings
                              where created_at >= v_since and status = 'COMPLETED'),
      'sessions_cancelled', (select count(*) from public.bookings
                              where created_at >= v_since and status = 'CANCELLED')
    );
  end if;

  if public.admin_has('communications.read') then
    v_out := v_out || jsonb_build_object(
      'emails_sent',   (select count(*) from public.email_logs
                         where created_at >= v_since and status = 'SENT' and not is_test),
      'emails_failed', (select count(*) from public.email_logs
                         where created_at >= v_since and status = 'FAILED' and not is_test)
    );
  end if;

  return v_out || jsonb_build_object('since', v_since);
end;
$$;

grant execute on function public.admin_funnel_stats(timestamptz) to authenticated;
revoke all on function public.admin_funnel_stats(timestamptz) from anon;

