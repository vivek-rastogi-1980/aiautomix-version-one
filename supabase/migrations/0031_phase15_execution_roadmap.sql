-- ============================================================================
-- 0031 — Phase 15: business plan -> execution roadmap
--
-- Additive. One entitlement, two tables, one function. Migrations 0001-0030 are
-- applied and are not edited.
--
-- ---------------------------------------------------------------------------
-- Why new tables rather than reusing the Phase 10 execution engine
-- ---------------------------------------------------------------------------
-- `execution_plans` / `execution_actions` (0018) already exist, already carry
-- `business_plan_id`, and were the first candidate. They model a different
-- thing, and forcing this into them would have broken it.
--
-- `execution_actions` is a MACHINE dispatch record: a closed `action_type`
-- enum (CREATE_LANDING_PAGE, GENERATE_CONTENT, ...), an execution provider, an
-- external execution id, approval gates, retry counts and webhook results. Its
-- status vocabulary — AWAITING_APPROVAL, APPROVED, EXECUTING — describes work
-- AIAutoMix performs on the customer's behalf against outside systems.
--
-- "Interview 10 dental clinics" is not that. It has no action_type, no
-- provider, must never be dispatched, and is COMPLETED only when a person says
-- so. Storing it in `execution_actions` would mean either inventing a fake
-- action_type or widening the enum that the dispatch layer switches on — in
-- both cases putting rows into a table whose whole purpose is that its rows are
-- executable. That is a correctness risk in the automation engine, not a
-- tidiness question.
--
-- So: separate tables, and `business_execution` is left alone as the flag for
-- the automation engine. The two systems share the business plan and nothing
-- else.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Entitlement
--
-- Its own flag, NOT `business_execution`. That one is denied on Free and
-- Starter because it governs reaching outside AIAutoMix and changing things.
-- Writing your own 90-day checklist carries none of that risk, and gating it
-- behind a paid tier would put the Plan -> Execute journey — the point of this
-- phase — out of reach of the customers most likely to need it.
--
-- Limits mirror `business_plan` exactly. One roadmap per plan is the natural
-- ratio, so a customer who can generate N plans can generate N roadmaps.
-- ---------------------------------------------------------------------------

insert into public.plan_entitlements (plan_id, feature, is_enabled, limit_value)
values
  ('free','execution_roadmap',         true, 1),
  ('starter','execution_roadmap',      true, 10),
  ('growth','execution_roadmap',       true, 40),
  ('professional','execution_roadmap', true, null),
  ('enterprise','execution_roadmap',   true, null)
on conflict (plan_id, feature) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Roadmaps
--
-- One row per generated roadmap. `document` keeps the validated model output
-- verbatim — the summary, priorities and milestones — while the tasks are
-- exploded into their own table because they are the only part that is mutated
-- afterwards.
-- ---------------------------------------------------------------------------

create table if not exists public.execution_roadmaps (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,

  -- Cascade, unlike the Phase 10 tables: a roadmap has no meaning without the
  -- plan it was derived from, and an orphan checklist is not worth keeping.
  business_plan_id uuid not null references public.business_plans (id) on delete cascade,

  title            text not null check (length(btrim(title)) between 1 and 200),
  summary          text check (length(summary) <= 2000),

  -- The validated roadmap document, exactly as the schema accepted it.
  document         jsonb not null default '{}'::jsonb,

  -- Provenance, matching what business_plans and validation_reports record.
  workflow         text not null default 'execution-roadmap',
  prompt_version   text not null,
  model            text not null,
  ai_request_id    uuid references public.ai_requests (id) on delete set null,

  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now())
);

comment on table public.execution_roadmaps is
  'A 30/60/90-day execution roadmap generated from a business plan. Tasks live in execution_roadmap_tasks; this row holds the summary, priorities and milestones as generated.';

drop trigger if exists execution_roadmaps_set_updated_at on public.execution_roadmaps;
create trigger execution_roadmaps_set_updated_at
  before update on public.execution_roadmaps
  for each row execute function public.set_updated_at();

create index if not exists execution_roadmaps_workspace_idx
  on public.execution_roadmaps (workspace_id, created_at desc);
