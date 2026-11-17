-- Run ONLY on an EMPTY disposable PostgreSQL test database, never an application database.
-- The unconditional CREATE TABLE deliberately fails if workspace_members already exists.
-- This fixture models the deployed owner/member role column as text and also checks legacy roles.
-- Applies the real migration; it does not copy its function implementation into the test.
\set ON_ERROR_STOP on

begin;
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end;
$$;

create table public.workspace_members (
  workspace_id uuid not null,
  user_id uuid not null,
  role text not null,
  primary key (workspace_id, user_id)
);
grant usage on schema public to service_role, anon, authenticated;
grant select, update on public.workspace_members to service_role;
commit;

\ir ../../supabase/migrations/20261117094527_github_workspace_owner_roles.sql

begin;
insert into public.workspace_members(workspace_id, user_id, role) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'member'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'admin'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'organiser'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'unknown');

do $$
begin
  assert not (select prosecdef from pg_proc where oid = 'public.github_assert_admin(uuid,uuid)'::regprocedure),
    'GitHub role check must remain invoker-rights';
  assert not has_function_privilege('anon', 'public.github_assert_admin(uuid,uuid)', 'execute');
  assert not has_function_privilege('authenticated', 'public.github_assert_admin(uuid,uuid)', 'execute');
  assert has_function_privilege('service_role', 'public.github_assert_admin(uuid,uuid)', 'execute');
end;
$$;

set local role service_role;
do $$
declare
  workspace uuid := '20000000-0000-0000-0000-000000000001';
  owner_id uuid := '10000000-0000-0000-0000-000000000001';
  actor uuid;
begin
  perform public.github_assert_admin(workspace, owner_id);
  perform public.github_assert_admin(workspace, '10000000-0000-0000-0000-000000000003');

  foreach actor in array array[
    '10000000-0000-0000-0000-000000000002'::uuid,
    '10000000-0000-0000-0000-000000000004'::uuid,
    '10000000-0000-0000-0000-000000000005'::uuid,
    '10000000-0000-0000-0000-000000000006'::uuid
  ] loop
    begin
      perform public.github_assert_admin(workspace, actor);
      raise exception 'Non-manager passed GitHub role check';
    exception when insufficient_privilege then null;
    end;
  end loop;

  begin
    perform public.github_assert_admin('20000000-0000-0000-0000-000000000002', owner_id);
    raise exception 'Owner permissions crossed workspace boundary';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.github_assert_admin(workspace, null);
    raise exception 'Missing actor passed GitHub role check';
  exception when insufficient_privilege then null;
  end;

  update public.workspace_members set role = 'member' where workspace_id = workspace and user_id = owner_id;
  begin
    perform public.github_assert_admin(workspace, owner_id);
    raise exception 'Demoted owner passed GitHub role check';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;
