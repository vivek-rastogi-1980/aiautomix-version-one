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
