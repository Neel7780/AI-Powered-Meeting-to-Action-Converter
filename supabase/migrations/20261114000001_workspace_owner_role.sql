-- ==============================================================================
-- 20261114000001_workspace_owner_role.sql
-- Introduce Workspace Owner Role and enforce strict Admin delegation hierarchy
-- (Note: Enum 'owner' is added in preceding migration 20261114000000)
-- ==============================================================================

-- 1. Update user_is_workspace_admin to treat 'owner' as having full administrative rights
create or replace function private.user_is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.user_has_workspace_role(
    p_workspace_id, array['owner'::public.app_role, 'admin'::public.app_role]
  );
$$;

-- 2. Add user_is_workspace_owner helper
create or replace function private.user_is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.user_has_workspace_role(
    p_workspace_id, array['owner'::public.app_role]
  );
$$;

revoke execute on function private.user_is_workspace_owner(uuid) from public, anon;
grant execute on function private.user_is_workspace_owner(uuid) to authenticated;

-- 3. Update user_is_organiser_or_admin to include owner
create or replace function private.user_is_organiser_or_admin(p_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.user_has_workspace_role(
    p_workspace_id,
    array['owner'::public.app_role, 'admin'::public.app_role, 'organiser'::public.app_role]
  );
$$;

-- 4. Update prevent_last_admin_removal to protect owner or admin BEFORE backfill
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
    if old.role in ('owner', 'admin') then
      select count(*) into v_admin_count
      from public.workspace_members
      where workspace_id = old.workspace_id
        and role in ('owner', 'admin')
        and user_id <> old.user_id;
      if v_admin_count = 0 then
        raise exception 'A workspace must always have at least one owner or admin';
      end if;
    end if;
    return old;
  end if;

  if old.role in ('owner', 'admin') and new.role not in ('owner', 'admin') then
    select count(*) into v_admin_count
    from public.workspace_members
    where workspace_id = old.workspace_id
      and role in ('owner', 'admin')
      and user_id <> old.user_id;
    if v_admin_count = 0 then
      raise exception 'A workspace must always have at least one owner or admin';
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

-- 5. Hierarchy Trigger: Admins CANNOT promote members to Admin or modify Owner
create or replace function private.enforce_workspace_role_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_is_owner boolean;
begin
  if v_caller is null then
    return new;
  end if;

  v_is_owner := private.user_is_workspace_owner(new.workspace_id);

  -- Only owner can modify an existing owner's role
  if old.role = 'owner' and new.role <> 'owner' and not v_is_owner then
    raise exception 'Only the workspace owner can modify workspace ownership.';
  end if;

  -- Only owner can promote someone to admin
  if (new.role = 'admin' and old.role <> 'admin') and not v_is_owner then
    raise exception 'Only the workspace owner can make a member an admin.';
  end if;

  -- Only owner can demote an admin (unless admin leaves or demotes self)
  if (old.role = 'admin' and new.role <> 'admin') and not v_is_owner and v_caller <> old.user_id then
    raise exception 'Only the workspace owner can demote an admin.';
  end if;

  -- Only owner can grant owner role
  if new.role = 'owner' and not v_is_owner then
    raise exception 'Only the workspace owner can grant owner status.';
  end if;

  return new;
end;
$$;

drop trigger if exists check_workspace_role_hierarchy on public.workspace_members;
create trigger check_workspace_role_hierarchy
before update of role on public.workspace_members
for each row execute function private.enforce_workspace_role_hierarchy();

-- 6. Prevent non-owners from removing the owner
create or replace function private.prevent_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    return old;
  end if;

  if old.role = 'owner' and not private.user_is_workspace_owner(old.workspace_id) then
    raise exception 'Administrators cannot remove the workspace owner.';
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_owner_deletion on public.workspace_members;
create trigger prevent_owner_deletion
before delete on public.workspace_members
for each row execute function private.prevent_owner_removal();

-- 7. Update create_workspace RPC to assign 'owner' to the creator
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
  values (v_workspace_id, v_user_id, 'owner');

  return v_workspace_id;
end;
$$;

revoke execute on function public.create_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;

-- 8. Backfill existing workspace creators to 'owner'
alter table public.workspace_members disable trigger prevent_last_admin_demotion;

update public.workspace_members wm
set role = 'owner'
from public.workspaces w
where wm.workspace_id = w.id
  and wm.user_id = w.created_by
  and wm.role = 'admin';

-- If any workspace has no owner, assign the earliest admin as owner
update public.workspace_members wm
set role = 'owner'
where (wm.workspace_id, wm.user_id) in (
  select distinct on (workspace_id) workspace_id, user_id
  from public.workspace_members
  where role = 'admin'
    and workspace_id not in (
      select workspace_id from public.workspace_members where role = 'owner'
    )
  order by workspace_id, created_at asc
);

alter table public.workspace_members enable trigger prevent_last_admin_demotion;

-- 9. RPC for updating a workspace member's role cleanly
create or replace function public.update_workspace_member_role(
  p_workspace_id uuid,
  p_target_user_id uuid,
  p_new_role public.app_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_target_old_role public.app_role;
  v_is_owner boolean;
  v_is_admin boolean;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  v_is_owner := private.user_is_workspace_owner(p_workspace_id);
  v_is_admin := private.user_is_workspace_admin(p_workspace_id);

  if not v_is_admin and not v_is_owner then
    raise exception 'Only workspace administrators or owner can change member roles';
  end if;

  select role into v_target_old_role
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_target_user_id;

  if not found then
    raise exception 'Member not found in workspace';
  end if;

  -- Only owner can grant or revoke admin / owner role
  if (p_new_role in ('owner', 'admin') or v_target_old_role in ('owner', 'admin')) and not v_is_owner then
    raise exception 'Only the workspace owner can make a member admin or modify admin roles';
  end if;

  update public.workspace_members
  set role = p_new_role, updated_at = now()
  where workspace_id = p_workspace_id and user_id = p_target_user_id;
end;
$$;

revoke execute on function public.update_workspace_member_role(uuid, uuid, public.app_role) from public, anon;
grant execute on function public.update_workspace_member_role(uuid, uuid, public.app_role) to authenticated;
