-- ============================================================================
-- 0025 — Atomic entitlement usage
--
-- Additive. Two new tables, two new functions. Migrations 0001-0024 are applied
-- and are not edited.
--
-- ---------------------------------------------------------------------------
-- The problem this solves
-- ---------------------------------------------------------------------------
-- `plan_entitlements.limit_value` describes a monthly allowance per plan, and a
-- SUPER_ADMIN can edit it from the admin panel. Nothing enforced it for
-- business validation or business plan generation: both ran `runWorkflow()`
-- with no quota check at all, so a workspace capped at 3 validations a month
-- could run any number, each a real billed AI call.
--
-- The obvious fix — count usage, compare to the limit, then execute — is what
-- the other feature engines do, and it is not safe:
--
--     used = SELECT count(*) ...        -- both requests read 2
--     if (used < limit) runWorkflow()   -- both pass, both execute
--     -- usage row written only AFTER the AI call succeeds
--
-- Two concurrent requests both observe the pre-request count and both proceed.
-- The window is the entire duration of the AI call, seconds wide, because
-- `ai_usage_logs` is written at the end. Counting is not reserving.
--
-- ---------------------------------------------------------------------------
-- The shape, and why it is this shape
-- ---------------------------------------------------------------------------
-- Deliberately the same structure as the credit engine in 0007, which is
-- already proven race-safe in this codebase:
--
--     credit_accounts.balance   (cached)   ->  usage_counters.used
--     credit_transactions       (ledger)   ->  usage_reservations
--     apply_credit_transaction  (locks)    ->  entitlement_consume
--
-- The counter is a cache; the reservation ledger is the authority. `for update`
-- on the counter row is what makes concurrency safe: two simultaneous calls
-- serialise, and the second sees the first's increment.
--
-- ---------------------------------------------------------------------------
-- Configuration must be real
-- ---------------------------------------------------------------------------
-- `entitlement_consume` reads `plan_entitlements.limit_value` ON EVERY CALL. No
-- limit is cached in application code, in a constant, or in a materialised
-- view. A SUPER_ADMIN editing free.business_idea_validation from 3 to 5 changes
-- the answer for the very next request, with no deploy, rebuild, restart or
-- re-login.
--
-- Lowering a limit below current usage refuses new requests and touches no
-- history: the counter is compared against whatever the limit is now.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The counter (cache) and the reservation ledger (authority)
-- ---------------------------------------------------------------------------

create table if not exists public.usage_counters (
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  feature       text not null,
  -- First instant of the usage period. Calendar month, UTC — the definition
  -- `features/commerce/usage.ts` already established. There is deliberately
  -- only one period model in this system.
  period_start  timestamptz not null,
  used          integer not null default 0 check (used >= 0),
  updated_at    timestamptz not null default timezone('utc', now()),

  primary key (workspace_id, feature, period_start)
);

comment on table public.usage_counters is
  'Cached per-period consumption. usage_reservations is the authority; this exists so a quota check is one indexed lookup rather than a count over the ledger.';

create table if not exists public.usage_reservations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  feature       text not null,
  period_start  timestamptz not null,

  -- Deterministic and supplied by the caller, exactly like the credit ledger.
  -- A retry of the same logical operation carries the same key and must not
  -- consume a second unit of allowance.
  idempotency_key text not null unique,

  state         text not null default 'held' check (state in ('held','released')),
  released_at   timestamptz,
  created_at    timestamptz not null default timezone('utc', now())
);

comment on table public.usage_reservations is
  'Append-only record of allowance consumed. Released rather than deleted when an AI run fails, so the history of what was attempted survives.';

create index if not exists usage_reservations_workspace_idx
  on public.usage_reservations (workspace_id, feature, period_start);

-- ---------------------------------------------------------------------------
-- 2. Row level security
--
-- A workspace member may READ their own consumption — the dashboard needs it.
-- Nobody may write through the API: the only supported path is the security
-- definer functions below, which is what keeps the counter and the ledger in
-- agreement. There is no INSERT, UPDATE or DELETE policy on either table, for
-- any role, on purpose.
-- ---------------------------------------------------------------------------

alter table public.usage_counters enable row level security;
alter table public.usage_reservations enable row level security;

drop policy if exists "Members read their usage counters" on public.usage_counters;
create policy "Members read their usage counters"
  on public.usage_counters for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Admins read all usage counters" on public.usage_counters;
create policy "Admins read all usage counters"
  on public.usage_counters for select
  to authenticated
  using (public.admin_has('usage.read'));

