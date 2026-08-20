-- ============================================================
-- AIAutoMix migration bundle: part1_0011-0015.sql
-- Paste into the Supabase SQL Editor and Run.
--
-- Contains, in order:
--   0011_sprint8_research_product.sql
--   0012_sprint8_report_regeneration.sql
--   0013_sprint8_admin_operations.sql
--   0014_phase7_competitor_intelligence.sql
--   0015_phase7_competitor_admin.sql
--
-- The SQL Editor runs this as one transaction, so any error rolls
-- the whole bundle back with nothing half-applied. Every statement
-- is idempotent, so re-running after a fix is safe.
-- ============================================================


-- >>>>>>>>>>>>>>>>>>>>>>>> 0011_sprint8_research_product.sql >>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- Sprint 8 — Phase 4: Market Research product layer
--
-- Phase 1 (migration 0009) deliberately granted NO client write policies on any
-- research table: "every write happens through server-side code holding the
-- user's session, via security definer functions". Phase 3 (migration 0010)
-- supplied the functions the stage engine needs — claim, complete, fail, start.
--
-- It did not supply one for creating the brief itself, because nothing created
-- briefs yet. Phase 4 does, so this migration adds that single missing write
-- path and nothing else.
--
-- Adding an INSERT policy on `research_requests` instead was the alternative,
-- and it is the weaker one: a policy can only see the row being written, so it
-- could not check that a referenced business idea belongs to the same workspace
-- as the research. That check matters — `business_idea_id` is a foreign key to
-- a table with its own RLS, and without it a caller could staple another
-- workspace's idea id onto their own research row and have the detail page
-- resolve it. Doing the write in a function keeps the cross-table invariant
-- next to the insert that depends on it.
--
-- No existing migration is modified.
-- ============================================================================

-- ============================================================================
-- 1. Create a research request
--
-- Authorisation is re-derived inside the function from `auth.uid()`, so the
-- workspace id the caller passes is a claim to be checked, never a grant. The
-- same shape as `research_start_run` in 0010.
-- ============================================================================

