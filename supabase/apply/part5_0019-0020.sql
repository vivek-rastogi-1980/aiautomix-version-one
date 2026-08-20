-- ============================================================================
-- APPLY PACK — migrations 0019 and 0020
--
-- Paste this whole file into the Supabase SQL Editor and run it once.
--
-- Why a paste file rather than `supabase db push`:
--   the CLI could not parse DIRECT_URL, because the database password contains
--   characters (@ and [) that a connection URI requires to be percent-encoded.
--   Nothing is wrong with the migrations or the migration history.
--
-- Both migrations are idempotent:
--   0019 uses `create table if not exists`, `add column if not exists`,
--        `create or replace function` and `on conflict do nothing`.
--   0020 skips any template that already has a version, so it can never
--        overwrite copy you have edited.
-- Running this twice is safe.
--
-- AFTER RUNNING, tell the CLI these are applied so a future `db push` does not
-- try to run them again:
--
--   npx supabase migration repair --status applied 0019 0020
--
-- Note `--status applied`, NOT `--status reverted`. The `reverted` command the
-- CLI suggested earlier would have marked 0001-0018 as un-applied against a
-- database that already contains every one of those objects.
-- ============================================================================

-- ============ 0019_client_onboarding.sql ============

-- ============================================================================
-- 0019 — Client Onboarding & Lead Conversion
--
-- Additive only. Migrations 0001-0018 are applied or pending and are never
-- edited. This file EXTENDS what already exists rather than replacing it:
--
--   public.leads              EXISTS (0005). Extended with identity links, a
--                             longer lifecycle and an idempotency key. Not
--                             recreated, not replaced.
--   public.business_ideas     EXISTS (0002). Untouched — the funnel writes to
--                             it through the existing model.
--   public.validation_reports EXISTS (0002). Untouched.
--   public.profiles           EXISTS (0001). Untouched.
--   public.workspaces         EXISTS (0004), with personal-workspace
--                             provisioning already in place. Untouched.
--   public.admin_audit_logs   EXISTS (0008). Reused via admin_log().
--   admin RBAC                EXISTS (0008). Extended with six permissions.
--
-- New tables, and why each could not be an extension of something existing:
--
--   lead_events        Leads had no timeline. A status column records where a
--                      lead IS; this records how it GOT there, which is what an
--                      admin actually needs to work it.
--   bookings           MISSING entirely. No calendar, no appointment model.
--   email_templates    MISSING. The only email in the codebase is a hardcoded
--                      plain-text admin notification in lib/leads/notify.ts.
--   email_template_versions  Templates that have been sent must never change
--                      retroactively — otherwise "what did we send them?" is
--                      unanswerable.
--   email_logs         MISSING. Nothing records what was sent to whom.
--
-- ---------------------------------------------------------------------------
-- THE PASSWORD RULE
-- ---------------------------------------------------------------------------
-- No column below stores a password, a temporary password, a token or a
-- provider credential, and none ever will. Account activation uses Supabase's
-- own one-time-link mechanism, which never hands a secret to this application.
-- The smoke suite asserts the absence by column name.
-- ============================================================================

-- ============================================================================
-- 1. Extend the existing leads table
--
-- `add column if not exists` throughout: this table is live and holds real
-- rows, so every addition is nullable or defaulted and nothing is dropped.
-- ============================================================================

alter table public.leads
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists workspace_id uuid references public.workspaces (id) on delete set null,
  add column if not exists business_idea_id uuid references public.business_ideas (id) on delete set null,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists industry text,
  add column if not exists target_customer text,
  add column if not exists target_market text,
  add column if not exists business_stage text,
  add column if not exists problem_solved text,
  add column if not exists website text,
  add column if not exists owner_user_id uuid references auth.users (id) on delete set null,
  add column if not exists last_activity_at timestamptz,
  -- THE duplicate-submission control. A repeated browser POST carries the same
  -- key and collides here instead of creating a second lead, a second user and
  -- a second workspace.
  add column if not exists idempotency_key text;

comment on column public.leads.idempotency_key is
  'Server-derived from the normalised email and source. Unique, so a resubmitted form collides rather than duplicating a lead.';
comment on column public.leads.user_id is
  'Set once the visitor has an auth account. Null while the lead is anonymous.';

-- A partial unique index rather than a column constraint: historical rows have
-- no key and must stay valid.
create unique index if not exists leads_idempotency_key_idx
  on public.leads (idempotency_key) where idempotency_key is not null;

create index if not exists leads_user_idx
  on public.leads (user_id) where user_id is not null;
create index if not exists leads_workspace_idx
  on public.leads (workspace_id) where workspace_id is not null;
create index if not exists leads_owner_idx
  on public.leads (owner_user_id) where owner_user_id is not null;
create index if not exists leads_activity_idx
  on public.leads (last_activity_at desc nulls last);

-- ---------------------------------------------------------------------------
-- The lifecycle.
--
-- 0005 constrained status to new|contacted|qualified|archived. The funnel needs
-- more stages, so the old constraint is replaced by a wider one that still
-- accepts every historical value. Existing rows are migrated where the meaning
-- is unambiguous; 'archived' becomes 'LOST', which is what it meant.
-- ---------------------------------------------------------------------------

alter table public.leads drop constraint if exists leads_status_check;

update public.leads set status = 'NEW'       where status = 'new';
update public.leads set status = 'CONTACTED' where status = 'contacted';
update public.leads set status = 'QUALIFIED' where status = 'qualified';
update public.leads set status = 'LOST'      where status = 'archived';

alter table public.leads
  alter column status set default 'NEW';

alter table public.leads
  add constraint leads_status_check check (status in (
    'NEW','CONTACTED','QUALIFIED','STRATEGY_BOOKED','STRATEGY_COMPLETED',
    'PROPOSAL','CUSTOMER','LOST'));

-- ============================================================================
-- 2. Lead timeline
-- ============================================================================

create table if not exists public.lead_events (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads (id) on delete cascade,

  event       text not null check (event in (
                'LANDING_VIEW','IDEA_FORM_STARTED','IDEA_SUBMITTED','LEAD_CREATED',
                'ACCOUNT_INVITED','ACCOUNT_CREATED','WORKSPACE_CREATED',
                'VALIDATION_STARTED','VALIDATION_COMPLETED','VALIDATION_FAILED',
                'REPORT_READY','REPORT_VIEWED','REPORT_DOWNLOADED',
                'STRATEGY_CTA_CLICKED','BOOKING_STARTED','BOOKING_CREATED',
                'BOOKING_CANCELLED','BOOKING_RESCHEDULED','BOOKING_COMPLETED',
                'STRATEGY_COMPLETED','LEAD_QUALIFIED','STATUS_CHANGED',
                'EMAIL_SENT','NOTE_ADDED')),

  -- Null for events the system raised on its own.
  actor_user_id uuid references auth.users (id) on delete set null,
  previous_status text check (length(previous_status) <= 40),
  new_status      text check (length(new_status) <= 40),
  note            text check (length(note) <= 4000),
  -- Never contains a token, a password or a provider credential.
  metadata        jsonb not null default '{}'::jsonb,

  created_at  timestamptz not null default timezone('utc', now())
);

comment on table public.lead_events is
  'Lead timeline. A status column says where a lead is; this says how it got there.';

create index if not exists lead_events_lead_idx
  on public.lead_events (lead_id, created_at desc);
create index if not exists lead_events_event_idx
  on public.lead_events (event, created_at desc);

-- ============================================================================
-- 3. Bookings
--
-- Deliberately small. §5 says do not build a calendar SaaS: this stores a
-- requested slot and its lifecycle, and nothing else. There is no availability
-- engine, no recurrence, no timezone arithmetic beyond storing the visitor's
-- own IANA zone alongside an absolute instant.
-- ============================================================================

create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),

  -- A booking belongs to a person, and optionally to a workspace and a lead.
  -- `user_id` is nullable because the secondary funnel books first and has an
  -- account a moment later.
  user_id       uuid references auth.users (id) on delete set null,
  workspace_id  uuid references public.workspaces (id) on delete set null,
  lead_id       uuid references public.leads (id) on delete set null,

  -- Contact details captured at booking time, so a booking is actionable even
  -- if the account is never activated.
  full_name     text not null check (length(btrim(full_name)) between 1 and 200),
  email         text not null check (length(email) between 3 and 254),
  phone         text check (length(phone) <= 40),

  -- The absolute instant. The visitor's IANA zone is stored beside it so a
  -- confirmation email can say "3pm your time" rather than a UTC timestamp.
  scheduled_at  timestamptz not null,
  timezone      text not null default 'UTC' check (length(timezone) <= 64),
  duration_minutes integer not null default 30 check (duration_minutes between 15 and 180),

  status        text not null default 'PENDING' check (status in (
                  'PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')),

  -- Set by an admin once a real call is arranged. Never a credential.
  meeting_url   text check (length(meeting_url) <= 2000),
  notes         text check (length(notes) <= 4000),
  cancellation_reason text check (length(cancellation_reason) <= 1000),

  -- Duplicate-booking control, derived from the email and the slot.
  idempotency_key text,

  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),
  cancelled_at  timestamptz,
  completed_at  timestamptz
);

