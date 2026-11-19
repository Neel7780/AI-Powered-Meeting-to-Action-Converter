-- ============================================================
-- Migration 20261118000000: Slack-like Workspace Chat System for ActionPulse
-- Covers: Channels, Direct Messages, Messages, Attachments,
-- Reactions, Read Receipts, Relational Consistency, Strict RLS,
-- Realtime Publication & Private Channel Authorization, and Storage Security
-- ============================================================

begin;

-- ============================================================
-- ENUMS & TYPES
-- ============================================================

do $$ begin
  create type public.conversation_type as enum ('channel', 'dm');
exception when duplicate_object then null; end $$;

-- ============================================================
-- TABLES & RELATIONAL CONSISTENCY
-- ============================================================

-- 1. CONVERSATIONS (Channels & 1:1 DMs)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type public.conversation_type not null default 'channel',
  name text,                                      -- For channels: 'general', 'random'. For DMs: canonical pair key
  topic text,                                     -- Optional channel topic
  description text,                               -- Optional channel description
  is_private boolean not null default false,      -- Immutable after creation. DMs are always private.
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_channel_name_chk check (
    (type = 'dm' and is_private = true and name is not null and char_length(btrim(name)) > 0)
    or
    (type = 'channel' and name is not null and char_length(btrim(name)) between 1 and 80)
  ),
  constraint conversations_id_workspace_unique unique (id, workspace_id)
);

-- Ensure updated constraint definition if table pre-existed
alter table public.conversations drop constraint if exists conversations_channel_name_chk;
alter table public.conversations add constraint conversations_channel_name_chk check (
  (type = 'dm' and is_private = true and name is not null and char_length(btrim(name)) > 0)
  or
  (type = 'channel' and name is not null and char_length(btrim(name)) between 1 and 80)
);

-- Unique index ensuring database-level duplicate prevention for 1:1 DMs within a workspace
create unique index if not exists conversations_workspace_dm_unique_idx
  on public.conversations(workspace_id, name)
  where type = 'dm';

-- Unique index preventing duplicate or spoofed channel names (e.g. duplicate #general)
create unique index if not exists conversations_workspace_channel_name_uq
  on public.conversations(workspace_id, lower(btrim(name)))
  where type = 'channel';

create index if not exists conversations_workspace_idx
  on public.conversations(workspace_id, type);

-- 2. CONVERSATION MEMBERS
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id),
  constraint conversation_members_user_id_profiles_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade
);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'conversation_members_user_id_profiles_fkey'
      and table_schema = 'public'
      and table_name = 'conversation_members'
  ) then
    alter table public.conversation_members
      add constraint conversation_members_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

create index if not exists conversation_members_user_idx
  on public.conversation_members(user_id, conversation_id);

-- 3. MESSAGES
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  workspace_id uuid not null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.messages(id) on delete set null,  -- Threading / reply
  content text not null,
  is_sticker boolean not null default false,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_content_chk check (char_length(btrim(content)) > 0 or is_sticker = true),
  constraint messages_not_self_reply_chk check (parent_id is null or parent_id <> id),
  constraint messages_sender_id_profiles_fkey
    foreign key (sender_id) references public.profiles(id) on delete cascade,
  -- Foreign key ensuring messages.conversation_id and messages.workspace_id match the exact conversation
  constraint messages_conv_workspace_fk
    foreign key (conversation_id, workspace_id)
    references public.conversations(id, workspace_id)
    on delete cascade,
  -- Composite unique key so attachments and reactions can enforce matching conversation & workspace
  constraint messages_id_conv_ws_unique unique (id, conversation_id, workspace_id)
);

alter table public.messages drop constraint if exists messages_not_self_reply_chk;
alter table public.messages add constraint messages_not_self_reply_chk
  check (parent_id is null or parent_id <> id);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'messages_sender_id_profiles_fkey'
      and table_schema = 'public'
      and table_name = 'messages'
  ) then
    alter table public.messages
      add constraint messages_sender_id_profiles_fkey
      foreign key (sender_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

drop index if exists public.messages_conversation_created_idx;
create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at desc, id desc);

create index if not exists messages_workspace_sender_idx
  on public.messages(workspace_id, sender_id);

