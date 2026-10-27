-- ==============================================================================
-- 0004_meeting_notifications.sql
-- Meeting Reminders (Pre-Meeting) & Post-Meeting Transcript Nudges
-- ==============================================================================

-- 1. Extend notification_event enum with meeting events
alter type public.notification_event add value if not exists 'meeting_reminder';
alter type public.notification_event add value if not exists 'meeting_transcript_nudge';

-- 2. Add meeting_id to notifications table
alter table public.notifications
  add column if not exists meeting_id uuid references public.meetings(id) on delete cascade;

create index if not exists idx_notifications_meeting_id
  on public.notifications (meeting_id)
  where meeting_id is not null;