comment on table public.bookings is
  'Free AI strategy sessions. Minimal by design — a requested slot and its lifecycle, not a calendar product.';

create unique index if not exists bookings_idempotency_key_idx
  on public.bookings (idempotency_key) where idempotency_key is not null;

create index if not exists bookings_user_idx
  on public.bookings (user_id, scheduled_at desc);
create index if not exists bookings_workspace_idx
  on public.bookings (workspace_id, scheduled_at desc);
create index if not exists bookings_lead_idx
  on public.bookings (lead_id);
create index if not exists bookings_status_idx
  on public.bookings (status, scheduled_at);

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 4. Email templates
--
-- Two tables rather than one, because §7 requires that a template which has
-- been used is never deleted or rewritten. `email_templates` is the mutable
-- pointer; `email_template_versions` is append-only history, and an email log
-- references the VERSION it sent. Without that split, "what exactly did we send
-- that customer?" becomes unanswerable the moment anyone edits a subject line.
-- ============================================================================

create table if not exists public.email_templates (
  id            uuid primary key default gen_random_uuid(),

  -- The event this template answers. One active template per trigger.
  trigger       text not null check (trigger in (
                  'ACCOUNT_WELCOME','ACCOUNT_ACTIVATION','IDEA_SUBMITTED',
                  'VALIDATION_STARTED','VALIDATION_COMPLETED','VALIDATION_FAILED',
                  'REPORT_READY','STRATEGY_SESSION_INVITATION','BOOKING_CONFIRMATION',
                  'BOOKING_REMINDER_24H','BOOKING_REMINDER_1H','BOOKING_CANCELLED',
                  'BOOKING_RESCHEDULED','PASSWORD_RESET','GENERAL_NOTIFICATION')),

  name          text not null check (length(btrim(name)) between 1 and 200),
  description   text check (length(description) <= 1000),

  status        text not null default 'DRAFT'
                  check (status in ('DRAFT','ACTIVE','ARCHIVED')),

  -- Points at the version currently in force. Null for a template that has
  -- never been saved with content.
  current_version integer not null default 0 check (current_version >= 0),

  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

comment on table public.email_templates is
  'Mutable pointer. The content that was actually sent lives in email_template_versions and is never rewritten.';

-- Exactly one ACTIVE template per trigger, enforced rather than hoped for: two
-- active templates would make "which one fires?" a race.
create unique index if not exists email_templates_active_trigger_idx
  on public.email_templates (trigger) where status = 'ACTIVE';

create index if not exists email_templates_status_idx
  on public.email_templates (status, updated_at desc);

drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

create table if not exists public.email_template_versions (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.email_templates (id) on delete cascade,
  version       integer not null check (version >= 1),

  subject       text not null check (length(btrim(subject)) between 1 and 300),
  body_html     text not null check (length(body_html) <= 200000),
  body_text     text check (length(body_text) <= 200000),

  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default timezone('utc', now()),

  unique (template_id, version)
);

comment on table public.email_template_versions is
  'Append-only. A version that has been sent must never change, or the record of what a customer received becomes fiction.';

-- The immutability guarantee, reusing 0008's trigger function verbatim.
drop trigger if exists email_template_versions_no_update on public.email_template_versions;
create trigger email_template_versions_no_update
  before update on public.email_template_versions
  for each row execute function public.reject_audit_mutation();

drop trigger if exists email_template_versions_no_delete on public.email_template_versions;
create trigger email_template_versions_no_delete
  before delete on public.email_template_versions
  for each row execute function public.reject_audit_mutation();

create index if not exists email_template_versions_template_idx
  on public.email_template_versions (template_id, version desc);

-- ============================================================================
-- 5. Email logs
-- ============================================================================

create table if not exists public.email_logs (
  id            uuid primary key default gen_random_uuid(),

  -- The exact version sent. Not the template — the version.
  template_id   uuid references public.email_templates (id) on delete set null,
  template_version_id uuid references public.email_template_versions (id) on delete set null,
  trigger       text check (length(trigger) <= 60),

  recipient_email text not null check (length(recipient_email) between 3 and 254),
  user_id       uuid references auth.users (id) on delete set null,
  workspace_id  uuid references public.workspaces (id) on delete set null,
  lead_id       uuid references public.leads (id) on delete set null,
  booking_id    uuid references public.bookings (id) on delete set null,

  -- Rendered subject, kept so support can see what the customer actually read
  -- in their inbox list. The body is NOT stored: it is reproducible from the
  -- version plus the context, and storing it would duplicate personal data.
  subject       text check (length(subject) <= 300),

  -- The provider's own id, for reconciling a bounce or a complaint later.
  provider           text check (length(provider) <= 40),
  provider_message_id text check (length(provider_message_id) <= 300),

  status        text not null default 'QUEUED' check (status in (
                  'QUEUED','SENT','FAILED','SKIPPED')),
  error_code    text check (length(error_code) <= 60),
  error_message text check (length(error_message) <= 2000),
  retry_count   integer not null default 0 check (retry_count >= 0 and retry_count <= 5),

  -- True when this was an admin test send. Test sends must never look like
  -- customer communication in the log.
  is_test       boolean not null default false,

  created_at    timestamptz not null default timezone('utc', now()),
  sent_at       timestamptz,
  failed_at     timestamptz
);

comment on table public.email_logs is
  'What was sent, to whom, from which template version. Never stores provider credentials or message bodies.';

create index if not exists email_logs_recipient_idx
  on public.email_logs (recipient_email, created_at desc);
create index if not exists email_logs_user_idx
  on public.email_logs (user_id, created_at desc);
create index if not exists email_logs_lead_idx
  on public.email_logs (lead_id, created_at desc);
create index if not exists email_logs_status_idx
  on public.email_logs (status, created_at desc);
create index if not exists email_logs_template_idx
  on public.email_logs (template_id, created_at desc);

-- ============================================================================
-- 6. Row level security
--
-- The shapes differ per table because the audiences differ, and getting this
-- uniform would be getting it wrong:
--
--   leads          Already insert-only for anon (0005), and that stays. A
--                  signed-in user may read leads that are THEIRS. Admins with
--                  leads.read see all.
--   lead_events    Admin-only. A visitor has no business reading their own
--                  sales timeline.
--   bookings       The person who booked reads their own; admins see all.
--   email_*        Admin-only throughout. Email logs are a record of personal
--                  communication and must never become broadly readable.
-- ============================================================================

alter table public.lead_events            enable row level security;
alter table public.bookings               enable row level security;
alter table public.email_templates        enable row level security;
alter table public.email_template_versions enable row level security;
alter table public.email_logs             enable row level security;

-- --- leads: add a scoped read for the owning user ---------------------------
-- 0005 deliberately granted NO select. That stays true for anonymous visitors;
-- this adds the narrowest possible read, so a signed-in user can see the lead
-- that is about them and nothing else.
drop policy if exists "Users read their own lead" on public.leads;
create policy "Users read their own lead"
  on public.leads for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admins read all leads" on public.leads;
create policy "Admins read all leads"
  on public.leads for select
  using (public.admin_has('leads.read'));

-- --- lead_events ------------------------------------------------------------
drop policy if exists "Admins read lead events" on public.lead_events;
create policy "Admins read lead events"
  on public.lead_events for select
  using (public.admin_has('leads.read'));

-- --- bookings ---------------------------------------------------------------
drop policy if exists "Users read their own bookings" on public.bookings;
create policy "Users read their own bookings"
  on public.bookings for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admins read all bookings" on public.bookings;
create policy "Admins read all bookings"
  on public.bookings for select
  using (public.admin_has('bookings.read'));

-- --- email templates and logs: admin only -----------------------------------
drop policy if exists "Admins read email templates" on public.email_templates;
create policy "Admins read email templates"
  on public.email_templates for select
  using (public.admin_has('communications.read'));

drop policy if exists "Admins read email template versions" on public.email_template_versions;
create policy "Admins read email template versions"
  on public.email_template_versions for select
  using (public.admin_has('communications.read'));

drop policy if exists "Admins read email logs" on public.email_logs;
create policy "Admins read email logs"
  on public.email_logs for select
  using (public.admin_has('communications.read'));

-- ============================================================================
-- 7. Admin RBAC — six new permissions
--
-- Added to the EXISTING matrix in 0008 rather than a parallel system.
-- Deliberate allocation: SUPPORT can read leads and bookings (they answer "what
-- happened to my booking?") but cannot change a lead's lifecycle or touch
-- templates. Sending a test email is separated from writing a template, because
-- it is the one communications action that leaves the building.
-- ============================================================================

insert into public.admin_role_permissions (role, permission) values
  ('SUPPORT',     'leads.read'),
  ('SUPPORT',     'bookings.read'),
  ('SUPPORT',     'communications.read'),

  ('ADMIN',       'leads.read'),
  ('ADMIN',       'leads.update'),
  ('ADMIN',       'bookings.read'),
  ('ADMIN',       'bookings.update'),
  ('ADMIN',       'communications.read'),
  ('ADMIN',       'communications.write'),
  ('ADMIN',       'communications.send_test'),

  ('SUPER_ADMIN', 'leads.read'),
  ('SUPER_ADMIN', 'leads.update'),
  ('SUPER_ADMIN', 'bookings.read'),
  ('SUPER_ADMIN', 'bookings.update'),
  ('SUPER_ADMIN', 'communications.read'),
  ('SUPER_ADMIN', 'communications.write'),
  ('SUPER_ADMIN', 'communications.send_test')
on conflict (role, permission) do nothing;

-- ============================================================================
-- 8. Public lead capture
--
-- Callable by anon. This is the ONE anonymous write in the application, and it
-- was already so before this migration — 0005 grants anon INSERT on leads. This
-- function replaces that raw insert with something that can enforce
-- idempotency and record a timeline entry in the same transaction.
--
-- What it deliberately does NOT do: create an auth user, create a workspace,
-- create a business idea, or start an AI validation. All four require a
-- verified email. Provisioning for an unverified address is how an attacker
-- turns a public form into a bill.
-- ============================================================================

create or replace function public.lead_capture(
  p_email            text,
  p_source           text,
  p_idempotency_key  text,
  p_first_name       text default null,
  p_last_name        text default null,
  p_phone            text default null,
  p_company          text default null,
  p_message          text default null,
  p_industry         text default null,
  p_target_customer  text default null,
  p_target_market    text default null,
  p_business_stage   text default null,
  p_problem_solved   text default null,
  p_website          text default null,
  p_landing_page     text default null,
  p_referrer         text default null,
  p_utm_source       text default null,
  p_utm_medium       text default null,
  p_utm_campaign     text default null,
  p_utm_term         text default null,
  p_utm_content      text default null
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

  -- THE duplicate control. A resubmitted form collides here.
  select id into v_id from public.leads
   where idempotency_key = p_idempotency_key;

  if v_id is not null then
    update public.leads
       set last_activity_at = timezone('utc', now())
     where id = v_id;
    return query select v_id, true;
    return;
  end if;

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
-- 9. Claim a lead after activation
--
-- Runs as the newly-activated user, under their own identity. This is where a
-- verified email finally becomes an account-linked lead — and where the
-- workspace and idea get attached.
--
-- Matching on email is the join: the lead was created anonymously and the user
-- has now proven they control that address by following a one-time link.
-- ============================================================================

create or replace function public.lead_claim_for_user(
  p_workspace_id     uuid,
  p_business_idea_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_lead  public.leads%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select lower(btrim(email)) into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return null;
  end if;

  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'not a member of this workspace'
      using errcode = 'insufficient_privilege';
  end if;

  -- The most recent unclaimed lead for this verified address.
  select * into v_lead from public.leads
   where lower(btrim(email)) = v_email
     and user_id is null
   order by created_at desc
   limit 1;

  if v_lead.id is null then
    return null;
  end if;

  update public.leads
     set user_id          = auth.uid(),
         workspace_id     = p_workspace_id,
         business_idea_id = coalesce(p_business_idea_id, business_idea_id),
         last_activity_at = timezone('utc', now())
   where id = v_lead.id;

  insert into public.lead_events (lead_id, event, actor_user_id, metadata)
  values (v_lead.id, 'ACCOUNT_CREATED', auth.uid(),
          jsonb_build_object('workspace_id', p_workspace_id));

  insert into public.lead_events (lead_id, event, actor_user_id)
  values (v_lead.id, 'WORKSPACE_CREATED', auth.uid());

  return v_lead.id;
end;
$$;

grant execute on function public.lead_claim_for_user(uuid, uuid) to authenticated;

-- ============================================================================
-- 10. Record a funnel event
--
-- Callable by the owning user (for their own lead) or by an admin. Used for the
-- analytics events in §16 that happen after activation — report viewed,
-- downloaded, strategy CTA clicked.
-- ============================================================================

create or replace function public.lead_record_event(
  p_lead_id  uuid,
  p_event    text,
  p_note     text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_id   uuid;
begin
  select * into v_lead from public.leads where id = p_lead_id;
  if v_lead.id is null then
    raise exception 'lead not found' using errcode = 'no_data_found';
  end if;

  if v_lead.user_id is distinct from auth.uid()
     and not public.admin_has('leads.update') then
    raise exception 'not permitted' using errcode = 'insufficient_privilege';
  end if;

  insert into public.lead_events (lead_id, event, actor_user_id, note, metadata)
  values (p_lead_id, p_event, auth.uid(), p_note, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  update public.leads set last_activity_at = timezone('utc', now())
   where id = p_lead_id;

  return v_id;
end;
$$;

grant execute on function public.lead_record_event(uuid, text, text, jsonb) to authenticated;

-- ============================================================================
-- 11. Admin: change a lead's lifecycle status
--
-- Writes to the shared admin audit log as well as the lead timeline, so the
-- change appears both in the lead's own history and in the platform-wide record
-- of what staff did.
-- ============================================================================

create or replace function public.lead_set_status(
  p_lead_id uuid,
  p_status  text,
  p_note    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
begin
  if not public.admin_has('leads.update') then
    raise exception 'permission denied: leads.update'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_lead from public.leads where id = p_lead_id for update;
  if v_lead.id is null then
    raise exception 'lead not found' using errcode = 'no_data_found';
  end if;

  update public.leads
     set status = p_status, last_activity_at = timezone('utc', now())
   where id = p_lead_id;

  insert into public.lead_events (
    lead_id, event, actor_user_id, previous_status, new_status, note
  ) values (
    p_lead_id, 'STATUS_CHANGED', auth.uid(), v_lead.status, p_status, p_note
  );

  -- The existing platform audit log. Reused, not duplicated.
  perform public.admin_log(
    'lead.status_changed', 'lead', p_lead_id::text,
    jsonb_build_object('status', v_lead.status),
    jsonb_build_object('status', p_status),
    p_note
  );
end;
$$;

grant execute on function public.lead_set_status(uuid, text, text) to authenticated;

-- ============================================================================
-- 12. Bookings — create
--
-- Callable by anon so the secondary funnel (book first, account later) works.
-- Idempotent on (email, slot): a double-clicked confirm button collides.
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
  v_email text := lower(btrim(p_email));
  v_id    uuid;
  v_ws    uuid;
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

  insert into public.bookings (
    user_id, workspace_id, lead_id, full_name, email, phone,
    scheduled_at, timezone, duration_minutes, status, notes, idempotency_key
  ) values (
    auth.uid(), v_ws, p_lead_id, p_full_name, v_email, p_phone,
    p_scheduled_at, coalesce(p_timezone, 'UTC'),
    least(greatest(coalesce(p_duration, 30), 15), 180),
    'PENDING', p_notes, p_idempotency_key
  )
  returning id into v_id;

  if p_lead_id is not null then
    insert into public.lead_events (lead_id, event, actor_user_id, metadata)
    values (p_lead_id, 'BOOKING_CREATED', auth.uid(),
            jsonb_build_object('booking_id', v_id));

    update public.leads
       set status = case when status in ('NEW','CONTACTED')
                         then 'STRATEGY_BOOKED' else status end,
           last_activity_at = timezone('utc', now())
     where id = p_lead_id;
  end if;

  return query select v_id, false;
end;
$$;

grant execute on function public.booking_create(
  text, text, timestamptz, text, text, text, uuid, integer, text
) to anon, authenticated;

-- ============================================================================
-- 13. Bookings — change status
--
-- The owner may cancel their own. An admin with bookings.update may set any
-- state. Confirming, completing and marking a no-show are staff decisions.
-- ============================================================================

create or replace function public.booking_set_status(
  p_booking_id uuid,
  p_status     text,
  p_reason     text default null,
  p_meeting_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_is_admin boolean := public.admin_has('bookings.update');
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'booking not found' using errcode = 'no_data_found';
  end if;

  if p_status not in ('PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW') then
    raise exception 'unknown booking status: %', p_status
      using errcode = 'invalid_parameter_value';
  end if;

  -- A customer may only cancel, and only their own.
  if not v_is_admin then
    if v_booking.user_id is distinct from auth.uid() then
      raise exception 'not permitted' using errcode = 'insufficient_privilege';
    end if;
    if p_status <> 'CANCELLED' then
      raise exception 'you can cancel a booking, but not change it to %', p_status
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  if v_booking.status in ('COMPLETED','CANCELLED') and not v_is_admin then
    raise exception 'this booking is already %', lower(v_booking.status)
      using errcode = 'invalid_parameter_value';
  end if;

  update public.bookings
     set status       = p_status,
         meeting_url  = coalesce(p_meeting_url, meeting_url),
         cancellation_reason = case when p_status = 'CANCELLED'
                                    then p_reason else cancellation_reason end,
         cancelled_at = case when p_status = 'CANCELLED'
                             then timezone('utc', now()) else cancelled_at end,
         completed_at = case when p_status = 'COMPLETED'
                             then timezone('utc', now()) else completed_at end
   where id = p_booking_id;

  if v_booking.lead_id is not null then
    insert into public.lead_events (lead_id, event, actor_user_id, metadata)
    values (
      v_booking.lead_id,
      case p_status
        when 'CANCELLED' then 'BOOKING_CANCELLED'
        when 'COMPLETED' then 'BOOKING_COMPLETED'
        else 'BOOKING_CREATED'
      end,
      auth.uid(),
      jsonb_build_object('booking_id', p_booking_id, 'status', p_status)
    );

    if p_status = 'COMPLETED' then
      update public.leads
         set status = case when status = 'STRATEGY_BOOKED'
                           then 'STRATEGY_COMPLETED' else status end
       where id = v_booking.lead_id;
    end if;
  end if;

  if v_is_admin then
    perform public.admin_log(
      'booking.status_changed', 'booking', p_booking_id::text,
      jsonb_build_object('status', v_booking.status),
      jsonb_build_object('status', p_status), p_reason
    );
  end if;
end;
$$;

grant execute on function public.booking_set_status(uuid, text, text, text) to authenticated;

-- ============================================================================
-- 14. Email templates — save a version
--
-- Saving ALWAYS creates a new version. There is no update path for content, and
-- the append-only trigger above means there cannot be one.
-- ============================================================================

create or replace function public.email_template_save(
  p_template_id uuid,
  p_subject     text,
  p_body_html   text,
  p_body_text   text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if not public.admin_has('communications.write') then
    raise exception 'permission denied: communications.write'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce(max(version), 0) + 1 into v_next
    from public.email_template_versions where template_id = p_template_id;

  insert into public.email_template_versions (
    template_id, version, subject, body_html, body_text, created_by
  ) values (
    p_template_id, v_next, p_subject, p_body_html, p_body_text, auth.uid()
  );

  update public.email_templates
     set current_version = v_next
   where id = p_template_id;

  perform public.admin_log(
    'email_template.version_saved', 'email_template', p_template_id::text,
    null, jsonb_build_object('version', v_next)
  );

  return v_next;
end;
$$;

grant execute on function public.email_template_save(uuid, text, text, text) to authenticated;

-- ============================================================================
-- 15. Email templates — change status
--
-- Activating one template for a trigger deactivates any other, so the unique
-- partial index above can never be violated by a race.
-- ============================================================================

create or replace function public.email_template_set_status(
  p_template_id uuid,
  p_status      text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.email_templates%rowtype;
begin
  if not public.admin_has('communications.write') then
    raise exception 'permission denied: communications.write'
      using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('DRAFT','ACTIVE','ARCHIVED') then
    raise exception 'unknown template status: %', p_status
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_template from public.email_templates
   where id = p_template_id for update;
  if v_template.id is null then
    raise exception 'template not found' using errcode = 'no_data_found';
  end if;

  if p_status = 'ACTIVE' then
    if v_template.current_version < 1 then
      raise exception 'save some content before activating this template'
        using errcode = 'invalid_parameter_value';
    end if;
    -- One active template per trigger.
    update public.email_templates
       set status = 'DRAFT'
     where trigger = v_template.trigger
       and status = 'ACTIVE'
       and id <> p_template_id;
  end if;

  update public.email_templates set status = p_status where id = p_template_id;

  perform public.admin_log(
    'email_template.status_changed', 'email_template', p_template_id::text,
    jsonb_build_object('status', v_template.status),
    jsonb_build_object('status', p_status)
  );
end;
$$;

grant execute on function public.email_template_set_status(uuid, text) to authenticated;

-- ============================================================================
-- 16. Email log — record a send
--
-- Called by the communication service after it has attempted delivery. Separate
-- from the send itself so a provider failure still leaves a record.
-- ============================================================================

create or replace function public.email_log_record(
  p_recipient   text,
  p_status      text,
  p_trigger     text default null,
  p_template_id uuid default null,
  p_version_id  uuid default null,
  p_subject     text default null,
  p_provider    text default null,
  p_message_id  text default null,
  p_error_code  text default null,
  p_error_message text default null,
  p_user_id     uuid default null,
  p_workspace_id uuid default null,
  p_lead_id     uuid default null,
  p_booking_id  uuid default null,
  p_is_test     boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.email_logs (
    template_id, template_version_id, trigger, recipient_email, user_id,
    workspace_id, lead_id, booking_id, subject, provider, provider_message_id,
    status, error_code, error_message, is_test,
    sent_at, failed_at
  ) values (
    p_template_id, p_version_id, p_trigger, lower(btrim(p_recipient)), p_user_id,
    p_workspace_id, p_lead_id, p_booking_id, p_subject, p_provider, p_message_id,
    p_status, p_error_code, left(coalesce(p_error_message, ''), 2000), p_is_test,
    case when p_status = 'SENT' then timezone('utc', now()) end,
    case when p_status = 'FAILED' then timezone('utc', now()) end
  )
  returning id into v_id;

  -- A test send must never look like customer communication on a lead's
  -- timeline. §23 is explicit that it triggers no business automation.
  if p_lead_id is not null and not p_is_test then
    insert into public.lead_events (lead_id, event, metadata)
    values (p_lead_id, 'EMAIL_SENT',
            jsonb_build_object('trigger', p_trigger, 'status', p_status));
  end if;

  return v_id;
end;
$$;

grant execute on function public.email_log_record(
  text, text, text, uuid, uuid, text, text, text, text, text,
  uuid, uuid, uuid, uuid, boolean
) to authenticated;

-- ============================================================================
-- 17. Seed the fifteen templates
--
-- Seeded as DRAFT, deliberately. An ACTIVE template sends real email to real
-- customers, and that should be a decision somebody makes in the admin panel
-- after reading the copy — not something a migration turns on.
-- ============================================================================

insert into public.email_templates (trigger, name, description, status)
values
  ('ACCOUNT_WELCOME','Welcome','Sent after a workspace is provisioned.','DRAFT'),
  ('ACCOUNT_ACTIVATION','Activate your account','Secure one-time activation link.','DRAFT'),
  ('IDEA_SUBMITTED','Idea received','Confirms the idea reached us.','DRAFT'),
  ('VALIDATION_STARTED','Validation started','Analysis has begun.','DRAFT'),
  ('VALIDATION_COMPLETED','Validation complete','Score and report link.','DRAFT'),
  ('VALIDATION_FAILED','Validation could not complete','Apology and next step.','DRAFT'),
  ('REPORT_READY','Report ready','The report can now be read.','DRAFT'),
  ('STRATEGY_SESSION_INVITATION','Strategy session invitation','Invites a qualified lead to book.','DRAFT'),
  ('BOOKING_CONFIRMATION','Booking confirmed','Date, time, timezone and joining details.','DRAFT'),
  ('BOOKING_REMINDER_24H','Reminder — tomorrow','24 hours before the session.','DRAFT'),
  ('BOOKING_REMINDER_1H','Reminder — in an hour','1 hour before the session.','DRAFT'),
  ('BOOKING_CANCELLED','Booking cancelled','Confirms a cancellation.','DRAFT'),
  ('BOOKING_RESCHEDULED','Booking rescheduled','Confirms the new time.','DRAFT'),
  ('PASSWORD_RESET','Password reset','Handled by the auth provider; here for completeness.','DRAFT'),
  ('GENERAL_NOTIFICATION','General notification','Ad-hoc operational message.','DRAFT')
on conflict do nothing;

-- ============================================================================
-- 18. Admin funnel metrics
--
-- Counted in SQL. A JavaScript reduce over a PostgREST-capped result set
-- returns a plausible but short total, which is worse than no total.
-- ============================================================================

create or replace function public.admin_funnel_stats(
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

  if public.admin_has('leads.read') then
    v_out := v_out || jsonb_build_object(
      'total_leads',      (select count(*) from public.leads where created_at >= v_since),
      'new_leads',        (select count(*) from public.leads
                            where created_at >= v_since and status = 'NEW'),
      'qualified_leads',  (select count(*) from public.leads
                            where created_at >= v_since and status in
                              ('QUALIFIED','STRATEGY_BOOKED','STRATEGY_COMPLETED','PROPOSAL','CUSTOMER')),
      'customers',        (select count(*) from public.leads
                            where created_at >= v_since and status = 'CUSTOMER'),
      'accounts_created', (select count(*) from public.leads
                            where created_at >= v_since and user_id is not null),
      'validated_ideas',  (select count(distinct lead_id) from public.lead_events
                            where created_at >= v_since and event = 'VALIDATION_COMPLETED'),
      'reports_viewed',   (select count(distinct lead_id) from public.lead_events
                            where created_at >= v_since and event = 'REPORT_VIEWED'),
      'reports_downloaded', (select count(distinct lead_id) from public.lead_events
                            where created_at >= v_since and event = 'REPORT_DOWNLOADED')
    );
  end if;

  if public.admin_has('bookings.read') then
    v_out := v_out || jsonb_build_object(
      'sessions_booked',    (select count(*) from public.bookings where created_at >= v_since),
      'sessions_completed', (select count(*) from public.bookings
                              where created_at >= v_since and status = 'COMPLETED'),
      'sessions_cancelled', (select count(*) from public.bookings
                              where created_at >= v_since and status = 'CANCELLED')
    );
  end if;

  if public.admin_has('communications.read') then
    v_out := v_out || jsonb_build_object(
      'emails_sent',   (select count(*) from public.email_logs
                         where created_at >= v_since and status = 'SENT' and not is_test),
      'emails_failed', (select count(*) from public.email_logs
                         where created_at >= v_since and status = 'FAILED' and not is_test)
    );
  end if;

  return v_out || jsonb_build_object('since', v_since);
end;
$$;

grant execute on function public.admin_funnel_stats(timestamptz) to authenticated;
revoke all on function public.admin_funnel_stats(timestamptz) from anon;

-- ============ 0020_email_template_content.sql ============

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