-- 4. MESSAGE ATTACHMENTS
create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  conversation_id uuid not null,
  workspace_id uuid not null,
  file_name text not null,
  file_url text not null default '',
  file_type text not null,
  file_size integer not null default 0,
  storage_path text not null,
  created_at timestamptz not null default now(),
  constraint message_attachments_file_name_chk check (char_length(btrim(file_name)) between 1 and 255),
  constraint message_attachments_file_size_chk check (file_size between 0 and 10485760),
  constraint message_attachments_storage_path_chk check (
    storage_path like (workspace_id::text || '/' || conversation_id::text || '/%')
    and position('..' in storage_path) = 0
    and char_length(storage_path) > (char_length(workspace_id::text) + char_length(conversation_id::text) + 2)
  ),
  constraint message_attachments_file_url_chk check (
    file_url = '' or file_url ~ '^https://'
  ),
  -- Foreign key ensuring attachment matches message, conversation and workspace
  constraint message_attachments_msg_conv_ws_fk
    foreign key (message_id, conversation_id, workspace_id)
    references public.messages(id, conversation_id, workspace_id)
    on delete cascade
);

alter table public.message_attachments drop constraint if exists message_attachments_file_name_chk;
alter table public.message_attachments add constraint message_attachments_file_name_chk
  check (char_length(btrim(file_name)) between 1 and 255);

alter table public.message_attachments drop constraint if exists message_attachments_file_size_chk;
alter table public.message_attachments add constraint message_attachments_file_size_chk
  check (file_size between 0 and 10485760);

alter table public.message_attachments drop constraint if exists message_attachments_storage_path_chk;
alter table public.message_attachments add constraint message_attachments_storage_path_chk check (
  storage_path like (workspace_id::text || '/' || conversation_id::text || '/%')
  and position('..' in storage_path) = 0
  and char_length(storage_path) > (char_length(workspace_id::text) + char_length(conversation_id::text) + 2)
);

alter table public.message_attachments drop constraint if exists message_attachments_file_url_chk;
alter table public.message_attachments add constraint message_attachments_file_url_chk
  check (file_url = '' or file_url ~ '^https://');

create index if not exists message_attachments_msg_idx
  on public.message_attachments(message_id);

create index if not exists message_attachments_conv_idx
  on public.message_attachments(conversation_id);

create index if not exists message_attachments_storage_path_idx
  on public.message_attachments(storage_path);

-- 5. MESSAGE REACTIONS
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  conversation_id uuid not null,
  workspace_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint message_reactions_emoji_chk check (char_length(btrim(emoji)) between 1 and 32),
  constraint message_reactions_user_id_profiles_fkey
    foreign key (user_id) references public.profiles(id) on delete cascade,
  -- Foreign key ensuring reaction matches message, conversation and workspace
  constraint message_reactions_msg_conv_ws_fk
    foreign key (message_id, conversation_id, workspace_id)
    references public.messages(id, conversation_id, workspace_id)
    on delete cascade,
  constraint message_reactions_unique unique (message_id, user_id, emoji)
);

alter table public.message_reactions drop constraint if exists message_reactions_emoji_chk;
alter table public.message_reactions add constraint message_reactions_emoji_chk
  check (char_length(btrim(emoji)) between 1 and 32);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'message_reactions_user_id_profiles_fkey'
      and table_schema = 'public'
      and table_name = 'message_reactions'
  ) then
    alter table public.message_reactions
      add constraint message_reactions_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

create index if not exists message_reactions_msg_idx
  on public.message_reactions(message_id);

-- ============================================================
-- AUTOMATED TRIGGERS & SECURITY HELPERS
-- ============================================================

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function private.set_updated_at();

drop trigger if exists messages_set_updated_at on public.messages;
create trigger messages_set_updated_at before update on public.messages
for each row execute function private.set_updated_at();

-- Enforce immutable conversation fields (workspace, type, privacy, creator, created_at)
-- and protect #general from being renamed.
create or replace function private.enforce_conversation_invariants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if new.id <> old.id then
      raise exception 'Conversation id cannot be modified';
    end if;
    if new.workspace_id <> old.workspace_id then
      raise exception 'Conversation workspace cannot be modified';
    end if;
    if new.type <> old.type then
      raise exception 'Conversation type cannot be modified';
    end if;
    if new.is_private <> old.is_private then
      raise exception 'Channel privacy is immutable after creation';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'Conversation creator cannot be modified';
    end if;
    if new.created_at <> old.created_at then
      raise exception 'Conversation created_at cannot be modified';
    end if;
    if old.type = 'channel'
       and lower(btrim(old.name)) = 'general'
       and lower(btrim(new.name)) <> 'general' then
      raise exception 'The default #general channel cannot be renamed';
    end if;
  end if;

  if new.type = 'channel' and new.name is not null then
    new.name := lower(btrim(new.name));
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_conversation_invariants() from public, anon, authenticated;

