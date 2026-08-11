-- ============================================================================
-- 0007 — Commercial Platform Foundation (Sprint 6.5)
--
-- Plans, entitlements, subscriptions, credits and usage metering. No payment
-- provider is referenced anywhere: the subscription model is provider-neutral
-- and carries only opaque `provider` / `provider_ref` columns for a future
-- adapter to populate.
--
-- The workspace is the commercial boundary. Every table here is workspace-
-- scoped, and RLS reuses the `is_workspace_member` / `can_manage_workspace`
-- helpers from 0004 rather than inventing a second authorisation model.
--
-- Additive and idempotent. 0001–0006 are not modified.
--
-- ONE DELIBERATE DEVIATION FROM THE SPEC, recorded here because it is the kind
-- of decision a reviewer should be able to challenge:
--
--   SPRINT-06.5.md lists a `usage_events` table. `ai_usage_logs` (migration
--   0003) already carries every field USAGE-METERING-SPEC.md requires —
--   user, workflow, ai_request_id, provider, model, input/output/total tokens,
--   estimated cost, status, created_at — and is already written by the Workflow
--   Manager on every run. The only missing field is `workspace_id`.
--
--   Creating `usage_events` alongside it would mean every AI run writes the
--   same event twice, to two tables that can disagree. For a ledger intended to
--   support billing, two sources of truth for one event is the failure mode to
--   avoid above all others. So `workspace_id` is added to `ai_usage_logs` and it
--   becomes the usage ledger, which is also what the master prompt asks for:
--   "Reuse existing AI usage infrastructure."
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Plan catalog
--
-- Values live in the database rather than in TypeScript so that changing a
-- limit is a SQL update, not a deploy. The *feature keys* stay a TypeScript
-- union so a typo in application code fails at compile time — data-driven
-- values, type-safe identifiers.
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id              text primary key,           -- 'free' | 'starter' | ...
  name            text not null,
  description     text not null,
  -- Minor units (cents/paise) to avoid float rounding on money. Null on
  -- ENTERPRISE, which is quote-only.
  price_monthly   integer,
  price_yearly    integer,
  currency        text not null default 'USD',
  -- Credits granted per billing period. 0 means the plan grants none.
  monthly_credits integer not null default 0,
  sort_order      integer not null default 0,
  is_public       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.plans is
  'Plan catalog. Prices in minor units; null price means quote-only.';

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Entitlements
--
-- One row per (plan, feature). `limit_value` is deliberately nullable with a
-- specific meaning: NULL = unlimited, 0 = denied, N = capped at N. Encoding
-- "unlimited" as NULL rather than -1 or a sentinel keeps the SQL honest —
-- `limit_value is null` reads as unlimited without a magic number.
-- ---------------------------------------------------------------------------
create table if not exists public.plan_entitlements (
  id           uuid primary key default gen_random_uuid(),
  plan_id      text not null references public.plans (id) on delete cascade,
  feature      text not null,
  is_enabled   boolean not null default true,
  limit_value  integer,
  created_at   timestamptz not null default now(),
  unique (plan_id, feature)
);

create index if not exists plan_entitlements_plan_idx
  on public.plan_entitlements (plan_id);
create index if not exists plan_entitlements_feature_idx
  on public.plan_entitlements (feature);


-- ---------------------------------------------------------------------------
-- Subscriptions — provider-neutral
--
-- `provider` and `provider_ref` exist so a future Stripe or Razorpay adapter
-- has somewhere to record its identifiers. Nothing in this migration or in the
-- application writes them.
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  plan_id              text not null references public.plans (id),
  status               text not null default 'active'
                       check (status in ('trialing','active','past_due','canceled','expired')),
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at          timestamptz,
  trial_ends_at        timestamptz,
  -- Reserved for a future payment adapter. Never populated in Sprint 6.5.
  provider             text,
  provider_ref         text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- A workspace has exactly one subscription. Enforced here rather than in
  -- application code so a race cannot create two.
  unique (workspace_id)
);

