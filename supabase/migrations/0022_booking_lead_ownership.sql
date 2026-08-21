-- ============================================================================
-- 0022 — booking_create must not trust a client-supplied lead id
--
-- Replaces one function body. No table, column, policy or grant changes.
-- 0019 is applied and is not edited.
--
-- ---------------------------------------------------------------------------
-- The defect
-- ---------------------------------------------------------------------------
-- `booking_create` is `security definer` (so it bypasses RLS) and is granted to
-- `anon, authenticated` — it has to be, because the secondary funnel books
-- before an account exists. It took `p_lead_id` from its caller and used it
-- unchecked to:
--
--   * set `bookings.lead_id`
--   * insert a BOOKING_CREATED row on that lead's timeline
--   * move that lead's status to STRATEGY_BOOKED
--
-- Nothing verified the caller had any relationship to the lead. Anyone could
-- POST to /rest/v1/rpc/booking_create with someone else's lead id and write
-- onto their timeline and lifecycle. The admin lead detail page reads exactly
-- those rows, so the forged activity would be indistinguishable from real
-- customer behaviour.
--
-- Same class of defect, and same fix, as the `email_log_record` hardening: a
-- `security definer` function is the ONLY gate left once RLS is bypassed, so it
-- has to do the check itself.
--
-- ---------------------------------------------------------------------------
-- The rule
-- ---------------------------------------------------------------------------
-- A lead id is honoured only when the caller can be shown to be connected to
-- it:
--
--   * the lead is already linked to the calling user, OR
--   * the lead was captured against the same email address this booking is
--     being made with — which is how the anonymous funnel legitimately books
--     before an account exists, and the only signal available in that case, OR
--   * the caller holds `leads.update` (staff booking on a customer's behalf)
--
-- Anything else DROPS the association rather than failing. The booking is the
-- thing the customer came for; losing the sales attribution on a suspicious
-- request is the right trade, and raising an error would tell a prober whether
-- a given lead id exists.
--
-- Matching on email is not authentication and is not treated as such: it grants
-- no read access and no session. It links a booking to a lead captured from the
-- same address, which is exactly the association the funnel intends.
-- ============================================================================

create or replace function public.booking_create(
  p_full_name       text,
  p_email           text,
  p_scheduled_at    timestamptz,
  p_timezone        text,
  p_idempotency_key text,
  p_phone           text default null,
  p_lead_id         uuid default null,
  p_duration        integer default 30,
  p_notes           text default null
)
returns table (booking_id uuid, was_existing boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email   text := lower(btrim(p_email));
  v_id      uuid;
  v_ws      uuid;
  -- Starts null and is only adopted once the caller is shown to be entitled
  -- to it. Every later use reads this, never `p_lead_id`.
  v_lead_id uuid := null;
begin
  if v_email is null or position('@' in v_email) = 0 then
    raise exception 'a valid email is required'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_scheduled_at <= timezone('utc', now()) then
    raise exception 'that time is in the past'
      using errcode = 'invalid_parameter_value';
  end if;

  select id into v_id from public.bookings
   where idempotency_key = p_idempotency_key;

  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  -- Attach the workspace when the booker is signed in. A booking made while
  -- signed out is still valid; it simply has no workspace yet.
  if auth.uid() is not null then
    select workspace_id into v_ws
      from public.workspace_members
     where user_id = auth.uid()
     limit 1;
  end if;

  -- The ownership test described above.
  if p_lead_id is not null then
    select id into v_lead_id
      from public.leads
     where id = p_lead_id
       and (
         (user_id is not null and user_id = auth.uid())
         or lower(btrim(email)) = v_email
         or public.admin_has('leads.update')
       );
  end if;

  insert into public.bookings (
    user_id, workspace_id, lead_id, full_name, email, phone,
    scheduled_at, timezone, duration_minutes, status, notes, idempotency_key
  ) values (
    auth.uid(), v_ws, v_lead_id, p_full_name, v_email, p_phone,
    p_scheduled_at, coalesce(p_timezone, 'UTC'),
    least(greatest(coalesce(p_duration, 30), 15), 180),
    'PENDING', p_notes, p_idempotency_key
  )
  returning id into v_id;

  if v_lead_id is not null then
    insert into public.lead_events (lead_id, event, actor_user_id, metadata)
    values (v_lead_id, 'BOOKING_CREATED', auth.uid(),
            jsonb_build_object('booking_id', v_id));

    update public.leads
       set status = case when status in ('NEW','CONTACTED')
                         then 'STRATEGY_BOOKED' else status end,
           last_activity_at = timezone('utc', now())
     where id = v_lead_id;
  end if;

  return query select v_id, false;
end;
$$;

grant execute on function public.booking_create(
  text, text, timestamptz, text, text, text, uuid, integer, text
) to anon, authenticated;

-- ============================================================================
-- Verification
--
--   select position('v_lead_id' in prosrc) > 0 as hardened
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'booking_create';
-- ============================================================================
