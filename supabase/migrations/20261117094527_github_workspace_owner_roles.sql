-- GitHub-only compatibility for deployed owner/member workspaces and legacy admin workspaces.
-- Keep the existing RPC name so every connection/mapping/grant/sync mutation uses the same guard.
-- Casting role to text supports both enum-backed and text-backed workspace_members schemas;
-- this migration does not rename roles, alter memberships, or change other workspace policies.
begin;

create or replace function public.github_assert_admin(p_workspace_id uuid, p_actor_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Retain the membership row lock until the caller's transaction ends.
  perform 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = p_actor_id
      and role::text in ('owner', 'admin')
    for share;
  if not found then
    raise insufficient_privilege;
  end if;
end;
$$;

revoke all on function public.github_assert_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.github_assert_admin(uuid, uuid) to service_role;

commit;
