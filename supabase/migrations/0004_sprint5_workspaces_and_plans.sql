-- ============================================================================
-- AIAutomix — Sprint 5: Workspace foundation + Business Plan Generator
--
-- WORKSPACE-ARCHITECTURE.md:
--   Workspace -> Members -> Projects -> Business Ideas -> Business Plans -> Reports
--   Roles: Owner, Admin, Member, Viewer
--
-- Adds workspaces + workspace_members, the three business-plan tables, and
-- additive `workspace_id` columns on the Sprint 2/3 tables so the existing
-- hierarchy becomes workspace-aware without changing how it behaves today.
--
-- UUID primary keys, timestamps, Row Level Security throughout (DATABASE.md).
-- Additive and idempotent. Apply after 0003_sprint4_ai_platform.sql.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- workspaces — the top of the ownership hierarchy
-- ============================================================================
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  slug        text not null unique,
  -- Every user gets one personal workspace. Shared workspaces arrive with
  -- collaboration, which is out of scope for this sprint.
  is_personal boolean not null default true,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now()),
  deleted_at  timestamptz
);

comment on table public.workspaces is
  'Top-level container: workspace -> members -> projects -> ideas -> plans -> reports.';

create index if not exists workspaces_owner_idx
  on public.workspaces (owner_id)
  where deleted_at is null;

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- ============================================================================
-- workspace_members — role assignments
-- ============================================================================
create table if not exists public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member'
                 check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now()),
  unique (workspace_id, user_id)
);

comment on table public.workspace_members is
  'Workspace role assignments. Owner and Admin manage, Member edits, Viewer reads.';

create index if not exists workspace_members_user_idx
  on public.workspace_members (user_id);

drop trigger if exists workspace_members_set_updated_at on public.workspace_members;
create trigger workspace_members_set_updated_at
  before update on public.workspace_members
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Membership helpers
--
-- These are `security definer` on purpose. A policy on `workspaces` that reads
-- `workspace_members` (and vice versa) would evaluate the other table's own
-- policies and recurse infinitely. Running the lookup as the definer breaks
-- that cycle — the standard Postgres pattern for membership-based RLS.
--
-- `search_path` is pinned so the functions cannot be hijacked by a caller's
-- session settings.
-- ============================================================================
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function public.owns_workspace(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws and w.owner_id = auth.uid() and w.deleted_at is null
  );
$$;

create or replace function public.workspace_role(ws uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role from public.workspace_members m
  where m.workspace_id = ws and m.user_id = auth.uid();
$$;

/** Owner, Admin and Member may write; Viewer is read-only. */
create or replace function public.can_edit_workspace(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.workspace_role(ws) in ('owner', 'admin', 'member'), false);
$$;

/** Owner and Admin may manage the workspace and its members. */
create or replace function public.can_manage_workspace(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.owns_workspace(ws)
      or coalesce(public.workspace_role(ws) = 'admin', false);
$$;

-- ---------------------------------------------------------------------------
-- workspaces RLS
--
-- The owner clause is not redundant with membership: it lets a freshly created
-- workspace be read back before its owner membership row exists, which is what
-- makes the bootstrap in `features/workspaces/data.ts` work under RLS.
-- ---------------------------------------------------------------------------
alter table public.workspaces enable row level security;

drop policy if exists "Members can view their workspaces" on public.workspaces;
create policy "Members can view their workspaces"
  on public.workspaces for select
  using (owner_id = auth.uid() or public.is_workspace_member(id));

drop policy if exists "Users can create their own workspaces" on public.workspaces;
create policy "Users can create their own workspaces"
  on public.workspaces for insert
  with check (owner_id = auth.uid());

drop policy if exists "Owners and admins can update a workspace" on public.workspaces;
create policy "Owners and admins can update a workspace"
  on public.workspaces for update
  using (owner_id = auth.uid() or public.can_manage_workspace(id))
  with check (owner_id = auth.uid() or public.can_manage_workspace(id));

drop policy if exists "Owners can delete a workspace" on public.workspaces;
create policy "Owners can delete a workspace"
  on public.workspaces for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- workspace_members RLS
-- ---------------------------------------------------------------------------
alter table public.workspace_members enable row level security;

drop policy if exists "Members can view the roster" on public.workspace_members;
create policy "Members can view the roster"
  on public.workspace_members for select
  using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id)
    or public.owns_workspace(workspace_id)
  );

drop policy if exists "Owners and admins can add members" on public.workspace_members;
create policy "Owners and admins can add members"
  on public.workspace_members for insert
  with check (public.can_manage_workspace(workspace_id));

