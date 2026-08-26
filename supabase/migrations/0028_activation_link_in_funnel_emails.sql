-- ============================================================================
-- 0028 — Put the activation link in the emails we send ourselves
--
-- Adds one new version to two templates. No schema change, no data deleted,
-- and no existing version is modified — `email_template_versions` is
-- append-only and this respects that.
--
-- ---------------------------------------------------------------------------
-- The defect
-- ---------------------------------------------------------------------------
-- A funnel visitor was supposed to receive TWO emails:
--
--   1. a confirmation from this application, over Hostinger SMTP
--   2. a one-time activation link from Supabase Auth's own mailer
--
-- Only the first ever arrived. Supabase's built-in email service permits two
-- messages an hour; real submissions came back
--
--   429 over_email_send_rate_limit
--
-- and GoTrue rolls the whole request back when the send fails, so the account
-- was not even created. Verified against production: a submission produced a
-- lead row with no matching `auth.users` row and no advance in
-- `confirmation_sent_at`.
--
-- The visitor was therefore left holding email 1, whose copy reads "we have
-- also sent you a secure link" — pointing at an email that does not exist. No
-- link, no password, no way in once the form's session expired.
--
-- ---------------------------------------------------------------------------
-- The fix
-- ---------------------------------------------------------------------------
-- The application now MINTS the link itself (`auth.admin.generateLink`, which
-- returns a URL and sends nothing) and DELIVERS it in the confirmation email
-- it was already sending. One email, one link, over transport that works.
--
-- These two versions carry `{{activation_url}}`. It was already in the closed
-- variable vocabulary, so nothing about the template engine changes.
--
-- ---------------------------------------------------------------------------
-- Why the copy is written the way it is
-- ---------------------------------------------------------------------------
-- The engine renders an unfilled variable as an empty string, and the link CAN
-- legitimately be absent — the mint fails when the service key is missing, and
-- the email still goes out because the lead is already committed. An empty
-- `href` renders as a button that silently does nothing, which is worse than
-- no button.
--
-- So the button is followed by the same URL in plain text and a line telling
-- the reader they can also sign in from the login page. If the link is empty,
-- what remains still reads as a complete, honest message.
--
-- ---------------------------------------------------------------------------
-- Status
-- ---------------------------------------------------------------------------
-- Both templates are ACTIVE already, and status is deliberately not written
-- here. A new version becomes current on save, so an active template picks
-- this up immediately; a draft one stays a draft. This migration cannot switch
-- emailing on for anything that is off.
-- ============================================================================

do $upgrade$
declare
  r             record;
  v_template_id uuid;
  v_next        integer;