-- The duplicate check on the plan page runs on every visit, so this one earns
-- its keep more than the others.
create index if not exists execution_roadmaps_plan_idx
  on public.execution_roadmaps (business_plan_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Tasks
--
-- `workspace_id` is denormalised from the roadmap on purpose. Every RLS policy
-- in this codebase is written against a workspace column, and joining up to the
-- roadmap inside a policy would run that join on every row of every read.
-- `roadmap_id` still carries the truth; a task can never be moved between
-- workspaces because nothing offers to.
-- ---------------------------------------------------------------------------

create table if not exists public.execution_roadmap_tasks (
  id           uuid primary key default gen_random_uuid(),
  roadmap_id   uuid not null references public.execution_roadmaps (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  -- '30' | '60' | '90'. Text rather than an integer so it reads the same in
  -- SQL as it does in the product.
  period       text not null check (period in ('30','60','90')),

  title        text not null check (length(btrim(title)) between 1 and 200),
  description  text check (length(description) <= 1000),

  category     text not null default 'GENERAL' check (category in (
                 'MARKETING','SALES','OPERATIONS','PRODUCT','TECHNOLOGY',
                 'FINANCE','LEGAL','CUSTOMER_DEVELOPMENT','GENERAL')),

  priority     text not null default 'MEDIUM'
                 check (priority in ('HIGH','MEDIUM','LOW')),

  -- A person's status, not a dispatcher's. Deliberately disjoint from
  -- execution_actions.status; see the header.
  status       text not null default 'NOT_STARTED'
                 check (status in ('NOT_STARTED','IN_PROGRESS','COMPLETED','BLOCKED')),

  -- Null until the customer sets one. The model is forbidden from inventing
  -- dates, so nothing populates this at generation time.
  due_date     date,

  -- Position within its period. Not unique: reordering would otherwise need a
  -- deferred constraint for no benefit.
  sort_order   integer not null default 0,

  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now())
);

comment on table public.execution_roadmap_tasks is
  'Individual roadmap tasks. Status is owned by the customer; progress is always recomputed from these rows and never stored.';

drop trigger if exists execution_roadmap_tasks_set_updated_at on public.execution_roadmap_tasks;
create trigger execution_roadmap_tasks_set_updated_at
  before update on public.execution_roadmap_tasks
  for each row execute function public.set_updated_at();

-- The roadmap page reads every task for one roadmap in period then sort order,
-- which is exactly this index.
create index if not exists execution_roadmap_tasks_roadmap_idx
  on public.execution_roadmap_tasks (roadmap_id, period, sort_order);
create index if not exists execution_roadmap_tasks_workspace_idx
  on public.execution_roadmap_tasks (workspace_id);

-- ---------------------------------------------------------------------------
-- 4. Row level security
--
-- Members read and write their own workspace's rows; admins holding the
-- existing `workspaces.read` permission may read them for support.
--
-- INSERT is granted to members because generation runs as the signed-in
-- customer, exactly as `business_plans` does — there is no service-role client
-- anywhere in this application. The insert is still not forgeable into another
-- workspace: `is_workspace_member` is checked in the policy itself.
--
-- UPDATE on tasks is what lets a customer tick a box. It is scoped to
-- membership on both sides of the update, so a row cannot be updated INTO a
-- workspace the caller does not belong to.
--
-- There is deliberately no UPDATE policy on `execution_roadmaps`: the generated
-- document is a record of what was produced, and nothing in the product edits
-- it. The trigger above exists only for the updated_at contract.
-- ---------------------------------------------------------------------------

alter table public.execution_roadmaps enable row level security;
alter table public.execution_roadmap_tasks enable row level security;

drop policy if exists "Members read their roadmaps" on public.execution_roadmaps;
create policy "Members read their roadmaps"
  on public.execution_roadmaps for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members create their roadmaps" on public.execution_roadmaps;
create policy "Members create their roadmaps"
  on public.execution_roadmaps for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Members delete their roadmaps" on public.execution_roadmaps;
create policy "Members delete their roadmaps"
  on public.execution_roadmaps for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Admins read all roadmaps" on public.execution_roadmaps;
create policy "Admins read all roadmaps"
  on public.execution_roadmaps for select
  to authenticated
  using (public.admin_has('workspaces.read'));

drop policy if exists "Members read their roadmap tasks" on public.execution_roadmap_tasks;
create policy "Members read their roadmap tasks"
  on public.execution_roadmap_tasks for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members create their roadmap tasks" on public.execution_roadmap_tasks;
create policy "Members create their roadmap tasks"
  on public.execution_roadmap_tasks for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Members update their roadmap tasks" on public.execution_roadmap_tasks;
create policy "Members update their roadmap tasks"
  on public.execution_roadmap_tasks for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists "Admins read all roadmap tasks" on public.execution_roadmap_tasks;
create policy "Admins read all roadmap tasks"
  on public.execution_roadmap_tasks for select
  to authenticated
  using (public.admin_has('workspaces.read'));

-- ---------------------------------------------------------------------------
-- 5. Progress
--
-- Computed in SQL, never in the browser and never stored. §21 requires that the
-- client cannot manipulate the percentage; the way to guarantee that is for the
-- percentage not to exist as a writable value anywhere.
--
-- `stable` rather than `volatile` so the planner can call it once per query.
-- Security definer with a membership check, matching `entitlement_usage`: the
-- caller must belong to the workspace or hold the admin read permission.
-- ---------------------------------------------------------------------------

create or replace function public.execution_roadmap_progress(p_roadmap_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_total     integer;
  v_done      integer;
  v_blocked   integer;
  v_high      integer;
begin
  select workspace_id into v_workspace
    from public.execution_roadmaps
   where id = p_roadmap_id;

  if v_workspace is null then
    return jsonb_build_object('total', 0, 'completed', 0, 'percent', 0);
  end if;

  if not public.is_workspace_member(v_workspace)
     and not public.admin_has('workspaces.read') then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  select count(*),
         count(*) filter (where status = 'COMPLETED'),
         count(*) filter (where status = 'BLOCKED'),
         count(*) filter (where priority = 'HIGH' and status <> 'COMPLETED')
    into v_total, v_done, v_blocked, v_high
    from public.execution_roadmap_tasks
   where roadmap_id = p_roadmap_id;

  return jsonb_build_object(
    'total', v_total,
    'completed', v_done,
    'blocked', v_blocked,
    'high_priority_open', v_high,
    -- Integer percent, floor. A roadmap with no tasks is 0%, not a division by
    -- zero and not 100%.
    'percent', case when v_total = 0 then 0
                    else floor((v_done::numeric / v_total) * 100)::int end
  );
end;
$$;

grant execute on function public.execution_roadmap_progress(uuid) to authenticated;
revoke all on function public.execution_roadmap_progress(uuid) from anon;