drop policy if exists "Owners and admins can change roles" on public.workspace_members;
create policy "Owners and admins can change roles"
  on public.workspace_members for update
  using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

drop policy if exists "Owners and admins can remove members" on public.workspace_members;
create policy "Owners and admins can remove members"
  on public.workspace_members for delete
  using (public.can_manage_workspace(workspace_id));

-- ============================================================================
-- business_plans — a generated, editable, versioned plan
-- ============================================================================
create table if not exists public.business_plans (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  project_id       uuid references public.projects (id) on delete set null,
  business_idea_id uuid references public.business_ideas (id) on delete set null,
  title            text not null,
  summary          text,
  status           text not null default 'draft'
                     check (status in ('draft', 'generating', 'ready', 'failed')),
  input_json       jsonb not null,
  workflow         text not null default 'business-plan',
  prompt_version   text not null,
  model            text not null,
  ai_request_id    uuid references public.ai_requests (id) on delete set null,
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now()),
  deleted_at       timestamptz
);

comment on table public.business_plans is
  'AI-generated business plans. Section content lives in business_plan_sections.';

create index if not exists business_plans_workspace_idx
  on public.business_plans (workspace_id, created_at desc)
  where deleted_at is null;
create index if not exists business_plans_user_idx
  on public.business_plans (user_id, created_at desc)
  where deleted_at is null;
create index if not exists business_plans_project_idx
  on public.business_plans (project_id);

drop trigger if exists business_plans_set_updated_at on public.business_plans;
create trigger business_plans_set_updated_at
  before update on public.business_plans
  for each row execute function public.set_updated_at();

-- ============================================================================
-- business_plan_sections — the current content of each section
--
-- `workspace_id` is denormalised so every policy is a single index-backed
-- membership check instead of a join back up to business_plans on every row.
-- ============================================================================
create table if not exists public.business_plan_sections (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references public.business_plans (id) on delete cascade,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  section_key     text not null,
  title           text not null,
  content         text not null,
  position        integer not null,
  current_version integer not null default 1,
  source          text not null default 'ai' check (source in ('ai', 'user')),
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now()),
  unique (plan_id, section_key)
);

comment on table public.business_plan_sections is
  'Current content of each business plan section. History lives in business_plan_versions.';

create index if not exists business_plan_sections_plan_idx
  on public.business_plan_sections (plan_id, position);

drop trigger if exists business_plan_sections_set_updated_at on public.business_plan_sections;
create trigger business_plan_sections_set_updated_at
  before update on public.business_plan_sections
  for each row execute function public.set_updated_at();