drop trigger if exists conversations_enforce_invariants on public.conversations;
create trigger conversations_enforce_invariants
before update on public.conversations
for each row execute function private.enforce_conversation_invariants();

-- Enforce reply parent belongs to the same conversation and is not self-referential
create or replace function private.validate_message_thread_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Invalid reply: message cannot reply to itself';
    end if;

    if not exists (
      select 1 from public.messages p
      where p.id = new.parent_id
        and p.conversation_id = new.conversation_id
    ) then
      raise exception 'Invalid reply: parent message belongs to a different conversation';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.validate_message_thread_parent() from public, anon, authenticated;

drop trigger if exists messages_validate_thread_parent on public.messages;
create trigger messages_validate_thread_parent
before insert or update of parent_id, conversation_id on public.messages
for each row execute function private.validate_message_thread_parent();

-- Enforce message update invariants:
-- - Immutable routing/identity/audit fields
-- - Server-controlled edited_at on content edits
-- - Soft-delete transitions only via public.soft_delete_message RPC
create or replace function private.enforce_message_update_invariants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_soft_delete_ctx boolean := coalesce(current_setting('app.chat_soft_delete', true), '') = 'on';
begin
  if auth.uid() is not null then
    if new.id <> old.id
       or new.conversation_id <> old.conversation_id
       or new.workspace_id <> old.workspace_id
       or new.sender_id <> old.sender_id
       or new.parent_id is distinct from old.parent_id
       or new.is_sticker <> old.is_sticker
       or new.created_at <> old.created_at then
      raise exception 'Immutable message fields cannot be modified';
    end if;

    if old.deleted_at is not null then
      raise exception 'Deleted messages cannot be modified';
    end if;

    if v_soft_delete_ctx then
      -- Controlled soft-delete executed by public.soft_delete_message RPC
      return new;
    end if;

    if new.deleted_at is distinct from old.deleted_at then
      raise exception 'Use soft_delete_message to delete a message';
    end if;

    if old.is_sticker then
      raise exception 'Sticker messages cannot be edited';
    end if;

    if new.content is distinct from old.content then
      new.edited_at := now();
    else
      new.edited_at := old.edited_at;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_message_update_invariants() from public, anon, authenticated;

drop trigger if exists messages_enforce_update_invariants on public.messages;
create trigger messages_enforce_update_invariants
before update on public.messages
for each row execute function private.enforce_message_update_invariants();

-- Bump parent conversation updated_at whenever a message is sent (for all members & DMs)
create or replace function private.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

revoke execute on function private.touch_conversation_on_message() from public, anon, authenticated;

drop trigger if exists on_message_inserted_touch_conversation on public.messages;
create trigger on_message_inserted_touch_conversation
after insert on public.messages
for each row execute function private.touch_conversation_on_message();

-- Auto-seed #general channel on new workspace
create or replace function private.handle_new_workspace_chat_setup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv_id uuid;
begin
  insert into public.conversations (
    workspace_id,
    type,
    name,
    topic,
    description,
    is_private,
    created_by
  ) values (
    new.id,
    'channel',
    'general',
    'Company-wide announcements and general matters',
    'Default channel for workspace-wide discussions.',
    false,
    new.created_by
  )
  on conflict (workspace_id, lower(btrim(name))) where type = 'channel'
  do update set updated_at = now()
  returning id into v_conv_id;

  if new.created_by is not null and exists (
    select 1 from public.profiles p where p.id = new.created_by
  ) then
    insert into public.conversation_members (conversation_id, user_id)
    values (v_conv_id, new.created_by)
    on conflict (conversation_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function private.handle_new_workspace_chat_setup() from public, anon, authenticated;

drop trigger if exists on_workspace_created_setup_chat on public.workspaces;
create trigger on_workspace_created_setup_chat
after insert on public.workspaces
for each row execute function private.handle_new_workspace_chat_setup();

-- Clean up only the removed user's conversation_members rows within the removed workspace.
-- Preserves all conversation rows, other participants' memberships, and historical DM/channel messages.
create or replace function private.cleanup_conversation_members_on_workspace_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.conversation_members cm
  using public.conversations c
  where cm.conversation_id = c.id
    and c.workspace_id = old.workspace_id
    and cm.user_id = old.user_id;

  return old;
end;
$$;

revoke execute on function private.cleanup_conversation_members_on_workspace_removal() from public, anon, authenticated;

drop trigger if exists on_workspace_member_removed_cleanup_chat on public.workspace_members;
create trigger on_workspace_member_removed_cleanup_chat
after delete on public.workspace_members
for each row execute function private.cleanup_conversation_members_on_workspace_removal();

-- Helper function: Check if current user can access a conversation.
-- Membership-based privacy: admins/owners NEVER automatically gain access to private channels or DMs.
create or replace function private.user_can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and private.user_has_workspace_role(c.workspace_id, null)
      and (
        -- Public channel in the workspace: any workspace member can access
        (c.type = 'channel' and c.is_private = false)
        or
        -- Private channel or DM: user must be an explicit member of the conversation
        exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = (select auth.uid())
        )
      )
  );
