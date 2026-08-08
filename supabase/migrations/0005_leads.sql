-- ============================================================================
-- 0005 — Lead capture
--
-- Public marketing forms (contact + "Book a Free AI Strategy Session") posted
-- via `mailto:` links, which silently lost every visitor without a configured
-- desktop mail client. This table is where they land instead.
--
-- Additive and idempotent, like the previous four. Depends on nothing in them.
-- ============================================================================

create table if not exists public.leads (
  id             uuid primary key default gen_random_uuid(),

  -- Contact details. Only `email` is required: a lead with an email is
  -- actionable, and every additional required field costs conversions.
  name           text,
  email          text not null,
  phone          text,
  company        text,
  message        text,

  -- Which form produced this, e.g. 'contact' | 'strategy-session'.
  source         text not null default 'unknown',

  -- Attribution. Captured because without it paid and organic spend cannot be
  -- evaluated at all. All optional — absence is normal, not an error.
  landing_page   text,
  referrer       text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_term       text,
  utm_content    text,

  -- Simple triage state so the inbox can be worked rather than just read.
  status         text not null default 'new'
                 check (status in ('new', 'contacted', 'qualified', 'archived')),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.leads is
  'Inbound leads from public marketing forms. Insert-only for anonymous visitors.';

create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_email_idx on public.leads (email);

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- The security shape here is deliberately asymmetric: anyone may INSERT (it is
-- a public form on a marketing site), and *nobody* may SELECT through the
-- anon or authenticated roles.
--
-- That second half matters. A table that accepts anonymous writes and also
-- allows anonymous reads is a public dump of every prospect's name, email and
-- phone number — the single most common way a Supabase-backed marketing form
-- leaks its own pipeline. With no SELECT policy, RLS denies all reads by
-- default; the service role bypasses RLS, so the Supabase dashboard and any
-- server-side tooling can still read the table.
-- ---------------------------------------------------------------------------
alter table public.leads enable row level security;

drop policy if exists "Anyone can submit a lead" on public.leads;
create policy "Anyone can submit a lead"
  on public.leads for insert
  to anon, authenticated
  with check (true);

-- No select / update / delete policies on purpose. Read them in the Supabase
-- dashboard, or from a server-side context using the service role key.