begin
  for r in
    select *
      from (values

      -- ===================================================================
      -- IDEA_SUBMITTED — the primary funnel's confirmation
      -- ===================================================================
      ('IDEA_SUBMITTED',
       $q$We have your idea — here is your workspace link$q$,
       $q$<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">
<p>Hello {{user.first_name}}</p>
<p>Thanks for sending your idea over. Here is what we received:</p>
<p style="background:#f5f5f7;border-radius:8px;padding:14px 16px;margin:20px 0"><strong>{{business_idea.title}}</strong><br><span style="color:#666666;font-size:14px">{{business_idea.industry}}</span></p>
<p>Use the link below to open your workspace. It signs you in and asks you to choose a password, so you can come back any time.</p>
<p style="margin:28px 0"><a href="{{activation_url}}" style="background:#5b5bd6;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">Open my workspace and set a password</a></p>
<p style="color:#666666;font-size:14px;word-break:break-all">If the button does not work, paste this into your browser:<br>{{activation_url}}</p>
<p style="color:#666666;font-size:14px">The link can only be used once. If it has expired by the time you get to it, you can request a new one from the login page.</p>
<p>Your validation report will appear in the workspace when it is ready.</p>
<p style="color:#666666;font-size:14px;margin-top:32px">— The AIAutoMix team</p>
</div>$q$,
       $q$Hello {{user.first_name}}

Thanks for sending your idea over. Here is what we received:

{{business_idea.title}}
{{business_idea.industry}}

Use the link below to open your workspace. It signs you in and asks you to choose a password, so you can come back any time.

{{activation_url}}

The link can only be used once. If it has expired by the time you get to it, you can request a new one from the login page.

Your validation report will appear in the workspace when it is ready.

- The AIAutoMix team$q$),

      -- ===================================================================
      -- BOOKING_CONFIRMATION — the strategy session funnel
      -- ===================================================================
      ('BOOKING_CONFIRMATION',
       $q$Your AI strategy session is booked — {{booking.date}}$q$,
       $q$<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">
<p>Hello {{user.first_name}}</p>
<p>Your free AI strategy session is confirmed.</p>
<p style="background:#f5f5f7;border-radius:8px;padding:16px;margin:24px 0"><strong style="font-size:18px">{{booking.date}}</strong><br>{{booking.time}} ({{booking.timezone}})</p>
<p>We have also set up a workspace for you. Open it with the link below — it signs you in and asks you to choose a password.</p>
<p style="margin:28px 0"><a href="{{activation_url}}" style="background:#5b5bd6;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">Open my workspace and set a password</a></p>
<p style="color:#666666;font-size:14px;word-break:break-all">If the button does not work, paste this into your browser:<br>{{activation_url}}</p>
<p>We will send the joining link before the session. If you need to cancel or move it, reply to this email and we will sort it out.</p>
<p>Bring whatever you are stuck on — that is the most useful thing to spend the time on.</p>
<p style="color:#666666;font-size:14px;margin-top:32px">— The AIAutoMix team</p>
</div>$q$,
       $q$Hello {{user.first_name}}

Your free AI strategy session is confirmed.

{{booking.date}} at {{booking.time}} ({{booking.timezone}})

We have also set up a workspace for you. Open it with the link below - it signs you in and asks you to choose a password.

{{activation_url}}

We will send the joining link before the session. If you need to cancel or move it, reply to this email and we will sort it out.

Bring whatever you are stuck on - that is the most useful thing to spend the time on.

- The AIAutoMix team$q$)

      ) as t(trigger, subject, body_html, body_text)
  loop
    select id into v_template_id
      from public.email_templates
     where trigger = r.trigger;

    if v_template_id is null then
      raise notice 'template % not present, skipping', r.trigger;
      continue;
    end if;

    -- Skip if this exact body is already the current version. Makes the
    -- migration re-runnable without stacking identical versions on the
    -- history an admin reads.
    if exists (
      select 1
        from public.email_template_versions v
        join public.email_templates tpl on tpl.id = v.template_id
       where v.template_id = v_template_id
         and v.version = tpl.current_version
         and v.body_html = r.body_html
    ) then
      raise notice 'template % already at this content, skipping', r.trigger;
      continue;
    end if;

    select coalesce(max(version), 0) + 1 into v_next
      from public.email_template_versions
     where template_id = v_template_id;

    insert into public.email_template_versions (
      template_id, version, subject, body_html, body_text, created_by
    ) values (
      v_template_id, v_next, r.subject, r.body_html, r.body_text, null
    );

    update public.email_templates
       set current_version = v_next,
           updated_at      = timezone('utc', now())
     where id = v_template_id;
  end loop;
end
$upgrade$;

-- ============================================================================
-- Verification
--
--   select t.trigger, t.status, t.current_version,
--          position('{{activation_url}}' in v.body_html) > 0 as has_link
--     from public.email_templates t
--     join public.email_template_versions v
--       on v.template_id = t.id and v.version = t.current_version
--    where t.trigger in ('IDEA_SUBMITTED', 'BOOKING_CONFIRMATION');
--
-- Both rows: status ACTIVE, current_version 2, has_link true.
-- ============================================================================
