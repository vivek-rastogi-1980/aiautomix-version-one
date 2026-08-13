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
