-- ============================================================
-- AI-Powered Meeting-to-Action Converter
-- Production baseline Supabase schema
-- Based on FINAL_PROJECT_SPEC.md v1.0 (28 Sep 2026)
--
-- IMPORTANT:
-- 1. Run this on the intended Supabase project after taking a backup.
-- 2. This script does NOT DROP application tables.
-- 3. Treat this as migration 0001 and commit it to Git immediately.
-- 4. Backend-only writes use the Supabase service role. Never expose
--    the service-role/secret key to the browser.
-- ============================================================

begin;

create extension if not exists pgcrypto;

create schema if not exists private;
create schema if not exists audit;

-- ============================================================
-- ENUMS
-- ============================================================

do $$ begin
  create type public.app_role as enum ('admin', 'organiser', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.meeting_visibility as enum ('workspace', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.meeting_status as enum ('draft', 'processing', 'ready', 'failed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.meeting_lifecycle as enum ('active', 'pending_deletion', 'deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transcript_source as enum ('paste', 'txt', 'vtt', 'srt', 'docx');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.extracted_item_type as enum ('action', 'decision', 'information');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_status as enum ('needs_review', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('todo', 'in_progress', 'blocked', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_channel as enum ('in_app', 'email', 'push');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_event as enum ('task_assigned', 'deadline_24h', 'overdue', 'daily_digest');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_status as enum ('pending', 'sent', 'failed', 'permanently_failed', 'deferred');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.consent_status as enum ('attested', 'revoked');
exception when duplicate_object then null; end $$;

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  timezone text not null default 'Asia/Kolkata',
  mfa_enabled boolean not null default false,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_chk check (
    display_name is null or char_length(btrim(display_name)) between 1 and 120
  ),
  constraint profiles_timezone_chk check (btrim(timezone) <> '')
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  retention_days integer not null default 90,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_name_chk check (char_length(btrim(name)) between 1 and 120),
  constraint workspaces_retention_chk check (retention_days in (30, 90, 180, 365))
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  timezone text not null default 'Asia/Kolkata',
  organiser_id uuid not null references auth.users(id) on delete restrict,
  ai_processing boolean not null default true,
  visibility public.meeting_visibility not null default 'workspace',
  status public.meeting_status not null default 'draft',
  lifecycle public.meeting_lifecycle not null default 'active',
  retention_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_title_chk check (char_length(btrim(title)) between 1 and 300),
  constraint meetings_timezone_chk check (btrim(timezone) <> '')
);

create table if not exists public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  external_name text,
  created_at timestamptz not null default now(),
  constraint meeting_participant_identity_chk check (
    user_id is not null or nullif(btrim(external_name), '') is not null
  )
);

create unique index if not exists meeting_participants_user_uq
  on public.meeting_participants(meeting_id, user_id)
  where user_id is not null;

create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null unique references public.meetings(id) on delete cascade,
  source public.transcript_source not null,
  storage_path text,
  raw_text text,
  canonical_text text,
  file_name text,
  file_size_bytes bigint,
  mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transcripts_file_size_chk check (
    file_size_bytes is null or file_size_bytes between 0 and 10485760
  ),
  constraint transcripts_source_data_chk check (
    (source = 'paste' and canonical_text is not null)
    or
    (source in ('txt','vtt','srt','docx') and (storage_path is not null or canonical_text is not null))
  )
);

create table if not exists public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  segment_index integer not null,
  speaker_name text,
  start_ms bigint,
  end_ms bigint,
  text text not null,
  created_at timestamptz not null default now(),
  constraint transcript_segments_index_chk check (segment_index >= 0),
  constraint transcript_segments_time_chk check (
    (start_ms is null and end_ms is null)
    or
    (start_ms is not null and start_ms >= 0 and end_ms is not null and end_ms >= start_ms)
  ),
  constraint transcript_segments_text_chk check (char_length(btrim(text)) > 0),
  unique (transcript_id, segment_index)
);

create table if not exists public.extracted_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  type public.extracted_item_type not null,
  task text,
  owner_name text,
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_confidence numeric(5,4),
  deadline_raw text,
  deadline_utc timestamptz,
  deadline_timezone text,
  deadline_confidence numeric(5,4),
  priority public.task_priority not null default 'normal',
  source_excerpt text not null,
  source_start_ms bigint,
  source_end_ms bigint,
  confidence numeric(5,4),
  uncertainty_flag boolean not null default false,
  review_status public.review_status not null default 'needs_review',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  provider text,
  model_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extracted_confidence_chk check (confidence is null or confidence between 0 and 1),
  constraint extracted_owner_confidence_chk check (owner_confidence is null or owner_confidence between 0 and 1),
  constraint extracted_deadline_confidence_chk check (deadline_confidence is null or deadline_confidence between 0 and 1),
  constraint extracted_source_time_chk check (
    (source_start_ms is null and source_end_ms is null)
    or
    (source_start_ms is not null and source_start_ms >= 0 and source_end_ms is not null and source_end_ms >= source_start_ms)
  ),
  constraint extracted_source_chk check (char_length(btrim(source_excerpt)) > 0),
  constraint extracted_action_task_chk check (
    type <> 'action' or nullif(btrim(task), '') is not null
  ),
  constraint extracted_review_chk check (
    (review_status = 'needs_review' and reviewed_by is null and reviewed_at is null)
    or
    (review_status in ('approved','rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete restrict,
  extracted_item_id uuid unique references public.extracted_items(id) on delete set null,
  title text not null,
  description text,
  deadline_utc timestamptz,
  priority public.task_priority not null default 'normal',
  status public.task_status not null default 'todo',
  blocked_by uuid references public.tasks(id) on delete set null,
  external_owner_label text,
  source_excerpt text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint tasks_title_chk check (char_length(btrim(title)) between 1 and 500),
  constraint tasks_source_excerpt_chk check (char_length(btrim(source_excerpt)) > 0),
  constraint tasks_not_self_blocked_chk check (blocked_by is null or blocked_by <> id)
);

create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_primary boolean not null default false,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create unique index if not exists task_one_primary_assignee_uq
  on public.task_assignees(task_id)
  where is_primary;

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  attested_by uuid not null references auth.users(id) on delete restrict,
  notice_version text not null,
  status public.consent_status not null default 'attested',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint consent_status_dates_chk check (
    (status = 'attested' and revoked_at is null)
    or
    (status = 'revoked' and revoked_at is not null)
  )
);

create unique index if not exists active_meeting_consent_uq
  on public.consents(meeting_id)
  where status = 'attested';

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  channel public.notification_channel not null,
  event_type public.notification_event not null,
  status public.notification_status not null default 'pending',
  attempt smallint not null default 0,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_attempt_chk check (attempt between 0 and 3)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create table if not exists public.llm_runs (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  provider text not null,
  model_version text not null,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  est_cost_inr numeric(12,4),
  payload_hash text,
  success boolean not null default true,
  error_code text,
  created_at timestamptz not null default now(),
  constraint llm_runs_tokens_chk check (
    (input_tokens is null or input_tokens >= 0)
    and (output_tokens is null or output_tokens >= 0)
  ),
  constraint llm_runs_latency_chk check (latency_ms is null or latency_ms >= 0),
  constraint llm_runs_cost_chk check (est_cost_inr is null or est_cost_inr >= 0)
);

create table if not exists audit.audit_log (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  target_table text not null,
  target_id uuid,
  status text,
  old_data jsonb,
  new_data jsonb,
  client_ip inet,
  user_agent text
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
create index if not exists meetings_workspace_idx on public.meetings(workspace_id);
create index if not exists meetings_organiser_idx on public.meetings(organiser_id);
create index if not exists meetings_starts_idx on public.meetings(starts_at desc);
create index if not exists meetings_retention_idx on public.meetings(retention_expires_at)
  where lifecycle = 'pending_deletion';
create index if not exists meeting_participants_user_idx on public.meeting_participants(user_id);
create index if not exists transcripts_meeting_idx on public.transcripts(meeting_id);
create index if not exists transcript_segments_transcript_idx on public.transcript_segments(transcript_id);
create index if not exists extracted_items_meeting_idx on public.extracted_items(meeting_id);
create index if not exists extracted_items_review_idx on public.extracted_items(review_status);
create index if not exists extracted_items_owner_idx on public.extracted_items(owner_user_id);
create index if not exists tasks_workspace_status_idx on public.tasks(workspace_id, status);
create index if not exists tasks_meeting_idx on public.tasks(meeting_id);
create index if not exists tasks_deadline_idx on public.tasks(deadline_utc) where status <> 'done';
create index if not exists tasks_blocked_by_idx on public.tasks(blocked_by) where blocked_by is not null;
create index if not exists task_assignees_user_idx on public.task_assignees(user_id);
create index if not exists consents_meeting_idx on public.consents(meeting_id);
create index if not exists notifications_due_idx on public.notifications(next_attempt_at)
  where status in ('pending','failed','deferred');
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists llm_runs_meeting_idx on public.llm_runs(meeting_id);
create index if not exists audit_workspace_ts_idx on audit.audit_log(workspace_id, ts desc);
create index if not exists audit_target_idx on audit.audit_log(target_table, target_id, ts desc);

-- ============================================================
-- COMMON TRIGGERS
-- ============================================================

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function private.set_updated_at();

drop trigger if exists workspace_members_set_updated_at on public.workspace_members;
create trigger workspace_members_set_updated_at before update on public.workspace_members
for each row execute function private.set_updated_at();

drop trigger if exists meetings_set_updated_at on public.meetings;
create trigger meetings_set_updated_at before update on public.meetings
for each row execute function private.set_updated_at();

drop trigger if exists transcripts_set_updated_at on public.transcripts;
create trigger transcripts_set_updated_at before update on public.transcripts
for each row execute function private.set_updated_at();

drop trigger if exists extracted_items_set_updated_at on public.extracted_items;
create trigger extracted_items_set_updated_at before update on public.extracted_items
for each row execute function private.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function private.set_updated_at();

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at before update on public.notifications
for each row execute function private.set_updated_at();

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions
for each row execute function private.set_updated_at();

-- ============================================================
-- AUTH -> PROFILE
-- ============================================================

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name),
        updated_at = now();
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = new.email, updated_at = now()
   where id = new.id;
  return new;
end;
$$;

revoke execute on function private.sync_user_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of email on auth.users
for each row execute function private.sync_user_email();

-- ============================================================
-- RLS HELPER FUNCTIONS
-- Kept in non-exposed private schema to avoid exposing SECURITY DEFINER RPCs.
-- ============================================================

grant usage on schema private to authenticated;

create or replace function private.user_has_workspace_role(
  p_workspace_id uuid,
  p_roles public.app_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and (p_roles is null or wm.role = any(p_roles))
  );
$$;

revoke execute on function private.user_has_workspace_role(uuid, public.app_role[]) from public, anon;
grant execute on function private.user_has_workspace_role(uuid, public.app_role[]) to authenticated;

create or replace function private.user_is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.user_has_workspace_role(
    p_workspace_id, array['admin'::public.app_role]
  );
$$;

revoke execute on function private.user_is_workspace_admin(uuid) from public, anon;
grant execute on function private.user_is_workspace_admin(uuid) to authenticated;

create or replace function private.user_is_organiser_or_admin(p_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.user_has_workspace_role(
    p_workspace_id,
    array['admin'::public.app_role, 'organiser'::public.app_role]
  );
$$;

revoke execute on function private.user_is_organiser_or_admin(uuid) from public, anon;
grant execute on function private.user_is_organiser_or_admin(uuid) to authenticated;

create or replace function private.user_can_view_meeting(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.meetings m
    where m.id = p_meeting_id
      and (
        (
          m.visibility = 'workspace'
          and private.user_has_workspace_role(m.workspace_id, null)
        )
        or
        (
          m.visibility = 'private'
          and (
            m.organiser_id = (select auth.uid())
            or exists (
              select 1 from public.meeting_participants mp
              where mp.meeting_id = m.id
                and mp.user_id = (select auth.uid())
            )
            or exists (
              select 1
              from public.tasks t
              join public.task_assignees ta on ta.task_id = t.id
              where t.meeting_id = m.id
                and ta.user_id = (select auth.uid())
            )
          )
        )
      )
  );
$$;

revoke execute on function private.user_can_view_meeting(uuid) from public, anon;
grant execute on function private.user_can_view_meeting(uuid) to authenticated;

-- ============================================================
-- WORKSPACE CREATION RPC
-- Creates the workspace and its first Admin atomically.
-- ============================================================

create or replace function public.create_workspace(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then
    raise exception 'Workspace name must be between 1 and 120 characters';
  end if;

  insert into public.workspaces(name, created_by)
  values (btrim(p_name), v_user_id)
  returning id into v_workspace_id;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'admin');

  return v_workspace_id;
end;
$$;

revoke execute on function public.create_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;

-- ============================================================
-- LAST-ADMIN PROTECTION
-- ============================================================

create or replace function private.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_count integer;
begin
  if tg_op = 'DELETE' then
    if old.role = 'admin' then
      select count(*) into v_admin_count
      from public.workspace_members
      where workspace_id = old.workspace_id
        and role = 'admin'
        and user_id <> old.user_id;
      if v_admin_count = 0 then
        raise exception 'A workspace must always have at least one admin';
      end if;
    end if;
    return old;
  end if;

  if old.role = 'admin' and new.role <> 'admin' then
    select count(*) into v_admin_count
    from public.workspace_members
    where workspace_id = old.workspace_id
      and role = 'admin'
      and user_id <> old.user_id;
    if v_admin_count = 0 then
      raise exception 'A workspace must always have at least one admin';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.prevent_last_admin_removal() from public, anon, authenticated;

drop trigger if exists prevent_last_admin_delete on public.workspace_members;
create trigger prevent_last_admin_delete before delete on public.workspace_members
for each row execute function private.prevent_last_admin_removal();

drop trigger if exists prevent_last_admin_demotion on public.workspace_members;
create trigger prevent_last_admin_demotion before update of role on public.workspace_members
for each row execute function private.prevent_last_admin_removal();

-- ============================================================
-- TASK INTEGRITY
-- Approved AI item -> exactly one task; source excerpt stays linked.
-- ============================================================

create or replace function private.validate_task_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.extracted_items%rowtype;
  v_meeting_workspace uuid;
begin
  select * into v_item
  from public.extracted_items
  where id = new.extracted_item_id;

  if new.extracted_item_id is not null then
    if not found then
      raise exception 'Referenced extracted item does not exist';
    end if;
    if v_item.review_status <> 'approved' then
      raise exception 'A task can only be created from an approved extracted item';
    end if;
    if v_item.meeting_id <> new.meeting_id then
      raise exception 'Task meeting does not match extracted item meeting';
    end if;
    if new.source_excerpt <> v_item.source_excerpt then
      raise exception 'Task source excerpt must match the approved extracted item';
    end if;
  end if;

  select workspace_id into v_meeting_workspace
  from public.meetings
  where id = new.meeting_id;

  if v_meeting_workspace is null or v_meeting_workspace <> new.workspace_id then
    raise exception 'Task workspace does not match meeting workspace';
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_task_source() from public, anon, authenticated;

drop trigger if exists validate_task_source on public.tasks;
create trigger validate_task_source before insert or update on public.tasks
for each row execute function private.validate_task_source();

-- ============================================================
-- AUDIT LOG
-- Raw transcript bodies are deliberately not audited.
-- ============================================================

create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_workspace_id uuid;
  v_target_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_ip_text text;
  v_user_agent text;
  v_meeting_id uuid;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  else
    v_old := to_jsonb(old);
  end if;

  v_target_id := nullif(coalesce(v_new ->> 'id', v_old ->> 'id'), '')::uuid;

  if tg_table_name = 'workspaces' then
    v_workspace_id := v_target_id;
  elsif tg_table_name = 'workspace_members' then
    v_workspace_id := nullif(coalesce(v_new ->> 'workspace_id', v_old ->> 'workspace_id'), '')::uuid;
  elsif tg_table_name = 'meetings' then
    v_workspace_id := nullif(coalesce(v_new ->> 'workspace_id', v_old ->> 'workspace_id'), '')::uuid;
  elsif tg_table_name = 'tasks' then
    v_workspace_id := nullif(coalesce(v_new ->> 'workspace_id', v_old ->> 'workspace_id'), '')::uuid;
  elsif tg_table_name = 'extracted_items' then
    v_meeting_id := nullif(coalesce(v_new ->> 'meeting_id', v_old ->> 'meeting_id'), '')::uuid;
    select workspace_id into v_workspace_id from public.meetings where id = v_meeting_id;
  end if;

  v_ip_text := split_part(
    current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1
  );
  v_user_agent := current_setting('request.headers', true)::json ->> 'user-agent';

  insert into audit.audit_log(
    workspace_id, actor_id, action_type, target_table, target_id,
    status, old_data, new_data, client_ip, user_agent
  ) values (
    v_workspace_id,
    v_actor,
    tg_op,
    tg_table_schema || '.' || tg_table_name,
    v_target_id,
    case when tg_op = 'DELETE' then 'deleted' else 'success' end,
    v_old,
    v_new,
    case when v_ip_text ~ '^[0-9a-fA-F:.]+$' then v_ip_text::inet else null end,
    v_user_agent
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke execute on function private.audit_row_change() from public, anon, authenticated;

drop trigger if exists audit_workspaces on public.workspaces;
create trigger audit_workspaces after insert or update or delete on public.workspaces
for each row execute function private.audit_row_change();

drop trigger if exists audit_workspace_members on public.workspace_members;
create trigger audit_workspace_members after insert or update or delete on public.workspace_members
for each row execute function private.audit_row_change();

drop trigger if exists audit_meetings on public.meetings;
create trigger audit_meetings after insert or update or delete on public.meetings
for each row execute function private.audit_row_change();

drop trigger if exists audit_extracted_items on public.extracted_items;
create trigger audit_extracted_items after insert or update or delete on public.extracted_items
for each row execute function private.audit_row_change();

drop trigger if exists audit_tasks on public.tasks;
create trigger audit_tasks after insert or update or delete on public.tasks
for each row execute function private.audit_row_change();

-- ============================================================
-- RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.transcripts enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.extracted_items enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.consents enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.llm_runs enable row level security;
alter table audit.audit_log enable row level security;

-- Start from deny-by-default for API roles.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all tables in schema audit from anon, authenticated;

-- Reads/writes allowed at table level; RLS decides which rows.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select on audit.audit_log to authenticated;

-- ------------------------------------------------------------
-- Profiles
-- ------------------------------------------------------------

create policy profiles_select_same_workspace
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = profiles.id
  )
);

create policy profiles_update_self
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- ------------------------------------------------------------
-- Workspaces
-- ------------------------------------------------------------

create policy workspaces_select_member
on public.workspaces for select to authenticated
using (private.user_has_workspace_role(id, null));

create policy workspaces_update_admin
on public.workspaces for update to authenticated
using (private.user_is_workspace_admin(id))
with check (private.user_is_workspace_admin(id));

-- ------------------------------------------------------------
-- Workspace members
-- ------------------------------------------------------------

create policy workspace_members_select_member
on public.workspace_members for select to authenticated
using (private.user_has_workspace_role(workspace_id, null));

create policy workspace_members_insert_admin
on public.workspace_members for insert to authenticated
with check (private.user_is_workspace_admin(workspace_id));

create policy workspace_members_update_admin
on public.workspace_members for update to authenticated
using (private.user_is_workspace_admin(workspace_id))
with check (private.user_is_workspace_admin(workspace_id));

create policy workspace_members_delete_admin
on public.workspace_members for delete to authenticated
using (private.user_is_workspace_admin(workspace_id));

-- ------------------------------------------------------------
-- Meetings
-- ------------------------------------------------------------

create policy meetings_select
on public.meetings for select to authenticated
using (private.user_can_view_meeting(id));

create policy meetings_insert_organiser
on public.meetings for insert to authenticated
with check (
  private.user_is_organiser_or_admin(workspace_id)
  and organiser_id = (select auth.uid())
);

create policy meetings_update_organiser
on public.meetings for update to authenticated
using (
  private.user_is_organiser_or_admin(workspace_id)
  and organiser_id = (select auth.uid())
)
with check (
  private.user_is_organiser_or_admin(workspace_id)
  and organiser_id = (select auth.uid())
);

create policy meetings_delete_organiser
on public.meetings for delete to authenticated
using (
  private.user_is_organiser_or_admin(workspace_id)
  and organiser_id = (select auth.uid())
);

-- ------------------------------------------------------------
-- Participants
-- ------------------------------------------------------------

create policy meeting_participants_select
on public.meeting_participants for select to authenticated
using (private.user_can_view_meeting(meeting_id));

create policy meeting_participants_insert_organiser
on public.meeting_participants for insert to authenticated
with check (
  exists (
    select 1 from public.meetings m
    where m.id = meeting_id
      and private.user_is_organiser_or_admin(m.workspace_id)
      and m.organiser_id = (select auth.uid())
  )
);

create policy meeting_participants_delete_organiser
on public.meeting_participants for delete to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = meeting_id
      and private.user_is_organiser_or_admin(m.workspace_id)
      and m.organiser_id = (select auth.uid())
  )
);

