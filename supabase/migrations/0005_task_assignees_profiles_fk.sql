-- ==============================================================================
-- 0005_task_assignees_profiles_fk.sql
-- Add explicit foreign key from public.task_assignees(user_id) to public.profiles(id)
-- This exposes the relationship to PostgREST's schema cache for direct embedding.
-- ==============================================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'task_assignees_user_id_profiles_fkey'
      and table_schema = 'public'
      and table_name = 'task_assignees'
  ) then
    alter table public.task_assignees
      add constraint task_assignees_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';

