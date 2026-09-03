-- ============================================================================
-- 0032 — Phase 16: AI Business Advisor
--
-- Additive. One entitlement, two tables. Migrations 0001-0031 are applied and
-- are not edited.
--
-- ---------------------------------------------------------------------------
-- Why conversation storage at all
-- ---------------------------------------------------------------------------
-- §15 asks to check for an existing conversation/message architecture before
-- creating one. There is none: nothing in migrations 0001-0031 stores a
-- multi-turn exchange. `ai_requests` records one workflow execution each and is
-- the platform's audit trail, not a thread — it has no notion of a reply, an
-- order, or a title, and overloading it would corrupt what it is for.
--
-- So: two small tables, deliberately the minimum §14 asks for. No branching, no
-- summarisation, no agent state.
--
-- ---------------------------------------------------------------------------
-- Why a separate entitlement
-- ---------------------------------------------------------------------------
-- Asking the advisor a question is a billable model call, and a cheap one that
-- customers will make many times — quite unlike generating a plan. Metering it
-- against `business_plan` would let a handful of questions consume a
-- customer's plan allowance, which is the wrong failure.
--
-- Limits are set an order of magnitude higher than the generation features for
-- that reason: an advisor a customer is afraid to use has no value. Free gets a
-- real trial rather than a token one.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Entitlement
-- ---------------------------------------------------------------------------

insert into public.plan_entitlements (plan_id, feature, is_enabled, limit_value)
values
  ('free','ai_advisor',         true, 10),
  ('starter','ai_advisor',      true, 100),
  ('growth','ai_advisor',       true, 500),
  ('professional','ai_advisor', true, null),
  ('enterprise','ai_advisor',   true, null)
on conflict (plan_id, feature) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Conversations
-- ---------------------------------------------------------------------------

create table if not exists public.advisor_conversations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,

  -- Derived from the first question rather than asked for. A titling step would
  -- be a second model call per conversation for something the customer can read
  -- off the question itself.
  title        text not null check (length(btrim(title)) between 1 and 200),

  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now())
);

comment on table public.advisor_conversations is
  'One AI Business Advisor thread. Workspace-scoped: a conversation is about a business, not about a person.';

drop trigger if exists advisor_conversations_set_updated_at
  on public.advisor_conversations;
create trigger advisor_conversations_set_updated_at
  before update on public.advisor_conversations
  for each row execute function public.set_updated_at();

-- The advisor page lists a workspace's threads newest first, which is this.
create index if not exists advisor_conversations_workspace_idx
  on public.advisor_conversations (workspace_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- 3. Messages
--
-- `workspace_id` is denormalised from the conversation, matching
-- `execution_roadmap_tasks`: every RLS policy in this codebase is written
-- against a workspace column, and joining up to the parent inside a policy
-- would run that join for every row of every read.
-- ---------------------------------------------------------------------------

create table if not exists public.advisor_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.advisor_conversations (id) on delete cascade,
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,

  role            text not null check (role in ('user','assistant')),

  -- The customer's question, or the advisor's `answer` field rendered for
  -- replay. Bounded so one message cannot become an unbounded blob.
  content         text not null check (length(content) <= 8000),

  -- The full validated advisor response, for the structured render. Null on
  -- user messages.
  response        jsonb,

  -- Provenance for assistant turns, matching what every other AI product here
  -- records.
  model           text,
  ai_request_id   uuid references public.ai_requests (id) on delete set null,

  created_at      timestamptz not null default timezone('utc', now())
);

comment on table public.advisor_messages is
  'Turns within an advisor conversation. Assistant rows keep the validated structured response in `response`; `content` is the plain answer for replay as context.';

-- The conversation view reads every message for one thread in order.
create index if not exists advisor_messages_conversation_idx
  on public.advisor_messages (conversation_id, created_at);
create index if not exists advisor_messages_workspace_idx
  on public.advisor_messages (workspace_id);

-- ---------------------------------------------------------------------------
-- 4. Row level security
--
-- §17: a customer reaches only their own workspace's conversations. Both tables
-- are gated on `is_workspace_member`, so User A asking for Workspace B's
-- conversation id gets no rows rather than a refusal — there is nothing to
-- probe.
--
-- INSERT is granted to members because the advisor runs as the signed-in
-- customer; there is no service-role client in this application. It is still
-- not forgeable into another workspace: membership is checked in the policy
-- itself, and the server never takes a workspace id from the request.
--
-- There is deliberately no UPDATE policy on either table. A conversation is a
-- record of what was asked and answered; editing it after the fact would make
-- the history worthless as an account of what the advisor actually said.
-- DELETE is allowed so a customer can remove a thread they no longer want.
-- ---------------------------------------------------------------------------

alter table public.advisor_conversations enable row level security;
alter table public.advisor_messages enable row level security;

drop policy if exists "Members read their conversations" on public.advisor_conversations;
create policy "Members read their conversations"
  on public.advisor_conversations for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members create their conversations" on public.advisor_conversations;
create policy "Members create their conversations"
  on public.advisor_conversations for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists "Members delete their conversations" on public.advisor_conversations;
create policy "Members delete their conversations"
  on public.advisor_conversations for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members read their advisor messages" on public.advisor_messages;
create policy "Members read their advisor messages"
  on public.advisor_messages for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members create their advisor messages" on public.advisor_messages;
create policy "Members create their advisor messages"
  on public.advisor_messages for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

-- Support visibility, on the same permission that already governs reading a
-- workspace. No admin write policy: nobody edits somebody's advice.
drop policy if exists "Admins read all conversations" on public.advisor_conversations;
create policy "Admins read all conversations"
  on public.advisor_conversations for select
  to authenticated
  using (public.admin_has('workspaces.read'));

drop policy if exists "Admins read all advisor messages" on public.advisor_messages;
create policy "Admins read all advisor messages"
  on public.advisor_messages for select
  to authenticated
  using (public.admin_has('workspaces.read'));
