-- ============================================================================
-- 0020 — Email template content
--
-- Additive only. 0019 is applied and is never edited.
--
-- ---------------------------------------------------------------------------
-- Why this migration exists
-- ---------------------------------------------------------------------------
-- 0019 seeded fifteen template ROWS with `status = 'DRAFT'` and
-- `current_version = 0` — a name and a description, and no content at all.
--
-- That combination means no email is ever sent, and the reason is invisible:
--
--   `loadActiveTemplate()` looks for status = 'ACTIVE'    → finds nothing
--   every send logs SKIPPED / NO_ACTIVE_TEMPLATE          → nothing delivered
--   `email_template_set_status` refuses to activate a
--   template with `current_version < 1`                   → cannot be fixed
--                                                            in the UI without
--                                                            first hand-writing
--                                                            HTML for each one
--
-- So a correctly configured mail server still sends nothing, and the admin
-- panel offers no way out that does not begin with "write fifteen emails".
-- Seeding a row without content did not create a template; it created a
-- placeholder that looks like one.
--
-- This migration writes version 1 for the twelve templates the application can
-- actually use. It activates nothing — see below.
--
-- ---------------------------------------------------------------------------
-- What is deliberately NOT seeded
-- ---------------------------------------------------------------------------
--   ACCOUNT_ACTIVATION   Sent by Supabase Auth as a one-time link. Content here
--   PASSWORD_RESET       has no effect, so filling it in would imply an edit
--                        that does nothing. Change these in the Supabase email
--                        settings instead.
--   BOOKING_RESCHEDULED  Rescheduling is not implemented — a customer cancels
--                        and books again. Copy for a flow that does not exist
--                        is the pretence the wiring column exists to prevent.
--
-- ---------------------------------------------------------------------------
-- Everything is seeded as DRAFT. Nothing here starts sending.
-- ---------------------------------------------------------------------------
-- A migration must not begin emailing customers. This copy is a sensible
-- default written by whoever built the feature, not something the business has
-- read and approved — and the moment a template goes ACTIVE it starts arriving
-- in real inboxes under the company name.
--
-- So the blocker this migration removes is the one that could not be removed
-- from the UI: with `current_version = 0`, `email_template_set_status` REFUSES
-- to activate, so an admin could not turn a template on no matter how many
-- times they clicked. Now the content exists, and activating is one click in
-- Admin -> Communications after reading the preview.
--
-- Recommended to activate first — the messages whose absence a customer would
-- report as a bug:
--   ACCOUNT_WELCOME, IDEA_SUBMITTED, VALIDATION_COMPLETED, VALIDATION_FAILED,
--   BOOKING_CONFIRMATION, BOOKING_CANCELLED
--
-- Recommended to leave off, and why:
--   VALIDATION_STARTED   Every validation would send one. Users who validate
--                        several ideas in a sitting get a burst of mail that
--                        tells them nothing they did not just do on screen.
--   REPORT_READY         Raised in the same breath as VALIDATION_COMPLETED, so
--                        activating both sends two emails for one event. Pick
--                        one. Completion is the better default because it
--                        carries the score.
--   Reminders            Need a scheduler. Nothing runs on a timer, so these
--                        never fire regardless of status.
--   STRATEGY_SESSION_INVITATION, GENERAL_NOTIFICATION
--                        No automatic caller by design — these are for an
--                        operator to send deliberately.
--
-- ---------------------------------------------------------------------------
-- Safe to re-run
-- ---------------------------------------------------------------------------
-- A template that already has ANY version is skipped entirely, so this can
-- never overwrite copy somebody has edited. Status is never written at all, so
-- re-running cannot switch anything on, off, or back from archived.
--
-- ---------------------------------------------------------------------------
-- On the markup
-- ---------------------------------------------------------------------------
-- Inline styles only, no <style> block, no images, no external CSS. Gmail
-- strips <style>, Outlook ignores most of it, and an image that does not load
-- leaves a hole where the message was. What survives everywhere is a narrow
-- column of styled paragraphs, so that is what these are.
--
-- Copy is written to degrade gracefully when a variable is empty: the engine
-- renders a missing value as blank, so "Hello {{user.first_name}}" reads fine
-- with no name while "Hello {{user.first_name}}," would arrive as "Hello ,".
-- ============================================================================

do $seed$
declare
  r               record;
  v_template_id   uuid;
