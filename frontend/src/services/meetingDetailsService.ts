import { API_BASE_URL, getApiUrl } from '../lib/api';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RichMeetingDetails, MeetingChapter, MeetingSummaryData } from '../types/meetingDetails';
import type { TranscriptSegment, ActionItemCandidate } from '../types/review';
import { 
  DESIGN_SPRINT_MEETING_DETAILS, 
  DESIGN_SPRINT_TRANSCRIPT, 
  DESIGN_SPRINT_CANDIDATES 
} from '../data/mockMeetingDetails';

export const meetingDetailsService = {
  /**
   * Fetch full meeting details, chapters, summary, and transcript.
   * If backend is offline or meeting is demo, returns rich fallback data.
   */
  async loadMeetingStudioData(meetingId: string): Promise<{
    meeting: RichMeetingDetails;
    transcript: TranscriptSegment[];
    candidates: ActionItemCandidate[];
    isLiveBackend: boolean;
  }> {
    // If demo ID, return demo directly
    if (meetingId === 'design-sprint-review' || meetingId === 'mtg-ds-01' || !meetingId) {
      return {
        meeting: DESIGN_SPRINT_MEETING_DETAILS,
        transcript: DESIGN_SPRINT_TRANSCRIPT,
        candidates: DESIGN_SPRINT_CANDIDATES,
        isLiveBackend: false
      };
    }

    try {
      const summaryEndpoint = API_BASE_URL
        ? `${API_BASE_URL}/api/meetings/${meetingId}/summary`
        : getApiUrl(`/api/meetings/${meetingId}/summary`);
      const chaptersEndpoint = API_BASE_URL
        ? `${API_BASE_URL}/api/meetings/${meetingId}/chapters`
        : getApiUrl(`/api/meetings/${meetingId}/chapters`);

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Parallel fetch from FastAPI backend
      const [summaryRes, chaptersRes] = await Promise.all([
        fetch(summaryEndpoint, { headers }).catch(() => null),
        fetch(chaptersEndpoint, { headers }).catch(() => null)
      ]);

      let summaryData: MeetingSummaryData = DESIGN_SPRINT_MEETING_DETAILS.summary;
      let chaptersData: MeetingChapter[] = DESIGN_SPRINT_MEETING_DETAILS.chapters;

      if (summaryRes && summaryRes.ok) {
        const json = await summaryRes.json();
        summaryData = {
          overview: json.overview || summaryData.overview,
          key_discussion_points: json.key_discussion_points || summaryData.key_discussion_points,
          decisions: json.decisions || summaryData.decisions,
          outcomes: json.outcomes || summaryData.outcomes,
          next_steps: json.next_steps || summaryData.next_steps,
          speaker_insights: json.speaker_insights || summaryData.speaker_insights,
          generated_at: json.generated_at || new Date().toISOString(),
          model_used: json.model_used || 'gemini-3.1-flash-lite'
        };
      }

      if (chaptersRes && chaptersRes.ok) {
        const json = await chaptersRes.json();
        if (json.chapters && Array.isArray(json.chapters)) {
          chaptersData = json.chapters.map((c: any) => ({
            id: c.id,
            title: c.title,
            timestamp: c.timestamp,
            start_seconds: c.start_seconds || 0,
            duration_seconds: c.duration_seconds || 0,
            duration_str: c.duration_str || '05:00',
            summary: c.summary || '',
            speakers: c.speakers || [],
            key_points: c.key_points || [],
            action_item_ids: c.action_item_ids || [],
            decision_count: c.decision_count || 0
          }));
        }
      }

      // Fetch transcript segments and meeting info from Supabase if configured
      let transcriptData: TranscriptSegment[] = DESIGN_SPRINT_TRANSCRIPT;
      let meetingTitle = DESIGN_SPRINT_MEETING_DETAILS.title;
      let meetingDateFormatted = DESIGN_SPRINT_MEETING_DETAILS.date_formatted;
      let candidatesData: ActionItemCandidate[] = DESIGN_SPRINT_CANDIDATES;

      if (isSupabaseConfigured) {
        // Fetch meeting info
        const { data: mData } = await supabase
          .from('meetings')
          .select('id, title, created_at')
          .eq('id', meetingId)
          .maybeSingle();

        if (mData) {
          meetingTitle = mData.title || meetingTitle;
          meetingDateFormatted = mData.created_at
            ? new Date(mData.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : meetingDateFormatted;
        }

        // Fetch candidate action items from extracted_items
        const { data: rawCandidates } = await supabase
          .from('extracted_items')
          .select('*')
          .eq('meeting_id', meetingId)
          .order('created_at', { ascending: true });

        if (rawCandidates && rawCandidates.length > 0) {
          candidatesData = rawCandidates.map((c: any) => ({
            id: c.id,
            meeting_id: c.meeting_id,
            workspace_id: c.workspace_id,
            title: c.title,
            description: c.description || '',
            due_date: c.due_date || null,
            assignee_id: c.owner_user_id || null,
            status: c.status === 'confirmed' ? 'approved' : c.status === 'dismissed' ? 'rejected' : 'pending',
            confidence_score: c.confidence_score ?? 0.9,
            transcript_timestamp: c.source_start_ms
              ? `${String(Math.floor(c.source_start_ms / 60000)).padStart(2, '0')}:${String(Math.floor((c.source_start_ms % 60000) / 1000)).padStart(2, '0')}`
              : '00:00',
            suggested_tags: c.category ? [c.category] : ['Task'],
            created_at: c.created_at || new Date().toISOString(),
            updated_at: c.updated_at || new Date().toISOString()
          }));
        }

        const { data: tData } = await supabase
          .from('transcripts')
          .select('id')
          .eq('meeting_id', meetingId)
          .maybeSingle();

        if (tData) {
          const { data: segs } = await supabase
            .from('transcript_segments')
            .select('*')
            .eq('transcript_id', tData.id)
            .order('segment_index', { ascending: true });

          if (segs && segs.length > 0) {
            transcriptData = segs.map((s, idx) => ({
              id: s.id,
              transcript_id: s.transcript_id,
              meeting_id: meetingId,
              segment_index: s.segment_index ?? idx,
              speaker_name: s.speaker_name || 'Participant',
              speaker_color: idx % 3 === 0 ? 'cyan' : idx % 3 === 1 ? 'emerald' : 'purple',
              start_ms: s.start_ms,
              end_ms: s.end_ms,
              start_seconds: Math.floor((s.start_ms || 0) / 1000),
              timestamp: `${String(Math.floor((s.start_ms || 0) / 60000)).padStart(2, '0')}:${String(Math.floor(((s.start_ms || 0) % 60000) / 1000)).padStart(2, '0')}`,
              text: s.text
            }));
          }
        }
      }

      // Assemble live meeting details
      const liveMeeting: RichMeetingDetails = {
        ...DESIGN_SPRINT_MEETING_DETAILS,
        id: meetingId,
        title: meetingTitle,
        date_formatted: meetingDateFormatted,
        summary: summaryData,
        chapters: chaptersData
      };

      return {
        meeting: liveMeeting,
        transcript: transcriptData,
        candidates: candidatesData,
        isLiveBackend: summaryRes?.ok || false
      };
    } catch (err) {
      console.warn('Failed to load live meeting data from API, using demo studio fallback:', err);
      return {
        meeting: DESIGN_SPRINT_MEETING_DETAILS,
        transcript: DESIGN_SPRINT_TRANSCRIPT,
        candidates: DESIGN_SPRINT_CANDIDATES,
        isLiveBackend: false
      };
    }
  }
};
