-- Run after migrations on an isolated PostgreSQL test database, never a production database.
-- All fixtures are rolled back. Uses the real functions, constraints, cascades and role grants.
begin;

insert into auth.users(id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003');
insert into public.workspaces(id, name) values
  ('20000000-0000-0000-0000-000000000001', 'GitHub test A'),
  ('20000000-0000-0000-0000-000000000002', 'GitHub test B');
insert into public.workspace_members(workspace_id, user_id, role) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'admin'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'member');

do $$
declare
  a uuid := '20000000-0000-0000-0000-000000000001';
  b uuid := '20000000-0000-0000-0000-000000000002';
  admin_a uuid := '10000000-0000-0000-0000-000000000001';
  admin_b uuid := '10000000-0000-0000-0000-000000000002';
  member uuid := '10000000-0000-0000-0000-000000000003';
  installation jsonb := '{"id":101,"account_id":50,"account_login":"example-org","account_type":"Organization",
    "permissions":{"metadata":"read"},"status":"active","observed_at":"2030-01-01T00:00:00Z"}';
  repos jsonb := '[{"repository_id":501,"full_name":"example-org/project","private":true}]';
  delivery uuid := '30000000-0000-0000-0000-000000000001';
begin
  -- Single-use state is bound to the initiating member, workspace, phase and expiry.
  perform public.github_begin_state(a, admin_a, repeat('a', 64), 'install', null);
  assert public.github_consume_state(repeat('a', 64), admin_b, 'install') is null, 'Wrong user consumed state';
  assert public.github_consume_state(repeat('a', 64), admin_a, 'oauth') is null, 'Wrong phase consumed state';
  assert public.github_consume_state(repeat('a', 64), admin_a, 'install')->>'workspace_id' = a::text;
  assert public.github_consume_state(repeat('a', 64), admin_a, 'install') is null, 'State was replayable';
  perform public.github_begin_state(a, admin_a, repeat('b', 64), 'install', null);
  update public.github_installation_states set expires_at = now() - interval '1 second';
  assert public.github_consume_state(repeat('b', 64), admin_a, 'install') is null, 'Expired state accepted';

  perform public.github_complete_connection(a, admin_a, installation, repos);
  perform public.github_complete_connection(b, admin_b, installation, repos);
  perform public.github_manage_repository(a, admin_a, 501, true);
  perform public.github_manage_repository(b, admin_b, 501, true);
  assert public.github_repository_context(a, member, 501) is null, 'Member had access by default';
  assert public.github_repository_context(a, admin_a, 501) is null, 'Admin bypassed repository grants';
  begin
    perform public.github_set_access(b, admin_a, 501, admin_b, 'write', '{}');
    raise exception 'Cross-tenant admin mutation succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.github_set_access(b, admin_b, 501, member, 'read', '{}');
    raise exception 'Granted access to a non-member';
  exception when foreign_key_violation then null; end;
  perform public.github_set_access(a, admin_a, 501, member, 'read', '{}');
  assert public.github_repository_context(a, member, 501)->>'level' = 'read';
  assert public.github_repository_context(b, member, 501) is null, 'Repository grant crossed workspaces';
  perform public.github_set_access(a, admin_a, 501, member, 'write', array['read_repository']);
  assert public.github_repository_context(a, member, 501)->'denied_actions' = '["read_repository"]'::jsonb;
  perform public.github_set_access(a, admin_a, 501, member, 'none', '{}');
  assert public.github_repository_context(a, member, 501) is null, 'Explicit revocation failed';

  perform public.github_set_access(a, admin_a, 501, member, 'read', '{}');
  delete from public.workspace_members where workspace_id = a and user_id = member;
  assert public.github_repository_context(a, member, 501) is null, 'Membership deletion left repository access';
  insert into public.workspace_members(workspace_id, user_id, role) values (a, member, 'member');
  perform public.github_set_access(a, admin_a, 501, member, 'read', '{}');
  perform public.github_manage_repository(a, admin_a, 501, false);
  perform public.github_manage_repository(a, admin_a, 501, true);
  assert public.github_repository_context(a, member, 501) is null, 'Reconnect restored old grants';

  -- Disconnecting one workspace never uninstalls or disconnects another workspace's installation.
  perform public.github_disconnect_installation(a, admin_a, 101);
  assert exists (select 1 from public.github_repositories where workspace_id = b and connected);
  assert exists (select 1 from public.github_installations where id = 101 and status = 'active');
  perform public.github_complete_connection(a, admin_a, installation, repos);
  perform public.github_manage_repository(a, admin_a, 501, true);
  perform public.github_set_access(a, admin_a, 501, member, 'read', '{}');

  -- A permission change during a network wait is rechecked by the committing RPC.
  update public.workspace_members set role = 'member' where workspace_id = a and user_id = admin_a;
  begin
    perform public.github_complete_connection(a, admin_a, installation, repos);
    raise exception 'Demoted administrator completed connection';
  exception when insufficient_privilege then null; end;
  update public.workspace_members set role = 'admin' where workspace_id = a and user_id = admin_a;

  installation := jsonb_set(installation, '{observed_at}', '"2030-02-01T00:00:00Z"');
  assert public.github_sync_installation(installation, '[]', delivery, 'digest-one', 'installation_repositories');
  assert not exists (select 1 from public.github_repositories where installation_id = 101), 'Removed repo remained';
  assert not exists (select 1 from public.github_repository_permissions), 'Removed repo kept grants';
  -- A failed lifecycle update must not mark the delivery processed.
  begin
    perform public.github_sync_installation(installation || '{"status":"invalid"}', repos,
      '30000000-0000-0000-0000-000000000002', 'failed-digest', 'installation');
    raise exception 'Invalid lifecycle status accepted';
  exception when check_violation then null; end;
  assert not exists (select 1 from public.github_webhook_deliveries
    where delivery_id = '30000000-0000-0000-0000-000000000002'), 'Failed delivery was acknowledged';
  assert not public.github_sync_installation(installation, repos, delivery, 'digest-one', 'installation_repositories');
  begin
    perform public.github_sync_installation(installation, repos, delivery, 'different-digest', 'installation_repositories');
    raise exception 'Duplicate delivery accepted another payload';
  exception when invalid_parameter_value then null; end;
  assert not exists (select 1 from public.github_repositories), 'Repository re-add auto-mapped a workspace';

  -- New additions require explicit installer verification and never resurrect grants.
  perform public.github_complete_connection(a, admin_a, installation, repos);
  assert public.github_repository_context(a, member, 501) is null;
  perform public.github_manage_repository(a, admin_a, 501, true);
  perform public.github_set_access(a, admin_a, 501, member, 'read', '{}');
  installation := jsonb_set(jsonb_set(installation, '{observed_at}', '"2030-03-01T00:00:00Z"'),
                           '{status}', '"suspended"');
  perform public.github_sync_installation(installation, '[]', null, '', 'manual', a, admin_a);
  assert public.github_repository_context(a, member, 501) is null, 'Suspension retained access';
  begin
    perform public.github_complete_connection(a, admin_a,
      jsonb_set(installation, '{status}', '"active"') || '{"observed_at":"2030-01-01T00:00:00Z"}', repos);
    raise exception 'Stale verification resurrected suspended access';
  exception when invalid_parameter_value then null; end;
  assert (select count(*) from audit.audit_log where workspace_id = a and actor_id = admin_a
    and action_type like 'github.%') > 5, 'Workspace audit records missing';
end $$;

-- RLS and privileges: browser roles cannot access tables or execute privileged RPCs.
do $$
declare t text; f record;
begin
  foreach t in array array['github_installations', 'github_workspace_installations', 'github_repositories',
    'github_repository_permissions', 'github_installation_states', 'github_webhook_deliveries'] loop
    assert not has_table_privilege('anon', 'public.' || t, 'select,insert,update,delete');
    assert not has_table_privilege('authenticated', 'public.' || t, 'select,insert,update,delete');
    assert (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass);
  end loop;
  for f in select oid from pg_proc where pronamespace = 'public'::regnamespace and left(proname, 7) = 'github_' loop
    assert not has_function_privilege('authenticated', f.oid, 'execute');
    assert not has_function_privilege('anon', f.oid, 'execute');
    assert has_function_privilege('service_role', f.oid, 'execute');
  end loop;
end $$;
rollback;