$$;

revoke execute on function private.user_can_access_conversation(uuid) from public, anon;
grant  execute on function private.user_can_access_conversation(uuid) to authenticated, service_role;

-- Helper function: Check whether a storage object is linked to a soft-deleted message.
-- SECURITY DEFINER is required because message_attachments_select itself hides deleted messages.
create or replace function private.storage_object_belongs_to_deleted_message(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.message_attachments ma
    join public.messages m on m.id = ma.message_id
    where ma.storage_path = p_storage_path
      and m.deleted_at is not null
  );
$$;

revoke execute on function private.storage_object_belongs_to_deleted_message(text) from public, anon;
grant  execute on function private.storage_object_belongs_to_deleted_message(text) to authenticated, service_role;

-- Helper function: Authorize Supabase Realtime Broadcast & Presence private topics
-- Supports:
--   presence:<workspace_uuid>     (extension = 'presence')  -> workspace members only
--   typing:<conversation_uuid>    (extension = 'broadcast') -> authorized conversation members only
create or replace function private.user_can_access_realtime_topic(
  p_topic text,
  p_extension text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_target_id uuid;
begin
  if v_user_id is null or p_topic is null or p_extension is null then
    return false;
  end if;

  if p_extension = 'presence'
     and p_topic ~ '^presence:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    v_target_id := substring(p_topic from 10)::uuid;
    return private.user_has_workspace_role(v_target_id, null);
  end if;

  if p_extension = 'broadcast'
     and p_topic ~ '^typing:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    v_target_id := substring(p_topic from 8)::uuid;
    return private.user_can_access_conversation(v_target_id);
  end if;

  return false;
exception
  when invalid_text_representation then
    return false;
end;
$$;

revoke execute on function private.user_can_access_realtime_topic(text, text) from public, anon;
grant  execute on function private.user_can_access_realtime_topic(text, text) to authenticated, service_role;

-- ============================================================
-- PUBLIC SECURITY DEFINER RPCs
-- ============================================================

-- 1. Atomic channel creation RPC (resolves private channel RLS RETURNING safely)
create or replace function public.create_channel(
  p_workspace_id uuid,
  p_name text,
  p_topic text default null,
  p_description text default null,
  p_is_private boolean default false
)
returns public.conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_clean_name text;
  v_conv public.conversations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_workspace_id is null or not private.user_has_workspace_role(p_workspace_id, null) then
    raise exception 'Unauthorized for workspace';
  end if;

  v_clean_name := regexp_replace(
    regexp_replace(lower(btrim(coalesce(p_name, ''))), '\s+', '-', 'g'),
    '[^a-z0-9_-]',
    '',
    'g'
  );

  if char_length(v_clean_name) not between 1 and 80 then
    raise exception 'Channel name must be between 1 and 80 valid characters';
  end if;

  insert into public.conversations (
    workspace_id,
    type,
    name,
    topic,
    description,
    is_private,
    created_by
  ) values (
    p_workspace_id,
    'channel',
    v_clean_name,
    nullif(btrim(coalesce(p_topic, '')), ''),
    nullif(btrim(coalesce(p_description, '')), ''),
    coalesce(p_is_private, false),
    v_user_id
  )
  returning * into v_conv;

  -- Register creator as an explicit member atomically
  insert into public.conversation_members (conversation_id, user_id)
  values (v_conv.id, v_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return v_conv;
end;
$$;

revoke execute on function public.create_channel(uuid, text, text, text, boolean) from public, anon;
grant  execute on function public.create_channel(uuid, text, text, text, boolean) to authenticated, service_role;

-- 2. Concurrency-safe Get or Create 1:1 Direct Message conversation
create or replace function public.get_or_create_dm_conversation(
  p_workspace_id uuid,
  p_target_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_user_id uuid := auth.uid();
  v_conv_id uuid;
  v_dm_key text;
begin
  if v_current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_workspace_id is null or p_target_user_id is null then
    raise exception 'Workspace and target user are required';
  end if;

  if v_current_user_id = p_target_user_id then
    raise exception 'Cannot create a DM with yourself';
  end if;

  -- Ensure caller belongs to this workspace
  if not private.user_has_workspace_role(p_workspace_id, null) then
    raise exception 'Unauthorized for workspace';
  end if;

  -- Ensure target user belongs to this workspace
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_target_user_id
  ) then
    raise exception 'Target user is not a member of this workspace';
  end if;

  -- Generate deterministic pairwise key (alphabetical sort of user IDs)
  if v_current_user_id < p_target_user_id then
    v_dm_key := 'dm:' || v_current_user_id::text || ':' || p_target_user_id::text;
  else
    v_dm_key := 'dm:' || p_target_user_id::text || ':' || v_current_user_id::text;
  end if;

  -- Atomic concurrency-safe insert with ON CONFLICT DO UPDATE
  insert into public.conversations (
    workspace_id,
    type,
    name,
    is_private,
    created_by
  ) values (
    p_workspace_id,
    'dm',
    v_dm_key,
    true,
    v_current_user_id
  )
  on conflict (workspace_id, name) where type = 'dm'
  do update set updated_at = now()
  returning id into v_conv_id;

  -- Ensure both users are registered in conversation_members
  insert into public.conversation_members (conversation_id, user_id)
  values
    (v_conv_id, v_current_user_id),
    (v_conv_id, p_target_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return v_conv_id;
end;
$$;

revoke execute on function public.get_or_create_dm_conversation(uuid, uuid) from public, anon;
grant  execute on function public.get_or_create_dm_conversation(uuid, uuid) to authenticated, service_role;

-- 3. Securely mark conversation as read
-- Caller MUST already have permission to access the conversation.
-- Marking a conversation as read will NEVER create unauthorized membership in private channels or DMs.
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_conv public.conversations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_conversation_id is null then
    raise exception 'Conversation not found or access denied';
  end if;

  select * into v_conv
  from public.conversations
  where id = p_conversation_id;

  if not found or not private.user_can_access_conversation(p_conversation_id) then
    raise exception 'Conversation not found or access denied';
  end if;

  -- Private channels and DMs require pre-existing membership (guaranteed by user_can_access_conversation)
  if v_conv.is_private or v_conv.type = 'dm' then
    update public.conversation_members
    set last_read_at = now()
    where conversation_id = p_conversation_id and user_id = v_user_id;
  else
    -- Public channel: workspace members may register or update read receipt
    insert into public.conversation_members (conversation_id, user_id, last_read_at)
    values (p_conversation_id, v_user_id, now())
    on conflict (conversation_id, user_id)
    do update set last_read_at = now();
  end if;
end;
$$;

revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant  execute on function public.mark_conversation_read(uuid) to authenticated, service_role;

-- 4. Securely soft-delete a message (sender OR workspace admin/owner who ALREADY has conversation access)
create or replace function public.soft_delete_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_msg public.messages%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_message_id is null then
    raise exception 'Message not found or access denied';
  end if;

  select * into v_msg
  from public.messages
  where id = p_message_id;

  if not found or not private.user_can_access_conversation(v_msg.conversation_id) then
    raise exception 'Message not found or access denied';
  end if;

  if v_msg.sender_id <> v_user_id
     and not private.user_is_workspace_admin(v_msg.workspace_id) then
    raise exception 'Unauthorized to delete this message';
  end if;

  if v_msg.deleted_at is not null then
    return;
  end if;

  perform set_config('app.chat_soft_delete', 'on', true);

  update public.messages
  set deleted_at = now(),
      content = 'This message was deleted.',
      updated_at = now()
  where id = p_message_id;
end;
$$;

revoke execute on function public.soft_delete_message(uuid) from public, anon;
grant  execute on function public.soft_delete_message(uuid) to authenticated, service_role;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) & LEAST-PRIVILEGE GRANTS
-- ============================================================

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.message_reactions enable row level security;

-- 0001_initial_schema.sql revokes default table privileges for anon, authenticated, and service_role.
-- Start from deny-by-default and grant exact table and column privileges.
revoke all on table
  public.conversations,
  public.conversation_members,
  public.messages,
  public.message_attachments,
  public.message_reactions
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.conversations,
  public.conversation_members,
  public.messages,
  public.message_attachments,
  public.message_reactions
to service_role;

-- Conversations: created via create_channel / get_or_create_dm_conversation RPCs only.
-- Only mutable channel metadata (name, topic, description) may be updated directly.
grant select, delete on table public.conversations to authenticated;
grant update (name, topic, description) on table public.conversations to authenticated;

-- Conversation members: read receipts updated exclusively via mark_conversation_read RPC (NO UPDATE grant).
-- Insert restricted to (conversation_id, user_id) so timestamps cannot be forged.
grant select, delete on table public.conversation_members to authenticated;
grant insert (conversation_id, user_id) on table public.conversation_members to authenticated;

-- Messages: inserts restricted to payload columns; edits restricted to (content) only;
-- deletes routed exclusively through soft_delete_message RPC (NO DELETE grant).
grant select on table public.messages to authenticated;
grant insert (conversation_id, workspace_id, sender_id, parent_id, content, is_sticker) on table public.messages to authenticated;
grant update (content) on table public.messages to authenticated;

-- Message attachments: immutable after creation (NO UPDATE grant).
grant select, delete on table public.message_attachments to authenticated;
grant insert (message_id, conversation_id, workspace_id, file_name, file_url, file_type, file_size, storage_path)
  on table public.message_attachments to authenticated;

-- Message reactions: immutable after creation (NO UPDATE grant).
grant select, delete on table public.message_reactions to authenticated;
grant insert (message_id, conversation_id, workspace_id, user_id, emoji)
  on table public.message_reactions to authenticated;

-- ------------------------------------------------------------
-- 1. CONVERSATIONS RLS
-- ------------------------------------------------------------
drop policy if exists conversations_select on public.conversations;
create policy conversations_select
  on public.conversations for select to authenticated
  using (
    private.user_can_access_conversation(id)
  );

-- Direct INSERT intentionally omitted: channels use public.create_channel() and DMs use public.get_or_create_dm_conversation().
drop policy if exists conversations_insert on public.conversations;

drop policy if exists conversations_update on public.conversations;
create policy conversations_update
  on public.conversations for update to authenticated
  using (
    private.user_can_access_conversation(id)
    and type = 'channel'
    and (
      created_by = (select auth.uid())
      or private.user_is_workspace_admin(workspace_id)
    )
  )
  with check (
    private.user_can_access_conversation(id)
    and type = 'channel'
    and (
      created_by = (select auth.uid())
      or private.user_is_workspace_admin(workspace_id)
    )
  );

drop policy if exists conversations_delete on public.conversations;
create policy conversations_delete
  on public.conversations for delete to authenticated
  using (
    private.user_can_access_conversation(id)
    and type = 'channel'
    and lower(btrim(name)) <> 'general'
    and (
      created_by = (select auth.uid())
      or private.user_is_workspace_admin(workspace_id)
    )
  );

-- ------------------------------------------------------------
-- 2. CONVERSATION MEMBERS RLS
-- ------------------------------------------------------------
drop policy if exists conversation_members_select on public.conversation_members;
create policy conversation_members_select
  on public.conversation_members for select to authenticated
  using (
    private.user_can_access_conversation(conversation_id)
  );

drop policy if exists conversation_members_insert on public.conversation_members;
create policy conversation_members_insert
  on public.conversation_members for insert to authenticated
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.type = 'channel'
        and private.user_has_workspace_role(c.workspace_id, null)
        -- Caller MUST already have access to this channel (non-member admins cannot join/invite into private channels)
        and private.user_can_access_conversation(c.id)
        -- Enforce target user is an authorized workspace member
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = c.workspace_id
            and wm.user_id = conversation_members.user_id
        )
        and (
          -- Any workspace member can join an open public channel
          (c.is_private = false and conversation_members.user_id = (select auth.uid()))
          or
          -- Channel creator or workspace admin/owner (who is already a member/has access) can invite workspace members
          (c.created_by = (select auth.uid()) or private.user_is_workspace_admin(c.workspace_id))
        )
    )
  );

