-- ============================================================================
-- 0029 — Phase 14: workspace plan assignment and plan history
--
-- Additive. One new table, two new functions. Migrations 0001-0028 are applied
-- and are not edited.
--
-- ---------------------------------------------------------------------------
-- What was missing
-- ---------------------------------------------------------------------------
-- 0007 created `subscriptions` and deliberately granted no INSERT, UPDATE or
-- DELETE policy to any client role, so a workspace's plan could be read but
-- never changed. That was correct for Sprint 6.5 — there was no authorised
-- writer — but it left no way for a SUPER_ADMIN to move a workspace between
-- plans, and no record of such a move ever having happened.
--
-- This migration adds the writer and the record. It adds nothing else: the
-- entitlement engine from 0025 is untouched, and continues to be the only
-- thing that decides whether a request is allowed.
--
-- ---------------------------------------------------------------------------
-- Why a history table rather than a column
-- ---------------------------------------------------------------------------
-- `subscriptions` stays the single source of truth for the CURRENT plan. The
-- history table never duplicates that state — it records transitions, so the
-- current plan is derivable from it but is never read from it. Keeping the two
-- roles separate is what stops "which one is right?" from ever being a
-- question.
--
-- It is append-only for the same reason `admin_audit_logs` is: a plan change is
-- a commercial act that somebody may later have to explain, and a record that
-- can be edited afterwards cannot settle an argument.
--
-- ---------------------------------------------------------------------------
-- What a plan change deliberately does NOT do
-- ---------------------------------------------------------------------------
-- It does not touch `usage_counters`, `usage_reservations`, `credit_accounts`,
-- `credit_transactions` or `ai_usage_logs`. A downgrade is a change to what is
-- allowed NEXT, never a rewrite of what already happened.
--
-- The consequence is intended and worth stating plainly: a workspace that used
-- 80 validations on Growth and is moved to Free (limit 3) will read 80 / 3, and
-- `entitlement_consume` will refuse further requests because it compares the
-- counter against whatever the limit is NOW. No extra enforcement is added
-- here; 0025 already produces exactly this behaviour.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The history table
-- ---------------------------------------------------------------------------

create table if not exists public.subscription_plan_history (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  -- Denormalised from `subscriptions` at write time so the trail survives the
  -- subscription row being replaced. Not a foreign key for the same reason.
  subscription_id uuid,

  -- Plan ids rather than foreign keys: a plan retired from the catalog must not
  -- erase the fact that a workspace was once on it.
  old_plan        text not null,
  new_plan        text not null,

  -- The admin who made the change. Nullable and `on delete set null` because
  -- the record must outlive the account that created it.
  changed_by      uuid references auth.users (id) on delete set null,
  changed_by_role text,

  reason          text,
  created_at      timestamptz not null default timezone('utc', now()),

  -- A change from a plan to itself is not a change. Enforced here so no code
  -- path can write a meaningless row.
  constraint subscription_plan_history_distinct check (old_plan <> new_plan)
);

comment on table public.subscription_plan_history is
  'Append-only record of workspace plan transitions. subscriptions holds the current plan; this holds how it got there.';
comment on column public.subscription_plan_history.changed_by is
  'The admin who made the change. Null once that account is deleted — the transition itself is never removed.';

create index if not exists subscription_plan_history_workspace_idx
  on public.subscription_plan_history (workspace_id, created_at desc);
