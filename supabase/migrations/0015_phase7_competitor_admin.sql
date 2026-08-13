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
