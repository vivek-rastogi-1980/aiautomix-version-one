-- ============================================================================
-- 0030 — Link a business plan back to the validation report it came from
--
-- Additive. One nullable column, one index. Migrations 0001-0029 are applied
-- and are not edited.
--
-- ---------------------------------------------------------------------------
-- Why a new column rather than reusing business_idea_id
-- ---------------------------------------------------------------------------
-- `business_plans.business_idea_id` already exists (0004) and is already
-- populated, so it was the first candidate. It is not sufficient, and the
-- reason is structural rather than cosmetic:
--
--   business_ideas 1 ── N validation_reports
--
-- `validation_reports.business_idea_id` carries no unique constraint, so one
-- idea can be validated repeatedly — a customer who revises and re-validates
-- has several reports for the same idea. Recording only the idea would leave
-- "which report produced this plan?" unanswerable, which is exactly the
-- question the "Based on validated idea" link has to answer.
--
-- The two columns therefore describe different relationships and neither
-- duplicates the other: `business_idea_id` says which idea, this says which
-- validation of it.
--
-- ---------------------------------------------------------------------------
-- No `source` column
-- ---------------------------------------------------------------------------
-- A separate `source = 'validation_report'` marker would be derivable state:
-- it is true exactly when `validation_report_id is not null`. Storing it as
-- well would create two facts that can disagree, so the predicate is used
-- directly instead.
--
-- ---------------------------------------------------------------------------
-- No RLS changes
-- ---------------------------------------------------------------------------
-- Deliberately none. `business_plans` already carries its workspace policies
-- from 0004 and `validation_reports` carries its own from 0002; a column added
-- to an RLS-protected table is protected by that table's existing policies.
-- Reading a plan still requires access to the plan, and reading the linked
-- report still requires access to the report — the link grants nothing on its
-- own, so it cannot become a cross-workspace read path.
--
-- `on delete set null` rather than cascade: deleting a validation report must
-- never delete the business plan somebody built from it.
-- ============================================================================

alter table public.business_plans
  add column if not exists validation_report_id uuid
    references public.validation_reports (id) on delete set null;

comment on column public.business_plans.validation_report_id is
  'The validation report this plan was generated from, when it began as a validated idea. Null for plans created directly. Presence of this value IS the "created from validation" flag — there is no separate source column.';

-- Supports both directions the product asks for: "which plans came from this
-- report?" (the duplicate check before creating one) and "which validated
-- ideas have no plan yet?" (the prompt on the plans list). Partial, because a
-- null link is the common case and never needs looking up.
create index if not exists business_plans_validation_report_idx
  on public.business_plans (validation_report_id)
  where validation_report_id is not null;