-- UPDATE policy intentionally omitted: prevents conversation_id hijacking.
-- Read receipts are updated exclusively through public.mark_conversation_read(uuid).
drop policy if exists conversation_members_update on public.conversation_members;

drop policy if exists conversation_members_delete on public.conversation_members;
create policy conversation_members_delete
  on public.conversation_members for delete to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.type = 'channel'
        and private.user_has_workspace_role(c.workspace_id, null)
        and private.user_can_access_conversation(c.id)
        and (
          -- User can leave a channel themselves
          conversation_members.user_id = (select auth.uid())
          or
          -- Creator or workspace admin/owner (with channel access) can remove a member
          c.created_by = (select auth.uid())
          or
          private.user_is_workspace_admin(c.workspace_id)
        )
    )
  );

-- ------------------------------------------------------------
-- 3. MESSAGES RLS
-- ------------------------------------------------------------
drop policy if exists messages_select on public.messages;
create policy messages_select
  on public.messages for select to authenticated
  using (
    private.user_can_access_conversation(conversation_id)
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert
  on public.messages for insert to authenticated
  with check (
    -- Cannot forge sender identity or pre-set moderation timestamps
    sender_id = (select auth.uid())
    and edited_at is null
    and deleted_at is null
    -- Enforce conversation access and matching workspace
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.workspace_id = messages.workspace_id
        and private.user_can_access_conversation(c.id)
    )
  );

