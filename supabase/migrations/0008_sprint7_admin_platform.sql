-- ============================================================================
-- Migration 0008 — Sprint 7: Admin & Operations Platform
--
-- Adds the internal control centre: admin identity, a centrally-defined
-- permission matrix, an append-oriented audit trail, and the RLS that lets an
-- admin read across workspace boundaries *without* a service-role key.
--
-- ---------------------------------------------------------------------------
-- THE CENTRAL DECISION: no service-role key in the application
-- ---------------------------------------------------------------------------
-- An admin panel has to cross the workspace boundary that every other table
-- spends its RLS enforcing. There are two ways to do that:
--
--   (a) Query with the service-role key, which bypasses RLS entirely, and rely
--       on application code to check permissions before every query.
--   (b) Grant the admin's *own* session the read access, through RLS policies
--       that consult a permission table.
--
-- This migration takes (b). Under (a) a single forgotten check exposes the
-- whole platform, because the database has been told to trust the caller
-- absolutely; the blast radius of one missing `if` is every row of every table.
-- Under (b) the database re-derives the answer on every statement from
-- `auth.uid()`, so application code that forgets a check gets *nothing back*
-- rather than everything. The application layer becomes defence in depth
-- instead of the only defence.
--
-- The cost is that admin reads are expressed as policies rather than as a
-- privileged connection, which is more SQL. That is the right trade for a
-- surface the security spec calls "a high-value attack surface".
--
-- Consequently: `SUPABASE_SERVICE_ROLE_KEY` is NOT read by the Next.js app.
--
-- ---------------------------------------------------------------------------
-- Idempotent. Additive only. Does not modify any applied migration.
-- ============================================================================

-- ============================================================================
-- 1. Admin identity
-- ============================================================================

create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null check (role in ('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ANALYST')),
  -- Deactivating is preferred over deleting: the audit trail references the
  -- actor, and a removed row would orphan the history of what they did.
  is_active  boolean not null default true,
  note       text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.admin_users is
  'Platform staff and their admin role. Membership of this table is the ONLY thing that confers admin access — never an email address or a hardcoded list.';

drop trigger if exists admin_users_set_updated_at on public.admin_users;
create trigger admin_users_set_updated_at
  before update on public.admin_users
  for each row execute function public.set_updated_at();

create index if not exists admin_users_role_idx
  on public.admin_users (role) where is_active;

-- ============================================================================
-- 2. The permission matrix — one source of truth
--
-- ADMIN-RBAC-SPEC.md requires "centralized permission definitions" and forbids
-- "scattered boolean checks". Storing the matrix as rows rather than as CASE
-- expressions inside a function means SQL policies and the TypeScript UI read
-- the *same* grant, and a role's powers can be audited with a SELECT.
-- ============================================================================

create table if not exists public.admin_role_permissions (
  role       text not null check (role in ('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ANALYST')),
  permission text not null check (permission in (
    'users.read',        'users.manage',
    'workspaces.read',   'workspaces.manage',
    'ai.read',           'usage.read',
    'credits.read',      'credits.adjust',
    'plans.read',        'plans.manage',
    'entitlements.read', 'entitlements.manage',
    'audit.read',        'system.read'
  )),
  primary key (role, permission)
);

comment on table public.admin_role_permissions is
  'Role -> permission grants. The single source of truth for admin authorization; mirrored (and asserted) in features/admin/permissions.ts.';

