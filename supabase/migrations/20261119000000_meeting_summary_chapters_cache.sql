-- Cache generated meeting insights. Existing meetings populate the cache on first read.
alter table public.meetings
  add column if not exists summary jsonb,
  add column if not exists chapters jsonb;

notify pgrst, 'reload schema';
