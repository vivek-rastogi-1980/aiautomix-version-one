-- ============================================================================
-- Migration 0010 — Sprint 8 Phase 3: Market Research stage engine
--
-- Adds the transactional core of stage-at-a-time execution: claiming a stage,
-- completing it, and failing it. Additive only; 0009 is untouched.
--
-- ---------------------------------------------------------------------------
-- WHY THESE ARE DATABASE FUNCTIONS, NOT APPLICATION CODE
-- ---------------------------------------------------------------------------
-- Two requirements can only be met where the transaction lives:
--
--   CONCURRENCY. Two browser tabs calling POST /run-stage at the same moment
--   must not both execute the same stage. An idempotency key alone does not
--   help: both requests would reach the provider before either recorded a
--   transaction, so the platform pays twice for identical work. `claim_stage`
--   takes a row lock (`SELECT … FOR UPDATE`) on the run, so the second caller
--   blocks until the first has inserted its attempt row and then observes that
--   the stage is already running.
--
--   PARTIAL RESULTS. `current_stage` must advance only when the stage's
--   validated output is already persisted. Doing that in two application
--   statements leaves a window where a crash advances the pointer past a stage
--   whose result was never written — the run then looks complete and is not.
--   `complete_stage` writes the result, the sources, the evidence and the new
--   pointer in one transaction: all of it, or none.
-- ============================================================================

-- ============================================================================
-- 1. Run-level execution bookkeeping
-- ============================================================================

alter table public.research_runs
  add column if not exists last_stage_started_at   timestamptz,
  add column if not exists last_stage_completed_at timestamptz,
  -- Set while a stage is executing; cleared on completion or failure. A stale
  -- value is how a crashed run is recognised (see `research_claim_stage`).
  add column if not exists locked_at               timestamptz,
  add column if not exists locked_stage            text;

comment on column public.research_runs.locked_at is
  'Non-null while a stage is executing. Used to reject concurrent execution and to detect abandoned runs.';

create index if not exists research_runs_locked_idx
  on public.research_runs (locked_at) where locked_at is not null;

-- ============================================================================
-- 2. Claim a stage
--
-- Returns the stage the SERVER decides to run, its attempt number, the depth
-- and the workspace. The caller supplies none of these — a client cannot pick
-- a later stage, replay an attempt number, or nominate a cheaper depth.
-- ============================================================================

