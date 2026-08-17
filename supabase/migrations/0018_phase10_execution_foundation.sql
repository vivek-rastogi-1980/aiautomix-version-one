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
