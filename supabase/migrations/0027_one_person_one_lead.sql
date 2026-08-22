-- ============================================================================
-- 0027 — One person, one lead
--
-- Replaces one function body. No schema change, no data deleted.
--
-- ---------------------------------------------------------------------------
-- The defect
-- ---------------------------------------------------------------------------
-- `lead_capture` resolved an existing lead ONLY by `idempotency_key`, and that
-- key is derived from (email, source):
--
--     lead:idea-validation:alice@example.com
--     lead:strategy-session:alice@example.com     <- different key, new lead
--
-- So Alice validating an idea and later booking a strategy session became TWO
-- leads. In Admin -> Leads she appears twice; the funnel counts her twice; the
-- first lead sits at NEW forever while the second advances to STRATEGY_BOOKED.
--
-- A partial fix already exists in the booking route: a SIGNED-IN booker reuses
-- their own lead. But the public funnel books anonymously — that is its whole
-- purpose — and the anonymous path still split the identity. Verified: one
-- user, one workspace, one booking, one idea, and two leads.
--
-- ---------------------------------------------------------------------------
-- The rule
-- ---------------------------------------------------------------------------
-- Identity is the PERSON, keyed on the normalised email. The source is an
-- attribute of how they arrived, not a separate customer.
--
-- Resolution order, most specific first:
--
--   1. exact idempotency key      -> a genuine retry of this same submission
--   2. same email, any source     -> the same human, arriving a second way
--   3. otherwise                  -> a new lead
--
-- Case 2 is the fix. It updates the existing lead with anything newly supplied
-- (a phone number given at booking that was missing at signup) without
-- overwriting what is already known with nulls, records the activity on the
-- existing timeline, and returns the original id.
--
-- ---------------------------------------------------------------------------
-- What is deliberately NOT changed
-- ---------------------------------------------------------------------------
-- The lead's `source` stays as first captured. It records where this customer
-- came FROM, and rewriting it on a later booking would destroy the attribution
-- the marketing funnel is measured on. The new activity is recorded as a
-- timeline event instead, which is where "what did they do" belongs.
--
-- Existing duplicate leads are NOT merged. Merging is a judgement call about
-- real customer records — whose status wins, whose owner, whose notes — and a
-- migration that guesses is a migration that silently corrupts a CRM. Existing
-- rows are left exactly as they are; only new captures behave correctly.
-- ============================================================================

create or replace function public.lead_capture(
  p_email             text,
  p_source            text,
  p_idempotency_key   text,
  p_first_name        text default null,
  p_last_name         text default null,
  p_phone             text default null,
  p_company           text default null,
  p_message           text default null,
  p_industry          text default null,
  p_target_customer   text default null,
  p_target_market     text default null,
  p_business_stage    text default null,
  p_problem_solved    text default null,
  p_website           text default null,
  p_landing_page      text default null,
  p_referrer          text default null,
  p_utm_source        text default null,
  p_utm_medium        text default null,
  p_utm_campaign      text default null,
  p_utm_term          text default null,
  p_utm_content       text default null
)
returns table (lead_id uuid, was_existing boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
  v_id    uuid;
  v_name  text;
begin
  if v_email is null or position('@' in v_email) = 0 then
    raise exception 'a valid email is required'
      using errcode = 'invalid_parameter_value';
  end if;

  -- 1. A genuine retry of this exact submission.
  select id into v_id from public.leads
   where idempotency_key = p_idempotency_key;

  if v_id is not null then
    update public.leads
       set last_activity_at = timezone('utc', now())
     where id = v_id;
    return query select v_id, true;
    return;
  end if;

  -- 2. The same person, arriving through a different entry point.
  --    Oldest first: their original lead is the one carrying the history, the
  --    owner and any status an admin has set.
  select id into v_id from public.leads
   where lower(btrim(email)) = v_email
   order by created_at
   limit 1;

  if v_id is not null then
    -- `coalesce(new, existing)` in that order throughout: a later submission
    -- fills gaps but never erases. Somebody who gave a phone number at signup
    -- and omitted it when booking keeps their phone number.
    update public.leads
       set first_name       = coalesce(p_first_name, first_name),
           last_name        = coalesce(p_last_name, last_name),
           name             = coalesce(name, nullif(btrim(
                                coalesce(p_first_name,'') || ' ' ||
                                coalesce(p_last_name,'')), '')),
           phone            = coalesce(p_phone, phone),
           company          = coalesce(p_company, company),
           message          = coalesce(message, p_message),
           industry         = coalesce(p_industry, industry),
           target_customer  = coalesce(p_target_customer, target_customer),
           target_market    = coalesce(p_target_market, target_market),
           business_stage   = coalesce(p_business_stage, business_stage),
           problem_solved   = coalesce(p_problem_solved, problem_solved),
           website          = coalesce(p_website, website),
           last_activity_at = timezone('utc', now())
     where id = v_id;

    -- The activity goes on the timeline. `source` on the lead itself is left
    -- alone so first-touch attribution survives.
    if p_source = 'idea-validation' then
      insert into public.lead_events (lead_id, event, metadata)
      values (v_id, 'IDEA_SUBMITTED', jsonb_build_object('source', p_source));
    else
      insert into public.lead_events (lead_id, event, metadata)
      values (v_id, 'STRATEGY_CTA_CLICKED',
              jsonb_build_object('source', p_source, 'returning', true));
    end if;

    return query select v_id, true;
    return;
  end if;

  -- 3. Genuinely new.
  v_name := btrim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, ''));
  if v_name = '' then v_name := null; end if;

  insert into public.leads (
    email, name, first_name, last_name, phone, company, message, source,
    industry, target_customer, target_market, business_stage, problem_solved,
    website, landing_page, referrer, utm_source, utm_medium, utm_campaign,
    utm_term, utm_content, idempotency_key, status, last_activity_at
  ) values (
    v_email, v_name, p_first_name, p_last_name, p_phone, p_company, p_message,
    coalesce(p_source, 'unknown'), p_industry, p_target_customer, p_target_market,
    p_business_stage, p_problem_solved, p_website, p_landing_page, p_referrer,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content,
    p_idempotency_key, 'NEW', timezone('utc', now())
  )
  returning id into v_id;

  insert into public.lead_events (lead_id, event, metadata)
  values (v_id, 'LEAD_CREATED', jsonb_build_object('source', p_source));

  if p_source = 'idea-validation' then
    insert into public.lead_events (lead_id, event) values (v_id, 'IDEA_SUBMITTED');
  end if;

  return query select v_id, false;
end;
$$;

grant execute on function public.lead_capture(
  text, text, text, text, text, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- ============================================================================
-- Verification
--
--   select public.lead_capture('a@b.com','idea-validation','k1','A','B');
--   select public.lead_capture('a@b.com','strategy-session','k2','A','B');
--
-- The second returns the SAME lead_id with was_existing = true. Before this
-- migration it returned a new id.
--
--   select count(*) from public.leads where email = 'a@b.com';   -- 1
-- ============================================================================
