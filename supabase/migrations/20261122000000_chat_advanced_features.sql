-- ============================================================
-- Migration 20261122000000: Advanced Workspace Chat Features
-- Covers: Conversation Pins, Group DMs Support, and Indexing
-- ============================================================

-- 1. CONVERSATION PINS TABLE
create table if not exists public.conversation_pins (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint conversation_pins_conv_msg_uq unique (conversation_id, message_id)
);

create index if not exists conversation_pins_conv_idx
  on public.conversation_pins(conversation_id);

create index if not exists conversation_pins_msg_idx
  on public.conversation_pins(message_id);

-- Enable RLS
alter table public.conversation_pins enable row level security;

-- Revoke default grants
revoke all on table public.conversation_pins from public, anon;

-- RLS Policies
-- SELECT: Members with access to the conversation can view pins
create policy conversation_pins_select on public.conversation_pins
  for select
  using (private.user_can_access_conversation(conversation_id, auth.uid()));

-- INSERT: Members with access to the conversation can pin messages
create policy conversation_pins_insert on public.conversation_pins
  for insert
  with check (
    pinned_by = auth.uid()
    and private.user_can_access_conversation(conversation_id, auth.uid())
  );

-- DELETE: Members with access to the conversation can unpin messages
create policy conversation_pins_delete on public.conversation_pins
  for delete
  using (private.user_can_access_conversation(conversation_id, auth.uid()));

-- Table privileges
grant select, insert, delete on table public.conversation_pins to authenticated;
grant all on table public.conversation_pins to service_role;

-- Realtime publication for conversation_pins
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_pins'
  ) then
    alter publication supabase_realtime add table public.conversation_pins;
  end if;
end $$;