create or replace function public.research_create_request(
  p_workspace_id     uuid,
  p_title            text,
  p_depth            text,
  p_scope            text default null,
  p_industry         text default null,
  p_geography        text default null,
  p_target_customer  text default null,
  p_business_model   text default null,
  p_questions        jsonb default '[]'::jsonb,
  p_business_idea_id uuid default null,
  p_business_plan_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id      uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  -- Viewers may read research but not commission it. `can_edit_workspace`
  -- re-derives the role from `auth.uid()`; a non-member fails the same check.
  if not public.can_edit_workspace(p_workspace_id) then
    raise exception 'not permitted to create research in this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  -- An inactive or unknown depth would otherwise be caught by the foreign key
  -- with a message no user should have to read, and `is_active` is not part of
  -- that key at all.
  if not exists (
    select 1 from public.research_depths
    where id = p_depth and is_active
  ) then
    raise exception 'unknown research depth: %', p_depth
      using errcode = 'check_violation';
  end if;

  -- Cross-workspace link check. The client picks these ids from a list this
  -- workspace can see, so a mismatch is not a mistake a real form makes.
  if p_business_idea_id is not null then
    if not exists (
      select 1 from public.business_ideas
      where id = p_business_idea_id
        and workspace_id = p_workspace_id
        and deleted_at is null
    ) then
      raise exception 'business idea does not belong to this workspace'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if p_business_plan_id is not null then
    if not exists (
      select 1 from public.business_plans
      where id = p_business_plan_id
        and workspace_id = p_workspace_id
        and deleted_at is null
    ) then
      raise exception 'business plan does not belong to this workspace'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Shape guard on the free-form column. The application validates the same
  -- rule with Zod; this is the copy that holds when the application is not the
  -- caller. `jsonb_array_length` errors on a non-array, so the type is checked
  -- before the length is.
  if jsonb_typeof(coalesce(p_questions, '[]'::jsonb)) <> 'array' then
    raise exception 'questions must be a JSON array'
      using errcode = 'check_violation';
  end if;
  if jsonb_array_length(coalesce(p_questions, '[]'::jsonb)) > 10 then
    raise exception 'at most 10 research questions'
      using errcode = 'check_violation';
  end if;

  insert into public.research_requests (
    workspace_id, user_id,
    business_idea_id, business_plan_id,
    title, scope, industry, geography, target_customer, business_model,
    questions, depth, status
  )
  values (
    p_workspace_id, v_user_id,
    p_business_idea_id, p_business_plan_id,
    btrim(p_title),
    nullif(btrim(coalesce(p_scope, '')), ''),
    nullif(btrim(coalesce(p_industry, '')), ''),
    nullif(btrim(coalesce(p_geography, '')), ''),
    nullif(btrim(coalesce(p_target_customer, '')), ''),
    nullif(btrim(coalesce(p_business_model, '')), ''),
    coalesce(p_questions, '[]'::jsonb),
    p_depth,
    'draft'
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.research_create_request(uuid, text, text, text, text, text, text, text, jsonb, uuid, uuid) is
  'Creates a market research brief. Re-derives workspace edit permission from auth.uid() and refuses cross-workspace idea/plan links.';

-- ============================================================================
-- 2. Listing counts
--
-- /research shows a source and evidence count per project. Reading them from
-- the run row is what the run row is for, but a request whose run has not been
-- created yet has no row to read — and counting from `research_sources` in the
-- page would be one extra round trip per card.
--
-- This view is a plain join, so `research_runs` RLS still applies to every row
-- it returns: a member sees their workspace's rows and nobody else's.
-- ============================================================================

create or replace view public.research_request_overview
with (security_invoker = true)
as
  select
    r.id,
    r.workspace_id,
    r.user_id,
    r.business_idea_id,
    r.business_plan_id,
    r.title,
    r.industry,
    r.geography,
    r.depth,
    r.status,
    r.created_at,
    r.updated_at,
    run.id             as run_id,
    run.status         as run_status,
    run.current_stage  as current_stage,
    run.credits_charged,
    run.credits_refunded,
    run.source_count,
    run.evidence_count,
    run.error          as run_error,
    run.completed_at   as run_completed_at
  from public.research_requests r
  left join lateral (
    select *
    from public.research_runs
    where research_request_id = r.id
    order by created_at desc
    limit 1
  ) run on true;

comment on view public.research_request_overview is
  'A research request joined to its most recent run. security_invoker, so the underlying RLS on both tables still decides visibility.';

-- ============================================================================
-- 3. Grants
--
-- `authenticated` may call; the function checks membership itself, so being
-- able to call is not being able to act. Same reasoning as 0010.
-- ============================================================================

grant execute on function public.research_create_request(uuid, text, text, text, text, text, text, text, jsonb, uuid, uuid) to authenticated;
grant select on public.research_request_overview to authenticated;


-- >>>>>>>>>>>>>>>>>>>>>>>> 0012_sprint8_report_regeneration.sql >>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- Sprint 8 — Phase 5: Market Research report regeneration
--
-- Regenerating a report must NOT re-run the research. The `report` stage reads
-- only stored `research_results` rows — no web search, no source retrieval — so
-- re-running that one stage rewrites the report from evidence that has already
-- been gathered and paid for.
--
-- `research_claim_stage` from migration 0010 cannot do this, and should not be
-- changed to: it refuses a stage that already succeeded, and that refusal is
-- what makes a repeated `run-stage` request free instead of a second charge.
-- Loosening it would loosen it for `discovery` too, and a user could be billed
-- twice for a web search by double-clicking.
--
-- So regeneration gets its OWN claim, narrowed to exactly the safe case:
-- the `report` stage, on a run whose report has already succeeded once.
-- Everything after the claim — execution, persistence, versioning, failure,
-- refund — reuses `research_complete_stage` and `research_fail_stage`
-- unchanged. One execution path, two ways to enter it.
--
-- No applied migration is modified.
-- ============================================================================

create or replace function public.research_claim_report_regeneration(
  p_request_id       uuid,
  p_lock_timeout_ms  integer default 300000
)
returns table (
  run_id       uuid,
  attempt      integer,
  depth        text,
  workspace_id uuid,
  request_id   uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run     public.research_runs%rowtype;
  v_attempt integer;
begin
  -- Newest run for the request, locked for the duration of the transaction.
  -- The lock is the concurrency control: a second regeneration waits here and
  -- then fails the "already running" check rather than charging twice.
  select r.* into v_run
  from public.research_runs r
  where r.research_request_id = p_request_id
  order by r.created_at desc
  limit 1
  for update;

  if v_run.id is null then
    raise exception 'no research run exists for this request'
      using errcode = 'no_data_found';
  end if;

  -- Authorisation is re-derived inside the transaction, from auth.uid(), and
  -- requires edit permission — regenerating spends credits, so a Viewer may
  -- read the report but not rebuild it.
  if not public.can_edit_workspace(v_run.workspace_id) then
    raise exception 'not permitted to regenerate research in this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if v_run.locked_at is not null
     and v_run.locked_at > timezone('utc', now()) - make_interval(secs => p_lock_timeout_ms / 1000.0)
  then
    raise exception 'stage % is already running for this run', coalesce(v_run.locked_stage, '?')
      using errcode = 'lock_not_available';
  end if;

  -- The narrowing that makes this safe: there must ALREADY be a successful
  -- report. That implies every earlier stage succeeded, so this cannot be used
  -- to skip ahead to a report with no evidence behind it — the exact attack
  -- `research_claim_stage` refuses a client-named stage to prevent.
  if not exists (
    select 1 from public.research_run_stages s
    where s.run_id = v_run.id
      and s.stage = 'report'
      and s.status = 'succeeded'
  ) then
    raise exception 'this research has no completed report to regenerate'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Attempts continue the same numbering as the original run, so the credit
  -- ledger's idempotency keys stay unique and the stage history reads as one
  -- continuous record of what was charged and why.
  select coalesce(max(s.attempt), 0) + 1 into v_attempt
  from public.research_run_stages s
  where s.run_id = v_run.id and s.stage = 'report';

  insert into public.research_run_stages
    (run_id, workspace_id, stage, attempt, status)
  values
    (v_run.id, v_run.workspace_id, 'report', v_attempt, 'running');

  -- The pointer is moved back to `report` for the duration. Completion sets it
  -- to null again (report is the terminal stage), so a regeneration that dies
  -- mid-flight leaves a run that resumes by re-running the report — never by
  -- re-running a web search.
  update public.research_runs
     set status                = 'running',
         current_stage         = 'report',
         locked_at             = timezone('utc', now()),
         locked_stage          = 'report',
         last_stage_started_at = timezone('utc', now())
   where id = v_run.id;

  return query
    select v_run.id, v_attempt, v_run.depth, v_run.workspace_id,
           v_run.research_request_id;
end;
$$;

comment on function public.research_claim_report_regeneration(uuid, integer) is
  'Claims a re-run of the report stage only, on a run whose report already succeeded. Never re-runs retrieval. Completion and failure reuse research_complete_stage / research_fail_stage.';

grant execute on function public.research_claim_report_regeneration(uuid, integer) to authenticated;

-- ============================================================================
-- Version history
--
-- `research_results` already versions every section: `research_complete_stage`
-- stands down the current row and inserts version = max + 1, and the partial
-- unique index from 0009 keeps exactly one current version per section. Nothing
-- is deleted, so a regeneration is additive and every earlier report remains
-- readable.
--
-- The index below is what makes reading that history cheap: the existing
-- indexes serve "current version of each section", not "every version of one
-- section, newest first", which is the query the version panel runs.
-- ============================================================================

create index if not exists research_results_history_idx
  on public.research_results (research_request_id, section_key, version desc);


-- >>>>>>>>>>>>>>>>>>>>>>>> 0013_sprint8_admin_operations.sql >>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- Sprint 8 — Phase 6: Admin & AI Operations Center
--
-- Sprint 7 (migration 0008) built the admin platform: RBAC, audit, the
-- permission-gated `admin_platform_stats` and the privileged mutations. This
-- migration is purely additive to it. Nothing in 0008 is altered, no policy is
-- loosened, and no new write path is opened — Phase 6 is a read/operations
-- surface.
--
-- Three things are added:
--
--   1. Indexes that the admin list and cost queries actually need. The AI log
--      is the one large operational table with no admin-shaped index.
--   2. `admin_research_stats` — the research/product counters the dashboard is
--      missing, as a NEW function rather than a redefinition of
--      `admin_platform_stats`, so an applied function keeps its behaviour.
--   3. `admin_cost_breakdown` — cost and usage aggregated in SQL, by day,
--      provider, model, workflow, feature or workspace.
--
-- Every function re-derives authority from `auth.uid()` via `admin_has(...)`
-- and is `security definer` with a pinned `search_path`, exactly as 0008 does.
-- ============================================================================

-- ============================================================================
-- 1. Indexes
--
-- Only what the admin queries demonstrably scan. `ai_usage_logs` already has
-- indexes for the *user-facing* access pattern — `(user_id, created_at desc)`
-- and `(user_id, workflow)` — but every admin query starts without a user_id
-- and orders by `created_at desc` across the whole table, so none of them help.
--
-- `credit_transactions` and `admin_audit_logs` are deliberately untouched: 0007
-- and 0008 already index them on `created_at desc` plus the columns their
-- filters use, which is what the Phase 6 pages query.
-- ============================================================================

-- The default order of /admin/ai, /admin/usage and /admin/costs, and the range
-- scan every cost aggregation performs.
create index if not exists ai_usage_logs_created_idx
  on public.ai_usage_logs (created_at desc);

-- The failure-triage panel on /admin and the status filter on /admin/ai. A
-- partial index would be smaller, but the same filter is used for `success`
-- when reviewing what a workspace actually consumed.
create index if not exists ai_usage_logs_status_created_idx
  on public.ai_usage_logs (status, created_at desc);

-- The workflow and model filters. The existing `(user_id, workflow)` index
-- cannot serve these: its leading column is absent from every admin predicate.
create index if not exists ai_usage_logs_workflow_created_idx
  on public.ai_usage_logs (workflow, created_at desc);
create index if not exists ai_usage_logs_model_created_idx
  on public.ai_usage_logs (model, created_at desc);

comment on index public.ai_usage_logs_created_idx is
  'Admin operations: default ordering and the range scan behind every cost aggregation.';

-- ============================================================================
-- 2. Research and product statistics
--
-- A separate function rather than an edit to `admin_platform_stats`, so an
-- already-deployed aggregate keeps returning exactly what it returned before
-- and the dashboard merges two payloads.
--
-- Permission gating follows 0008's pattern: each block is guarded on its own
-- grant and simply omitted when the caller lacks it. An absent key means "you
-- may not see this" and the dashboard renders it as unavailable — never as a
-- zero, which an operator could act on.
-- ============================================================================

create or replace function public.admin_research_stats(
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

  -- Research operations sit behind `ai.read`, the same grant that governs the
  -- research tables' admin SELECT policies in migration 0009. Using a
  -- different permission here would let a role read the rows but not the
  -- counts, or the reverse.
  if public.admin_has('ai.read') then
    v_out := v_out || jsonb_build_object(
      'research_requests',   (select count(*) from public.research_requests where created_at >= v_since),
      'research_runs',       (select count(*) from public.research_runs where created_at >= v_since),
      'research_completed',  (select count(*) from public.research_runs where created_at >= v_since and status = 'completed'),
      'research_failed',     (select count(*) from public.research_runs where created_at >= v_since and status = 'failed'),
      'research_running',    (select count(*) from public.research_runs where status = 'running'),
      'research_sources',    (select count(*) from public.research_sources where created_at >= v_since),
      'research_evidence',   (select count(*) from public.research_evidence where created_at >= v_since),
      -- Stage attempts that failed, across all runs in the window: the single
      -- most useful reliability number for the pipeline.
      'stage_failures',      (select count(*) from public.research_run_stages
                               where started_at >= v_since and status = 'failed'),
      'validator_runs',      (select count(*) from public.validation_reports where created_at >= v_since),
      'business_plans',      (select count(*) from public.business_plans
                               where created_at >= v_since and deleted_at is null)
    );
  end if;

  -- Credits consumed BY research specifically. Scoped to `credits.read`
  -- because it is money movement, not usage telemetry — an ANALYST sees the
  -- run counts above and not this.
  if public.admin_has('credits.read') then
    v_out := v_out || jsonb_build_object(
      'research_credits_charged',  (select coalesce(sum(credits_charged), 0)
                                      from public.research_run_stages where started_at >= v_since),
      'research_credits_refunded', (select coalesce(sum(credits_refunded), 0)
                                      from public.research_run_stages where started_at >= v_since)
    );
  end if;

  return v_out || jsonb_build_object('since', v_since);
end;
$$;

comment on function public.admin_research_stats(timestamptz) is
  'Market Research operational counters for the admin dashboard. Permission-gated per block, like admin_platform_stats.';

-- ============================================================================
-- 3. Cost and usage breakdown
--
-- SUM() happens here, not in JavaScript. The AI log is the largest table on the
-- platform and grows with every request; selecting a window of it into Node to
-- run `reduce()` would move megabytes to add numbers Postgres can add in place,
-- and would silently truncate once the row count passed PostgREST's cap —
-- producing a *plausible but wrong* cost figure, which is worse than an error.
--
-- `estimated_cost_usd` is `numeric`. It is summed as `numeric` and only cast to
-- text at the very end, so no float rounding enters a money column.
--
-- `p_dimension` is validated against a fixed list and used to pick a CASE
-- branch — never concatenated into SQL. There is no dynamic SQL in this
-- function, so a crafted dimension string cannot alter the query shape.
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
  -- Clamped: the limit reaches this from a query string.
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 200);
  v_out   jsonb;
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = 'insufficient_privilege';
  end if;

  -- Cost analytics is usage telemetry, so it follows `usage.read` — the same
  -- grant that governs /admin/usage. SUPPORT holds it; so does ANALYST, which
  -- is the role that exists to answer exactly these questions.
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
      -- Feature mapping. Kept in SQL beside the aggregation so the grouping
      -- and the label cannot disagree; the prefixes match the workflow ids
      -- registered in features/ai/registry and features/research/stages.
      case
        when l.workflow like 'research-%'      then 'Market research'
        when l.workflow = 'business-plan'      then 'Business plans'
        when l.workflow = 'business-validator' then 'Idea validator'
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
      count(*)                                          as requests,
      count(*) filter (where s.status = 'failed')       as failures,
      coalesce(sum(s.total_tokens), 0)                  as tokens,
      coalesce(sum(s.estimated_cost_usd), 0)::numeric   as cost
    from scoped s
    group by 1
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key',      g.key,
        -- A workspace id is not a name. Resolved here rather than in a second
        -- round trip, and left as the id when the workspace is gone.
        'label',    case
                      when p_dimension = 'workspace'
                        then coalesce(w.name, g.key)
                      else g.key
                    end,
        'requests', g.requests,
        'failures', g.failures,
        'tokens',   g.tokens,
        -- Text, not float: `numeric` must not round-trip through a JSON double
        -- on its way to a money column.
        'cost',     g.cost::text
      )
      order by
        -- A time series reads chronologically; every other dimension reads
        -- most-expensive-first, because that is the question being asked.
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
  'AI cost and usage aggregated in SQL by day/provider/model/workflow/feature/workspace. Requires usage.read; dimension is whitelisted, never interpolated.';

-- ============================================================================
-- 4. Grants
--
-- `authenticated` may EXECUTE; each function re-checks authority internally, so
-- being able to call is not being able to act. `anon` gets nothing.
-- ============================================================================

grant execute on function public.admin_research_stats(timestamptz) to authenticated;
revoke all on function public.admin_research_stats(timestamptz) from anon;

grant execute on function public.admin_cost_breakdown(text, timestamptz, timestamptz, integer) to authenticated;
revoke all on function public.admin_cost_breakdown(text, timestamptz, timestamptz, integer) from anon;


-- >>>>>>>>>>>>>>>>>>>>>>>> 0014_phase7_competitor_intelligence.sql >>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- Phase 7 — Competitor Intelligence
--
-- The schema deliberately mirrors the Market Research foundation (migrations
-- 0009/0010) rather than reusing its tables. Reuse was considered and rejected:
-- `research_sources` and `research_evidence` are keyed to a research request
-- and their RLS, their unique constraints and their meaning all assume one, so
-- adding a discriminator column would weaken a working security boundary to
-- save typing. What IS reused is the architecture — the same stage engine
-- shape, the same "sources come only from provider citations" rule, the same
-- claim-must-name-a-source constraint, the same versioned section results.
--
-- Competitor-specific entities exist only where the research model has no
-- equivalent: `competitors` (an entity that accumulates evidence across four
-- stages) and its verification/classification state.
--
-- No applied migration is modified. No existing policy is loosened.
--
-- ENTITLEMENT NOTE: this feature gates on the EXISTING `competitor_analysis`
-- entitlement, which migration 0007 already seeded across all five plans
-- (free/starter off, growth 25, professional 200, enterprise unlimited). The
-- Phase 7 brief names it `competitor_intelligence`, but it also says to reuse
-- an entitlement that already exists — and adding a second key for the same
-- capability would leave two flags to keep in sync and a priced plan catalog
-- that no longer describes what it sells.
-- ============================================================================

-- ============================================================================
-- 1. Depth catalog and stage costs
--
-- Same shape as `research_depths` / `research_stage_costs`: the database is the
-- authority for what a stage costs, and the TypeScript mirror in
-- `features/competitors/cost.ts` is asserted against this seed by the test
-- suite. If they disagree, the SQL wins.
-- ============================================================================

create table if not exists public.competitor_depths (
  id               text primary key,
  label            text not null,
  description      text not null,
  /** Candidate competitors carried past discovery. */
  max_competitors  integer not null check (max_competitors between 1 and 50),
  max_sources      integer not null check (max_sources between 1 and 200),
  max_queries      integer not null check (max_queries between 1 and 40),
  stage_timeout_ms integer not null check (stage_timeout_ms between 10000 and 300000),
  max_attempts     integer not null default 3 check (max_attempts between 1 and 5),
  sort_order       integer not null default 0,
  is_active        boolean not null default true
);

comment on table public.competitor_depths is
  'Competitor research depth tiers. The cost ceiling for a run lives here, not in application code.';

create table if not exists public.competitor_stage_costs (
  depth   text not null references public.competitor_depths (id) on delete cascade,
  stage   text not null check (stage in (
    'planning', 'discovery', 'verification', 'profiling',
    'pricing_positioning', 'analysis', 'recommendations'
  )),
  credits integer not null check (credits >= 0),
  primary key (depth, stage)
);

comment on table public.competitor_stage_costs is
  'Credits charged when a stage begins. Mirrored (and asserted) in features/competitors/cost.ts.';

insert into public.competitor_depths
  (id, label, description, max_competitors, max_sources, max_queries, stage_timeout_ms, max_attempts, sort_order)
values
  ('basic',    'Basic',    'A small set of the most obvious competitors, checked quickly.',        5,  15, 4,  60000, 3, 1),
  ('standard', 'Standard', 'A broader sweep with verification and pricing where it is published.', 10, 30, 8,  90000, 3, 2),
  ('deep',     'Deep',     'The widest permitted competitor set and the deepest evidence base.',   20, 60, 14, 120000, 3, 3)
on conflict (id) do nothing;

-- Retrieval stages cost more because they reach the network. `profiling`,
-- `analysis` and `recommendations` reason over stored rows and are cheap.
insert into public.competitor_stage_costs (depth, stage, credits) values
  ('basic','planning',5),            ('basic','discovery',12),
  ('basic','verification',10),       ('basic','profiling',10),
  ('basic','pricing_positioning',12),('basic','analysis',15),
  ('basic','recommendations',6),

  ('standard','planning',8),             ('standard','discovery',28),
  ('standard','verification',22),        ('standard','profiling',20),
  ('standard','pricing_positioning',28), ('standard','analysis',25),
  ('standard','recommendations',12),

  ('deep','planning',10),            ('deep','discovery',65),
  ('deep','verification',50),        ('deep','profiling',45),
  ('deep','pricing_positioning',60), ('deep','analysis',45),
  ('deep','recommendations',20)
on conflict (depth, stage) do nothing;

-- ============================================================================
-- 2. Projects
-- ============================================================================

create table if not exists public.competitor_projects (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,

  -- Provenance. `set null` rather than cascade: deleting the source idea must
  -- not destroy competitor research that has already been paid for and cited.
  business_idea_id  uuid references public.business_ideas (id) on delete set null,
  business_plan_id  uuid references public.business_plans (id) on delete set null,

  title             text not null check (length(btrim(title)) between 1 and 200),
  -- What the user is building. Feeds the competitor criteria.
  description       text check (length(description) <= 4000),
  category          text check (length(category) <= 200),
  geography         text check (length(geography) <= 200),
  target_customer   text check (length(target_customer) <= 1000),
  customer_problem  text check (length(customer_problem) <= 2000),
  business_model    text check (length(business_model) <= 1000),
  -- Names the user already knows about, as a starting point. Still verified
  -- like any other candidate; a seed is a hint, not a fact.
  known_competitors jsonb not null default '[]'::jsonb,

  depth             text not null default 'standard'
                      references public.competitor_depths (id),

  status            text not null default 'draft'
                      check (status in ('draft','running','completed','failed','cancelled')),

  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

comment on table public.competitor_projects is
  'A competitor intelligence brief. Workspace-scoped; the workspace is the security boundary.';

drop trigger if exists competitor_projects_set_updated_at on public.competitor_projects;
create trigger competitor_projects_set_updated_at
  before update on public.competitor_projects
  for each row execute function public.set_updated_at();

create index if not exists competitor_projects_workspace_idx
  on public.competitor_projects (workspace_id, created_at desc);
create index if not exists competitor_projects_status_idx
  on public.competitor_projects (status, created_at desc);
create index if not exists competitor_projects_idea_idx
  on public.competitor_projects (business_idea_id) where business_idea_id is not null;
create index if not exists competitor_projects_plan_idx
  on public.competitor_projects (business_plan_id) where business_plan_id is not null;

-- ============================================================================
-- 3. Runs and stage attempts
-- ============================================================================

create table if not exists public.competitor_runs (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.competitor_projects (id) on delete cascade,
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,

  status              text not null default 'pending'
                        check (status in ('pending','running','completed','failed','cancelled')),
  -- The resume point. Null once the run finishes.
  current_stage       text check (current_stage in (
                        'planning','discovery','verification','profiling',
                        'pricing_positioning','analysis','recommendations')),
  depth               text not null references public.competitor_depths (id),

  credits_charged     integer not null default 0 check (credits_charged >= 0),
  credits_refunded    integer not null default 0 check (credits_refunded >= 0),
  total_tokens        integer not null default 0,
  estimated_cost_usd  numeric(12,6) not null default 0,
  competitor_count    integer not null default 0,
  verified_count      integer not null default 0,
  source_count        integer not null default 0,
  evidence_count      integer not null default 0,

  error               text,
  -- Concurrency control. A non-null `locked_at` inside the timeout means a
  -- stage is executing; this is what stops two tabs both charging for one.
  locked_at           timestamptz,
  locked_stage        text,

  started_at              timestamptz,
  completed_at            timestamptz,
  last_stage_started_at   timestamptz,
  last_stage_completed_at timestamptz,
  created_at              timestamptz not null default timezone('utc', now()),
  updated_at              timestamptz not null default timezone('utc', now())
);

drop trigger if exists competitor_runs_set_updated_at on public.competitor_runs;
create trigger competitor_runs_set_updated_at
  before update on public.competitor_runs
  for each row execute function public.set_updated_at();

create index if not exists competitor_runs_project_idx
  on public.competitor_runs (project_id, created_at desc);
create index if not exists competitor_runs_workspace_idx
  on public.competitor_runs (workspace_id, created_at desc);
create index if not exists competitor_runs_status_idx
  on public.competitor_runs (status, created_at desc);

/**
 * One row per attempt at a stage.
 *
 * Keyed (run, stage, attempt) rather than (run, stage): a retry is a new
 * attempt with its own credit charge and its own error, so the ledger and the
 * stage history agree about what was paid for and why.
 */
create table if not exists public.competitor_run_stages (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references public.competitor_runs (id) on delete cascade,
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,

  stage             text not null check (stage in (
                      'planning','discovery','verification','profiling',
                      'pricing_positioning','analysis','recommendations')),
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

create index if not exists competitor_run_stages_run_idx
  on public.competitor_run_stages (run_id, started_at);
create index if not exists competitor_run_stages_status_idx
  on public.competitor_run_stages (status, started_at desc);
create index if not exists competitor_run_stages_workspace_idx
  on public.competitor_run_stages (workspace_id);

-- ============================================================================
-- 4. Sources
--
-- Written ONLY from provider citations. Nothing else in the system inserts
-- here, and no stage may write a URL the model composed — that rule is what
-- makes a citation checkable.
-- ============================================================================

create table if not exists public.competitor_sources (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.competitor_projects (id) on delete cascade,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  run_id         uuid references public.competitor_runs (id) on delete set null,

  url            text not null check (length(url) between 5 and 2000),
  -- Tracking params and fragments removed; this is what dedup matches on.
  canonical_url  text not null,
  title          text,
  publisher      text,
  source_type    text not null default 'web' check (source_type in (
                   'web','news','report','government','academic',
                   'industry','company','statistics','other')),
  -- Nullable by design: a missing publication date is recorded, never invented.
  published_at   timestamptz,
  retrieved_at   timestamptz not null default timezone('utc', now()),
  status         text not null default 'retrieved'
                   check (status in ('discovered','retrieved','failed','rejected','duplicate')),
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default timezone('utc', now()),

  unique (project_id, canonical_url)
);

comment on column public.competitor_sources.metadata is
  'Retrieval metadata only — never raw page content. Nothing here is rendered as HTML.';

create index if not exists competitor_sources_project_idx
  on public.competitor_sources (project_id, created_at);
create index if not exists competitor_sources_workspace_idx
  on public.competitor_sources (workspace_id);

-- ============================================================================
-- 5. Competitors
--
-- The one genuinely new entity. A competitor is discovered once and then
-- enriched by three later stages, so the row accumulates rather than being
-- rewritten — `competitor_complete_stage` merges with `coalesce`, and a stage
-- that learns nothing new cannot blank a field an earlier stage established.
-- ============================================================================

create table if not exists public.competitors (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.competitor_projects (id) on delete cascade,
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,

  name                text not null check (length(btrim(name)) between 1 and 200),
  website             text check (length(website) <= 2000),
  -- Registrable host, lowercased, `www.` stripped. The dedup key: two searches
  -- returning the same company under different paths must not create two rows.
  canonical_domain    text not null,

  competitor_type     text not null default 'UNCLASSIFIED'
                        check (competitor_type in ('DIRECT','INDIRECT','EMERGING','UNCLASSIFIED')),
  verification_status text not null default 'PENDING'
                        check (verification_status in
                          ('VERIFIED','PARTIALLY_VERIFIED','UNVERIFIED','PENDING')),
  -- Why verification landed where it did. Shown to the user verbatim.
  verification_notes  text check (length(verification_notes) <= 2000),

  -- Structured, stage-written. Shapes are validated by Zod before they land
  -- here; jsonb keeps the four enrichment stages from needing four migrations.
  profile             jsonb not null default '{}'::jsonb,
  pricing             jsonb not null default '{}'::jsonb,
  positioning         jsonb not null default '{}'::jsonb,

  confidence          text not null default 'low'
                        check (confidence in ('low','medium','high')),
  /** 0-100, only where discovery had evidence to rank on. */
  relevance           integer check (relevance between 0 and 100),

  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now()),

  unique (project_id, canonical_domain)
);

comment on table public.competitors is
  'A discovered competitor, enriched across the verification, profiling and pricing stages.';
comment on column public.competitors.pricing is
  'Publicly observable pricing only. Absent values are stored as NOT_PUBLICLY_AVAILABLE, never as a guess.';

drop trigger if exists competitors_set_updated_at on public.competitors;
create trigger competitors_set_updated_at
  before update on public.competitors
  for each row execute function public.set_updated_at();

create index if not exists competitors_project_idx
  on public.competitors (project_id, competitor_type);
create index if not exists competitors_workspace_idx
  on public.competitors (workspace_id);
create index if not exists competitors_verification_idx
  on public.competitors (project_id, verification_status);

-- ============================================================================
-- 6. Evidence
--
-- `source_id` is NOT NULL. That single constraint is the fabrication control:
-- a claim that cannot name the source it came from cannot be stored at all,
-- so there is no code path — however buggy — that persists an uncited claim.
-- ============================================================================

create table if not exists public.competitor_evidence (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.competitor_projects (id) on delete cascade,
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  source_id      uuid not null references public.competitor_sources (id) on delete cascade,
  -- Null for project-level claims (a market gap belongs to the analysis, not
  -- to one competitor).
  competitor_id  uuid references public.competitors (id) on delete cascade,

  section_key    text not null,
  claim          text not null check (length(btrim(claim)) between 1 and 2000),
  -- What in the source supports it. Quoted or closely paraphrased.
  evidence_reference text check (length(evidence_reference) <= 1000),
  -- STATED / OBSERVED / INFERRED / RECOMMENDED. Required, never defaulted to
  -- the strongest value.
  claim_kind     text not null default 'OBSERVED'
                   check (claim_kind in ('STATED','OBSERVED','INFERRED','RECOMMENDED')),
  confidence     text not null default 'medium'
                   check (confidence in ('low','medium','high')),
  is_contradictory boolean not null default false,
  created_at     timestamptz not null default timezone('utc', now())
);

create index if not exists competitor_evidence_project_idx
  on public.competitor_evidence (project_id, section_key);
create index if not exists competitor_evidence_competitor_idx
  on public.competitor_evidence (competitor_id) where competitor_id is not null;
create index if not exists competitor_evidence_source_idx
  on public.competitor_evidence (source_id);
create index if not exists competitor_evidence_workspace_idx
  on public.competitor_evidence (workspace_id);

-- ============================================================================
-- 7. Section results
--
-- Versioned exactly like `research_results`: a new version supersedes rather
-- than overwrites, so regenerating never destroys an earlier analysis.
-- ============================================================================

create table if not exists public.competitor_results (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.competitor_projects (id) on delete cascade,
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  run_id             uuid references public.competitor_runs (id) on delete set null,

  section_key        text not null,
  structured_content jsonb not null default '{}'::jsonb,
  confidence         text not null default 'medium'
                       check (confidence in ('low','medium','high')),
  status             text not null default 'complete'
                       check (status in ('complete','partial','insufficient_evidence','failed')),
  version            integer not null default 1 check (version >= 1),
  is_current         boolean not null default true,

  created_at         timestamptz not null default timezone('utc', now()),
  updated_at         timestamptz not null default timezone('utc', now())
);

drop trigger if exists competitor_results_set_updated_at on public.competitor_results;
create trigger competitor_results_set_updated_at
  before update on public.competitor_results
  for each row execute function public.set_updated_at();

-- Exactly one current version per section per project.
create unique index if not exists competitor_results_current_uidx
  on public.competitor_results (project_id, section_key) where is_current;
create index if not exists competitor_results_project_idx
  on public.competitor_results (project_id, section_key);
create index if not exists competitor_results_history_idx
  on public.competitor_results (project_id, section_key, version desc);
create index if not exists competitor_results_workspace_idx
  on public.competitor_results (workspace_id);

-- ============================================================================
-- 8. RLS
--
-- Workspace membership for read; NO client write policies. Every write happens
-- through the security-definer functions below — the same shape as credits in
-- 0007, the admin platform in 0008 and research in 0009/0010.
--
-- Admin read access is additive and consults `admin_has('ai.read')`, so a
-- non-admin's workspace isolation is unchanged.
-- ============================================================================

alter table public.competitor_depths      enable row level security;
alter table public.competitor_stage_costs enable row level security;
alter table public.competitor_projects    enable row level security;
alter table public.competitor_runs        enable row level security;
alter table public.competitor_run_stages  enable row level security;
alter table public.competitor_sources     enable row level security;
alter table public.competitors            enable row level security;
alter table public.competitor_evidence    enable row level security;
alter table public.competitor_results     enable row level security;

-- Catalog: readable by any signed-in user (the estimator on /competitors/new
-- needs it) and containing no customer data.
drop policy if exists "Anyone signed in can read competitor depths" on public.competitor_depths;
create policy "Anyone signed in can read competitor depths"
  on public.competitor_depths for select to authenticated using (is_active);

drop policy if exists "Anyone signed in can read competitor stage costs" on public.competitor_stage_costs;
create policy "Anyone signed in can read competitor stage costs"
  on public.competitor_stage_costs for select to authenticated using (true);

drop policy if exists "Members read their workspace competitor projects" on public.competitor_projects;
create policy "Members read their workspace competitor projects"
  on public.competitor_projects for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace competitor runs" on public.competitor_runs;
create policy "Members read their workspace competitor runs"
  on public.competitor_runs for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace competitor stages" on public.competitor_run_stages;
create policy "Members read their workspace competitor stages"
  on public.competitor_run_stages for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace competitor sources" on public.competitor_sources;
create policy "Members read their workspace competitor sources"
  on public.competitor_sources for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace competitors" on public.competitors;
create policy "Members read their workspace competitors"
  on public.competitors for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace competitor evidence" on public.competitor_evidence;
create policy "Members read their workspace competitor evidence"
  on public.competitor_evidence for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their workspace competitor results" on public.competitor_results;
create policy "Members read their workspace competitor results"
  on public.competitor_results for select
  using (public.is_workspace_member(workspace_id));

-- --- Admin read access (migration 0008 RBAC) --------------------------------

drop policy if exists "Admins read all competitor projects" on public.competitor_projects;
create policy "Admins read all competitor projects"
  on public.competitor_projects for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all competitor runs" on public.competitor_runs;
create policy "Admins read all competitor runs"
  on public.competitor_runs for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all competitor stages" on public.competitor_run_stages;
create policy "Admins read all competitor stages"
  on public.competitor_run_stages for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all competitor sources" on public.competitor_sources;
create policy "Admins read all competitor sources"
  on public.competitor_sources for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all competitors" on public.competitors;
create policy "Admins read all competitors"
  on public.competitors for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all competitor evidence" on public.competitor_evidence;
create policy "Admins read all competitor evidence"
  on public.competitor_evidence for select using (public.admin_has('ai.read'));

drop policy if exists "Admins read all competitor results" on public.competitor_results;
create policy "Admins read all competitor results"
  on public.competitor_results for select using (public.admin_has('ai.read'));

-- ============================================================================
-- 9. Cost estimation
-- ============================================================================

create or replace function public.competitor_estimate_credits(p_depth text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(credits), 0)::integer
  from public.competitor_stage_costs
  where depth = p_depth;
$$;

grant execute on function public.competitor_estimate_credits(text) to authenticated;

-- ============================================================================
-- 10. Create a project
--
-- Authorisation is re-derived from `auth.uid()`, so the workspace id the caller
-- passes is a claim to be checked, never a grant.
-- ============================================================================

create or replace function public.competitor_create_project(
  p_workspace_id      uuid,
  p_title             text,
  p_depth             text,
  p_description       text default null,
  p_category          text default null,
  p_geography         text default null,
  p_target_customer   text default null,
  p_customer_problem  text default null,
  p_business_model    text default null,
  p_known_competitors jsonb default '[]'::jsonb,
  p_business_idea_id  uuid default null,
  p_business_plan_id  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id      uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  -- Viewers may read competitor research but not commission it.
  if not public.can_edit_workspace(p_workspace_id) then
    raise exception 'not permitted to create competitor research in this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.competitor_depths where id = p_depth and is_active
  ) then
    raise exception 'unknown competitor research depth: %', p_depth
      using errcode = 'check_violation';
  end if;

  -- Cross-workspace link check. A client could otherwise staple another
  -- workspace's idea id onto its own project and have the detail page resolve
  -- it — the reason this is a function rather than an INSERT policy, which
  -- could only see the row being written.
  if p_business_idea_id is not null and not exists (
    select 1 from public.business_ideas
    where id = p_business_idea_id and workspace_id = p_workspace_id and deleted_at is null
  ) then
    raise exception 'business idea does not belong to this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if p_business_plan_id is not null and not exists (
    select 1 from public.business_plans
    where id = p_business_plan_id and workspace_id = p_workspace_id and deleted_at is null
  ) then
    raise exception 'business plan does not belong to this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(coalesce(p_known_competitors, '[]'::jsonb)) <> 'array' then
    raise exception 'known competitors must be a JSON array'
      using errcode = 'check_violation';
  end if;
  if jsonb_array_length(coalesce(p_known_competitors, '[]'::jsonb)) > 10 then
    raise exception 'at most 10 known competitors'
      using errcode = 'check_violation';
  end if;

  insert into public.competitor_projects (
    workspace_id, user_id, business_idea_id, business_plan_id,
    title, description, category, geography, target_customer,
    customer_problem, business_model, known_competitors, depth, status
  )
  values (
    p_workspace_id, v_user_id, p_business_idea_id, p_business_plan_id,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_category, '')), ''),
    nullif(btrim(coalesce(p_geography, '')), ''),
    nullif(btrim(coalesce(p_target_customer, '')), ''),
    nullif(btrim(coalesce(p_customer_problem, '')), ''),
    nullif(btrim(coalesce(p_business_model, '')), ''),
    coalesce(p_known_competitors, '[]'::jsonb),
    p_depth,
    'draft'
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.competitor_create_project(uuid, text, text, text, text, text, text, text, text, jsonb, uuid, uuid) to authenticated;

