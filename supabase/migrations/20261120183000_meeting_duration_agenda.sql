-- Persist scheduled meeting duration and agenda/description
alter table public.meetings
  add column if not exists duration_minutes integer default 30,
  add column if not exists description text;

notify pgrst, 'reload schema';
