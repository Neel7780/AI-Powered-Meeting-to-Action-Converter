create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null check (email = lower(btrim(email))),
  role public.app_role not null default 'member' check (role <> 'admin'),
  token_hash text not null unique,                 -- sha256 of the token; the raw token is never stored
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists workspace_invites_one_pending
  on public.workspace_invites (workspace_id, email) where accepted_at is null;

alter table public.workspace_invites enable row level security;

create policy invites_select_admin on public.workspace_invites
  for select to authenticated using (private.user_is_workspace_admin(workspace_id));
create policy invites_delete_admin on public.workspace_invites
  for delete to authenticated using (private.user_is_workspace_admin(workspace_id));
-- No insert/update policy: only the backend creates invites (it must send the email anyway).

create or replace function public.accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.workspace_invites%rowtype;
  v_email text;
begin
  select lower(email) into v_email from auth.users
  where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then raise exception 'Sign in with a confirmed email first'; end if;

  select * into v_inv from public.workspace_invites
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and accepted_at is null and expires_at > now()
  for update;
  if not found then raise exception 'Invite is invalid or expired'; end if;
  if v_inv.email <> v_email then raise exception 'This invite was sent to a different email'; end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_inv.workspace_id, auth.uid(), v_inv.role)
  on conflict do nothing;
  update public.workspace_invites set accepted_at = now() where id = v_inv.id;
  return v_inv.workspace_id;
end $$;

create or replace function public.leave_workspace(p_workspace_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.workspace_members
  where workspace_id = p_workspace_id and user_id = auth.uid();   -- last-admin trigger still protects
$$;

revoke execute on function public.accept_invite(text), public.leave_workspace(uuid) from public, anon;
grant  execute on function public.accept_invite(text), public.leave_workspace(uuid) to authenticated;
