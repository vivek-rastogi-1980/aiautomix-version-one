-- ============================================================================
-- 0024 — Super Admin command center aggregates
--
-- Adds ONE read-only function. No tables, no columns, no policy changes.
--
-- ---------------------------------------------------------------------------
-- Why a new function rather than extending admin_platform_stats
-- ---------------------------------------------------------------------------
-- `admin_platform_stats` (0008) is applied and is consulted by the existing
-- dashboard. Migrations that are already applied are never edited, and widening
-- a function other pages depend on to serve one new page is how a shared
-- aggregate becomes something nobody dares change. This is additive: the
-- existing dashboard keeps working untouched if this function is never called.
--
-- ---------------------------------------------------------------------------
-- Everything here is counted in SQL, deliberately
-- ---------------------------------------------------------------------------
-- §16 and §20: no loading rows into TypeScript to add them up, and no
-- JavaScript floating-point arithmetic for money. `estimated_cost_usd` is
-- `numeric`, summed as `numeric`, and returned as text so PostgREST cannot
-- round it through a float on the way out. The UI formats that string; it never
-- does arithmetic on it.
--
-- ---------------------------------------------------------------------------
-- Every key is permission-gated, and absent rather than zero
-- ---------------------------------------------------------------------------
-- Same contract the other stat functions use: a caller without the grant gets
-- a JSON object with the key MISSING, and the `Stat` component renders
-- "Unavailable". A zero would read as "none happened", which is a different
-- and much more misleading fact.
-- ============================================================================

create or replace function public.admin_command_center_stats(
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
  v_today timestamptz := date_trunc('day', timezone('utc', now()));
  v_out   jsonb := '{}'::jsonb;
  v_model text;
  v_flow  text;
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = 'insufficient_privilege';
  end if;

  -- --- People ------------------------------------------------------------
  -- "Active users" was previously reported as unmeasurable, because nothing
  -- recorded a session. `auth.users.last_sign_in_at` does record one, so the
  -- metric now has a real source and a stated definition: signed in at least
  -- once within the window. That definition is shown in the UI, because an
  -- unexplained "active" number invites everyone to assume their own meaning.
  if public.admin_has('users.read') then
    v_out := v_out || jsonb_build_object(
      'active_users',    (select count(*) from auth.users
                           where last_sign_in_at >= v_since),
      'signed_in_today', (select count(*) from auth.users
                           where last_sign_in_at >= v_today),
      'never_signed_in', (select count(*) from auth.users
                           where last_sign_in_at is null)
    );
  end if;

  -- --- Leads -------------------------------------------------------------
  if public.admin_has('leads.read') then
    v_out := v_out || jsonb_build_object(
      'new_leads_today', (select count(*) from public.leads
                           where created_at >= v_today),
      -- The funnel stages, counted DISTINCT per lead: a customer who opens
      -- their report four times is one lead that reached "report viewed", not
      -- four. Counting rows here would inflate every downstream conversion.
      'stage_lead_created',       (select count(*) from public.leads where created_at >= v_since),
      'stage_idea_submitted',     (select count(distinct lead_id) from public.lead_events
                                    where created_at >= v_since and event = 'IDEA_SUBMITTED'),
      'stage_account_activated',  (select count(distinct lead_id) from public.lead_events
                                    where created_at >= v_since and event = 'ACCOUNT_CREATED'),
      'stage_validated',          (select count(distinct lead_id) from public.lead_events
                                    where created_at >= v_since and event = 'VALIDATION_COMPLETED'),
      'stage_report_viewed',      (select count(distinct lead_id) from public.lead_events
                                    where created_at >= v_since and event = 'REPORT_VIEWED'),
      'stage_report_downloaded',  (select count(distinct lead_id) from public.lead_events
                                    where created_at >= v_since and event = 'REPORT_DOWNLOADED'),
      'stage_cta_clicked',        (select count(distinct lead_id) from public.lead_events
                                    where created_at >= v_since and event = 'STRATEGY_CTA_CLICKED'),
      'stage_booking_created',    (select count(distinct lead_id) from public.lead_events
                                    where created_at >= v_since and event = 'BOOKING_CREATED'),
      'stage_booking_completed',  (select count(distinct lead_id) from public.lead_events
                                    where created_at >= v_since and event = 'BOOKING_COMPLETED')
    );
  end if;

  -- --- AI platform --------------------------------------------------------
  if public.admin_has('ai.read') then
    select model into v_model
      from public.ai_usage_logs
     where created_at >= v_since
     group by model
     order by count(*) desc, model
     limit 1;

    select workflow into v_flow
      from public.ai_usage_logs
     where created_at >= v_since
     group by workflow
     order by count(*) desc, workflow
     limit 1;

    v_out := v_out || jsonb_build_object(
      'most_used_model',    v_model,
      'most_used_workflow', v_flow,
      -- numeric throughout, rendered as text. Never a float.
      'avg_cost_per_request', (
        select case when count(*) = 0 then null
                    else to_char(
                      sum(coalesce(estimated_cost_usd, 0)) / count(*),
                      'FM0.000000')
               end
          from public.ai_usage_logs where created_at >= v_since),
      'ai_failure_rate', (
        select case when count(*) = 0 then null
                    else to_char(
                      100.0 * count(*) filter (where status <> 'success') / count(*),
                      'FM990.0')
               end
          from public.ai_usage_logs where created_at >= v_since)
    );

    -- Per-workflow breakdown, so "which feature is spending the money?" has an
    -- answer without a second round trip.
    v_out := v_out || jsonb_build_object('by_workflow', coalesce((
      select jsonb_agg(row_to_json(w) order by w.requests desc)
        from (
          select workflow,
                 count(*)::int                                   as requests,
                 count(*) filter (where status <> 'success')::int as failures,
                 coalesce(sum(total_tokens), 0)::bigint           as tokens,
                 to_char(coalesce(sum(estimated_cost_usd), 0), 'FM0.000000') as cost
            from public.ai_usage_logs
           where created_at >= v_since
           group by workflow
           order by count(*) desc
           limit 12
        ) w
    ), '[]'::jsonb));
  end if;

  -- --- Credits ------------------------------------------------------------
  if public.admin_has('credits.read') then
    v_out := v_out || jsonb_build_object(
      'credits_issued',   (select coalesce(sum(amount), 0) from public.credit_transactions
                            where created_at >= v_since and amount > 0),
      'credits_consumed', (select coalesce(abs(sum(amount)), 0) from public.credit_transactions
                            where created_at >= v_since and amount < 0)
    );
  end if;

  return v_out || jsonb_build_object('since', v_since, 'today', v_today);
end;
$$;

comment on function public.admin_command_center_stats(timestamptz) is
  'Super Admin command center aggregates. Each block is permission-gated; a key is ABSENT rather than zero when the caller lacks the grant. Money is summed as numeric and returned as text.';

grant execute on function public.admin_command_center_stats(timestamptz) to authenticated;
revoke all on function public.admin_command_center_stats(timestamptz) from anon;

-- ============================================================================
-- Verification
--
--   select public.admin_command_center_stats();   -- as an admin session
--
-- Returns {} plus `since`/`today` for an admin with no grants, and raises
-- `insufficient_privilege` for a non-admin.
-- ============================================================================