-- ------------------------------------------------------------
-- Transcripts
-- ------------------------------------------------------------

create policy transcripts_select
on public.transcripts for select to authenticated
using (private.user_can_view_meeting(meeting_id));

create policy transcripts_insert_organiser
on public.transcripts for insert to authenticated
with check (
  exists (
    select 1 from public.meetings m
    where m.id = meeting_id
      and private.user_is_organiser_or_admin(m.workspace_id)
  )
);

create policy transcripts_update_organiser
on public.transcripts for update to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = meeting_id
      and private.user_is_organiser_or_admin(m.workspace_id)
  )
)
with check (
  exists (
    select 1 from public.meetings m
    where m.id = meeting_id
      and private.user_is_organiser_or_admin(m.workspace_id)
  )
);

create policy transcripts_delete_organiser
on public.transcripts for delete to authenticated
using (
  exists (
    select 1 from public.meetings m
    where m.id = meeting_id
      and private.user_is_organiser_or_admin(m.workspace_id)
  )
);

-- ------------------------------------------------------------
-- Transcript segments
-- ------------------------------------------------------------

create policy transcript_segments_select
on public.transcript_segments for select to authenticated
using (
  exists (
    select 1 from public.transcripts t
    where t.id = transcript_id
      and private.user_can_view_meeting(t.meeting_id)
  )
);

