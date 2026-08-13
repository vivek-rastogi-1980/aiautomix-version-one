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
