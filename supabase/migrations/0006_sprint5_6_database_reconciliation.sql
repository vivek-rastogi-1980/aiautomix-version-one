-- ============================================================================
-- 0006 — Database reconciliation (Sprint 5.5 → Sprint 6)
--
-- Closes two findings from docs/PRE-SPRINT-6-GO-NO-GO.md, both discovered by
-- querying the live database rather than reading the migration files.
--
--   DB-001  Production and migration 0004 disagree. 0004 widens the SELECT
--           policies on `business_ideas` and `validation_reports` to include
--           workspace membership; production has owner-only. The `projects`
--           policy from the same block DID apply, so 0004 landed partially.
--
--   DB-002  Six foreign keys have no index. Two of them are `workspace_id`
--           columns used inside RLS predicates, so every policy evaluation on
--           those tables is a sequential scan.
--
-- 0004 is NOT modified. It has been applied to production, and rewriting an
-- applied migration means the file no longer describes what actually ran —
-- which is the very problem DB-001 records. Reconciliation goes forward.
--
-- Additive and idempotent, like 0001–0005. Safe to run more than once, and safe
-- to run against a database where 0004 applied fully (the policies are dropped
-- and recreated to a known state either way).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- DB-001 — Reconcile the widened SELECT policies
--
-- Restates exactly what 0004 intended. `projects` is included even though
-- production already matches: stating all three makes this file the single
-- authoritative description of the read rules, rather than something a reader
-- has to diff against 0004 to understand.
--
-- The `workspace_id is not null` guard matters. These three tables carry a
-- nullable `workspace_id` (added by 0004 to pre-existing Sprint 2/3 tables), and
-- `is_workspace_member(null)` returns NULL rather than false. Without the guard
-- the OR branch evaluates to NULL, and while NULL is not TRUE — so it does not
-- grant access — the guard keeps the predicate readable and lets the planner
-- skip the function call entirely for legacy rows.
--
-- Read access widens to workspace members. Write access is deliberately NOT
-- touched: inserts, updates and deletes on these tables stay owner-only, which
-- is what 0004 established and what the application's `canEdit` checks mirror.
-- ---------------------------------------------------------------------------

drop policy if exists "Users can view their own business ideas" on public.business_ideas;
create policy "Users can view their own business ideas"
  on public.business_ideas for select
  using (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

drop policy if exists "Users can view their own reports" on public.validation_reports;
create policy "Users can view their own reports"
  on public.validation_reports for select
  using (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

-- Already correct in production; restated so this file is self-contained.
drop policy if exists "Users can view their own projects" on public.projects;
create policy "Users can view their own projects"
  on public.projects for select
  using (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );


-- ---------------------------------------------------------------------------
-- DB-002 — Index the six unindexed foreign keys
--
-- Postgres does not create an index for a foreign key automatically; it only
-- does so for primary keys and unique constraints. An unindexed FK costs on
-- every join across it, and on every cascade — deleting a parent row forces a
-- sequential scan of the child table to find dependents.
--
-- The two `workspace_id` columns are the urgent pair. `business_plan_sections`
-- and `business_plan_versions` both gate SELECT on
-- `is_workspace_member(workspace_id)`, so that column is read on every row
-- Postgres considers. Unindexed, opening a single plan degrades as the whole
-- table grows, not just as that plan grows.
--
-- Plain CREATE INDEX rather than CONCURRENTLY: these tables are currently empty,
-- so the lock is instantaneous, and CONCURRENTLY cannot run inside the
-- transaction the Supabase SQL editor wraps around a migration. If this is ever
-- applied to a database with meaningful volume, run the CONCURRENTLY variants
-- noted at the foot of this file instead, one statement at a time.
--
-- Naming follows the existing convention: <table>_<column-or-role>_idx.
-- ---------------------------------------------------------------------------

-- RLS predicate columns — the two that matter most.
create index if not exists business_plan_sections_workspace_idx
  on public.business_plan_sections (workspace_id);

create index if not exists business_plan_versions_workspace_idx
  on public.business_plan_versions (workspace_id);

-- Join and cascade paths.
create index if not exists ai_usage_logs_request_idx
  on public.ai_usage_logs (request_id);

create index if not exists business_plan_versions_edited_by_idx
  on public.business_plan_versions (edited_by);

create index if not exists business_plans_ai_request_idx
  on public.business_plans (ai_request_id);

create index if not exists business_plans_business_idea_idx
  on public.business_plans (business_idea_id);


-- ---------------------------------------------------------------------------
-- Documentation
-- ---------------------------------------------------------------------------

comment on index public.business_plan_sections_workspace_idx is
  'Backs is_workspace_member(workspace_id) in the SELECT policy (0006 / DB-002).';

comment on index public.business_plan_versions_workspace_idx is
  'Backs is_workspace_member(workspace_id) in the SELECT policy (0006 / DB-002).';


-- ============================================================================
-- Verification — run after applying
--
--   -- Expect all three to include is_workspace_member:
--   select tablename, qual
--   from pg_policies
--   where schemaname = 'public'
--     and cmd = 'SELECT'
--     and tablename in ('business_ideas', 'validation_reports', 'projects');
--
--   -- Expect zero rows:
--   select conrelid::regclass::text as tbl, a.attname as col
--   from pg_constraint ct
--   join unnest(ct.conkey) k(attnum) on true
--   join pg_attribute a on a.attrelid = ct.conrelid and a.attnum = k.attnum
--   where ct.contype = 'f'
--     and ct.connamespace = 'public'::regnamespace
--     and not exists (
--       select 1 from pg_index i
--       where i.indrelid = ct.conrelid and a.attnum = any(i.indkey)
--     );
--
-- If applying to a database with significant row volume, replace the CREATE
-- INDEX statements above with these, run individually and OUTSIDE a transaction:
--
--   create index concurrently if not exists business_plan_sections_workspace_idx
--     on public.business_plan_sections (workspace_id);
--   create index concurrently if not exists business_plan_versions_workspace_idx
--     on public.business_plan_versions (workspace_id);
--   create index concurrently if not exists ai_usage_logs_request_idx
--     on public.ai_usage_logs (request_id);
--   create index concurrently if not exists business_plan_versions_edited_by_idx
--     on public.business_plan_versions (edited_by);
--   create index concurrently if not exists business_plans_ai_request_idx
--     on public.business_plans (ai_request_id);
--   create index concurrently if not exists business_plans_business_idea_idx
--     on public.business_plans (business_idea_id);
-- ============================================================================