create policy transcript_segments_insert_organiser
on public.transcript_segments for insert to authenticated
with check (
  exists (
    select 1
    from public.transcripts t
    join public.meetings m on m.id = t.meeting_id
    where t.id = transcript_id
      and private.user_is_organiser_or_admin(m.workspace_id)
  )
);

create policy transcript_segments_update_organiser
on public.transcript_segments for update to authenticated
using (
  exists (
    select 1
    from public.transcripts t
    join public.meetings m on m.id = t.meeting_id
    where t.id = transcript_id
      and private.user_is_organiser_or_admin(m.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.transcripts t
    join public.meetings m on m.id = t.meeting_id
    where t.id = transcript_id
      and private.user_is_organiser_or_admin(m.workspace_id)
  )
);

-- ------------------------------------------------------------
-- Extracted items
-- Writes are intentionally backend-only in normal operation.
-- Service role bypasses RLS. Review endpoint should use backend auth.
-- ------------------------------------------------------------

create policy extracted_items_select
on public.extracted_items for select to authenticated
using (private.user_can_view_meeting(meeting_id));

-- ------------------------------------------------------------
-- Tasks
-- Active tasks are created/edited by backend after approval.
-- Client-side authenticated users may only change task status (enforced by column-level privileges).
-- Assignees may update status of their tasks; Organisers/Admins may update status of any workspace task.
-- ------------------------------------------------------------

create policy tasks_select
on public.tasks for select to authenticated
using (private.user_can_view_meeting(meeting_id));

create policy tasks_update_status_assignee
on public.tasks for update to authenticated
using (
  private.user_can_view_meeting(meeting_id)
  and (
    exists (
      select 1 from public.task_assignees ta
      where ta.task_id = tasks.id
        and ta.user_id = (select auth.uid())
    )
    or private.user_is_organiser_or_admin(tasks.workspace_id)
  )
)
with check (
  private.user_can_view_meeting(meeting_id)
);

-- ------------------------------------------------------------
-- Task assignees
-- Read is client-visible; mutations are backend-only.
-- ------------------------------------------------------------

create policy task_assignees_select
on public.task_assignees for select to authenticated
using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and private.user_can_view_meeting(t.meeting_id)
  )
);

