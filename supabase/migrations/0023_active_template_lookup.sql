-- ============================================================================
-- 0023 — let the send path resolve its own template
--
-- Adds one `security definer` reader. No table, column or policy changes.
--
-- ---------------------------------------------------------------------------
-- The defect
-- ---------------------------------------------------------------------------
-- `email_templates` and `email_template_versions` are admin-read-only: the only
-- SELECT policies 0019 created require `admin_has('communications.read')`.
-- That is correct for the admin panel — a customer has no business reading the
-- template library.
--
-- But the communication service runs under the CALLER's session, and the caller
-- is usually not an admin. A public idea submission runs as `anon`; a customer
-- finishing a validation runs as themselves. Neither can read
-- `email_templates`, so `loadActiveTemplate()` got no row back and every send
-- resolved as:
--
--   status = SKIPPED, error_code = NO_ACTIVE_TEMPLATE
--
-- ...even with a template genuinely ACTIVE. The failure was invisible in the
-- most damaging way: the log said "we deliberately did not send", which is
-- exactly what a correctly-configured system with no active template says. It
-- was only found by running the real funnel end to end and reading the row.
--
-- ---------------------------------------------------------------------------
-- Why a function rather than a broader policy
-- ---------------------------------------------------------------------------
-- Adding "anyone may select from email_templates" would fix the send and also
-- publish every DRAFT and ARCHIVED template, including copy nobody has approved
-- and internal descriptions.
--
-- This exposes strictly less: given a trigger, it returns the ACTIVE version's
-- subject and body and nothing else. No drafts, no archived versions, no
-- template list, no authorship, no timestamps. A caller who asks for a trigger
-- with no active template gets no rows — the same answer they get today.
--
-- The content it returns is, by definition, text the business has chosen to
-- send to customers, so returning it to the process that is about to send it
-- discloses nothing new.
-- ============================================================================

create or replace function public.email_active_template(p_trigger text)
returns table (
  template_id uuid,
  version_id  uuid,
  version     integer,
  subject     text,
  body_html   text,
  body_text   text
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, v.id, v.version, v.subject, v.body_html, v.body_text
    from public.email_templates t
    join public.email_template_versions v
      on v.template_id = t.id
     and v.version = t.current_version
   where t.trigger = p_trigger
     and t.status = 'ACTIVE'
     and t.current_version >= 1
   limit 1;
$$;

comment on function public.email_active_template(text) is
  'Resolves the ACTIVE template for a trigger for the send path. Security definer because email_templates is admin-read-only and the sender is usually anon or a customer. Returns nothing for drafts or archived templates.';

-- anon included deliberately: the public idea and booking forms send mail
-- before an account exists.
grant execute on function public.email_active_template(text) to anon, authenticated;

-- ============================================================================
-- Verification
--
--   select trigger from public.email_templates where status = 'ACTIVE';
--   select subject from public.email_active_template('IDEA_SUBMITTED');
--
-- The second should return the active subject; a DRAFT trigger returns 0 rows.
-- ============================================================================