-- Least privilege, deny by default. A role holds exactly the rows below.
--
--   ANALYST     read-only analytics. Deliberately has NO users.read and no
--               credits.read: analytics work does not require customer PII or
--               visibility into individual money movements.
--   SUPPORT     customer-facing reads, including PII and balances, so a
--               support agent can answer "what happened to my account?".
--               No mutations at all in Sprint 7.
--   ADMIN       full operations: suspend/restore, adjust credits, read audit.
--               Excludes plans.manage / entitlements.manage — changing pricing
--               or what a plan includes is a platform-wide commercial act, not
--               an operational one.
--   SUPER_ADMIN everything.
insert into public.admin_role_permissions (role, permission) values
  ('ANALYST',     'workspaces.read'),
  ('ANALYST',     'ai.read'),
  ('ANALYST',     'usage.read'),
  ('ANALYST',     'plans.read'),
  ('ANALYST',     'entitlements.read'),
  ('ANALYST',     'system.read'),

  ('SUPPORT',     'users.read'),
  ('SUPPORT',     'workspaces.read'),
  ('SUPPORT',     'ai.read'),
  ('SUPPORT',     'usage.read'),
  ('SUPPORT',     'credits.read'),
  ('SUPPORT',     'plans.read'),
  ('SUPPORT',     'entitlements.read'),

  ('ADMIN',       'users.read'),
  ('ADMIN',       'users.manage'),
  ('ADMIN',       'workspaces.read'),
  ('ADMIN',       'workspaces.manage'),
  ('ADMIN',       'ai.read'),
  ('ADMIN',       'usage.read'),
  ('ADMIN',       'credits.read'),
  ('ADMIN',       'credits.adjust'),
  ('ADMIN',       'plans.read'),
  ('ADMIN',       'entitlements.read'),
  ('ADMIN',       'audit.read'),
  ('ADMIN',       'system.read'),

  ('SUPER_ADMIN', 'users.read'),
  ('SUPER_ADMIN', 'users.manage'),
  ('SUPER_ADMIN', 'workspaces.read'),
  ('SUPER_ADMIN', 'workspaces.manage'),
  ('SUPER_ADMIN', 'ai.read'),
  ('SUPER_ADMIN', 'usage.read'),
  ('SUPER_ADMIN', 'credits.read'),
  ('SUPER_ADMIN', 'credits.adjust'),
  ('SUPER_ADMIN', 'plans.read'),
  ('SUPER_ADMIN', 'plans.manage'),
  ('SUPER_ADMIN', 'entitlements.read'),
  ('SUPER_ADMIN', 'entitlements.manage'),
  ('SUPER_ADMIN', 'audit.read'),
  ('SUPER_ADMIN', 'system.read')
on conflict (role, permission) do nothing;

-- ============================================================================
-- 3. Authorization primitives
--
-- `security definer` with a pinned `search_path`, exactly like the workspace
-- helpers in 0004. These are the only place `auth.uid()` is turned into admin
-- authority, so there is one code path to review.
-- ============================================================================

/** The caller's active admin role, or NULL if they are not staff. */
create or replace function public.admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.role
  from public.admin_users a
  where a.user_id = auth.uid() and a.is_active;
$$;

/** Is the caller any kind of active admin? */
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.admin_role() is not null;
$$;

/**
 * Does the caller hold `p_permission`?
 *
 * Deny by default: a NULL role, an inactive admin, or a permission string that
 * matches no grant all return false. An unknown permission cannot accidentally
 * succeed, because authorization is a lookup rather than a negation.
 */
create or replace function public.admin_has(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_role_permissions p
    where p.role = public.admin_role()
      and p.permission = p_permission
  );
$$;

comment on function public.admin_has(text) is
  'Deny-by-default admin permission check. Used by RLS policies and by the server-side guards in features/admin/guard.ts.';

-- ============================================================================
-- 4. Audit trail
--
-- Append-oriented: INSERT is allowed to the audited functions, UPDATE and
-- DELETE are refused for *everyone*, including SUPER_ADMIN, by a trigger. An
-- admin who can rewrite the record of what they did does not have an audit
-- trail, they have a diary.
--
-- Retention/erasure is therefore a deliberate out-of-band operation (a
-- migration or a direct maintenance session), which is the intent: it should
-- require more authority than the application ever holds.
-- ============================================================================

create table if not exists public.admin_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  -- Denormalised on purpose: the actor's role AT THE TIME of the action. If
  -- they are later demoted, the record must still say what authority was used.
  actor_role    text not null,
  action        text not null,
  entity_type   text not null,
  entity_id     text,
  before_data   jsonb,
  after_data    jsonb,
  reason        text,
  request_id    text,
  created_at    timestamptz not null default timezone('utc', now())
);

comment on table public.admin_audit_logs is
  'Immutable record of sensitive admin actions. UPDATE and DELETE are rejected by trigger for every role.';
comment on column public.admin_audit_logs.actor_role is
  'The actor role at the time of the action, not their current role.';
comment on column public.admin_audit_logs.before_data is
  'Redacted snapshot before the change. Must never contain secrets, tokens or provider credentials.';

create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_actor_idx
  on public.admin_audit_logs (actor_user_id, created_at desc);
create index if not exists admin_audit_logs_entity_idx
  on public.admin_audit_logs (entity_type, entity_id, created_at desc);