begin
  for r in
    select *
      from (values

      -- ===================================================================
      -- ACCOUNT_WELCOME — after activation, workspace provisioned
      -- ===================================================================
      ('ACCOUNT_WELCOME',
       $q$Your AIAutoMix workspace is ready$q$,
       $q$<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">
<p>Hello {{user.first_name}}</p>
<p>Your workspace is set up and ready to use. Everything you create — validations, reports, plans — lives here.</p>
<p style="margin:28px 0"><a href="{{dashboard_url}}" style="background:#5b5bd6;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">Open my dashboard</a></p>
<p>If you submitted a business idea, you will hear from us again as soon as the analysis is finished.</p>
<p style="color:#666666;font-size:14px;margin-top:32px">— The AIAutoMix team</p>
</div>$q$,
       $q$Hello {{user.first_name}}

Your workspace is set up and ready to use. Everything you create - validations, reports, plans - lives here.

Open your dashboard: {{dashboard_url}}

If you submitted a business idea, you will hear from us again as soon as the analysis is finished.

- The AIAutoMix team$q$,
       'DRAFT'),  -- recommended: activate

      -- ===================================================================
      -- IDEA_SUBMITTED — public idea form
      -- ===================================================================
      ('IDEA_SUBMITTED',
       $q$We have your idea — analysis has started$q$,
       $q$<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">
<p>Hello {{user.first_name}}</p>
<p>Thanks for sending your idea over. Here is what we received:</p>
<p style="background:#f5f5f7;border-radius:8px;padding:14px 16px;margin:20px 0"><strong>{{business_idea.title}}</strong><br><span style="color:#666666;font-size:14px">{{business_idea.industry}}</span></p>
<p>We have also sent you a secure link to open your workspace — no password needed. Your validation report will appear there when it is ready.</p>
<p style="color:#666666;font-size:14px;margin-top:32px">— The AIAutoMix team</p>
</div>$q$,
       $q$Hello {{user.first_name}}

Thanks for sending your idea over. Here is what we received:

{{business_idea.title}}
{{business_idea.industry}}

We have also sent you a secure link to open your workspace - no password needed. Your validation report will appear there when it is ready.

- The AIAutoMix team$q$,
       'DRAFT'),  -- recommended: activate

      -- ===================================================================
      -- VALIDATION_STARTED — do not activate alongside the others (see above)
      -- ===================================================================
      ('VALIDATION_STARTED',
       $q$We have started analysing {{business_idea.title}}$q$,
       $q$<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">
<p>Hello {{user.first_name}}</p>
<p>Analysis of <strong>{{business_idea.title}}</strong> is under way. This usually takes a few minutes.</p>
<p>We will email you the moment the report is ready — there is no need to wait on the page.</p>
<p style="color:#666666;font-size:14px;margin-top:32px">— The AIAutoMix team</p>
</div>$q$,
       $q$Hello {{user.first_name}}

Analysis of {{business_idea.title}} is under way. This usually takes a few minutes.

We will email you the moment the report is ready - there is no need to wait on the page.

- The AIAutoMix team$q$,
       'DRAFT'),

      -- ===================================================================
      -- VALIDATION_COMPLETED — the payoff message
      -- ===================================================================
      ('VALIDATION_COMPLETED',
       $q$Your validation report is ready — {{validation.score}}/100$q$,
       $q$<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">
<p>Hello {{user.first_name}}</p>
<p>We have finished analysing <strong>{{business_idea.title}}</strong>.</p>
<p style="background:#f5f5f7;border-radius:8px;padding:20px;margin:24px 0;text-align:center"><span style="font-size:40px;font-weight:700;color:#5b5bd6">{{validation.score}}</span><span style="font-size:20px;color:#666666">/100</span></p>
<p>The full report explains the score: market, competition, risks and the specific things worth doing next.</p>
<p style="margin:28px 0"><a href="{{validation.report_url}}" style="background:#5b5bd6;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">Read my report</a></p>
<p>Want to talk it through? A free AI strategy session is the fastest way to turn the report into a plan — you can book one from your dashboard.</p>
<p style="color:#666666;font-size:14px;margin-top:32px">— The AIAutoMix team</p>
</div>$q$,
       $q$Hello {{user.first_name}}

We have finished analysing {{business_idea.title}}.

Your score: {{validation.score}}/100

The full report explains the score: market, competition, risks and the specific things worth doing next.

Read your report: {{validation.report_url}}

Want to talk it through? A free AI strategy session is the fastest way to turn the report into a plan - you can book one from your dashboard: {{dashboard_url}}

- The AIAutoMix team$q$,
       'DRAFT'),  -- recommended: activate

      -- ===================================================================
      -- VALIDATION_FAILED — an apology beats silence
      -- ===================================================================
      ('VALIDATION_FAILED',
       $q$We could not finish analysing your idea$q$,
       $q$<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">
<p>Hello {{user.first_name}}</p>
<p>Something went wrong while we were analysing <strong>{{business_idea.title}}</strong>, and the report did not complete.</p>
<p>This is on us, not on anything you did. Your idea is saved and you can run the validation again from your dashboard whenever you like.</p>
<p style="margin:28px 0"><a href="{{dashboard_url}}" style="background:#5b5bd6;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">Try again</a></p>
<p>If it fails a second time, reply to this email and a person will look at it.</p>
<p style="color:#666666;font-size:14px;margin-top:32px">— The AIAutoMix team</p>
</div>$q$,
       $q$Hello {{user.first_name}}

Something went wrong while we were analysing {{business_idea.title}}, and the report did not complete.

This is on us, not on anything you did. Your idea is saved and you can run the validation again from your dashboard whenever you like: {{dashboard_url}}

If it fails a second time, reply to this email and a person will look at it.

- The AIAutoMix team$q$,
       'DRAFT'),  -- recommended: activate

      -- ===================================================================
      -- REPORT_READY — do not activate with VALIDATION_COMPLETED: same event,
      -- so both active means two emails for one thing that happened.
      -- ===================================================================
      ('REPORT_READY',
       $q$Your report on {{business_idea.title}} is ready$q$,
       $q$<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">
<p>Hello {{user.first_name}}</p>
<p>Your report on <strong>{{business_idea.title}}</strong> can now be read, and downloaded as a PDF.</p>
<p style="margin:28px 0"><a href="{{validation.report_url}}" style="background:#5b5bd6;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">Read my report</a></p>
<p style="color:#666666;font-size:14px;margin-top:32px">— The AIAutoMix team</p>
</div>$q$,
       $q$Hello {{user.first_name}}

Your report on {{business_idea.title}} can now be read, and downloaded as a PDF.

Read it here: {{validation.report_url}}

- The AIAutoMix team$q$,
       'DRAFT'),

      -- ===================================================================
      -- STRATEGY_SESSION_INVITATION — operator sends this deliberately
      -- ===================================================================
      ('STRATEGY_SESSION_INVITATION',
       $q$Fancy a free AI strategy session?$q$,
       $q$<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">
<p>Hello {{user.first_name}}</p>
<p>We have been looking at what you are building, and we think a short conversation would be genuinely useful.</p>
<p>The session is free and lasts about 30 minutes. No pitch — we go through where the opportunity actually is and what we would do first.</p>
<p style="margin:28px 0"><a href="{{dashboard_url}}" style="background:#5b5bd6;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">Book my session</a></p>
<p style="color:#666666;font-size:14px;margin-top:32px">— The AIAutoMix team</p>
</div>$q$,
       $q$Hello {{user.first_name}}

We have been looking at what you are building, and we think a short conversation would be genuinely useful.

The session is free and lasts about 30 minutes. No pitch - we go through where the opportunity actually is and what we would do first.

Book here: {{dashboard_url}}

- The AIAutoMix team$q$,
       'DRAFT'),

      -- ===================================================================
      -- BOOKING_CONFIRMATION
      -- ===================================================================
      ('BOOKING_CONFIRMATION',
       $q$Your AI strategy session is booked — {{booking.date}}$q$,
       $q$<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">
<p>Hello {{user.first_name}}</p>
<p>Your free AI strategy session is confirmed.</p>
<p style="background:#f5f5f7;border-radius:8px;padding:16px;margin:24px 0"><strong style="font-size:18px">{{booking.date}}</strong><br>{{booking.time}} ({{booking.timezone}})</p>
<p>We will send the joining link before the session. If you need to cancel or move it, reply to this email and we will sort it out.</p>
<p>Bring whatever you are stuck on — that is the most useful thing to spend the time on.</p>
<p style="color:#666666;font-size:14px;margin-top:32px">— The AIAutoMix team</p>
</div>$q$,
       $q$Hello {{user.first_name}}

Your free AI strategy session is confirmed.

{{booking.date}} at {{booking.time}} ({{booking.timezone}})

We will send the joining link before the session. If you need to cancel or move it, reply to this email and we will sort it out.

Bring whatever you are stuck on - that is the most useful thing to spend the time on.

- The AIAutoMix team$q$,
       'DRAFT'),  -- recommended: activate

      -- ===================================================================
      -- BOOKING_REMINDER_24H / _1H — seeded; nothing runs on a timer
      -- ===================================================================
      ('BOOKING_REMINDER_24H',
       $q$Tomorrow: your AI strategy session at {{booking.time}}$q$,
       $q$<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">
<p>Hello {{user.first_name}}</p>
<p>A reminder that your AI strategy session is tomorrow.</p>
<p style="background:#f5f5f7;border-radius:8px;padding:16px;margin:24px 0"><strong style="font-size:18px">{{booking.date}}</strong><br>{{booking.time}} ({{booking.timezone}})</p>
<p>If tomorrow no longer works, reply and we will move it.</p>
<p style="color:#666666;font-size:14px;margin-top:32px">— The AIAutoMix team</p>
</div>$q$,
       $q$Hello {{user.first_name}}

A reminder that your AI strategy session is tomorrow.

{{booking.date}} at {{booking.time}} ({{booking.timezone}})

If tomorrow no longer works, reply and we will move it.

- The AIAutoMix team$q$,
       'DRAFT'),

      ('BOOKING_REMINDER_1H',
       $q$Starting in an hour: your AI strategy session$q$,
       $q$<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">
<p>Hello {{user.first_name}}</p>
<p>Your AI strategy session starts in about an hour, at {{booking.time}} ({{booking.timezone}}).</p>
<p style="margin:28px 0"><a href="{{booking.meeting_url}}" style="background:#5b5bd6;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">Join the session</a></p>
<p style="color:#666666;font-size:14px;margin-top:32px">— The AIAutoMix team</p>
</div>$q$,
       $q$Hello {{user.first_name}}

Your AI strategy session starts in about an hour, at {{booking.time}} ({{booking.timezone}}).

Join here: {{booking.meeting_url}}

- The AIAutoMix team$q$,
       'DRAFT'),

      -- ===================================================================
      -- BOOKING_CANCELLED
      -- ===================================================================
      ('BOOKING_CANCELLED',
       $q$Your AI strategy session on {{booking.date}} has been cancelled$q$,
       $q$<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">
<p>Hello {{user.first_name}}</p>
<p>Your AI strategy session on <strong>{{booking.date}}</strong> at {{booking.time}} ({{booking.timezone}}) has been cancelled.</p>
<p>Nothing else has changed — your workspace and any reports are exactly as you left them.</p>
<p style="margin:28px 0"><a href="{{dashboard_url}}" style="background:#5b5bd6;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">Book another time</a></p>
<p style="color:#666666;font-size:14px;margin-top:32px">— The AIAutoMix team</p>
</div>$q$,
       $q$Hello {{user.first_name}}

Your AI strategy session on {{booking.date}} at {{booking.time}} ({{booking.timezone}}) has been cancelled.

Nothing else has changed - your workspace and any reports are exactly as you left them.

Book another time: {{dashboard_url}}

- The AIAutoMix team$q$,
       'DRAFT'),  -- recommended: activate

      -- ===================================================================
      -- GENERAL_NOTIFICATION — ad-hoc, operator sends it
      -- ===================================================================
      ('GENERAL_NOTIFICATION',
       $q$A message from AIAutoMix$q$,
       $q$<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:8px">
<p>Hello {{user.first_name}}</p>
<p>Replace this paragraph with whatever the message needs to say. It is a general-purpose template for one-off operational notes.</p>
<p style="margin:28px 0"><a href="{{dashboard_url}}" style="background:#5b5bd6;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">Open my dashboard</a></p>
<p style="color:#666666;font-size:14px;margin-top:32px">— The AIAutoMix team</p>
</div>$q$,
       $q$Hello {{user.first_name}}

Replace this paragraph with whatever the message needs to say. It is a general-purpose template for one-off operational notes.

Open your dashboard: {{dashboard_url}}

- The AIAutoMix team$q$,
       'DRAFT')

      ) as t(trigger_name, subject, body_html, body_text, recommended_status)
  loop
    select id into v_template_id
      from public.email_templates
     where trigger = r.trigger_name;

    -- 0019 was not applied, or this trigger is not seeded. Skip rather than
    -- fail: a missing row is not a reason to abort the whole migration.
    if v_template_id is null then
      continue;
    end if;

    -- Never overwrite work. If ANY version exists, somebody has been in here
    -- and their copy wins over this default.
    if exists (
      select 1 from public.email_template_versions
       where template_id = v_template_id
    ) then
      continue;
    end if;

    insert into public.email_template_versions (
      template_id, version, subject, body_html, body_text
    ) values (
      v_template_id, 1, r.subject, r.body_html, r.body_text
    );

    -- `status` is deliberately absent from this UPDATE. Content is a migration
    -- concern; deciding to start emailing customers is a human one, made in
    -- Admin -> Communications after reading the preview.
    update public.email_templates
       set current_version = 1
     where id = v_template_id;
  end loop;
end
$seed$;

-- ============================================================================
-- Verification
--
-- After applying, twelve templates should read DRAFT with current_version = 1:
--
--   select trigger, status, current_version
--     from public.email_templates
--    order by current_version desc, trigger;
--
-- `current_version = 1` is the part that matters — that is what makes the
-- Activate button work. If every row still reads 0, migration 0019 has not been
-- applied to this database and the loop above found nothing to update.
--
-- Then activate the six recommended above from Admin -> Communications, after
-- reading each preview.
-- ============================================================================
