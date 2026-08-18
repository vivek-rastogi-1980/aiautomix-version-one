-- ============================================================================
-- Activate the BOOKING_CONFIRMATION email template
--
-- Run this in the Supabase SQL Editor AFTER migration 0019 has been applied.
--
-- ---------------------------------------------------------------------------
-- Why this is raw SQL rather than an admin RPC call
-- ---------------------------------------------------------------------------
-- `email_template_save` and `email_template_set_status` both gate on
-- `admin_has('communications.write')`, which resolves `auth.uid()`. In the SQL
-- Editor there is no authenticated user, so those functions would refuse.
--
-- Running the inserts directly is the correct escape hatch for a one-off
-- bootstrap: the SQL Editor connects as a superuser, which is the same
-- authority a migration has. Day-to-day template editing should go through the
-- admin panel and the RPCs, so that every change lands in the audit log.
--
-- ---------------------------------------------------------------------------
-- Safe to run more than once
-- ---------------------------------------------------------------------------
-- Saving always appends a new version — the append-only trigger on
-- `email_template_versions` makes rewriting one impossible — so re-running this
-- creates version 2, 3, and so on, and points the template at the newest. That
-- is the intended behaviour, not a bug: history is preserved.
-- ============================================================================

do $$
declare
  v_template_id uuid;
  v_next        integer;
begin
  select id into v_template_id
    from public.email_templates
   where trigger = 'BOOKING_CONFIRMATION';

  if v_template_id is null then
    raise exception
      'No BOOKING_CONFIRMATION template row exists. Apply migration 0019 first.';
  end if;

  select coalesce(max(version), 0) + 1 into v_next
    from public.email_template_versions
   where template_id = v_template_id;

  insert into public.email_template_versions (
    template_id, version, subject, body_html, body_text
  ) values (
    v_template_id,
    v_next,
    -- Every {{placeholder}} below is in the engine's closed vocabulary. An
    -- unknown one would be refused at send time rather than rendered blank.
    'Your AI strategy session is confirmed — {{booking.date}}',
    $html$<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #1a1a1a; max-width: 560px;">
  <p>Hi {{user.first_name}},</p>

  <p>Your free AI strategy session is confirmed. Here are the details:</p>

  <table cellpadding="0" cellspacing="0" style="margin: 24px 0; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px 24px 8px 0; color: #666;">Date</td>
      <td style="padding: 8px 0; font-weight: 600;">{{booking.date}}</td>
    </tr>
    <tr>
      <td style="padding: 8px 24px 8px 0; color: #666;">Time</td>
      <td style="padding: 8px 0; font-weight: 600;">{{booking.time}}</td>
    </tr>
    <tr>
      <td style="padding: 8px 24px 8px 0; color: #666;">Timezone</td>
      <td style="padding: 8px 0; font-weight: 600;">{{booking.timezone}}</td>
    </tr>
  </table>

  <p>We will use the session to look at your idea, where the demand actually
  is, and what the first ninety days should cost. Come with the questions you
  most want answered.</p>

  <p style="margin: 28px 0;">
    <a href="{{dashboard_url}}"
       style="display: inline-block; padding: 12px 24px; background: #7C5CFF;
              color: #ffffff; text-decoration: none; border-radius: 8px;
              font-weight: 600;">Open your workspace</a>
  </p>

  <p style="color: #666; font-size: 14px;">Need to change or cancel? Reply to
  this email and we will sort it out.</p>

  <p style="color: #666; font-size: 14px;">— The AIAutoMix team</p>
</div>$html$,
    $text$Hi {{user.first_name}},

Your free AI strategy session is confirmed.

Date:     {{booking.date}}
Time:     {{booking.time}}
Timezone: {{booking.timezone}}

We will use the session to look at your idea, where the demand actually is,
and what the first ninety days should cost. Come with the questions you most
want answered.

Open your workspace: {{dashboard_url}}

Need to change or cancel? Reply to this email and we will sort it out.

- The AIAutoMix team$text$
  );

  -- Exactly one template may be ACTIVE per trigger. Stand any rival down first
  -- so the unique partial index cannot be violated.
  update public.email_templates
     set status = 'DRAFT'
   where trigger = 'BOOKING_CONFIRMATION'
     and status = 'ACTIVE'
     and id <> v_template_id;

  update public.email_templates
     set status = 'ACTIVE', current_version = v_next
   where id = v_template_id;

  raise notice 'BOOKING_CONFIRMATION is now ACTIVE at version %', v_next;
end $$;

-- Verify.
select t.trigger, t.status, t.current_version, v.subject
  from public.email_templates t
  join public.email_template_versions v
    on v.template_id = t.id and v.version = t.current_version
 where t.trigger = 'BOOKING_CONFIRMATION';
