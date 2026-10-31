-- ==============================================================================
-- 0003_calendar_integration.sql
-- Calendar Integration (Google Calendar OAuth, Events, and Meeting Linkage)
-- ==============================================================================

-- 1. Create calendar_connections table
create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null default 'google' check (provider in ('google', 'microsoft')),
  account_email text not null check (account_email = lower(btrim(account_email))),
  encrypted_refresh_token text not null,
  access_token text,
  token_expires_at timestamptz,
  sync_enabled boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_connections_user_workspace_provider_key unique (user_id, workspace_id, provider)
);

create index if not exists idx_calendar_connections_user_ws
  on public.calendar_connections (user_id, workspace_id);

-- 2. Enhance meetings table with external calendar metadata
alter table public.meetings
  add column if not exists calendar_event_id text,
  add column if not exists calendar_provider text,
  add column if not exists conference_url text;

create index if not exists idx_meetings_calendar_event
  on public.meetings (workspace_id, calendar_event_id)
  where calendar_event_id is not null;

-- 3. Row-Level Security (RLS)
alter table public.calendar_connections enable row level security;

-- Authenticated users can view their own calendar connection
create policy calendar_connections_select on public.calendar_connections
  for select to authenticated
  using (auth.uid() = user_id);

-- Authenticated users can disconnect (delete) their own calendar connection
create policy calendar_connections_delete on public.calendar_connections
  for delete to authenticated
  using (auth.uid() = user_id);

-- Only backend (service_role) performs token insertions and updates
-- following the Backend-First Mutation architecture.

-- 4. Column and Table Grants (matching 0001 and 0002 pattern)
revoke all on public.calendar_connections from anon, authenticated;
grant select, delete on public.calendar_connections to authenticated;
grant select, insert, update, delete on public.calendar_connections to service_role;