create index if not exists subscriptions_workspace_idx on public.subscriptions (workspace_id);
create index if not exists subscriptions_plan_idx on public.subscriptions (plan_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Credit accounts
--
-- `balance` is a cached total. The ledger below is the authority; this column
-- exists so a balance read is one indexed lookup rather than a sum over every
-- transaction the workspace has ever made. It is only ever written inside
-- `public.apply_credit_transaction`, which holds a row lock — nothing else may
-- update it, and RLS grants no UPDATE to any client role.
-- ---------------------------------------------------------------------------
create table if not exists public.credit_accounts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  balance      integer not null default 0 check (balance >= 0),
  lifetime_granted integer not null default 0,
  lifetime_spent   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id)
);

create index if not exists credit_accounts_workspace_idx on public.credit_accounts (workspace_id);

drop trigger if exists credit_accounts_set_updated_at on public.credit_accounts;
create trigger credit_accounts_set_updated_at
  before update on public.credit_accounts
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Credit transactions — immutable ledger
--
-- Append-only by policy AND by trigger: `credit_transactions_immutable` below
-- rejects UPDATE and DELETE outright, so the ledger cannot be rewritten even by
-- a privileged caller who forgets. `amount` is signed — positive credits the
-- account, negative debits it — so the balance is always the sum of the ledger.
--
-- `idempotency_key` is unique per workspace. A retried operation that reuses
-- its key is absorbed rather than double-charging.
-- ---------------------------------------------------------------------------
create table if not exists public.credit_transactions (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  account_id      uuid not null references public.credit_accounts (id) on delete cascade,
  kind            text not null
                  check (kind in ('GRANT','DEBIT','REFUND','ADJUSTMENT','EXPIRATION')),
  amount          integer not null check (amount <> 0),
  balance_after   integer not null,
  reason          text,
  -- What consumed the credit, when it was an AI run.
  workflow        text,
  ai_request_id   uuid references public.ai_requests (id) on delete set null,
  -- Who or what initiated it. Null for system operations (expiry, grant).
  created_by      uuid references auth.users (id) on delete set null,
  idempotency_key text,
  created_at      timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create index if not exists credit_transactions_workspace_idx on public.credit_transactions (workspace_id);
create index if not exists credit_transactions_account_idx on public.credit_transactions (account_id);
create index if not exists credit_transactions_created_idx on public.credit_transactions (created_at desc);
create index if not exists credit_transactions_kind_idx on public.credit_transactions (kind);
create index if not exists credit_transactions_request_idx on public.credit_transactions (ai_request_id);
create index if not exists credit_transactions_created_by_idx on public.credit_transactions (created_by);

create or replace function public.reject_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'credit_transactions is an immutable ledger; use a compensating REFUND or ADJUSTMENT row instead of % ', tg_op
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists credit_transactions_immutable on public.credit_transactions;
create trigger credit_transactions_immutable
  before update or delete on public.credit_transactions
  for each row execute function public.reject_ledger_mutation();


-- ---------------------------------------------------------------------------
-- Usage ledger — workspace_id added to the existing ai_usage_logs
-- (see the deviation note at the head of this file)
-- ---------------------------------------------------------------------------
alter table public.ai_usage_logs
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

create index if not exists ai_usage_logs_workspace_idx on public.ai_usage_logs (workspace_id);

-- Backfill historical rows to the owner's personal workspace so existing usage
-- is not orphaned outside the commercial boundary.
update public.ai_usage_logs u
set workspace_id = w.id
from public.workspaces w
where u.workspace_id is null
  and w.owner_id = u.user_id
  and w.is_personal
  and w.deleted_at is null;


-- ---------------------------------------------------------------------------
-- Atomic credit mutation
--
-- The only supported way to change a balance. `security definer` so it can
-- write tables that RLS denies to every client role, with `search_path` pinned
-- (matching the 0004 helpers).
--
-- `for update` on the account row is what makes concurrent debits safe: two
-- simultaneous calls serialise, the second sees the first's balance, and an
-- overdraw is rejected rather than racing to a negative. The `balance >= 0`
-- CHECK is the belt to that braces — if this function is ever bypassed, the
-- constraint still refuses to store a negative balance.
--
-- Returns the resulting balance. Raises on insufficient funds.
-- ---------------------------------------------------------------------------
create or replace function public.apply_credit_transaction(
  p_workspace_id    uuid,
  p_kind            text,
  p_amount          integer,
  p_reason          text default null,
  p_workflow        text default null,
  p_ai_request_id   uuid default null,
  p_created_by      uuid default null,
  p_idempotency_key text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account   public.credit_accounts%rowtype;
  v_existing  public.credit_transactions%rowtype;
  v_new_balance integer;
begin
  if p_amount = 0 then
    raise exception 'credit amount must be non-zero';
  end if;

  -- Idempotency is checked before any mutation so a retry is a pure read.
  if p_idempotency_key is not null then
    select * into v_existing
    from public.credit_transactions
    where workspace_id = p_workspace_id and idempotency_key = p_idempotency_key;

    if found then
      return v_existing.balance_after;
    end if;
  end if;

  -- Create the account on first use rather than requiring a separate step.
  insert into public.credit_accounts (workspace_id)
  values (p_workspace_id)
  on conflict (workspace_id) do nothing;

  -- The lock that makes concurrent debits correct.
  select * into v_account
  from public.credit_accounts
  where workspace_id = p_workspace_id
  for update;

  v_new_balance := v_account.balance + p_amount;

  if v_new_balance < 0 then
    raise exception 'insufficient credits: balance %, requested %', v_account.balance, p_amount
      using errcode = 'check_violation';
  end if;

  update public.credit_accounts
  set balance = v_new_balance,
      lifetime_granted = lifetime_granted + greatest(p_amount, 0),
      lifetime_spent   = lifetime_spent + greatest(-p_amount, 0)
  where id = v_account.id;

  insert into public.credit_transactions
    (workspace_id, account_id, kind, amount, balance_after, reason,
     workflow, ai_request_id, created_by, idempotency_key)
  values
    (p_workspace_id, v_account.id, p_kind, p_amount, v_new_balance, p_reason,
     p_workflow, p_ai_request_id, p_created_by, p_idempotency_key);

  return v_new_balance;
end;
$$;

comment on function public.apply_credit_transaction is
  'The only supported way to change a credit balance. Row-locks the account, enforces non-negative balance, writes the immutable ledger, and absorbs retries via idempotency_key.';


-- ============================================================================
-- Row Level Security
--
-- Shape across all five tables:
--   plans / plan_entitlements  world-readable (the pricing page is public);
--                              no client may write.
--   subscriptions              members read; NOBODY writes through a client.
--   credit_accounts            members read; NOBODY writes through a client.
--   credit_transactions        members read; NOBODY writes through a client.
--
-- The absence of INSERT/UPDATE/DELETE policies is the security control, not an
-- omission. Every commercial mutation goes through `apply_credit_transaction`
-- or a service-role path, which is what "never trust client-side plan,
-- subscription, credit balance or entitlement values" means in practice: the
-- browser is not merely discouraged from writing them, it is unable to.
-- ============================================================================

alter table public.plans enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.subscriptions enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_transactions enable row level security;

drop policy if exists "Public plans are readable by anyone" on public.plans;
create policy "Public plans are readable by anyone"
  on public.plans for select
  to anon, authenticated
  using (is_public);

drop policy if exists "Plan entitlements are readable by anyone" on public.plan_entitlements;
create policy "Plan entitlements are readable by anyone"
  on public.plan_entitlements for select
  to anon, authenticated
  using (
    exists (select 1 from public.plans p where p.id = plan_id and p.is_public)
  );

drop policy if exists "Members can read their workspace subscription" on public.subscriptions;
create policy "Members can read their workspace subscription"
  on public.subscriptions for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members can read their workspace credit account" on public.credit_accounts;
create policy "Members can read their workspace credit account"
  on public.credit_accounts for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members can read their workspace credit ledger" on public.credit_transactions;
create policy "Members can read their workspace credit ledger"
  on public.credit_transactions for select
  to authenticated
  using (public.is_workspace_member(workspace_id));


-- ============================================================================
-- Seed the catalog
--
-- ON CONFLICT DO UPDATE so re-running the migration reconciles the catalog to
-- these values rather than silently leaving stale prices behind.
-- ============================================================================
insert into public.plans (id, name, description, price_monthly, price_yearly, monthly_credits, sort_order, is_public)
values
  ('free',        'Free',        'Evaluate the platform with a limited monthly allowance.',        0,      0,     20,  1, true),
  ('starter',     'Starter',     'For individual entrepreneurs validating and planning.',       2900,  29000,   200,  2, true),
  ('growth',      'Growth',      'For growing businesses and independent consultants.',         7900,  79000,   750,  3, true),
  ('professional','Professional','For teams and agencies running work for clients.',           19900, 199000,  2500,  4, true),
  ('enterprise',  'Enterprise',  'Custom controls, volume and support for organisations.',      null,   null,     0,  5, true)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price_monthly = excluded.price_monthly,
  price_yearly = excluded.price_yearly,
  monthly_credits = excluded.monthly_credits,
  sort_order = excluded.sort_order,
  is_public = excluded.is_public;

-- Entitlements. NULL limit = unlimited, 0 = denied, N = capped.
insert into public.plan_entitlements (plan_id, feature, is_enabled, limit_value)
values
  -- free
  ('free','business_idea_validation', true,  3),
  ('free','business_plan',            true,  1),
  ('free','pdf_export',               true,  null),
  ('free','market_research',          false, 0),
  ('free','competitor_analysis',      false, 0),
  ('free','team_members',             true,  1),
  ('free','api_access',               false, 0),
  -- starter
  ('starter','business_idea_validation', true,  25),
  ('starter','business_plan',            true,  10),
  ('starter','pdf_export',               true,  null),
  ('starter','market_research',          false, 0),
  ('starter','competitor_analysis',      false, 0),
  ('starter','team_members',             true,  1),
  ('starter','api_access',               false, 0),
  -- growth
  ('growth','business_idea_validation', true,  100),
  ('growth','business_plan',            true,  40),
  ('growth','pdf_export',               true,  null),
  ('growth','market_research',          true,  25),
  ('growth','competitor_analysis',      true,  25),
  ('growth','team_members',             true,  5),
  ('growth','api_access',               false, 0),
  -- professional
  ('professional','business_idea_validation', true, null),
  ('professional','business_plan',            true, null),
  ('professional','pdf_export',               true, null),
  ('professional','market_research',          true, 200),
  ('professional','competitor_analysis',      true, 200),
  ('professional','team_members',             true, 20),
  ('professional','api_access',               true, null),
  -- enterprise
  ('enterprise','business_idea_validation', true, null),
  ('enterprise','business_plan',            true, null),
  ('enterprise','pdf_export',               true, null),
  ('enterprise','market_research',          true, null),
  ('enterprise','competitor_analysis',      true, null),
  ('enterprise','team_members',             true, null),
  ('enterprise','api_access',               true, null)
on conflict (plan_id, feature) do update set
  is_enabled = excluded.is_enabled,
  limit_value = excluded.limit_value;


-- ---------------------------------------------------------------------------
-- Give every existing workspace a Free subscription and a credit account, so
-- there is no state where a workspace exists without a commercial identity.
-- ---------------------------------------------------------------------------
insert into public.subscriptions (workspace_id, plan_id, status)
select w.id, 'free', 'active'
from public.workspaces w
where w.deleted_at is null
on conflict (workspace_id) do nothing;

insert into public.credit_accounts (workspace_id)
select w.id from public.workspaces w where w.deleted_at is null
on conflict (workspace_id) do nothing;


-- ============================================================================
-- Verification — run after applying
--
--   -- Every workspace has a subscription and an account:
--   select
--     (select count(*) from public.workspaces where deleted_at is null) as workspaces,
--     (select count(*) from public.subscriptions) as subscriptions,
--     (select count(*) from public.credit_accounts) as accounts;
--
--   -- The ledger refuses mutation (both must raise):
--   -- update public.credit_transactions set amount = 1;
--   -- delete from public.credit_transactions;
--
--   -- Overdraw is refused:
--   -- select public.apply_credit_transaction('<workspace>', 'DEBIT', -999999);
-- ============================================================================