drop policy if exists messages_update on public.messages;
create policy messages_update
  on public.messages for update to authenticated
  using (
    sender_id = (select auth.uid())
    and deleted_at is null
    and is_sticker = false
    and private.user_can_access_conversation(conversation_id)
  )
  with check (
    sender_id = (select auth.uid())
    and deleted_at is null
    and is_sticker = false
    and private.user_can_access_conversation(conversation_id)
  );

-- Direct DELETE intentionally omitted: message deletion uses public.soft_delete_message(uuid).
drop policy if exists messages_delete on public.messages;

-- ------------------------------------------------------------
-- 4. MESSAGE ATTACHMENTS RLS
-- ------------------------------------------------------------
drop policy if exists message_attachments_select on public.message_attachments;
create policy message_attachments_select
  on public.message_attachments for select to authenticated
  using (
    private.user_can_access_conversation(conversation_id)
    and exists (
      select 1 from public.messages m
      where m.id = message_attachments.message_id
        and m.deleted_at is null
    )
  );

drop policy if exists message_attachments_insert on public.message_attachments;
create policy message_attachments_insert
  on public.message_attachments for insert to authenticated
  with check (
    -- Must attach to caller's own non-deleted message in a conversation they can access
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.conversation_id = message_attachments.conversation_id
        and m.workspace_id = message_attachments.workspace_id
        and m.sender_id = (select auth.uid())
        and m.deleted_at is null
        and private.user_can_access_conversation(m.conversation_id)
    )
  );

