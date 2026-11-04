-- Backend-only GitHub App integration. No credentials or tokens are persisted.
begin;

create table public.github_installations (
  id bigint primary key check (id > 0),
  account_id bigint not null,
  account_login text not null,
  account_type text not null,
  permissions jsonb not null default '{}',
  status text not null check (status in ('active', 'suspended', 'deleted')),
  observed_at timestamptz not null
);

create table public.github_workspace_installations (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  installation_id bigint not null references public.github_installations(id),
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, installation_id)
);
create index github_workspace_installations_installation_idx
  on public.github_workspace_installations(installation_id);

-- Candidates are only repositories verified through an installer's GitHub admin access.
-- A global installation's repositories must never be enumerated to another workspace.
create table public.github_repositories (
  workspace_id uuid not null,
  repository_id bigint not null check (repository_id > 0),
  installation_id bigint not null,
  full_name text not null,
  private boolean not null,
  connected boolean not null default false,
  primary key (workspace_id, repository_id),
  foreign key (workspace_id, installation_id)
    references public.github_workspace_installations(workspace_id, installation_id) on delete cascade
);
create index github_repositories_installation_idx on public.github_repositories(installation_id);

create table public.github_repository_permissions (
  workspace_id uuid not null,
  repository_id bigint not null,
  user_id uuid not null,
  level text not null check (level in ('read', 'write')),
  denied_actions text[] not null default '{}',
  primary key (workspace_id, repository_id, user_id),
  foreign key (workspace_id, repository_id)
    references public.github_repositories(workspace_id, repository_id) on delete cascade,
  foreign key (workspace_id, user_id)
    references public.workspace_members(workspace_id, user_id) on delete cascade,
  check (denied_actions <@ array[
    'read_repository', 'read_issues', 'create_issues', 'comment', 'create_branch', 'open_pull_request'
  ]::text[])
);
create index github_repository_permissions_member_idx
  on public.github_repository_permissions(workspace_id, user_id);

create table public.github_installation_states (
  state_hash text primary key check (length(state_hash) = 64),
  workspace_id uuid not null,
  user_id uuid not null,
  phase text not null check (phase in ('install', 'oauth')),
  installation_id bigint,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  foreign key (workspace_id, user_id)
    references public.workspace_members(workspace_id, user_id) on delete cascade,
  check ((phase = 'install' and installation_id is null) or (phase = 'oauth' and installation_id > 0))
);
create index github_states_member_idx on public.github_installation_states(workspace_id, user_id);

create table public.github_webhook_deliveries (
  delivery_id uuid primary key,
  payload_hash text not null,
  event text not null,
  processed_at timestamptz not null default now()
);

-- These tables and RPCs have no browser access, including for workspace admins.
do $$
declare t text;
begin
  foreach t in array array['github_installations', 'github_workspace_installations', 'github_repositories',
    'github_repository_permissions', 'github_installation_states', 'github_webhook_deliveries']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant usage on schema audit to service_role;
grant insert on audit.audit_log to service_role;
grant usage on sequence audit.audit_log_id_seq to service_role;

