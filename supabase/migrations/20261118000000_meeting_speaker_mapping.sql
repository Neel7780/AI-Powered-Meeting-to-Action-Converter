-- NULL keeps legacy recordings compatible with the draft-after-diarization flow.
-- A mapping submission can deliberately leave a voice unidentified.
alter table public.meetings
  add column if not exists speaker_mapping_required boolean;

notify pgrst, 'reload schema';