-- ============================================================================
-- 11. Start (or reuse) a run
--
-- A project may only have one active run; a second would charge twice for the
-- same work and leave two pointers disagreeing about where the research is.
-- ============================================================================

create or replace function public.competitor_start_run(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.competitor_projects%rowtype;
  v_run_id  uuid;
begin
  select * into v_project from public.competitor_projects where id = p_project_id;
  if v_project.id is null then
    raise exception 'competitor project not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_project.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  select id into v_run_id
  from public.competitor_runs
  where project_id = p_project_id and status in ('pending','running')
  order by created_at desc
  limit 1;

  if v_run_id is not null then
    return v_run_id;
  end if;

  insert into public.competitor_runs (project_id, workspace_id, depth, status, current_stage)
  values (p_project_id, v_project.workspace_id, v_project.depth, 'pending', 'planning')
  returning id into v_run_id;

  update public.competitor_projects set status = 'running' where id = p_project_id;

  return v_run_id;
end;
$$;

grant execute on function public.competitor_start_run(uuid) to authenticated;

-- ============================================================================
-- 12. Claim the next stage
--
-- The row lock is the concurrency control. Everything authoritative — which
-- stage, which attempt, which depth — is derived here, never supplied by the
-- caller. A client that could name its own stage could skip to
-- `recommendations` and pay for advice with no competitors behind it.
-- ============================================================================

create or replace function public.competitor_claim_stage(
  p_run_id          uuid,
  p_max_attempts    integer default 3,
  p_lock_timeout_ms integer default 300000
)
returns table (
  stage        text,
  attempt      integer,
  depth        text,
  workspace_id uuid,
  project_id   uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run     public.competitor_runs%rowtype;
  v_stage   text;
  v_attempt integer;
  v_failed  integer;
begin
  select * into v_run from public.competitor_runs r where r.id = p_run_id for update;

  if v_run.id is null then
    raise exception 'competitor run not found' using errcode = 'no_data_found';
  end if;

  -- Re-derived inside the transaction: membership could have been revoked
  -- between the HTTP check and this statement.
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if v_run.status = 'completed' then
    raise exception 'this competitor run is already complete'
      using errcode = 'invalid_parameter_value';
  end if;
  if v_run.status = 'cancelled' then
    raise exception 'this competitor run was cancelled'
      using errcode = 'invalid_parameter_value';
  end if;

  if v_run.locked_at is not null
     and v_run.locked_at > timezone('utc', now()) - make_interval(secs => p_lock_timeout_ms / 1000.0)
  then
    raise exception 'stage % is already running for this run', coalesce(v_run.locked_stage, '?')
      using errcode = 'lock_not_available';
  end if;

  v_stage := coalesce(v_run.current_stage, 'planning');

  select count(*) into v_failed
  from public.competitor_run_stages s
  where s.run_id = p_run_id and s.stage = v_stage and s.status = 'failed';

  -- A stage that already succeeded is never re-run: that is what makes a
  -- repeated request free rather than a second charge.
  if exists (
    select 1 from public.competitor_run_stages s
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

  insert into public.competitor_run_stages (run_id, workspace_id, stage, attempt, status)
  values (p_run_id, v_run.workspace_id, v_stage, v_attempt, 'running');

  update public.competitor_runs
     set status                = 'running',
         current_stage         = v_stage,
         locked_at             = timezone('utc', now()),
         locked_stage          = v_stage,
         last_stage_started_at = timezone('utc', now()),
         started_at            = coalesce(started_at, timezone('utc', now()))
   where id = p_run_id;

  return query
    select v_stage, v_attempt, v_run.depth, v_run.workspace_id, v_run.project_id;
end;
$$;

grant execute on function public.competitor_claim_stage(uuid, integer, integer) to authenticated;

-- ============================================================================
-- 13. Complete a stage
--
-- Persists sources, competitors, evidence and section results, then advances
-- the pointer — in ONE transaction. `p_next_stage` null means finished.
--
-- Competitors are UPSERTED with coalesce on every enrichment column: discovery
-- creates the row, and verification/profiling/pricing add to it. A later stage
-- that learns nothing about a field must not blank what an earlier one found.
-- ============================================================================

create or replace function public.competitor_complete_stage(
  p_run_id      uuid,
  p_stage       text,
  p_attempt     integer,
  p_next_stage  text,
  p_results     jsonb default '[]'::jsonb,
  p_sources     jsonb default '[]'::jsonb,
  p_competitors jsonb default '[]'::jsonb,
  p_evidence    jsonb default '[]'::jsonb,
  p_usage       jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run             public.competitor_runs%rowtype;
  v_project_id      uuid;
  v_item            jsonb;
  v_source_id       uuid;
  v_competitor_id   uuid;
  v_new_sources     integer := 0;
  v_new_competitors integer := 0;
  v_new_evidence    integer := 0;
  v_canonical       text;
  v_domain          text;
begin
  select * into v_run from public.competitor_runs where id = p_run_id for update;
  if v_run.id is null then
    raise exception 'competitor run not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  v_project_id := v_run.project_id;

  -- --- Sources -------------------------------------------------------------
  -- Deduplicated by canonical_url via the unique constraint; a repeat is
  -- absorbed rather than raising, so a retry that rediscovers the same pages
  -- is harmless.
  for v_item in select * from jsonb_array_elements(p_sources)
  loop
    v_canonical := coalesce(v_item->>'canonical_url', v_item->>'url');
    continue when v_canonical is null or v_item->>'url' is null;

    insert into public.competitor_sources
      (project_id, workspace_id, run_id, url, canonical_url,
       title, publisher, source_type, published_at, status, metadata)
    values
      (v_project_id, v_run.workspace_id, p_run_id,
       v_item->>'url', v_canonical,
       nullif(v_item->>'title', ''),
       nullif(v_item->>'publisher', ''),
       coalesce(nullif(v_item->>'source_type', ''), 'web'),
       (v_item->>'published_at')::timestamptz,
       coalesce(nullif(v_item->>'status', ''), 'retrieved'),
       coalesce(v_item->'metadata', '{}'::jsonb))
    on conflict (project_id, canonical_url) do nothing;

    if found then v_new_sources := v_new_sources + 1; end if;
  end loop;

  -- --- Competitors ---------------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_competitors)
  loop
    v_domain := nullif(btrim(coalesce(v_item->>'canonical_domain', '')), '');
    -- A competitor with no resolvable domain came from somewhere other than a
    -- citation. Dropped rather than stored.
    continue when v_domain is null or nullif(btrim(coalesce(v_item->>'name','')), '') is null;

    insert into public.competitors
      (project_id, workspace_id, name, website, canonical_domain,
       competitor_type, verification_status, verification_notes,
       profile, pricing, positioning, confidence, relevance)
    values
      (v_project_id, v_run.workspace_id,
       btrim(v_item->>'name'),
       nullif(v_item->>'website', ''),
       lower(v_domain),
       coalesce(nullif(v_item->>'competitor_type', ''), 'UNCLASSIFIED'),
       coalesce(nullif(v_item->>'verification_status', ''), 'PENDING'),
       nullif(v_item->>'verification_notes', ''),
       coalesce(v_item->'profile', '{}'::jsonb),
       coalesce(v_item->'pricing', '{}'::jsonb),
       coalesce(v_item->'positioning', '{}'::jsonb),
       coalesce(nullif(v_item->>'confidence', ''), 'low'),
       (v_item->>'relevance')::integer)
    -- The existing row is referred to unqualified (`competitors.x`); a
    -- schema-qualified reference is not accepted in an ON CONFLICT target.
    on conflict (project_id, canonical_domain) do update set
      -- Enrichment, not replacement.
      name                = coalesce(nullif(excluded.name, ''), competitors.name),
      website             = coalesce(excluded.website, competitors.website),
      competitor_type     = case
                              when excluded.competitor_type = 'UNCLASSIFIED'
                                then competitors.competitor_type
                              else excluded.competitor_type
                            end,
      verification_status = case
                              when excluded.verification_status = 'PENDING'
                                then competitors.verification_status
                              else excluded.verification_status
                            end,
      verification_notes  = coalesce(excluded.verification_notes, competitors.verification_notes),
      -- `||` merges the objects, so the profiling and pricing stages each add
      -- their own keys without erasing the other's.
      profile             = competitors.profile     || excluded.profile,
      pricing             = competitors.pricing     || excluded.pricing,
      positioning         = competitors.positioning || excluded.positioning,
      confidence          = excluded.confidence,
      relevance           = coalesce(excluded.relevance, competitors.relevance);

    -- Counts rows WRITTEN, insert or update — an upsert always reports FOUND,
    -- so this is not a count of new competitors. The authoritative totals are
    -- recomputed from `count(*)` when the run row is advanced below.
    v_new_competitors := v_new_competitors + 1;
  end loop;

  -- --- Evidence ------------------------------------------------------------
  -- Resolved against STORED sources by canonical url. An item that resolves to
  -- nothing is dropped here rather than persisted: the NOT NULL on `source_id`
  -- would refuse it anyway, and dropping keeps a retry from failing wholesale
  -- because one claim referenced a URL the provider did not return.
  for v_item in select * from jsonb_array_elements(p_evidence)
  loop
    select id into v_source_id
    from public.competitor_sources
    where project_id = v_project_id
      and canonical_url = v_item->>'canonical_url'
    limit 1;

    continue when v_source_id is null;

    v_competitor_id := null;
    if v_item->>'canonical_domain' is not null then
      select id into v_competitor_id
      from public.competitors
      where project_id = v_project_id
        and canonical_domain = lower(v_item->>'canonical_domain')
      limit 1;
    end if;

    insert into public.competitor_evidence
      (project_id, workspace_id, source_id, competitor_id, section_key,
       claim, evidence_reference, claim_kind, confidence, is_contradictory)
    values
      (v_project_id, v_run.workspace_id, v_source_id, v_competitor_id,
       coalesce(nullif(v_item->>'section_key', ''), 'competitor_profiles'),
       v_item->>'claim',
       nullif(v_item->>'evidence_reference', ''),
       coalesce(nullif(v_item->>'claim_kind', ''), 'OBSERVED'),
       coalesce(nullif(v_item->>'confidence', ''), 'medium'),
       coalesce((v_item->>'is_contradictory')::boolean, false));

    v_new_evidence := v_new_evidence + 1;
  end loop;

  -- --- Section results -----------------------------------------------------
  -- Superseding: the previous current version is stood down first, so the
  -- one-current-version index holds throughout.
  for v_item in select * from jsonb_array_elements(p_results)
  loop
    update public.competitor_results
       set is_current = false
     where project_id = v_project_id
       and section_key = v_item->>'section_key'
       and is_current;

    insert into public.competitor_results
      (project_id, workspace_id, run_id, section_key,
       structured_content, confidence, status, version, is_current)
    values
      (v_project_id, v_run.workspace_id, p_run_id,
       v_item->>'section_key',
       coalesce(v_item->'structured_content', '{}'::jsonb),
       coalesce(nullif(v_item->>'confidence', ''), 'medium'),
       coalesce(nullif(v_item->>'status', ''), 'complete'),
       coalesce((
         select max(version) + 1 from public.competitor_results
         where project_id = v_project_id and section_key = v_item->>'section_key'
       ), 1),
       true);
  end loop;

  -- --- Stage attempt -------------------------------------------------------
  update public.competitor_run_stages
     set status          = 'succeeded',
         completed_at    = timezone('utc', now()),
         prompt_tokens   = (p_usage->>'prompt_tokens')::integer,
         output_tokens   = (p_usage->>'output_tokens')::integer,
         total_tokens    = (p_usage->>'total_tokens')::integer,
         duration_ms     = (p_usage->>'duration_ms')::integer,
         ai_usage_log_id = (p_usage->>'ai_usage_log_id')::uuid
   where run_id = p_run_id and stage = p_stage and attempt = p_attempt;

  -- --- Advance -------------------------------------------------------------
  update public.competitor_runs
     set current_stage           = p_next_stage,
         status                  = case when p_next_stage is null then 'completed' else 'running' end,
         completed_at            = case when p_next_stage is null then timezone('utc', now()) else completed_at end,
         locked_at               = null,
         locked_stage            = null,
         last_stage_completed_at = timezone('utc', now()),
         total_tokens            = total_tokens + coalesce((p_usage->>'total_tokens')::integer, 0),
         estimated_cost_usd      = estimated_cost_usd + coalesce((p_usage->>'estimated_cost_usd')::numeric, 0),
         source_count            = (select count(*) from public.competitor_sources where project_id = v_project_id),
         competitor_count        = (select count(*) from public.competitors where project_id = v_project_id),
         verified_count          = (select count(*) from public.competitors
                                     where project_id = v_project_id
                                       and verification_status in ('VERIFIED','PARTIALLY_VERIFIED')),
         evidence_count          = (select count(*) from public.competitor_evidence where project_id = v_project_id)
   where id = p_run_id;

  if p_next_stage is null then
    update public.competitor_projects set status = 'completed' where id = v_project_id;
  end if;

  return jsonb_build_object(
    'sources_added',       v_new_sources,
    'competitors_written', v_new_competitors,
    'evidence_added',      v_new_evidence,
    'next_stage',          p_next_stage
  );
end;
$$;

grant execute on function public.competitor_complete_stage(uuid, text, integer, text, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- ============================================================================
-- 14. Fail a stage
--
-- Records the failure and releases the lock WITHOUT advancing. The pointer
-- stays put, so the next request retries the same stage.
-- ============================================================================

create or replace function public.competitor_fail_stage(
  p_run_id        uuid,
  p_stage         text,
  p_attempt       integer,
  p_error_code    text,
  p_error_message text,
  p_terminal      boolean default false,
  p_usage         jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.competitor_runs%rowtype;
begin
  select * into v_run from public.competitor_runs where id = p_run_id for update;
  if v_run.id is null then
    raise exception 'competitor run not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  update public.competitor_run_stages
     set status        = 'failed',
         completed_at  = timezone('utc', now()),
         error_code    = p_error_code,
         error_message = left(coalesce(p_error_message, ''), 2000),
         duration_ms   = (p_usage->>'duration_ms')::integer
   where run_id = p_run_id and stage = p_stage and attempt = p_attempt;

  -- current_stage is NOT touched. That is the whole point of this function.
  update public.competitor_runs
     set status       = case when p_terminal then 'failed' else 'running' end,
         error        = left(coalesce(p_error_message, ''), 2000),
         locked_at    = null,
         locked_stage = null
   where id = p_run_id;

  if p_terminal then
    update public.competitor_projects set status = 'failed' where id = v_run.project_id;
  end if;
end;
$$;

grant execute on function public.competitor_fail_stage(uuid, text, integer, text, text, boolean, jsonb) to authenticated;


-- >>>>>>>>>>>>>>>>>>>>>>>> 0015_phase7_competitor_admin.sql >>>>>>>>>>>>>>>>>>>>>>>>

-- ============================================================================
-- Phase 7 — Competitor Intelligence: admin observability
--
-- Most of the admin panel picks up the new feature for free. `ai_usage_logs`
-- gains `competitor-*` rows the moment a stage runs, so /admin/ai,
-- /admin/usage and cost-by-workflow all include it without a line of code.
-- `credit_transactions` likewise, so /admin/credits already shows the charges
-- and refunds.
--
-- Two things do NOT come for free, and this migration adds exactly those:
--
--   1. `admin_cost_breakdown`'s `feature` dimension buckets any unrecognised
--      workflow as 'Other'. Competitor spend would silently land there — an
--      operator asking "what is competitor intelligence costing us" would get
--      a wrong answer rather than no answer, which is worse.
--
--   2. The dashboard's product counters have no competitor equivalent.
--
-- `admin_cost_breakdown` is REPLACED here rather than edited in 0013: the
-- applied migration file is untouched, and `create or replace function` is the
-- supported way to move a function forward. The body is otherwise identical to
-- 0013's, including the permission check and the dimension whitelist.
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
  -- Clamped: the limit reaches this from a query string.
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
      -- Feature mapping. Kept in SQL beside the aggregation so the grouping and
      -- the label cannot disagree; the prefixes match the workflow ids
      -- registered in features/ai/registry, features/research/stages and
      -- features/competitors/stages.
      case
        when l.workflow like 'competitor-%'    then 'Competitor intelligence'
        when l.workflow like 'research-%'      then 'Market research'
        when l.workflow = 'business-plan'      then 'Business plans'
        when l.workflow = 'business-validator' then 'Idea validator'
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
        -- Text, not float: `numeric` must not round-trip through a JSON double
        -- on its way to a money column.
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
  'AI cost and usage aggregated in SQL by day/provider/model/workflow/feature/workspace. Requires usage.read; dimension is whitelisted, never interpolated. Phase 7 added the competitor feature bucket.';

-- ============================================================================
-- Competitor operational counters
--
-- A new function rather than an edit to `admin_research_stats`, so an
-- already-deployed aggregate keeps returning exactly what it returned before.
-- Permission gating follows the same pattern: each block is guarded on its own
-- grant and omitted when the caller lacks it, so an absent key means "you may
-- not see this" rather than zero.
-- ============================================================================

create or replace function public.admin_competitor_stats(
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

  -- Competitor operations sit behind `ai.read`, the same grant that governs the
  -- competitor tables' admin SELECT policies in migration 0014. Using a
  -- different permission here would let a role read the rows but not the counts.
  if public.admin_has('ai.read') then
    v_out := v_out || jsonb_build_object(
      'competitor_projects',  (select count(*) from public.competitor_projects where created_at >= v_since),
      'competitor_runs',      (select count(*) from public.competitor_runs where created_at >= v_since),
      'competitor_completed', (select count(*) from public.competitor_runs where created_at >= v_since and status = 'completed'),
      'competitor_failed',    (select count(*) from public.competitor_runs where created_at >= v_since and status = 'failed'),
      'competitors_found',    (select count(*) from public.competitors where created_at >= v_since),
      'competitors_verified', (select count(*) from public.competitors
                                where created_at >= v_since
                                  and verification_status in ('VERIFIED','PARTIALLY_VERIFIED')),
      'competitor_sources',   (select count(*) from public.competitor_sources where created_at >= v_since),
      'competitor_stage_failures', (select count(*) from public.competitor_run_stages
                                     where started_at >= v_since and status = 'failed')
    );
  end if;

  -- Money movement, so `credits.read` rather than `ai.read`.
  if public.admin_has('credits.read') then
    v_out := v_out || jsonb_build_object(
      'competitor_credits_charged',  (select coalesce(sum(credits_charged), 0)
                                        from public.competitor_run_stages where started_at >= v_since),
      'competitor_credits_refunded', (select coalesce(sum(credits_refunded), 0)
                                        from public.competitor_run_stages where started_at >= v_since)
    );
  end if;

  return v_out || jsonb_build_object('since', v_since);
end;
$$;

comment on function public.admin_competitor_stats(timestamptz) is
  'Competitor Intelligence operational counters for the admin dashboard. Permission-gated per block, like admin_platform_stats.';

grant execute on function public.admin_competitor_stats(timestamptz) to authenticated;
revoke all on function public.admin_competitor_stats(timestamptz) from anon;