drop policy if exists message_attachments_delete on public.message_attachments;
create policy message_attachments_delete
  on public.message_attachments for delete to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and private.user_can_access_conversation(m.conversation_id)
        and (
          m.sender_id = (select auth.uid())
          or private.user_is_workspace_admin(m.workspace_id)
        )
    )
  );

-- ------------------------------------------------------------
-- 5. MESSAGE REACTIONS RLS
-- ------------------------------------------------------------
drop policy if exists message_reactions_select on public.message_reactions;
create policy message_reactions_select
  on public.message_reactions for select to authenticated
  using (
    private.user_can_access_conversation(conversation_id)
  );

drop policy if exists message_reactions_insert on public.message_reactions;
create policy message_reactions_insert
  on public.message_reactions for insert to authenticated
  with check (
    -- Cannot forge user_id; cannot react to deleted messages
    user_id = (select auth.uid())
    and exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.conversation_id = message_reactions.conversation_id
        and m.workspace_id = message_reactions.workspace_id
        and m.deleted_at is null
        and private.user_can_access_conversation(m.conversation_id)
    )
  );

drop policy if exists message_reactions_delete on public.message_reactions;
create policy message_reactions_delete
  on public.message_reactions for delete to authenticated
  using (
    user_id = (select auth.uid())
    and private.user_can_access_conversation(conversation_id)
  );

-- ============================================================
-- REALTIME PUBLICATION & PRIVATE BROADCAST/PRESENCE RLS
-- ============================================================

-- Add chat tables to supabase_realtime publication idempotently.
-- Messages use soft-deletes (UPDATE), keeping REPLICA IDENTITY DEFAULT safe with RLS.
do $$
declare
  v_table text;