create index if not exists admin_audit_logs_action_idx
  on public.admin_audit_logs (action, created_at desc);

create or replace function public.reject_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception
    'admin_audit_logs is append-only: % is not permitted', tg_op
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists admin_audit_logs_immutable on public.admin_audit_logs;
create trigger admin_audit_logs_immutable
  before update or delete on public.admin_audit_logs
  for each row execute function public.reject_audit_mutation();

/**
 * Write one audit event. `security definer` so the row is written even though
 * no client-facing INSERT policy exists on the table — the ONLY way to append
 * is through this function, which stamps the actor from `auth.uid()` rather
 * than accepting one from the caller. A client cannot forge authorship.
 */
create or replace function public.admin_log(
  p_action      text,
  p_entity_type text,
  p_entity_id   text default null,
  p_before      jsonb default null,
  p_after       jsonb default null,
  p_reason      text default null,
  p_request_id  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.admin_role();
  v_id   uuid;
begin
  if v_role is null then
    raise exception 'not an admin' using errcode = 'insufficient_privilege';
  end if;

  insert into public.admin_audit_logs (
    actor_user_id, actor_role, action, entity_type, entity_id,
    before_data, after_data, reason, request_id
  )
  values (
    auth.uid(), v_role, p_action, p_entity_type, p_entity_id,
    p_before, p_after, p_reason, p_request_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================================
-- 5. Suspension state
--
-- ADMIN-OPERATIONS-SPEC.md: "Prefer reversible operations. Avoid deletion."
-- Suspension is a nullable timestamp rather than a boolean so the record
-- carries *when*, and restoring is setting it back to NULL.
-- ============================================================================

alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;

alter table public.workspaces
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;

create index if not exists profiles_suspended_idx
  on public.profiles (suspended_at) where suspended_at is not null;
create index if not exists workspaces_suspended_idx
  on public.workspaces (suspended_at) where suspended_at is not null;

-- ============================================================================
-- 6. Admin read access via RLS
--
-- Each policy is ADDITIVE to the existing per-user policies (Postgres ORs
-- permissive policies together), so nothing a normal user could already see
-- changes, and no existing policy is dropped or rewritten. Workspace isolation
-- for non-admins is untouched: `admin_has(...)` is false for them, leaving the
-- original predicate as the only one that can match.
-- ============================================================================

alter table public.admin_users enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_audit_logs enable row level security;

-- An admin may see the staff list; nobody else may learn who the admins are.
drop policy if exists "Admins read the staff list" on public.admin_users;
create policy "Admins read the staff list"
  on public.admin_users for select
  using (public.is_admin());

-- Every admin may read the matrix — the UI needs it to hide unusable controls.
drop policy if exists "Admins read the permission matrix" on public.admin_role_permissions;
create policy "Admins read the permission matrix"
  on public.admin_role_permissions for select
  using (public.is_admin());

drop policy if exists "Audit readers read the audit trail" on public.admin_audit_logs;
create policy "Audit readers read the audit trail"
  on public.admin_audit_logs for select
  using (public.admin_has('audit.read'));

-- NOTE: no INSERT/UPDATE/DELETE policy is defined on any of the three tables
-- above. Appending happens through admin_log() (security definer); granting
-- admin roles is deliberately a database operation, not an application one.

-- --- Customer data --------------------------------------------------------

drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles"
  on public.profiles for select
  using (public.admin_has('users.read'));

drop policy if exists "Admins read all workspaces" on public.workspaces;
create policy "Admins read all workspaces"
  on public.workspaces for select
  using (public.admin_has('workspaces.read'));

drop policy if exists "Admins read all workspace members" on public.workspace_members;
create policy "Admins read all workspace members"
  on public.workspace_members for select
  using (public.admin_has('workspaces.read'));

drop policy if exists "Admins read all projects" on public.projects;
create policy "Admins read all projects"
  on public.projects for select
  using (public.admin_has('workspaces.read'));

drop policy if exists "Admins read all usage" on public.ai_usage_logs;
create policy "Admins read all usage"
  on public.ai_usage_logs for select
  using (public.admin_has('ai.read'));

drop policy if exists "Admins read all AI requests" on public.ai_requests;
create policy "Admins read all AI requests"
  on public.ai_requests for select
  using (public.admin_has('ai.read'));

drop policy if exists "Admins read all AI responses" on public.ai_responses;
create policy "Admins read all AI responses"
  on public.ai_responses for select
  using (public.admin_has('ai.read'));

drop policy if exists "Admins read all subscriptions" on public.subscriptions;
create policy "Admins read all subscriptions"
  on public.subscriptions for select
  using (public.admin_has('workspaces.read'));

drop policy if exists "Admins read all credit accounts" on public.credit_accounts;
create policy "Admins read all credit accounts"
  on public.credit_accounts for select
  using (public.admin_has('credits.read'));

drop policy if exists "Admins read all credit transactions" on public.credit_transactions;
create policy "Admins read all credit transactions"
  on public.credit_transactions for select
  using (public.admin_has('credits.read'));

-- `plans` and `plan_entitlements` are already world-readable where public;
-- these let staff see non-public plans too.
drop policy if exists "Admins read every plan" on public.plans;
create policy "Admins read every plan"
  on public.plans for select
  using (public.admin_has('plans.read'));

drop policy if exists "Admins read every entitlement" on public.plan_entitlements;
create policy "Admins read every entitlement"
  on public.plan_entitlements for select
  using (public.admin_has('entitlements.read'));

-- ============================================================================
-- 7. Audited mutations
--
-- Still no client write policies anywhere. Every mutation below is a
-- `security definer` function that (1) checks the permission itself, (2)
-- performs the change and (3) writes the audit row IN THE SAME TRANSACTION.
--
-- That last point is the reason these are functions rather than application
-- code: an action and its audit record cannot come apart. There is no ordering
-- of failures that produces a change with no audit row, or an audit row for a
-- change that did not happen.
-- ============================================================================

/** Suspend or restore a user. Reversible; requires a reason to suspend. */
create or replace function public.admin_set_user_suspended(
  p_user_id   uuid,
  p_suspended boolean,
  p_reason    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
begin
  if not public.admin_has('users.manage') then
    raise exception 'permission denied: users.manage'
      using errcode = 'insufficient_privilege';
  end if;

  if p_suspended and coalesce(btrim(p_reason), '') = '' then
    raise exception 'a reason is required to suspend a user'
      using errcode = 'check_violation';
  end if;

  select jsonb_build_object('suspended_at', suspended_at, 'suspended_reason', suspended_reason)
    into v_before
  from public.profiles where id = p_user_id;

  if v_before is null then
    raise exception 'user not found' using errcode = 'no_data_found';
  end if;

  update public.profiles
     set suspended_at     = case when p_suspended then timezone('utc', now()) else null end,
         suspended_reason = case when p_suspended then p_reason else null end
   where id = p_user_id;

  perform public.admin_log(
    case when p_suspended then 'USER_SUSPENDED' else 'USER_RESTORED' end,
    'user', p_user_id::text, v_before,
    jsonb_build_object('suspended', p_suspended), p_reason, null
  );
end;
$$;

/** Suspend or restore a workspace. Never deletes. */
create or replace function public.admin_set_workspace_suspended(
  p_workspace_id uuid,
  p_suspended    boolean,
  p_reason       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
begin
  if not public.admin_has('workspaces.manage') then
    raise exception 'permission denied: workspaces.manage'
      using errcode = 'insufficient_privilege';
  end if;

  if p_suspended and coalesce(btrim(p_reason), '') = '' then
    raise exception 'a reason is required to suspend a workspace'
      using errcode = 'check_violation';
  end if;

  select jsonb_build_object('suspended_at', suspended_at, 'suspended_reason', suspended_reason)
    into v_before
  from public.workspaces where id = p_workspace_id;

  if v_before is null then
    raise exception 'workspace not found' using errcode = 'no_data_found';
  end if;

  update public.workspaces
     set suspended_at     = case when p_suspended then timezone('utc', now()) else null end,
         suspended_reason = case when p_suspended then p_reason else null end
   where id = p_workspace_id;

  perform public.admin_log(
    case when p_suspended then 'WORKSPACE_SUSPENDED' else 'WORKSPACE_RESTORED' end,
    'workspace', p_workspace_id::text, v_before,
    jsonb_build_object('suspended', p_suspended), p_reason, null
  );
end;
$$;

/**
 * Manual credit movement from the admin panel.
 *
 * Delegates the arithmetic to `apply_credit_transaction` (migration 0007) —
 * the balance is still mutated in exactly one place in the system, under the
 * same row lock, with the same overdraw rejection. This function adds the
 * authorization check, the mandatory reason, and the audit row.
 */
create or replace function public.admin_apply_credits(
  p_workspace_id uuid,
  p_kind         text,
  p_amount       integer,
  p_reason       text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before  integer;
  v_after   integer;
  v_action  text;
begin
  if not public.admin_has('credits.adjust') then
    raise exception 'permission denied: credits.adjust'
      using errcode = 'insufficient_privilege';
  end if;

  -- ADMIN-AUDIT-LOG-SPEC.md: "Manual credit mutations require a reason."
  -- Enforced here, in the database, so no caller can skip it.
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'a reason is required for manual credit changes'
      using errcode = 'check_violation';
  end if;

  if p_kind not in ('GRANT', 'ADJUSTMENT', 'REFUND') then
    raise exception 'admin credit operations are limited to GRANT, ADJUSTMENT and REFUND'
      using errcode = 'check_violation';
  end if;

  select balance into v_before
  from public.credit_accounts where workspace_id = p_workspace_id;

  v_after := public.apply_credit_transaction(
    p_workspace_id => p_workspace_id,
    p_kind         => p_kind,
    p_amount       => p_amount,
    p_reason       => p_reason,
    p_created_by   => auth.uid()
  );

  v_action := case p_kind
    when 'GRANT'      then 'CREDIT_GRANTED'
    when 'REFUND'     then 'CREDIT_REFUNDED'
    else                   'CREDIT_ADJUSTED'
  end;

  perform public.admin_log(
    v_action, 'workspace', p_workspace_id::text,
    jsonb_build_object('balance', v_before),
    jsonb_build_object('balance', v_after, 'kind', p_kind, 'amount', p_amount),
    p_reason, null
  );

  return v_after;
end;
$$;

/** Update a plan's commercial fields. SUPER_ADMIN only, via plans.manage. */
create or replace function public.admin_update_plan(
  p_plan_id         text,
  p_name            text,
  p_description     text,
  p_price_monthly   integer,
  p_monthly_credits integer,
  p_is_public       boolean,
  p_reason          text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after  jsonb;
begin
  if not public.admin_has('plans.manage') then
    raise exception 'permission denied: plans.manage'
      using errcode = 'insufficient_privilege';
  end if;

  if p_price_monthly is not null and p_price_monthly < 0 then
    raise exception 'price cannot be negative' using errcode = 'check_violation';
  end if;
  if p_monthly_credits is null or p_monthly_credits < 0 then
    raise exception 'monthly credits cannot be null or negative' using errcode = 'check_violation';
  end if;

  select to_jsonb(p) into v_before from public.plans p where p.id = p_plan_id;
  if v_before is null then
    raise exception 'plan not found' using errcode = 'no_data_found';
  end if;

  update public.plans
     set name            = coalesce(p_name, name),
         description     = coalesce(p_description, description),
         price_monthly   = p_price_monthly,
         monthly_credits = p_monthly_credits,
         is_public       = p_is_public
   where id = p_plan_id;

  select to_jsonb(p) into v_after from public.plans p where p.id = p_plan_id;

  perform public.admin_log('PLAN_UPDATED', 'plan', p_plan_id, v_before, v_after, p_reason, null);
end;
$$;

/** Update one plan/feature entitlement. NULL limit = unlimited, 0 = denied. */
create or replace function public.admin_update_entitlement(
  p_plan_id  text,
  p_feature  text,
  p_enabled  boolean,
  p_limit    integer,
  p_reason   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after  jsonb;
begin
  if not public.admin_has('entitlements.manage') then
    raise exception 'permission denied: entitlements.manage'
      using errcode = 'insufficient_privilege';
  end if;

  if p_limit is not null and p_limit < 0 then
    raise exception 'limit cannot be negative' using errcode = 'check_violation';
  end if;

  select to_jsonb(e) into v_before
  from public.plan_entitlements e
  where e.plan_id = p_plan_id and e.feature = p_feature;

  if v_before is null then
    raise exception 'entitlement not found' using errcode = 'no_data_found';
  end if;

  update public.plan_entitlements
     set is_enabled  = p_enabled,
         limit_value = p_limit
   where plan_id = p_plan_id and feature = p_feature;

  select to_jsonb(e) into v_after
  from public.plan_entitlements e
  where e.plan_id = p_plan_id and e.feature = p_feature;

  perform public.admin_log(
    'ENTITLEMENT_UPDATED', 'plan_entitlement',
    p_plan_id || ':' || p_feature, v_before, v_after, p_reason, null
  );
end;
$$;

-- ============================================================================
-- 8. Platform counts for the dashboard
--
-- The dashboard needs totals across every workspace. Doing that from the
-- client would mean selecting every row and counting in TypeScript — slow, and
-- it drags rows the caller has no reason to hold. This returns only the
-- aggregates, and refuses callers without the matching read permission.
-- ============================================================================

create or replace function public.admin_platform_stats(p_since timestamptz default null)
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

  -- Each block is gated on its own permission, so an ANALYST (no users.read)
  -- gets a payload with no user counts rather than a denial — the dashboard
  -- then labels those cards unavailable instead of failing to render.
  if public.admin_has('users.read') then
    v_out := v_out || jsonb_build_object(
      'total_users',     (select count(*) from public.profiles),
      'suspended_users', (select count(*) from public.profiles where suspended_at is not null),
      'new_users_30d',   (select count(*) from public.profiles where created_at >= v_since)
    );
  end if;

  if public.admin_has('workspaces.read') then
    v_out := v_out || jsonb_build_object(
      'total_workspaces',    (select count(*) from public.workspaces where deleted_at is null),
      'suspended_workspaces',(select count(*) from public.workspaces where suspended_at is not null),
      'new_workspaces_30d',  (select count(*) from public.workspaces where created_at >= v_since and deleted_at is null),
      'active_subscriptions',(select count(*) from public.subscriptions where status in ('active','trialing'))
    );
  end if;

  if public.admin_has('ai.read') then
    v_out := v_out || jsonb_build_object(
      'ai_requests',     (select count(*) from public.ai_usage_logs where created_at >= v_since),
      'ai_successes',    (select count(*) from public.ai_usage_logs where created_at >= v_since and status = 'success'),
      'ai_failures',     (select count(*) from public.ai_usage_logs where created_at >= v_since and status = 'failed'),
      'total_tokens',    (select coalesce(sum(total_tokens), 0) from public.ai_usage_logs where created_at >= v_since),
      'estimated_cost',  (select coalesce(sum(estimated_cost_usd), 0) from public.ai_usage_logs where created_at >= v_since)
    );
  end if;

  if public.admin_has('credits.read') then
    v_out := v_out || jsonb_build_object(
      'credits_outstanding', (select coalesce(sum(balance), 0) from public.credit_accounts),
      'credits_granted_30d', (select coalesce(sum(amount), 0) from public.credit_transactions where created_at >= v_since and amount > 0),
      'credits_spent_30d',   (select coalesce(-sum(amount), 0) from public.credit_transactions where created_at >= v_since and amount < 0)
    );
  end if;

  return v_out || jsonb_build_object('since', v_since);
end;
$$;

-- ============================================================================
-- 9. Grants
--
-- `authenticated` may EXECUTE these; every one of them re-checks authority
-- internally, so being able to call is not being able to act. `anon` is not
-- granted anything.
-- ============================================================================

grant execute on function public.admin_role()                                       to authenticated;
grant execute on function public.is_admin()                                         to authenticated;
grant execute on function public.admin_has(text)                                    to authenticated;
grant execute on function public.admin_log(text, text, text, jsonb, jsonb, text, text) to authenticated;
grant execute on function public.admin_set_user_suspended(uuid, boolean, text)      to authenticated;
grant execute on function public.admin_set_workspace_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.admin_apply_credits(uuid, text, integer, text)     to authenticated;
grant execute on function public.admin_update_plan(text, text, text, integer, integer, boolean, text) to authenticated;
grant execute on function public.admin_update_entitlement(text, text, boolean, integer, text) to authenticated;
grant execute on function public.admin_platform_stats(timestamptz)                  to authenticated;

revoke all on function public.admin_apply_credits(uuid, text, integer, text)        from anon;
revoke all on function public.admin_set_user_suspended(uuid, boolean, text)         from anon;
revoke all on function public.admin_set_workspace_suspended(uuid, boolean, text)    from anon;
revoke all on function public.admin_update_plan(text, text, text, integer, integer, boolean, text) from anon;
revoke all on function public.admin_update_entitlement(text, text, boolean, integer, text) from anon;
revoke all on function public.admin_platform_stats(timestamptz)                     from anon;
