-- ============================================================================
-- 0021 — Missing foreign-key indexes for the onboarding schema
--
-- Additive only. Creates indexes and nothing else: no tables, no columns, no
-- policies, no functions. Safe to re-run.
--
-- ---------------------------------------------------------------------------
-- Why this is separate from 0019
-- ---------------------------------------------------------------------------
-- 0019 is committed and is the migration being applied to production. Editing
-- it to slip these in would mean the SQL reviewed and the SQL applied are not
-- the same file. A follow-up migration keeps that honest.
--
-- ---------------------------------------------------------------------------
-- Why these and not every foreign key
-- ---------------------------------------------------------------------------
-- Postgres does NOT index a foreign key automatically. An unindexed FK costs
-- twice: a sequential scan of the child table whenever a parent row is deleted
-- or updated (to enforce the referential action), and a slow lookup for any
-- query filtering on it.
--
-- But an index is not free either — it is paid for on every insert and update,
-- and `email_logs` is the highest-write table in this schema. So each FK below
-- was judged individually rather than indexed reflexively.
--
-- INDEXED — a parent delete triggers a scan of a table that grows:
--
--   leads.business_idea_id      Deleting a business idea scans every lead to
--                               apply `on delete set null`. `leads` grows with
--                               every visitor, forever.
--   email_logs.workspace_id     Deleting a workspace scans the whole delivery
--                               log. Also the natural filter for "what did we
--                               send this customer?".
--   email_logs.booking_id       Deleting a booking scans the same table, and
--                               support genuinely asks "what went out for this
--                               session?".
--   lead_events.actor_user_id   Deleting a user scans the timeline table,
--                               which accumulates a row per funnel step per
--                               lead — the fastest-growing table here.
--
-- DELIBERATELY NOT INDEXED, with the reason recorded so nobody re-litigates it:
--
--   email_logs.template_version_id
--       `email_template_versions` has a BEFORE DELETE trigger that rejects
--       every delete, for every role, including one that bypasses RLS. A
--       parent row can therefore never be removed, so the scan this index
--       would prevent cannot occur. The remaining case — "which sends used
--       version 3?" — is a rare admin question against a table already indexed
--       by `template_id`.
--
--   email_templates.created_by
--   email_template_versions.created_by
--       Fifteen templates and a handful of versions each. A sequential scan of
--       a table this size is faster than an index lookup, and the write cost
--       would buy nothing. Revisit if template authoring ever becomes bulk.
-- ============================================================================

-- A business idea is deleted; every lead referencing it must be found.
create index if not exists leads_business_idea_idx
  on public.leads (business_idea_id)
  where business_idea_id is not null;

-- A workspace is deleted; the delivery log must be scanned for references.
create index if not exists email_logs_workspace_idx
  on public.email_logs (workspace_id, created_at desc)
  where workspace_id is not null;

-- A booking is deleted, and "what was sent for this session?" is a real
-- support question.
create index if not exists email_logs_booking_idx
  on public.email_logs (booking_id)
  where booking_id is not null;

-- A staff account is removed; their actions across every lead timeline must be
-- located to null the reference.
create index if not exists lead_events_actor_idx
  on public.lead_events (actor_user_id)
  where actor_user_id is not null;

-- ============================================================================
-- Verification
--
--   select indexname from pg_indexes
--    where schemaname = 'public'
--      and indexname in (
--        'leads_business_idea_idx',
--        'email_logs_workspace_idx',
--        'email_logs_booking_idx',
--        'lead_events_actor_idx'
--      );
--
-- Should return four rows. Requires 0019 to have been applied first — the
-- tables do not otherwise exist.
-- ============================================================================
