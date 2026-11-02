-- ==============================================================================
-- 0006_audio_diarization.sql
-- Offline meetings recorded in the app: audio transcripts + speaker diarization.
--
-- * transcript_source gains 'audio'.
-- * transcript_segments.speaker_label keeps the raw diarization label
--   (SPEAKER_00, SPEAKER_01, ...) so the organiser can re-map speakers later;
--   speaker_name holds the display name shown to the LLM and the UI.
-- * The meeting-transcripts bucket accepts audio up to 50 MB (Supabase free-tier
--   per-file maximum). Path convention is unchanged:
--   meeting-transcripts/{workspace_id}/{meeting_id}/{filename}
-- ==============================================================================

alter type public.transcript_source add value if not exists 'audio';

alter table public.transcript_segments
  add column if not exists speaker_label text;

alter table public.transcripts drop constraint if exists transcripts_file_size_chk;
alter table public.transcripts add constraint transcripts_file_size_chk check (
  file_size_bytes is null or file_size_bytes between 0 and 52428800
);

alter table public.transcripts drop constraint if exists transcripts_source_data_chk;
alter table public.transcripts add constraint transcripts_source_data_chk check (
  (source = 'paste' and canonical_text is not null)
  or
  (source::text in ('txt','vtt','srt','docx','audio') and (storage_path is not null or canonical_text is not null))
);

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'text/plain',
      'text/vtt',
      'application/x-subrip',
      'text/srt',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'audio/webm',
      'audio/ogg',
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/x-wav',
      'audio/x-m4a'
    ]
where id = 'meeting-transcripts';

notify pgrst, 'reload schema';
