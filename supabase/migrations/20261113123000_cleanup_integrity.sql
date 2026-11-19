-- Service-role-only review transaction. Actor permissions are checked again inside the transaction.
-- Calendar credentials must never be selectable from a browser.
revoke all on public.calendar_connections from anon, authenticated;

create or replace function public.review_meeting_items(
  p_meeting_id uuid, p_actor_id uuid, p_items jsonb,
  p_decision text default 'approved', p_reason text default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  m public.meetings%rowtype;
  candidate public.extracted_items%rowtype;
  change jsonb;
  owner_id uuid;
  task_id uuid;
  prerequisite_id uuid;
  raw_dependency uuid;
  created_ids uuid[] := '{}';
  transcript_text text;
  seen_ids uuid[] := '{}';
begin
  select * into m from public.meetings where id = p_meeting_id;
  if not found or m.lifecycle = 'deleted' then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;
  if m.visibility = 'private' and m.organiser_id <> p_actor_id
     and not exists (select 1 from public.meeting_participants where meeting_id = m.id and user_id = p_actor_id)
     and not exists (select 1 from public.tasks t join public.task_assignees a on a.task_id = t.id where t.meeting_id = m.id and a.user_id = p_actor_id) then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;
  -- Serialize reviews and dependency changes in a workspace, including concurrent requests.
  perform 1 from public.workspaces where id = m.workspace_id for update;
  perform 1 from public.workspace_members where workspace_id = m.workspace_id
    and user_id = p_actor_id and role in ('admin', 'organiser') for share;
  if not found then raise exception 'Organiser access required' using errcode = '42501'; end if;
  if p_decision not in ('approved', 'rejected') or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Invalid review request' using errcode = '22023';
  end if;
  select canonical_text into transcript_text from public.transcripts where meeting_id = m.id;

  for change in select value from jsonb_array_elements(p_items) loop
    if (change->>'id')::uuid = any(seen_ids) then
      raise exception 'Duplicate candidate in request' using errcode = '22023';
    end if;
    seen_ids := array_append(seen_ids, (change->>'id')::uuid);
    select * into candidate from public.extracted_items
      where id = (change->>'id')::uuid and meeting_id = m.id for update;
    if not found or candidate.review_status <> 'needs_review' then
      raise exception 'Candidate missing or already reviewed' using errcode = '40001';
    end if;
    if p_decision = 'rejected' then
      update public.extracted_items set review_status = 'rejected', reviewed_by = p_actor_id,
        reviewed_at = now(), rejection_reason = p_reason where id = candidate.id;
      continue;
    end if;
    if change->>'execution_type' = 'agent' then
      raise exception 'Automatic execution is unavailable' using errcode = '22023';
    end if;
    if transcript_text is null or position(candidate.source_excerpt in transcript_text) = 0 then
      raise exception 'Source excerpt is not grounded in the transcript' using errcode = '22023';
    end if;
    owner_id := case when change ? 'owner_user_id' then (change->>'owner_user_id')::uuid else candidate.owner_user_id end;
    if owner_id is not null then
      perform 1 from public.workspace_members where workspace_id = m.workspace_id and user_id = owner_id for share;
      if not found then raise exception 'Assignee is not a workspace member' using errcode = '22023'; end if;
    end if;
    update public.extracted_items set
      task = case when change ? 'task' then change->>'task' else task end,
      owner_user_id = owner_id,
      deadline_utc = case when change ? 'deadline_utc' then (change->>'deadline_utc')::timestamptz else deadline_utc end,
      deadline_timezone = case when change ? 'deadline_utc' then
        case when change->>'deadline_utc' is null then null else m.timezone end else deadline_timezone end,
      priority = case when change ? 'priority' then (change->>'priority')::public.task_priority else priority end,
      review_status = 'approved', reviewed_by = p_actor_id, reviewed_at = now()
      where id = candidate.id returning * into candidate;
    if candidate.type = 'action' then
      insert into public.tasks(workspace_id, meeting_id, extracted_item_id, title, deadline_utc,
        priority, source_excerpt, created_by, external_owner_label)
      values(m.workspace_id, m.id, candidate.id, candidate.task, candidate.deadline_utc,
        candidate.priority, candidate.source_excerpt, p_actor_id,
        case when owner_id is null and candidate.owner_name <> 'AI Agent' then candidate.owner_name else null end)
      returning id into task_id;
      created_ids := array_append(created_ids, task_id);
      if owner_id is not null then
        insert into public.task_assignees(task_id, user_id, is_primary) values(task_id, owner_id, true);
      end if;
    end if;
  end loop;
  -- Link after every task exists, so dependencies can point forward within the batch.
  if p_decision = 'approved' then
    for change in select value from jsonb_array_elements(p_items) loop
      select * into candidate from public.extracted_items where id = (change->>'id')::uuid;
      if candidate.type <> 'action' then continue; end if;
      raw_dependency := case when change ? 'blocked_by_id' then (change->>'blocked_by_id')::uuid
        when candidate.rejection_reason like 'depends_on:%' then split_part(candidate.rejection_reason, ':', 2)::uuid else null end;
      if raw_dependency is null then continue; end if;
      select id into prerequisite_id from public.tasks where workspace_id = m.workspace_id
        and (id = raw_dependency or extracted_item_id = raw_dependency) order by id limit 1;
      if prerequisite_id is null then
        raise exception 'Prerequisite is not an approved task in this workspace' using errcode = '22023';
      end if;
      update public.tasks set blocked_by = prerequisite_id,
        status = case when (select status from public.tasks where id = prerequisite_id) = 'done'
          then 'todo'::public.task_status else 'blocked'::public.task_status end
        where extracted_item_id = candidate.id;
    end loop;
  end if;
  return jsonb_build_object('approved', case when p_decision = 'approved' then jsonb_array_length(p_items) else 0 end,
    'rejected', case when p_decision = 'rejected' then jsonb_array_length(p_items) else 0 end, 'task_ids', to_jsonb(created_ids));
end;
$$;
revoke all on function public.review_meeting_items(uuid, uuid, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.review_meeting_items(uuid, uuid, jsonb, text, text) to service_role;

-- Apply the same graph invariants to backend writes and permitted frontend status updates.
create or replace function private.guard_task_graph() returns trigger
language plpgsql security definer set search_path = '' as $$
declare prerequisite public.tasks%rowtype;
begin
  perform 1 from public.workspaces where id = new.workspace_id for update;
  if new.blocked_by is not null then
    select * into prerequisite from public.tasks where id = new.blocked_by and workspace_id = new.workspace_id;
    if not found then raise exception 'Prerequisite must belong to the same workspace' using errcode = '22023'; end if;
    if exists (
      with recursive chain as (
        select id, blocked_by from public.tasks where id = new.blocked_by
        union select t.id, t.blocked_by from public.tasks t join chain c on t.id = c.blocked_by
      ) select 1 from chain where id = new.id
    ) then raise exception 'Circular dependency' using errcode = '22023'; end if;
    if new.status in ('todo', 'in_progress', 'done') and prerequisite.status <> 'done' then
      raise exception 'Prerequisite must be completed first' using errcode = '22023';
    end if;
  end if;
  new.completed_at := case when new.status = 'done' then coalesce(new.completed_at, now()) else null end;
  return new;
end;
$$;
revoke all on function private.guard_task_graph() from public, anon, authenticated;
create trigger guard_task_graph before insert or update of blocked_by, status on public.tasks
  for each row execute function private.guard_task_graph();

create or replace function private.cascade_task_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'done' and old.status <> 'done' then
    update public.tasks set status = 'todo' where workspace_id = new.workspace_id and blocked_by = new.id and status = 'blocked';
  elsif old.status = 'done' and new.status <> 'done' then
    update public.tasks set status = 'blocked' where workspace_id = new.workspace_id and blocked_by = new.id and status <> 'blocked';
  end if;
  return new;
end;
$$;
revoke all on function private.cascade_task_status() from public, anon, authenticated;
create trigger cascade_task_status after update of status on public.tasks
  for each row when (old.status is distinct from new.status) execute function private.cascade_task_status();

-- Carry tasks into later meetings without changing transcript provenance.
create table public.task_carryovers (
  task_id uuid not null references public.tasks(id) on delete cascade,
  target_meeting_id uuid not null references public.meetings(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (task_id, target_meeting_id)
);
create index task_carryovers_workspace_idx on public.task_carryovers(workspace_id);
alter table public.task_carryovers enable row level security;
create policy task_carryovers_select on public.task_carryovers for select to authenticated
using (private.user_has_workspace_role(workspace_id, null)
  and private.user_can_view_meeting(target_meeting_id)
  and exists (select 1 from public.tasks t where t.id = task_id and private.user_can_view_meeting(t.meeting_id)));
revoke all on public.task_carryovers from anon, authenticated;
grant select on public.task_carryovers to authenticated;
grant select, insert, update, delete on public.task_carryovers to service_role;
create function private.validate_carryover() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.tasks t join public.meetings m on m.id = new.target_meeting_id
     where t.id = new.task_id and t.workspace_id = new.workspace_id and m.workspace_id = new.workspace_id
     and t.meeting_id <> m.id and t.status <> 'done') then
    raise exception 'Carryover requires an unfinished task and a different meeting in the same workspace' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_carryover() from public, anon, authenticated;
create trigger validate_carryover before insert or update on public.task_carryovers
for each row execute function private.validate_carryover();

-- Private participation/assignment never overrides current workspace membership or deletion.
create or replace function private.user_can_view_meeting(p_meeting_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.meetings m where m.id = p_meeting_id and m.lifecycle <> 'deleted'
      and private.user_has_workspace_role(m.workspace_id, null)
      and (m.visibility = 'workspace' or m.organiser_id = (select auth.uid())
        or exists (select 1 from public.meeting_participants mp where mp.meeting_id=m.id and mp.user_id=(select auth.uid()))
        or exists (select 1 from public.tasks t join public.task_assignees a on a.task_id=t.id
                   where t.meeting_id=m.id and a.user_id=(select auth.uid())))
  );
$$;
revoke all on function private.user_can_view_meeting(uuid) from public, anon;
grant execute on function private.user_can_view_meeting(uuid) to authenticated;