drop policy if exists "Members read their reservations" on public.usage_reservations;
create policy "Members read their reservations"
  on public.usage_reservations for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Admins read all reservations" on public.usage_reservations;
create policy "Admins read all reservations"
  on public.usage_reservations for select
  to authenticated
  using (public.admin_has('usage.read'));

-- ---------------------------------------------------------------------------
-- 3. Period helper
--
-- One definition, used by the functions below and mirrored by
-- `currentPeriodStart()` in TypeScript. Calendar month in UTC.
-- ---------------------------------------------------------------------------

create or replace function public.usage_period_start(p_at timestamptz default null)
returns timestamptz
language sql
immutable
as $$
  select date_trunc('month', coalesce(p_at, timezone('utc', now())) at time zone 'UTC')
         at time zone 'UTC';
$$;

-- ---------------------------------------------------------------------------
-- 4. Consume one unit of allowance, atomically
--
-- Returns jsonb rather than raising, because "you have reached your limit" is a
-- normal product outcome the UI must render, not an exception. Genuine faults
-- (not a member, unknown feature) still raise.
-- ---------------------------------------------------------------------------

create or replace function public.entitlement_consume(
  p_workspace_id    uuid,
  p_feature         text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period   timestamptz := public.usage_period_start();
  v_plan     text;
  v_status   text;
  v_enabled  boolean;
  v_limit    integer;
  v_used     integer;
  v_existing public.usage_reservations%rowtype;
begin
  -- Authorization. The caller names a workspace; membership decides whether
  -- they may spend its allowance. Without this a signed-in customer could
  -- consume another workspace's quota by passing its id.
  if not public.is_workspace_member(p_workspace_id)
     and not public.admin_has('workspaces.manage') then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if p_idempotency_key is null or length(btrim(p_idempotency_key)) = 0 then
    raise exception 'an idempotency key is required'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Idempotent replay. A retry carrying the same key gets the original outcome
  -- and consumes nothing further.
  select * into v_existing from public.usage_reservations
   where idempotency_key = p_idempotency_key;

  if v_existing.id is not null then
    select used into v_used from public.usage_counters
     where workspace_id = p_workspace_id
       and feature = p_feature
       and period_start = v_existing.period_start;

    return jsonb_build_object(
      'allowed', v_existing.state = 'held',
      'replayed', true,
      'feature', p_feature,
      'used', coalesce(v_used, 0),
      'period_start', v_existing.period_start
    );
  end if;

  -- Plan comes from the database, never from the caller. There is no parameter
  -- through which a client could assert a plan, and this is the only lookup.
  select plan_id, status into v_plan, v_status
    from public.subscriptions
   where workspace_id = p_workspace_id;

  if v_plan is null then
    return jsonb_build_object(
      'allowed', false, 'reason', 'no_subscription', 'feature', p_feature);
  end if;

  -- Mirrors isEntitledStatus() in features/commerce/types.ts.
  if v_status not in ('active', 'trialing') then
    return jsonb_build_object(
      'allowed', false, 'reason', 'subscription_inactive',
      'feature', p_feature, 'plan', v_plan, 'status', v_status);
  end if;

  -- Read at call time. This is what makes an admin edit take effect on the very
  -- next request rather than at the next deploy.
  select is_enabled, limit_value into v_enabled, v_limit
    from public.plan_entitlements
   where plan_id = v_plan and feature = p_feature;

  -- No row means the plan does not describe this feature. Deny: a feature added
  -- to the code before the catalog must not become free for everyone.
  if not found then
    return jsonb_build_object(
      'allowed', false, 'reason', 'feature_not_in_plan',
      'feature', p_feature, 'plan', v_plan);
  end if;

  if not v_enabled or v_limit = 0 then
    return jsonb_build_object(
      'allowed', false, 'reason', 'feature_disabled',
      'feature', p_feature, 'plan', v_plan, 'limit', v_limit);
  end if;

  -- Materialise the counter, then LOCK it. The insert must come first so there
  -- is a row to lock; `on conflict do nothing` makes the race to create it
  -- harmless.
  insert into public.usage_counters (workspace_id, feature, period_start, used)
  values (p_workspace_id, p_feature, v_period, 0)
  on conflict (workspace_id, feature, period_start) do nothing;

  select used into v_used
    from public.usage_counters
   where workspace_id = p_workspace_id
     and feature = p_feature
     and period_start = v_period
   for update;

  -- null limit = unlimited.
  if v_limit is not null and v_used >= v_limit then
    return jsonb_build_object(
      'allowed', false, 'reason', 'limit_reached',
      'feature', p_feature, 'plan', v_plan,
      'used', v_used, 'limit', v_limit,
      'period', 'monthly', 'period_start', v_period);
  end if;

  update public.usage_counters
     set used = used + 1, updated_at = timezone('utc', now())
   where workspace_id = p_workspace_id
     and feature = p_feature
     and period_start = v_period;

  insert into public.usage_reservations (
    workspace_id, feature, period_start, idempotency_key
  ) values (
    p_workspace_id, p_feature, v_period, p_idempotency_key
  );

  return jsonb_build_object(
    'allowed', true, 'feature', p_feature, 'plan', v_plan,
    'used', v_used + 1, 'limit', v_limit,
    'remaining', case when v_limit is null then null else v_limit - v_used - 1 end,
    'period', 'monthly', 'period_start', v_period);
end;
$$;

grant execute on function public.entitlement_consume(uuid, text, text) to authenticated;
revoke all on function public.entitlement_consume(uuid, text, text) from anon;

-- ---------------------------------------------------------------------------
-- 5. Release a reservation
--
-- Called when the work the allowance was reserved for did not happen — an AI
-- failure, a validation error after reservation. Matches the policy
-- `countWorkflowRuns` already implements by counting successes only: a customer
-- does not pay allowance for something they did not receive.
--
-- Releasing marks the ledger row rather than deleting it, so "this was
-- attempted and refunded" stays visible. Releasing twice is a no-op.
-- ---------------------------------------------------------------------------

create or replace function public.entitlement_release(p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.usage_reservations%rowtype;
begin
  select * into v_row from public.usage_reservations
   where idempotency_key = p_idempotency_key
   for update;

  if v_row.id is null then
    return jsonb_build_object('released', false, 'reason', 'not_found');
  end if;

  if not public.is_workspace_member(v_row.workspace_id)
     and not public.admin_has('workspaces.manage') then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if v_row.state = 'released' then
    return jsonb_build_object('released', false, 'reason', 'already_released');
  end if;

  update public.usage_reservations
     set state = 'released', released_at = timezone('utc', now())
   where id = v_row.id;

  -- `greatest(used - 1, 0)` rather than a bare decrement: the CHECK would
  -- reject a negative, and a release that outnumbers its consume should be
  -- absorbed rather than aborting the caller's error path.
  update public.usage_counters
     set used = greatest(used - 1, 0), updated_at = timezone('utc', now())
   where workspace_id = v_row.workspace_id
     and feature = v_row.feature
     and period_start = v_row.period_start;

  return jsonb_build_object('released', true, 'feature', v_row.feature);
end;
$$;

grant execute on function public.entitlement_release(text) to authenticated;
revoke all on function public.entitlement_release(text) from anon;

-- ---------------------------------------------------------------------------
-- 6. Read current consumption for a workspace
--
-- Powers the dashboard usage panel without exposing the tables directly.
-- Returns the CURRENT limit alongside usage, so what a customer sees and what
-- the engine enforces can never disagree.
-- ---------------------------------------------------------------------------

create or replace function public.entitlement_usage(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_period timestamptz := public.usage_period_start();
  v_plan   text;
  v_status text;
begin
  if not public.is_workspace_member(p_workspace_id)
     and not public.admin_has('usage.read') then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  select plan_id, status into v_plan, v_status
    from public.subscriptions where workspace_id = p_workspace_id;

  if v_plan is null then
    return jsonb_build_object('plan', null, 'features', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'plan', v_plan,
    'status', v_status,
    'period_start', v_period,
    'period_end', (v_period + interval '1 month'),
    'features', coalesce((
      select jsonb_agg(row_to_json(f) order by f.feature)
        from (
          select e.feature,
                 e.is_enabled,
                 e.limit_value                        as limit,
                 coalesce(c.used, 0)                  as used,
                 case when e.limit_value is null then null
                      else greatest(e.limit_value - coalesce(c.used, 0), 0)
                 end                                  as remaining
            from public.plan_entitlements e
            left join public.usage_counters c
              on c.workspace_id = p_workspace_id
             and c.feature = e.feature
             and c.period_start = v_period
           where e.plan_id = v_plan
        ) f
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.entitlement_usage(uuid) to authenticated;
revoke all on function public.entitlement_usage(uuid) from anon;

-- ============================================================================
-- Verification
--
--   select public.entitlement_consume('<ws>', 'business_idea_validation', 'k1');
--   select public.entitlement_usage('<ws>');
--
-- Concurrency: two simultaneous consumes with one unit remaining must return
-- allowed=true exactly once. The `for update` on usage_counters is what
-- guarantees it.
-- ============================================================================
