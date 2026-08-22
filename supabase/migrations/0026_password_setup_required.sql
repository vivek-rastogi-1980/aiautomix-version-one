-- ============================================================================
-- 0026 — Mandatory password setup on first login
--
-- Additive. One nullable-safe column with a default. No data is rewritten.
--
-- ---------------------------------------------------------------------------
-- What this supports, and what it deliberately does NOT
-- ---------------------------------------------------------------------------
-- A visitor who comes through the funnel gets an account without ever choosing
-- a password: `signInWithOtp` creates the user and emails a one-time link, and
-- clicking it establishes a session. That is the whole point of the funnel —
-- "I submitted my idea", not "I registered for a SaaS product".
--
-- The consequence is an account with a session and no password. If the link
-- expires and they come back later, there is nothing to log in WITH.
--
-- This column marks that state so the application can require a password once,
-- on first arrival, before the dashboard.
--
-- It does NOT store a password, a temporary password, a hash or a token. The
-- schema still has nowhere to put one, and the smoke suite still asserts that:
-- authentication remains entirely Supabase Auth's business. This is a single
-- boolean saying "this person has not chosen a password yet".
--
-- ---------------------------------------------------------------------------
-- Why a plain column and no new RLS
-- ---------------------------------------------------------------------------
-- `profiles` already has "users update own profile" (0001). A user clearing
-- their own flag is exactly what is supposed to happen after they set a
-- password, so no new policy is needed and no security definer function is
-- warranted.
--
-- Worth being explicit about the threat model: someone could call the update
-- directly and clear the flag without setting a password. They would gain
-- nothing — they already hold a valid session, and their account would simply
-- still have no password. This is a first-run experience gate, not an
-- authorization boundary, and it is not treated as one anywhere in the code.
-- ============================================================================

alter table public.profiles
  add column if not exists password_setup_required boolean not null default false;

comment on column public.profiles.password_setup_required is
  'True when the account was provisioned through the funnel and the person has not chosen a password yet. Not a credential and not an authorization boundary — a first-run gate so somebody whose one-time link has expired still has a way in.';

-- Partial: the overwhelming majority of rows are false, and the only query
-- that matters is "does this one person still need to set a password?".
create index if not exists profiles_password_setup_idx
  on public.profiles (id) where password_setup_required;

-- ============================================================================
-- Verification
--
--   select count(*) from public.profiles where password_setup_required;
--
-- Zero immediately after this migration: the default is false, so no existing
-- customer is suddenly asked to set a password. Only accounts provisioned by
-- the funnel from now on are flagged.
-- ============================================================================
