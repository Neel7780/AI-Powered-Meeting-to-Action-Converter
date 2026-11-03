-- ==============================================================================
-- 0007_task_prerequisite_communications.sql
-- Two-way communication between Assignee and Manager regarding Task Prerequisites
-- ==============================================================================

-- 1. Ensure foreign key from tasks.created_by to profiles(id) for PostgREST embedding
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'tasks_created_by_profiles_fkey'
      and table_schema = 'public'
      and table_name = 'tasks'
  ) then
    alter table public.tasks
      add constraint tasks_created_by_profiles_fkey
      foreign key (created_by) references public.profiles(id) on delete restrict;
  end if;
end $$;

-- 2. Extend notification_event enum
alter type public.notification_event add value if not exists 'task_prerequisite_inquiry';
alter type public.notification_event add value if not exists 'task_prerequisite_reply';

-- 3. Create task_communications table
create table if not exists public.task_communications (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  message_type text not null default 'inquiry',
  content text not null,
  suggested_prerequisite_task_id uuid references public.tasks(id) on delete set null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_comm_content_chk check (char_length(btrim(content)) > 0),
  constraint task_comm_type_chk check (message_type in ('inquiry', 'reply', 'resolution')),
  constraint task_comm_status_chk check (status in ('open', 'answered', 'resolved'))
);

-- 4. Indexes for fast retrieval
create index if not exists idx_task_comm_task_id on public.task_communications(task_id, created_at asc);
create index if not exists idx_task_comm_workspace on public.task_communications(workspace_id);
create index if not exists idx_task_comm_recipient on public.task_communications(recipient_id, status);

-- 5. Updated_at trigger
drop trigger if exists task_communications_set_updated_at on public.task_communications;
create trigger task_communications_set_updated_at
  before update on public.task_communications
  for each row execute function private.set_updated_at();

-- 6. Row-Level Security
alter table public.task_communications enable row level security;

-- Workspace members can view task communications in their workspace
drop policy if exists task_comm_select_workspace_members on public.task_communications;
create policy task_comm_select_workspace_members
  on public.task_communications for select to authenticated
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = task_communications.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Workspace members can insert task communications where they are the sender
drop policy if exists task_comm_insert_workspace_members on public.task_communications;
create policy task_comm_insert_workspace_members
  on public.task_communications for insert to authenticated
  with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = task_communications.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Backend service-role or sender/recipient can update communication status
drop policy if exists task_comm_update_workspace_members on public.task_communications;
create policy task_comm_update_workspace_members
  on public.task_communications for update to authenticated
  using (
    (sender_id = auth.uid() or recipient_id = auth.uid()) and
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = task_communications.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- 7. Reload schema cache for PostgREST
notify pgrst, 'reload schema';