create index if not exists subscription_plan_history_actor_idx
  on public.subscription_plan_history (changed_by, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Append-only
--
-- Mirrors `reject_audit_mutation` (0008) and `reject_ledger_mutation` (0007).
-- Its own function rather than a shared one so the error names the table the
-- caller actually touched.
-- ---------------------------------------------------------------------------

create or replace function public.reject_plan_history_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception
    'subscription_plan_history is append-only: % is not permitted', tg_op
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists subscription_plan_history_immutable
  on public.subscription_plan_history;
create trigger subscription_plan_history_immutable
  before update or delete on public.subscription_plan_history
  for each row execute function public.reject_plan_history_mutation();

-- ---------------------------------------------------------------------------
-- 3. Row level security
--
-- Read for admins holding `workspaces.read` — the permission that already
-- governs the workspace detail page this history is rendered on. SUPER_ADMIN
-- holds it, so SUPER_ADMIN sees everything.
--
-- There is NO insert, update or delete policy, for any role, on purpose. The
-- only writer is `admin_change_workspace_plan` below, which is security definer
-- and therefore bypasses RLS. A customer cannot write here through any path,
-- and neither can an admin acting outside that function.
-- ---------------------------------------------------------------------------

alter table public.subscription_plan_history enable row level security;

drop policy if exists "Workspace readers read plan history"
  on public.subscription_plan_history;
create policy "Workspace readers read plan history"
  on public.subscription_plan_history for select
  to authenticated
  using (public.admin_has('workspaces.read'));

-- ---------------------------------------------------------------------------
-- 4. Change a workspace's plan, atomically
--
-- Everything below happens in one transaction: a plpgsql function body is a
-- single statement to the caller, so a failure anywhere rolls back the update,
-- the history row and the audit row together. There is deliberately no way to
-- record a plan change without its history, because they are the same write.
--
-- Authorization is `plans.manage`, which in the seeded matrix (0008) is held by
-- SUPER_ADMIN alone — ADMIN is explicitly excluded from it. Reusing that
-- permission rather than inventing one keeps a single RBAC vocabulary.
--
-- Nothing is trusted from the caller except the workspace id, the target plan
-- and a reason. The current plan is read from the database, never supplied, so
-- a stale or forged "current plan" cannot influence the outcome.
-- ---------------------------------------------------------------------------

create or replace function public.admin_change_workspace_plan(
  p_workspace_id uuid,
  p_plan_id      text,
  p_reason       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role     text := public.admin_role();
  v_sub      public.subscriptions%rowtype;
  v_old_plan text;
  v_history  uuid;
begin
  if not public.admin_has('plans.manage') then
    raise exception 'permission denied: plans.manage'
      using errcode = 'insufficient_privilege';
  end if;

  -- The target plan must exist in the catalog. Without this an admin could
  -- strand a workspace on a plan id that has no entitlement rows, which
  -- `entitlement_consume` would read as feature_not_in_plan and deny
  -- everything.
  if not exists (select 1 from public.plans where id = p_plan_id) then
    raise exception 'plan not found: %', p_plan_id
      using errcode = 'no_data_found';
  end if;

  -- Lock the subscription row. Two admins changing the same workspace at once
  -- serialise here, so the second reads the first's plan as the old value and
  -- the history reads as a chain rather than two conflicting branches.
  select * into v_sub
    from public.subscriptions
   where workspace_id = p_workspace_id
   for update;

  if v_sub.id is null then
    raise exception 'no subscription for this workspace'
      using errcode = 'no_data_found';
  end if;

  v_old_plan := v_sub.plan_id;

  if v_old_plan = p_plan_id then
    raise exception 'workspace is already on the % plan', p_plan_id
      using errcode = 'check_violation';
  end if;

  -- 1. The change itself. Only `plan_id` moves: status, period boundaries and
  --    provider references are not this operation's business, and rewriting the
  --    period would silently reset the customer's allowance.
  update public.subscriptions
     set plan_id = p_plan_id
   where id = v_sub.id;

  -- 2. The immutable record of it.
  insert into public.subscription_plan_history (
    workspace_id, subscription_id, old_plan, new_plan,
    changed_by, changed_by_role, reason
  ) values (
    p_workspace_id, v_sub.id, v_old_plan, p_plan_id,
    auth.uid(), v_role, nullif(btrim(coalesce(p_reason, '')), '')
  )
  returning id into v_history;

  -- 3. The shared admin trail, so a plan change appears alongside every other
  --    privileged act rather than only in a commerce-specific table.
  perform public.admin_log(
    'WORKSPACE_PLAN_CHANGED',
    'workspace',
    p_workspace_id::text,
    jsonb_build_object('plan_id', v_old_plan),
    jsonb_build_object('plan_id', p_plan_id),
    p_reason,
    null
  );

  -- Usage counters, reservations, credits and AI history are untouched by
  -- design. See the header.
  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'old_plan', v_old_plan,
    'new_plan', p_plan_id,
    'history_id', v_history
  );
end;
$$;

grant execute on function public.admin_change_workspace_plan(uuid, text, text)
  to authenticated;
revoke all on function public.admin_change_workspace_plan(uuid, text, text)
  from anon;

-- ---------------------------------------------------------------------------
-- 5. Read a workspace's plan history
--
-- A function rather than a direct select so the admin detail page gets the
-- actor's email in one round trip. Reads are still governed by the same
-- permission the RLS policy uses.
-- ---------------------------------------------------------------------------

create or replace function public.admin_workspace_plan_history(
  p_workspace_id uuid,
  p_limit        integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not public.admin_has('workspaces.read') then
    raise exception 'permission denied: workspaces.read'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(row_to_json(h) order by h.created_at desc), '[]'::jsonb)
    into v_rows
  from (
    select ph.id,
           ph.old_plan,
           ph.new_plan,
           ph.reason,
           ph.created_at,
           ph.changed_by_role,
           u.email as changed_by_email
      from public.subscription_plan_history ph
      left join auth.users u on u.id = ph.changed_by
     where ph.workspace_id = p_workspace_id
     order by ph.created_at desc
     limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) h;

  return v_rows;
end;
$$;

grant execute on function public.admin_workspace_plan_history(uuid, integer)
  to authenticated;
revoke all on function public.admin_workspace_plan_history(uuid, integer)
  from anon;