create or replace function public.research_claim_stage(
  p_run_id           uuid,
  p_max_attempts     integer default 3,
  -- A run whose lock is older than this is treated as abandoned (the serverless
  -- function died mid-stage) and may be reclaimed.
  p_lock_timeout_ms  integer default 300000
)
returns table (
  stage        text,
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
  v_run      public.research_runs%rowtype;
  v_stage    text;
  v_attempt  integer;
  v_failed   integer;
begin
  -- The row lock is the concurrency control. A second caller waits here.
  select * into v_run
  from public.research_runs r
  where r.id = p_run_id
  for update;

  if v_run.id is null then
    raise exception 'research run not found' using errcode = 'no_data_found';
  end if;

  -- Authorisation is re-derived inside the transaction rather than trusted from
  -- the caller: membership could have been revoked between the HTTP check and
  -- this statement.
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  if v_run.status = 'completed' then
    raise exception 'this research run is already complete'
      using errcode = 'invalid_parameter_value';
  end if;
  if v_run.status = 'cancelled' then
    raise exception 'this research run was cancelled'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Concurrency: someone else holds the run.
  if v_run.locked_at is not null
     and v_run.locked_at > timezone('utc', now()) - make_interval(secs => p_lock_timeout_ms / 1000.0)
  then
    raise exception 'stage % is already running for this run', coalesce(v_run.locked_stage, '?')
      using errcode = 'lock_not_available';
  end if;

  v_stage := coalesce(v_run.current_stage, 'planning');

  -- Attempts are counted from persisted history, never supplied by a caller.
  select count(*) into v_failed
  from public.research_run_stages s
  where s.run_id = p_run_id and s.stage = v_stage and s.status = 'failed';

  -- A stage that already succeeded is never re-run: that is what makes a
  -- repeated request free rather than a second charge.
  if exists (
    select 1 from public.research_run_stages s
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

  insert into public.research_run_stages
    (run_id, workspace_id, stage, attempt, status)
  values
    (p_run_id, v_run.workspace_id, v_stage, v_attempt, 'running');

  update public.research_runs
     set status                = 'running',
         current_stage         = v_stage,
         locked_at             = timezone('utc', now()),
         locked_stage          = v_stage,
         last_stage_started_at = timezone('utc', now()),
         started_at            = coalesce(started_at, timezone('utc', now()))
   where id = p_run_id;

  return query
    select v_stage, v_attempt, v_run.depth, v_run.workspace_id,
           v_run.research_request_id;
end;
$$;

comment on function public.research_claim_stage(uuid, integer, integer) is
  'Atomically claims the next executable stage. The row lock is what stops two concurrent requests executing the same stage.';

-- ============================================================================
-- 3. Complete a stage
--
-- Persists the section results, the sources and the evidence, then advances the
-- pointer — in ONE transaction. `p_next_stage` null means the run is finished.
-- ============================================================================

create or replace function public.research_complete_stage(
  p_run_id      uuid,
  p_stage       text,
  p_attempt     integer,
  p_next_stage  text,
  p_results     jsonb default '[]'::jsonb,
  p_sources     jsonb default '[]'::jsonb,
  p_evidence    jsonb default '[]'::jsonb,
  p_usage       jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run          public.research_runs%rowtype;
  v_request_id   uuid;
  v_item         jsonb;
  v_source_id    uuid;
  v_new_sources  integer := 0;
  v_new_evidence integer := 0;
  v_canonical    text;
begin
  select * into v_run from public.research_runs where id = p_run_id for update;
  if v_run.id is null then
    raise exception 'research run not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  v_request_id := v_run.research_request_id;

  -- --- Sources -------------------------------------------------------------
  -- Deduplicated by canonical_url via the unique constraint from 0009; a
  -- repeat is absorbed rather than raising, so a retry that rediscovers the
  -- same pages is harmless.
  for v_item in select * from jsonb_array_elements(p_sources)
  loop
    v_canonical := coalesce(v_item->>'canonical_url', v_item->>'url');
    if v_canonical is null or v_item->>'url' is null then
      continue;
    end if;

    insert into public.research_sources
      (research_request_id, workspace_id, run_id, url, canonical_url,
       title, publisher, source_type, published_at, status, metadata)
    values
      (v_request_id, v_run.workspace_id, p_run_id,
       v_item->>'url', v_canonical,
       nullif(v_item->>'title', ''),
       nullif(v_item->>'publisher', ''),
       coalesce(nullif(v_item->>'source_type', ''), 'web'),
       (v_item->>'published_at')::timestamptz,
       coalesce(nullif(v_item->>'status', ''), 'retrieved'),
       coalesce(v_item->'metadata', '{}'::jsonb))
    on conflict (research_request_id, canonical_url) do nothing;

    if found then
      v_new_sources := v_new_sources + 1;
    end if;
  end loop;

  -- --- Evidence ------------------------------------------------------------
  -- Every row must resolve to a source that already exists for this request.
  -- An unresolvable citation is DROPPED rather than stored: the fabrication
  -- control from 0009 would reject it anyway, and failing the whole stage for
  -- one bad citation would be worse than recording the rest.
  for v_item in select * from jsonb_array_elements(p_evidence)
  loop
    select id into v_source_id
    from public.research_sources
    where research_request_id = v_request_id
      and canonical_url = coalesce(v_item->>'canonical_url', v_item->>'source_url')
    limit 1;

    if v_source_id is null then
      continue;
    end if;

    insert into public.research_evidence
      (research_request_id, workspace_id, source_id, section_key, claim,
       evidence_reference, confidence, is_contradictory)
    values
      (v_request_id, v_run.workspace_id, v_source_id,
       v_item->>'section_key', v_item->>'claim',
       nullif(v_item->>'evidence_reference', ''),
       coalesce(nullif(v_item->>'confidence', ''), 'medium'),
       coalesce((v_item->>'is_contradictory')::boolean, false));

    v_new_evidence := v_new_evidence + 1;
  end loop;

  -- --- Section results -----------------------------------------------------
  -- Superseding: the previous current version is stood down first, so the
  -- one-current-version index from 0009 holds throughout.
  for v_item in select * from jsonb_array_elements(p_results)
  loop
    update public.research_results
       set is_current = false
     where research_request_id = v_request_id
       and section_key = v_item->>'section_key'
       and is_current;

    insert into public.research_results
      (research_request_id, workspace_id, run_id, section_key,
       structured_content, confidence, status, version, is_current)
    values
      (v_request_id, v_run.workspace_id, p_run_id,
       v_item->>'section_key',
       coalesce(v_item->'structured_content', '{}'::jsonb),
       coalesce(nullif(v_item->>'confidence', ''), 'medium'),
       coalesce(nullif(v_item->>'status', ''), 'complete'),
       coalesce((
         select max(version) + 1 from public.research_results
         where research_request_id = v_request_id
           and section_key = v_item->>'section_key'
       ), 1),
       true);
  end loop;

  -- --- Stage attempt -------------------------------------------------------
  update public.research_run_stages
     set status         = 'succeeded',
         completed_at   = timezone('utc', now()),
         prompt_tokens  = (p_usage->>'prompt_tokens')::integer,
         output_tokens  = (p_usage->>'output_tokens')::integer,
         total_tokens   = (p_usage->>'total_tokens')::integer,
         duration_ms    = (p_usage->>'duration_ms')::integer,
         ai_usage_log_id = (p_usage->>'ai_usage_log_id')::uuid
   where run_id = p_run_id and stage = p_stage and attempt = p_attempt;

  -- --- Advance -------------------------------------------------------------
  update public.research_runs
     set current_stage           = p_next_stage,
         status                  = case when p_next_stage is null then 'completed' else 'running' end,
         completed_at            = case when p_next_stage is null then timezone('utc', now()) else completed_at end,
         locked_at               = null,
         locked_stage            = null,
         last_stage_completed_at = timezone('utc', now()),
         total_tokens            = total_tokens + coalesce((p_usage->>'total_tokens')::integer, 0),
         estimated_cost_usd      = estimated_cost_usd + coalesce((p_usage->>'estimated_cost_usd')::numeric, 0),
         source_count            = source_count + v_new_sources,
         evidence_count          = evidence_count + v_new_evidence
   where id = p_run_id;

  if p_next_stage is null then
    update public.research_requests
       set status = 'completed'
     where id = v_request_id;
  end if;

  return jsonb_build_object(
    'sources_added', v_new_sources,
    'evidence_added', v_new_evidence,
    'next_stage', p_next_stage
  );
end;
$$;

-- ============================================================================
-- 4. Fail a stage
--
-- Records the failure and releases the lock WITHOUT advancing. The pointer
-- stays where it was, so the next request retries the same stage.
-- ============================================================================

create or replace function public.research_fail_stage(
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
  v_run public.research_runs%rowtype;
begin
  select * into v_run from public.research_runs where id = p_run_id for update;
  if v_run.id is null then
    raise exception 'research run not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_run.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  update public.research_run_stages
     set status        = 'failed',
         completed_at  = timezone('utc', now()),
         error_code    = p_error_code,
         error_message = left(coalesce(p_error_message, ''), 2000),
         total_tokens  = (p_usage->>'total_tokens')::integer,
         duration_ms   = (p_usage->>'duration_ms')::integer
   where run_id = p_run_id and stage = p_stage and attempt = p_attempt;

  -- current_stage is deliberately NOT touched.
  update public.research_runs
     set status       = case when p_terminal then 'failed' else 'running' end,
         error        = left(coalesce(p_error_message, ''), 2000),
         locked_at    = null,
         locked_stage = null,
         total_tokens = total_tokens + coalesce((p_usage->>'total_tokens')::integer, 0)
   where id = p_run_id;

  if p_terminal then
    update public.research_requests set status = 'failed'
     where id = v_run.research_request_id;
  end if;
end;
$$;

-- ============================================================================
-- 5. Create a run
--
-- A request may only have one active run; a second would charge twice for the
-- same work and leave two pointers disagreeing about where the research is.
-- ============================================================================

create or replace function public.research_start_run(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.research_requests%rowtype;
  v_run_id  uuid;
begin
  select * into v_request from public.research_requests where id = p_request_id;
  if v_request.id is null then
    raise exception 'research request not found' using errcode = 'no_data_found';
  end if;
  if not public.is_workspace_member(v_request.workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  select id into v_run_id
  from public.research_runs
  where research_request_id = p_request_id
    and status in ('pending', 'running')
  order by created_at desc
  limit 1;

  if v_run_id is not null then
    return v_run_id;
  end if;

  insert into public.research_runs
    (research_request_id, workspace_id, depth, status, current_stage)
  values
    (p_request_id, v_request.workspace_id, v_request.depth, 'pending', 'planning')
  returning id into v_run_id;

  update public.research_requests set status = 'running' where id = p_request_id;

  return v_run_id;
end;
$$;

-- ============================================================================
-- 6. Grants
--
-- `authenticated` may execute; each function re-derives workspace membership
-- internally, so being able to call is not being able to act.
-- ============================================================================

grant execute on function public.research_claim_stage(uuid, integer, integer) to authenticated;
grant execute on function public.research_complete_stage(uuid, text, integer, text, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.research_fail_stage(uuid, text, integer, text, text, boolean, jsonb) to authenticated;
grant execute on function public.research_start_run(uuid) to authenticated;

revoke all on function public.research_claim_stage(uuid, integer, integer) from anon;
revoke all on function public.research_complete_stage(uuid, text, integer, text, jsonb, jsonb, jsonb, jsonb) from anon;
revoke all on function public.research_fail_stage(uuid, text, integer, text, text, boolean, jsonb) from anon;
revoke all on function public.research_start_run(uuid) from anon;
