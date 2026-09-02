-- ============================================================================
-- 0029 — Every workspace gets a commercial identity, at creation
--
-- Migration 0007 ends with this:
--
--   "Give every existing workspace a Free subscription and a credit account,
--    so there is no state where a workspace exists without a commercial
--    identity."
--
-- It backfilled the workspaces that existed when it ran, and nothing has
-- maintained the invariant since. No trigger, no RPC and no application code
-- creates a subscription — `createPersonalWorkspace` in
-- features/workspaces/data.ts inserts the workspace and its owner membership
-- and stops. So the guarantee held only until the next workspace was created.
--
-- What that costs: `entitlement_consume` reads the plan from
-- `public.subscriptions`, and its first branch is
--
--   if v_plan is null then return allowed:false, reason:'no_subscription'
--
-- A workspace with no subscription row can therefore run nothing at all. The
-- customer submits an idea, the funnel saves it as a draft, they press
-- "Validate" and get "No plan is assigned to this workspace yet." Nothing is
-- sent to a provider, no report is written, and the idea stays a draft.
--
-- Every workspace created since 0007 last ran was in exactly that state.
--
-- Fixed with a trigger rather than a line in `createPersonalWorkspace`,
-- because the invariant belongs to the table and there is more than one way to
-- make a workspace. It is `security definer` of necessity: `subscriptions` and
-- `credit_accounts` carry SELECT policies only, so the authenticated customer
-- whose INSERT fires this trigger has no rights to write either table — which
-- is correct, and is why the application cannot do this for itself.
-- ============================================================================

create or replace function public.workspace_provision_commercial_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `on conflict do nothing` because both tables are unique on workspace_id:
  -- a workspace that somehow already has one keeps it, and a re-run of this
  -- migration's backfill is a no-op rather than an error.
  --
  -- 'free' is the entry plan every account starts on; a paid plan is a later
  -- transition through `features/commerce/subscriptions.ts`, never an initial
  -- state. If the plans catalog is missing 'free' the foreign key fails loudly
  -- here, which is the right outcome — a silent no-subscription workspace is
  -- the bug this migration exists to remove.
  insert into public.subscriptions (workspace_id, plan_id, status)
  values (new.id, 'free', 'active')
  on conflict (workspace_id) do nothing;

  insert into public.credit_accounts (workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;

  return new;
end;
$$;

-- AFTER INSERT: the workspace row must exist before anything can reference it.
drop trigger if exists workspaces_provision_commercial_identity
  on public.workspaces;
create trigger workspaces_provision_commercial_identity
  after insert on public.workspaces
  for each row
  execute function public.workspace_provision_commercial_identity();


-- ---------------------------------------------------------------------------
-- Backfill the workspaces created while the invariant was unenforced.
--
-- Identical in shape to 0007's backfill and idempotent for the same reason.
-- Soft-deleted workspaces are skipped: nothing runs in them.
-- ---------------------------------------------------------------------------
insert into public.subscriptions (workspace_id, plan_id, status)
select w.id, 'free', 'active'
from public.workspaces w
where w.deleted_at is null
on conflict (workspace_id) do nothing;

insert into public.credit_accounts (workspace_id)
select w.id from public.workspaces w where w.deleted_at is null
on conflict (workspace_id) do nothing;


-- ---------------------------------------------------------------------------
-- Verification — run after applying. Both must return zero rows.
--
--   select w.id, w.name from public.workspaces w
--     left join public.subscriptions s on s.workspace_id = w.id
--    where w.deleted_at is null and s.workspace_id is null;
--
--   select w.id, w.name from public.workspaces w
--     left join public.credit_accounts c on c.workspace_id = w.id
--    where w.deleted_at is null and c.workspace_id is null;
-- ---------------------------------------------------------------------------
