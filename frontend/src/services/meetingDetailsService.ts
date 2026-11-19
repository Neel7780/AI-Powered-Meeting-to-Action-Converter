import { requestApi } from '../lib/api';
import { supabase } from '../lib/supabase';
import { reviewApi, isValidUuid } from './reviewApi';
import type { RichMeetingDetails, MeetingChapter, MeetingSummaryData } from '../types/meetingDetails';

export const meetingDetailsService = {
  async loadMeetingStudioData(meetingId: string) {
    if (!isValidUuid(meetingId)) throw new Error('A valid meeting ID is required.');
    const details = await reviewApi.fetchMeetingDetails(meetingId);
    const [transcript, members, summary, chapters, workspace] = await Promise.all([
      reviewApi.fetchTranscript(meetingId),
      reviewApi.fetchWorkspaceMembers(details.workspace_id),
      requestApi<MeetingSummaryData>(`/api/meetings/${meetingId}/summary`),
      requestApi<{ chapters: MeetingChapter[] }>(`/api/meetings/${meetingId}/chapters`),
      supabase.from('workspaces').select('name').eq('id', details.workspace_id).single(),
    ]);
    if (workspace.error) throw workspace.error;
    const candidates = await reviewApi.fetchActionItemCandidates(meetingId, members);
    const duration = Math.max(0, ...transcript.map(s => Number(s.end_ms || 0) / 1000));
    const durationText = duration ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}` : 'Unavailable';
    const meeting: RichMeetingDetails = {
      id: details.id, title: details.title, workspace_id: details.workspace_id,
      workspace_name: workspace.data.name, breadcrumb: ['Meetings', details.title],
      date_formatted: new Date(details.date).toLocaleDateString(), tags: [],
      total_duration_seconds: duration, total_duration_formatted: durationText,
      participants: [], summary, chapters: chapters.chapters,
      speaker_tracks: [], comments: [], clips: [], trackers: [],
      metrics: {
        total_duration_seconds: duration, total_duration_str: durationText,
        pacing_wpm: 0, sentiment_score: 'Unavailable', action_items_count: candidates.length,
        decisions_count: summary.decisions.length, questions_count: 0, speaker_talk_ratios: [],
      },
    };
    return { meeting, transcript, candidates };
  },
};