begin
  if exists (
    select 1 from pg_publication
    where pubname = 'supabase_realtime'
      and not puballtables
  ) then
    foreach v_table in array array[
      'conversations',
      'messages',
      'message_attachments',
      'message_reactions'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end $$;

-- Enforce RLS on Supabase Realtime private Broadcast/Presence channels (realtime.messages).
-- Note: RLS is already enabled on realtime.messages by Supabase; do NOT run ALTER TABLE on it.
do $$
begin
  if to_regclass('realtime.messages') is not null then
    drop policy if exists realtime_chat_messages_select on realtime.messages;
    create policy realtime_chat_messages_select
      on realtime.messages for select to authenticated
      using (
        private.user_can_access_realtime_topic((select realtime.topic()), extension)
      );

    drop policy if exists realtime_chat_messages_insert on realtime.messages;
    create policy realtime_chat_messages_insert
      on realtime.messages for insert to authenticated
      with check (
        private.user_can_access_realtime_topic((select realtime.topic()), extension)
      );
  end if;
end $$;

-- ============================================================
-- STORAGE BUCKET: chat-attachments (PRIVATE & SECURE)
-- ============================================================

-- Bucket MUST be private. SVG is excluded to prevent stored XSS via signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false, -- STRICT PRIVACY: Private bucket requiring conversation-level authorization
  10485760, -- 10 MB limit
  array[
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Storage path format convention (strictly 2 folders deep):
-- chat-attachments/{workspace_id}/{conversation_id}/{timestamp_filename}
-- (storage.foldername(name))[1] -> workspace_id
-- (storage.foldername(name))[2] -> conversation_id

-- 1. Storage SELECT: Conversation-level authorization required; soft-deleted message attachments are blocked.
drop policy if exists storage_chat_attachments_select on storage.objects;
create policy storage_chat_attachments_select
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-attachments'
  and array_length(storage.foldername(name), 1) = 2
  and not private.storage_object_belongs_to_deleted_message(name)
  and exists (
    select 1
    from public.conversations c
    where c.id::text = (storage.foldername(name))[2]
      and c.workspace_id::text = (storage.foldername(name))[1]
      and private.user_can_access_conversation(c.id)
  )
);

-- 2. Storage INSERT: Authorized conversation members only
drop policy if exists storage_chat_attachments_insert on storage.objects;
create policy storage_chat_attachments_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-attachments'
  and array_length(storage.foldername(name), 1) = 2
  and exists (
    select 1
    from public.conversations c
    where c.id::text = (storage.foldername(name))[2]
      and c.workspace_id::text = (storage.foldername(name))[1]
      and private.user_can_access_conversation(c.id)
  )
);

-- 3. Storage DELETE: Active conversation member (uploader OR workspace admin/owner WITH conversation access)
-- Uses non-deprecated owner_id with legacy owner fallback.
drop policy if exists storage_chat_attachments_delete on storage.objects;
create policy storage_chat_attachments_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-attachments'
  and array_length(storage.foldername(name), 1) = 2
  and exists (
    select 1
    from public.conversations c
    where c.id::text = (storage.foldername(name))[2]
      and c.workspace_id::text = (storage.foldername(name))[1]
      and private.user_can_access_conversation(c.id)
      and (
        coalesce(owner_id, owner::text) = (select auth.uid())::text
        or private.user_is_workspace_admin(c.workspace_id)
      )
  )
);

-- ============================================================
-- BACKFILL DEFAULT #general FOR EXISTING WORKSPACES
-- ============================================================

insert into public.conversations (
  workspace_id,
  type,
  name,
  topic,
  description,
  is_private,
  created_by
)
select
  w.id,
  'channel',
  'general',
  'Company-wide announcements and general matters',
  'Default channel for workspace-wide discussions.',
  false,
  w.created_by
from public.workspaces w
where not exists (
  select 1
  from public.conversations c
  where c.workspace_id = w.id
    and c.type = 'channel'
    and lower(btrim(c.name)) = 'general'
);

insert into public.conversation_members (conversation_id, user_id)
select c.id, w.created_by
from public.conversations c
join public.workspaces w on w.id = c.workspace_id
join public.profiles p on p.id = w.created_by
where c.type = 'channel'
  and lower(btrim(c.name)) = 'general'
  and w.created_by is not null
on conflict (conversation_id, user_id) do nothing;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';

commit;