-- ============================================================================
-- business_plan_versions — append-only history, one row per saved revision
-- ============================================================================
create table if not exists public.business_plan_versions (
  id           uuid primary key default gen_random_uuid(),
  section_id   uuid not null references public.business_plan_sections (id) on delete cascade,
  plan_id      uuid not null references public.business_plans (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  section_key  text not null,
  version      integer not null,
  content      text not null,
  source       text not null check (source in ('ai', 'user')),
  edited_by    uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default timezone('utc', now()),
  unique (section_id, version)
);

comment on table public.business_plan_versions is
  'Append-only revision history for business plan sections.';

create index if not exists business_plan_versions_section_idx
  on public.business_plan_versions (section_id, version desc);
create index if not exists business_plan_versions_plan_idx
  on public.business_plan_versions (plan_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Business plan RLS — membership to read, edit rights to write.
-- Viewers can read every plan in their workspace but change nothing.
-- ---------------------------------------------------------------------------
alter table public.business_plans enable row level security;

drop policy if exists "Members can view workspace plans" on public.business_plans;
create policy "Members can view workspace plans"
  on public.business_plans for select
  using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

drop policy if exists "Editors can create plans" on public.business_plans;
create policy "Editors can create plans"
  on public.business_plans for insert
  with check (user_id = auth.uid() and public.can_edit_workspace(workspace_id));

drop policy if exists "Editors can update plans" on public.business_plans;
create policy "Editors can update plans"
  on public.business_plans for update
  using (public.can_edit_workspace(workspace_id))
  with check (public.can_edit_workspace(workspace_id));

drop policy if exists "Editors can delete plans" on public.business_plans;
create policy "Editors can delete plans"
  on public.business_plans for delete
  using (public.can_edit_workspace(workspace_id));

alter table public.business_plan_sections enable row level security;

drop policy if exists "Members can view plan sections" on public.business_plan_sections;
create policy "Members can view plan sections"
  on public.business_plan_sections for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Editors can create plan sections" on public.business_plan_sections;
create policy "Editors can create plan sections"
  on public.business_plan_sections for insert
  with check (public.can_edit_workspace(workspace_id));

drop policy if exists "Editors can update plan sections" on public.business_plan_sections;
create policy "Editors can update plan sections"
  on public.business_plan_sections for update
  using (public.can_edit_workspace(workspace_id))
  with check (public.can_edit_workspace(workspace_id));

drop policy if exists "Editors can delete plan sections" on public.business_plan_sections;
create policy "Editors can delete plan sections"
  on public.business_plan_sections for delete
  using (public.can_edit_workspace(workspace_id));

-- History is select + insert only: a revision log that can be rewritten is not
-- a revision log.
alter table public.business_plan_versions enable row level security;

drop policy if exists "Members can view plan history" on public.business_plan_versions;
create policy "Members can view plan history"
  on public.business_plan_versions for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Editors can append plan history" on public.business_plan_versions;
create policy "Editors can append plan history"
  on public.business_plan_versions for insert
  with check (public.can_edit_workspace(workspace_id));

-- ============================================================================
-- Make the existing hierarchy workspace-aware
--
-- Columns are additive and nullable, then backfilled. The existing owner-scoped
-- policies are widened with an OR on workspace membership rather than being
-- replaced: today every user has exactly one personal workspace with exactly
-- one member, so access is unchanged — but the moment collaboration ships, the
-- hierarchy already resolves correctly.
-- ============================================================================
alter table public.projects
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.business_ideas
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.validation_reports
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

create index if not exists projects_workspace_idx on public.projects (workspace_id);
create index if not exists business_ideas_workspace_idx on public.business_ideas (workspace_id);
create index if not exists validation_reports_workspace_idx on public.validation_reports (workspace_id);

-- ---------------------------------------------------------------------------
-- Backfill: give every existing user a personal workspace, make them its owner,
-- and attach their existing rows to it.
-- ---------------------------------------------------------------------------
insert into public.workspaces (owner_id, name, slug, is_personal)
select
  u.id,
  coalesce(nullif(trim(p.full_name), ''), split_part(u.email, '@', 1), 'My') || '''s workspace',
  'ws-' || replace(u.id::text, '-', ''),
  true
from auth.users u
left join public.profiles p on p.id = u.id
where not exists (
  select 1 from public.workspaces w
  where w.owner_id = u.id and w.is_personal and w.deleted_at is null
)
on conflict (slug) do nothing;

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
on conflict (workspace_id, user_id) do nothing;

update public.projects p
set workspace_id = w.id
from public.workspaces w
where p.workspace_id is null
  and w.owner_id = p.user_id
  and w.is_personal
  and w.deleted_at is null;

update public.business_ideas b
set workspace_id = w.id
from public.workspaces w
where b.workspace_id is null
  and w.owner_id = b.user_id
  and w.is_personal
  and w.deleted_at is null;

update public.validation_reports r
set workspace_id = w.id
from public.workspaces w
where r.workspace_id is null
  and w.owner_id = r.user_id
  and w.is_personal
  and w.deleted_at is null;

-- ---------------------------------------------------------------------------
-- Widen the Sprint 2/3 read policies to accept workspace membership.
-- The owner clause stays first so the common path is still a plain equality.
-- ---------------------------------------------------------------------------
drop policy if exists "Projects are viewable by their owner" on public.projects;
drop policy if exists "Users can view their own projects" on public.projects;
create policy "Users can view their own projects"
  on public.projects for select
  using (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

drop policy if exists "Users can view their own business ideas" on public.business_ideas;
create policy "Users can view their own business ideas"
  on public.business_ideas for select
  using (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

drop policy if exists "Users can view their own reports" on public.validation_reports;
create policy "Users can view their own reports"
  on public.validation_reports for select
  using (
    auth.uid() = user_id
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

-- ============================================================================
-- Register the business-plan workflow in the AI catalog (Sprint 4 tables)
-- ============================================================================
insert into public.ai_workflows
  (slug, label, description, provider, active_prompt_version)
values
  (
    'business-plan',
    'Business Plan Generator',
    'Generates an eleven-section business plan from a structured brief.',
    'openai',
    'v1'
  )
on conflict (slug) do update set
  label                 = excluded.label,
  description           = excluded.description,
  provider              = excluded.provider,
  active_prompt_version = excluded.active_prompt_version;

insert into public.ai_prompt_versions (workflow_slug, version, is_active)
values ('business-plan', 'v1', true)
on conflict (workflow_slug, version) do update set
  is_active = excluded.is_active;