create function public.github_assert_admin(p_workspace_id uuid, p_actor_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  -- Hold membership through each mutation so a concurrent role revocation cannot slip past it.
  perform 1 from public.workspace_members where workspace_id = p_workspace_id
    and user_id = p_actor_id and role = 'admin' for share;
  if not found then raise insufficient_privilege; end if;
end $$;

create function public.github_audit(
  p_workspace_id uuid, p_actor_id uuid, p_action text,
  p_repository_id bigint default null, p_details jsonb default '{}'
) returns void language sql set search_path = '' as $$
  insert into audit.audit_log(workspace_id, actor_id, action_type, target_table, status, new_data)
  values (p_workspace_id, p_actor_id, 'github.' || p_action, 'github_repositories', 'success',
    p_details || jsonb_build_object('repository_id', p_repository_id));
$$;

create function public.github_begin_state(
  p_workspace_id uuid, p_actor_id uuid, p_state_hash text, p_phase text, p_installation_id bigint
) returns void language plpgsql set search_path = '' as $$
begin
  perform public.github_assert_admin(p_workspace_id, p_actor_id);
  delete from public.github_installation_states where expires_at < now();
  insert into public.github_installation_states(state_hash, workspace_id, user_id, phase, installation_id)
    values (p_state_hash, p_workspace_id, p_actor_id, p_phase, p_installation_id);
end $$;

create function public.github_consume_state(p_state_hash text, p_actor_id uuid, p_phase text)
returns jsonb language plpgsql set search_path = '' as $$
declare s public.github_installation_states;
begin
  delete from public.github_installation_states where state_hash = p_state_hash and user_id = p_actor_id
    and phase = p_phase and expires_at > clock_timestamp() returning * into s;
  if not found then return null; end if;
  perform public.github_assert_admin(s.workspace_id, p_actor_id);
  return to_jsonb(s);
end $$;

create function public.github_complete_connection(
  p_workspace_id uuid, p_actor_id uuid, p_installation jsonb, p_repositories jsonb
) returns void language plpgsql set search_path = '' as $$
declare iid bigint := (p_installation->>'id')::bigint;
begin
  perform pg_advisory_xact_lock(iid);
  perform public.github_assert_admin(p_workspace_id, p_actor_id);
  if exists (select 1 from public.github_installations where id = iid
    and observed_at > (p_installation->>'observed_at')::timestamptz)
    or p_installation->>'status' <> 'active' then
    raise invalid_parameter_value using message = 'Stale installation verification';
  end if;
  insert into public.github_installations
    select * from jsonb_populate_record(null::public.github_installations, p_installation)
    on conflict (id) do update set account_id = excluded.account_id, account_login = excluded.account_login,
      account_type = excluded.account_type, permissions = excluded.permissions,
      status = excluded.status, observed_at = excluded.observed_at;
  insert into public.github_workspace_installations(workspace_id, installation_id, connected_by)
    values (p_workspace_id, iid, p_actor_id) on conflict (workspace_id, installation_id) do nothing;
  -- Moving to a different installation must not carry previous member grants with it.
  delete from public.github_repositories where workspace_id = p_workspace_id and installation_id <> iid
    and repository_id in (select (r->>'repository_id')::bigint from jsonb_array_elements(p_repositories) r);
  insert into public.github_repositories(workspace_id, repository_id, installation_id, full_name, private)
    select p_workspace_id, (r->>'repository_id')::bigint, iid, r->>'full_name', (r->>'private')::boolean
    from jsonb_array_elements(p_repositories) r
    on conflict (workspace_id, repository_id) do update set full_name = excluded.full_name, private = excluded.private;
  perform public.github_audit(p_workspace_id, p_actor_id, 'connected', null,
    jsonb_build_object('installation_id', iid));
end $$;

create function public.github_manage_repository(
  p_workspace_id uuid, p_actor_id uuid, p_repository_id bigint, p_connected boolean
) returns void language plpgsql set search_path = '' as $$
declare iid bigint;
begin
  select installation_id into iid from public.github_repositories
    where workspace_id = p_workspace_id and repository_id = p_repository_id;
  if not found then raise no_data_found; end if;
  perform pg_advisory_xact_lock(iid);
  perform public.github_assert_admin(p_workspace_id, p_actor_id);
  if p_connected and not exists (select 1 from public.github_installations where id = iid and status = 'active')
    then raise invalid_parameter_value; end if;
  update public.github_repositories set connected = p_connected
    where workspace_id = p_workspace_id and repository_id = p_repository_id;
  if not found then raise no_data_found; end if;
  if not p_connected then
    delete from public.github_repository_permissions where workspace_id = p_workspace_id
      and repository_id = p_repository_id;
  end if;
  perform public.github_audit(p_workspace_id, p_actor_id,
    case when p_connected then 'repository_connected' else 'repository_disconnected' end, p_repository_id);
end $$;

create function public.github_set_access(
  p_workspace_id uuid, p_actor_id uuid, p_repository_id bigint, p_user_id uuid, p_level text, p_denied_actions text[]
) returns void language plpgsql set search_path = '' as $$
declare iid bigint;
begin
  select installation_id into iid from public.github_repositories
    where workspace_id = p_workspace_id and repository_id = p_repository_id;
  if not found then raise no_data_found; end if;
  perform pg_advisory_xact_lock(iid);
  perform public.github_assert_admin(p_workspace_id, p_actor_id);
  if not exists (select 1 from public.github_repositories r join public.github_installations i
    on i.id = r.installation_id where r.workspace_id = p_workspace_id and r.repository_id = p_repository_id
    and r.connected and i.status = 'active') then raise no_data_found; end if;
  if p_level = 'none' then
    delete from public.github_repository_permissions where workspace_id = p_workspace_id
      and repository_id = p_repository_id and user_id = p_user_id;
  else
    insert into public.github_repository_permissions(workspace_id, repository_id, user_id, level, denied_actions)
      values (p_workspace_id, p_repository_id, p_user_id, p_level, p_denied_actions)
      on conflict (workspace_id, repository_id, user_id) do update
        set level = excluded.level, denied_actions = excluded.denied_actions;
  end if;
  perform public.github_audit(p_workspace_id, p_actor_id, 'access_updated', p_repository_id,
    jsonb_build_object('user_id', p_user_id, 'level', p_level, 'denied_actions', p_denied_actions));
end $$;

create function public.github_disconnect_installation(p_workspace_id uuid, p_actor_id uuid, p_installation_id bigint)
returns void language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(p_installation_id);
  perform public.github_assert_admin(p_workspace_id, p_actor_id);
  delete from public.github_workspace_installations
    where workspace_id = p_workspace_id and installation_id = p_installation_id;
  if not found then raise no_data_found; end if;
  perform public.github_audit(p_workspace_id, p_actor_id, 'disconnected', null,
    jsonb_build_object('installation_id', p_installation_id));
end $$;

-- One transaction for lifecycle updates, cascading permission revocation, audit and delivery receipt.
create function public.github_sync_installation(
  p_installation jsonb, p_repositories jsonb, p_delivery_id uuid default null,
  p_payload_hash text default '', p_event text default 'manual',
  p_workspace_id uuid default null, p_actor_id uuid default null
) returns boolean language plpgsql set search_path = '' as $$
declare iid bigint := (p_installation->>'id')::bigint;
declare wid uuid;
begin
  perform pg_advisory_xact_lock(iid);
  if p_delivery_id is not null then
    insert into public.github_webhook_deliveries(delivery_id, payload_hash, event)
      values (p_delivery_id, p_payload_hash, p_event) on conflict do nothing;
    if not found then
      if exists (select 1 from public.github_webhook_deliveries where delivery_id = p_delivery_id
        and payload_hash <> p_payload_hash) then raise invalid_parameter_value; end if;
      return false;
    end if;
  else
    perform public.github_assert_admin(p_workspace_id, p_actor_id);
    if not exists (select 1 from public.github_workspace_installations
      where workspace_id = p_workspace_id and installation_id = iid) then raise no_data_found; end if;
  end if;
  -- Ignore old in-flight snapshots; all webhook snapshots are fetched live, not trusted payload deltas.
  update public.github_installations set status = p_installation->>'status',
    account_id = coalesce((p_installation->>'account_id')::bigint, account_id),
    account_login = coalesce(p_installation->>'account_login', account_login),
    account_type = coalesce(p_installation->>'account_type', account_type),
    permissions = coalesce(p_installation->'permissions', '{}'::jsonb),
    observed_at = (p_installation->>'observed_at')::timestamptz
    where id = iid and observed_at <= (p_installation->>'observed_at')::timestamptz;
  if not found then return true; end if;
  for wid in select workspace_id from public.github_workspace_installations where installation_id = iid loop
    perform public.github_audit(wid, p_actor_id, 'installation_synced', null,
      jsonb_build_object('installation_id', iid, 'status', p_installation->>'status', 'event', p_event));
  end loop;
  -- Never automatically add new repositories or restore old grants after access returns.
  delete from public.github_repositories where installation_id = iid and (
    p_installation->>'status' <> 'active' or repository_id not in (
      select (r->>'repository_id')::bigint from jsonb_array_elements(p_repositories) r
    ));
  update public.github_repositories r set full_name = v->>'full_name', private = (v->>'private')::boolean
    from jsonb_array_elements(p_repositories) v
    where r.installation_id = iid and r.repository_id = (v->>'repository_id')::bigint;
  return true;
end $$;

create function public.github_repository_context(p_workspace_id uuid, p_actor_id uuid, p_repository_id bigint)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('installation_id', r.installation_id, 'level', p.level,
    'denied_actions', p.denied_actions, 'permissions', i.permissions)
  from public.github_repositories r join public.github_installations i on i.id = r.installation_id
  join public.github_repository_permissions p on p.workspace_id = r.workspace_id and p.repository_id = r.repository_id
  join public.workspace_members m on m.workspace_id = p.workspace_id and m.user_id = p.user_id
  where r.workspace_id = p_workspace_id and r.repository_id = p_repository_id and p.user_id = p_actor_id
    and r.connected and i.status = 'active';
$$;

do $$
declare f record;
begin
  for f in select oid::regprocedure as signature from pg_proc
    where pronamespace = 'public'::regnamespace and left(proname, 7) = 'github_'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
    execute format('grant execute on function %s to service_role', f.signature);
  end loop;
end $$;

commit;