-- ------------------------------------------------------------
-- Consents
-- ------------------------------------------------------------

create policy consents_select
on public.consents for select to authenticated
using (private.user_can_view_meeting(meeting_id));

create policy consents_insert_organiser
on public.consents for insert to authenticated
with check (
  attested_by = (select auth.uid())
  and exists (
    select 1 from public.meetings m
    where m.id = meeting_id
      and private.user_is_organiser_or_admin(m.workspace_id)
  )
);

-- ------------------------------------------------------------
-- Notifications
-- Backend creates/deletes notifications. Users read their own.
-- ------------------------------------------------------------

create policy notifications_select_own
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

create policy notifications_update_own
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- Push subscriptions
-- ------------------------------------------------------------

create policy push_subscriptions_select_own
on public.push_subscriptions for select to authenticated
using (user_id = (select auth.uid()));

create policy push_subscriptions_insert_own
on public.push_subscriptions for insert to authenticated
with check (user_id = (select auth.uid()));

create policy push_subscriptions_update_own
on public.push_subscriptions for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy push_subscriptions_delete_own
on public.push_subscriptions for delete to authenticated
using (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- LLM runs: metadata only, no raw transcript payloads.
-- Writes are backend-only.
-- ------------------------------------------------------------

create policy llm_runs_select
on public.llm_runs for select to authenticated
using (private.user_can_view_meeting(meeting_id));

-- ------------------------------------------------------------
-- Audit log: workspace Admins only.
-- ------------------------------------------------------------

create policy audit_log_select_admin
on audit.audit_log for select to authenticated
using (
  workspace_id is not null
  and private.user_is_workspace_admin(workspace_id)
);

-- ============================================================
-- COLUMN-LEVEL PRIVILEGES
-- Prevent Team Members from changing task fields other than status.
-- PostgreSQL evaluates privileges before RLS, so both layers apply.
-- ============================================================

revoke update on table public.tasks from authenticated;
grant update (status) on table public.tasks to authenticated;

-- Profiles: users can edit only their own mutable profile fields.
revoke update on table public.profiles from authenticated;
grant update (display_name, timezone, avatar_url) on table public.profiles to authenticated;

-- ============================================================
-- STORAGE
-- Private bucket. Path convention:
-- meeting-transcripts/<workspace_id>/<meeting_id>/<filename>
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meeting-transcripts',
  'meeting-transcripts',
  false,
  10485760,
  array[
    'text/plain',
    'text/vtt',
    'application/x-subrip',
    'text/srt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy storage_transcripts_select
on storage.objects for select to authenticated
using (
  bucket_id = 'meeting-transcripts'
  and exists (
    select 1
    from public.meetings m
    where m.id::text = (storage.foldername(name))[2]
      and m.workspace_id::text = (storage.foldername(name))[1]
      and private.user_can_view_meeting(m.id)
  )
);

create policy storage_transcripts_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'meeting-transcripts'
  and exists (
    select 1
    from public.meetings m
    where m.id::text = (storage.foldername(name))[2]
      and m.workspace_id::text = (storage.foldername(name))[1]
      and private.user_is_organiser_or_admin(m.workspace_id)
  )
);

create policy storage_transcripts_update
on storage.objects for update to authenticated
using (
  bucket_id = 'meeting-transcripts'
  and exists (
    select 1
    from public.meetings m
    where m.id::text = (storage.foldername(name))[2]
      and m.workspace_id::text = (storage.foldername(name))[1]
      and private.user_is_organiser_or_admin(m.workspace_id)
  )
)
with check (
  bucket_id = 'meeting-transcripts'
  and exists (
    select 1
    from public.meetings m
    where m.id::text = (storage.foldername(name))[2]
      and m.workspace_id::text = (storage.foldername(name))[1]
      and private.user_is_organiser_or_admin(m.workspace_id)
  )
);

create policy storage_transcripts_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'meeting-transcripts'
  and exists (
    select 1
    from public.meetings m
    where m.id::text = (storage.foldername(name))[2]
      and m.workspace_id::text = (storage.foldername(name))[1]
      and private.user_is_organiser_or_admin(m.workspace_id)
  )
);

-- ============================================================
-- DEFAULT PRIVILEGES
-- Keep future objects locked down unless explicitly granted.
-- ============================================================

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role, public;

alter default privileges for role postgres in schema public
  revoke usage, select, update on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;

commit;

-- ============================================================
-- POST-SCRIPT CHECKS
-- Run these separately after the transaction succeeds.
-- ============================================================
-- select tablename, rowsecurity from pg_tables
-- where schemaname = 'public' order by tablename;
--
-- select count(*) from public.workspace_members;
--
-- select n.nspname, p.proname, has_function_privilege('anon', p.oid, 'execute')
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname in ('public','private');
