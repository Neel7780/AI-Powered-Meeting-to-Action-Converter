import { API_BASE_URL, getApiUrl } from '../lib/api';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { 
  RichMeetingDetails, 
  MeetingChapter, 
  MeetingSummaryData,
  SummaryDiscussionPoint,
  SummaryDecision
} from '../types/meetingDetails';
import type { TranscriptSegment, ActionItemCandidate } from '../types/review';
import { 
  DESIGN_SPRINT_MEETING_DETAILS, 
  DESIGN_SPRINT_TRANSCRIPT, 
  DESIGN_SPRINT_CANDIDATES,
  SPRINT_102_MEETING_DETAILS
} from '../data/mockMeetingDetails';
import { INITIAL_TRANSCRIPT_SEGMENTS, INITIAL_CANDIDATE_ITEMS } from './reviewApi';

function getSpeakerColor(
  speakerName: string,
  fallbackIdx: number
): 'cyan' | 'emerald' | 'purple' | 'amber' | 'blue' | 'rose' {
  const lower = (speakerName || '').toLowerCase().trim();
  if (lower.includes('krishna')) return 'cyan';
  if (lower.includes('neel')) return 'emerald';
  if (lower.includes('bhagy')) return 'purple';
  if (lower.includes('manali')) return 'amber';
  const palette: Array<'cyan' | 'emerald' | 'purple' | 'amber' | 'blue' | 'rose'> = [
    'cyan',
    'emerald',
    'purple',
    'amber',
    'blue',
    'rose',
  ];
  return palette[fallbackIdx % palette.length];
}

function extractOrEstimateTimestamp(
  s: any,
  idx: number,
  prevSeconds: number
): { startSeconds: number; timestamp: string } {
  // 1. If start_ms is present and > 0, use it
  if (s.start_ms !== null && s.start_ms !== undefined && Number(s.start_ms) > 0) {
    const sec = Math.floor(Number(s.start_ms) / 1000);
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return {
      startSeconds: sec,
      timestamp: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
    };
  }

  // 2. Check if segment text contains a leading timestamp, e.g. [01:23], (01:23) or 01:23
  if (s.text) {
    const match = String(s.text).match(/^[\(\[]?(\d{1,2}):(\d{2})[\)\]]?/);
    if (match) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const totalSec = mins * 60 + secs;
      return {
        startSeconds: totalSec,
        timestamp: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      };
    }
  }

  // 3. If start_ms is 0 but this is segment 0, it's 00:00
  if (idx === 0) {
    return { startSeconds: 0, timestamp: '00:00' };
  }

  // 4. If subsequent segment has 0 or null, estimate based on previous + word count or 15s
  const words = (s.text || '').split(/\s+/).filter(Boolean).length;
  const estimatedDuration = Math.max(5, Math.ceil(words * 0.45));
  const estimatedSec = prevSeconds + estimatedDuration;
  const mins = Math.floor(estimatedSec / 60);
  const secs = estimatedSec % 60;
  return {
    startSeconds: estimatedSec,
    timestamp: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
  };
}

const STORAGE_SUMMARY_PREFIX = 'meeting_studio_summary_';
const STORAGE_CHAPTERS_PREFIX = 'meeting_studio_chapters_';

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
    if (meetingId === 'mtg-sprint-102') {
      return {
        meeting: SPRINT_102_MEETING_DETAILS,
        transcript: INITIAL_TRANSCRIPT_SEGMENTS,
        candidates: INITIAL_CANDIDATE_ITEMS,
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

      // 1. Fetch meeting record from Supabase
      let meetingTitle = 'Live Meeting';
      let clientName = 'Team Workspace';
      let startsAtFormatted = 'Today';
      let statusStr = 'Ready';

      if (isSupabaseConfigured) {
        const { data: mtgRow } = await supabase
          .from('meetings')
          .select(`
            id,
            workspace_id,
            title,
            starts_at,
            timezone,
            status,
            created_at,
            workspaces (
              id,
              name
            )
          `)
          .eq('id', meetingId)
          .maybeSingle();

        if (mtgRow) {
          meetingTitle = mtgRow.title || meetingTitle;
          statusStr = mtgRow.status || statusStr;
          if (mtgRow.workspaces && (mtgRow.workspaces as any).name) {
            clientName = (mtgRow.workspaces as any).name;
          }
          if (mtgRow.starts_at) {
            const dt = new Date(mtgRow.starts_at);
            startsAtFormatted = dt.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
          }
        }
      }

      // 2. Fetch live action item candidates from extracted_items
      let liveCandidates: ActionItemCandidate[] = [];
      if (isSupabaseConfigured) {
        const { data: items } = await supabase
          .from('extracted_items')
          .select('*')
          .eq('meeting_id', meetingId)
          .order('created_at', { ascending: true });

        if (items && items.length > 0) {
          liveCandidates = items.map((item) => {
            const assigneeMember = item.owner_name
              ? {
                  id: item.owner_user_id || item.id,
                  user_id: item.owner_user_id || item.id,
                  full_name: item.owner_name,
                  email: '',
                  role: 'team_member' as const,
                }
              : null;

            return {
              id: item.id,
              meeting_id: item.meeting_id || meetingId,
              workspace_id: item.workspace_id,
              title: item.task,
              description: item.task,
              due_date: item.deadline_utc || null,
              extracted_due_date: item.deadline_raw || null,
              assignee_id: item.owner_user_id || null,
              assignee: assigneeMember,
              blocked_by_id: item.blocked_by_id || null,
              execution_type: (item.external_owner_label === 'AI Agent' ? 'agent' : 'human') as 'human' | 'agent',
              status: ((item.review_status === 'approved' || item.review_status === 'rejected') ? item.review_status : 'pending'),
              confidence_score: item.confidence_score ?? 0.9,
              transcript_timestamp: item.transcript_timestamp || '00:00',
              transcript_segment_id: item.transcript_segment_id || undefined,
              suggested_tags: [item.category || 'General'],
              created_at: item.created_at || new Date().toISOString(),
              updated_at: item.updated_at || new Date().toISOString(),
            };
          });
        }
      }

      // 3. Fetch meeting participants from meeting_participants table
      let liveParticipants: any[] = [];
      if (isSupabaseConfigured) {
        const { data: partData } = await supabase
          .from('meeting_participants')
          .select(`
            id,
            name,
            email,
            role,
            user_id,
            profiles:user_id (
              display_name,
              avatar_url,
              email
            )
          `)
          .eq('meeting_id', meetingId);

        if (partData && partData.length > 0) {
          liveParticipants = partData.map((p: any, idx: number) => {
            const displayName =
              p.profiles?.display_name ||
              p.name ||
              (p.email ? p.email.split('@')[0] : `Participant ${idx + 1}`);
            const initials = displayName
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase() || 'TM';

            const colors = ['blue', 'purple', 'emerald', 'amber', 'rose'] as const;
            return {
              name: displayName,
              role: p.role || 'Participant',
              avatar: p.profiles?.avatar_url || '',
              initials,
              color: colors[idx % colors.length],
              online: true,
            };
          });
        }
      }

      if (liveParticipants.length === 0) {
        liveParticipants = [
          {
            name: 'Workspace Member',
            role: 'Host',
            avatar: '',
            initials: 'WM',
            color: 'blue',
            online: true,
          },
        ];
      }

      // 4. Fetch transcript segments from Supabase if configured
      let transcriptData: TranscriptSegment[] = [];
      if (isSupabaseConfigured) {
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
            let runningSeconds = 0;
            transcriptData = segs.map((s, idx) => {
              const speakerName = s.speaker_name || 'Participant';
              const speakerColor = getSpeakerColor(speakerName, idx);
              const { startSeconds, timestamp } = extractOrEstimateTimestamp(s, idx, runningSeconds);
              runningSeconds = startSeconds;

              return {
                id: s.id,
                transcript_id: s.transcript_id,
                meeting_id: meetingId,
                segment_index: s.segment_index ?? idx,
                speaker_name: speakerName,
                speaker_color: speakerColor,
                start_ms: s.start_ms,
                end_ms: s.end_ms,
                start_seconds: startSeconds,
                timestamp: timestamp,
                text: s.text,
              };
            });
          }
        }
      }

      // Compute total duration
      let totalDurationSeconds = 1800; // 30m default
      if (transcriptData.length > 0) {
        const lastSeg = transcriptData[transcriptData.length - 1];
        totalDurationSeconds = Math.max(60, Math.ceil((lastSeg.end_ms || lastSeg.start_seconds * 1000) / 1000));
      }
      const durMins = Math.floor(totalDurationSeconds / 60);
      const durSecs = totalDurationSeconds % 60;
      const durationFormatted = `${durMins}m ${durSecs.toString().padStart(2, '0')}s`;

      // Check localStorage for persisted summary & chapters
      let cachedSummary: MeetingSummaryData | null = null;
      let cachedChapters: MeetingChapter[] | null = null;
      if (typeof window !== 'undefined') {
        try {
          const rawS = localStorage.getItem(`${STORAGE_SUMMARY_PREFIX}${meetingId}`);
          if (rawS) cachedSummary = JSON.parse(rawS);
          const rawC = localStorage.getItem(`${STORAGE_CHAPTERS_PREFIX}${meetingId}`);
          if (rawC) cachedChapters = JSON.parse(rawC);
        } catch (e) {
          console.warn('Could not read cached summary/chapters:', e);
        }
      }

      // 5. Build dynamic fallback summary & chapters if backend didn't generate LLM summary yet
      const fallbackDiscussionPoints: SummaryDiscussionPoint[] = liveCandidates.length > 0
        ? [{
            topic: 'Action Items & Planning',
            points: liveCandidates.slice(0, 5).map((c) => c.title),
            timestamp: '00:00',
            speakers: liveParticipants.map((p) => p.name),
          }]
        : [{
            topic: 'General Discussion',
            points: ['Discussion recorded and saved to workspace.'],
            timestamp: '00:00',
            speakers: liveParticipants.map((p) => p.name),
          }];

      const fallbackDecisions: SummaryDecision[] = [
        {
          id: `dec-${meetingId}-1`,
          text: `Identified ${liveCandidates.length} candidate action items for team execution.`,
          timestamp: '00:00',
          speaker: liveParticipants[0]?.name || 'Host',
        },
        {
          id: `dec-${meetingId}-2`,
          text: `Meeting status: ${statusStr}.`,
          timestamp: '00:00',
          speaker: liveParticipants[0]?.name || 'Host',
        },
      ];

      const fallbackSpeakerInsights = liveParticipants.map((p) => ({
        speaker: p.name,
        talk_percentage: Math.round(100 / Math.max(1, liveParticipants.length)),
        duration_min: Math.max(1, Math.round(totalDurationSeconds / 60 / Math.max(1, liveParticipants.length))),
        key_contribution: `Contributor in "${meetingTitle}"`,
      }));

      let summaryData: MeetingSummaryData = cachedSummary || {
        overview: liveCandidates.length > 0
          ? `Recorded transcript and ${liveCandidates.length} action items captured for "${meetingTitle}".`
          : `Meeting recording registered for "${meetingTitle}". Organiser can review or run action item extraction.`,
        key_discussion_points: fallbackDiscussionPoints,
        decisions: fallbackDecisions,
        outcomes: [
          `Meeting session captured in workspace: ${clientName}.`,
          `Action items staged in review gate.`,
        ],
        next_steps: [
          'Verify candidate action items and assignees in Review Gate.',
          'Sync approved tasks to Kanban board for team execution.',
        ],
        takeaways: [
          `Action items staged in review gate for ${meetingTitle}.`,
          `Ready for team assignment and Kanban board sync.`,
        ],
        speaker_insights: fallbackSpeakerInsights,
        generated_at: new Date().toISOString(),
        model_used: 'gemini-3.1-flash-lite',
      };

      let chaptersData: MeetingChapter[] = (cachedChapters && cachedChapters.length > 0) ? cachedChapters : [
        {
          id: `chap-${meetingId}-1`,
          title: meetingTitle,
          timestamp: '00:00',
          start_seconds: 0,
          end_seconds: totalDurationSeconds,
          end_timestamp: `${String(durMins).padStart(2, '0')}:${String(durSecs).padStart(2, '0')}`,
          duration_seconds: totalDurationSeconds,
          duration_str: durationFormatted,
          summary: `Session discussion and captured items for ${meetingTitle}.`,
          description: `Session discussion and captured items for ${meetingTitle}.`,
          speakers: liveParticipants.map((p) => p.name),
          key_points: liveCandidates.slice(0, 3).map((c) => c.title),
          action_item_ids: liveCandidates.map((c) => c.id),
          decision_count: liveCandidates.length,
        },
      ];

      // If backend returned real LLM summary / chapters, use them and persist to localStorage
      if (summaryRes && summaryRes.ok) {
        const json = await summaryRes.json();
        summaryData = {
          overview: json.overview || summaryData.overview,
          key_discussion_points: json.key_discussion_points || summaryData.key_discussion_points,
          decisions: json.decisions || summaryData.decisions,
          outcomes: json.outcomes || summaryData.outcomes,
          next_steps: json.next_steps || summaryData.next_steps,
          takeaways: json.takeaways || [
            ...(json.outcomes || []),
            ...(json.next_steps || []),
          ].slice(0, 5),
          speaker_insights: json.speaker_insights || summaryData.speaker_insights,
          generated_at: json.generated_at || new Date().toISOString(),
          model_used: json.model_used || 'gemini-3.1-flash-lite',
        };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`${STORAGE_SUMMARY_PREFIX}${meetingId}`, JSON.stringify(summaryData));
          } catch (e) {
            console.warn('Could not save summary to storage:', e);
          }
        }
      }

      if (chaptersRes && chaptersRes.ok) {
        const json = await chaptersRes.json();
        if (json.chapters && Array.isArray(json.chapters) && json.chapters.length > 0) {
          chaptersData = json.chapters.map((c: any) => ({
            id: c.id,
            title: c.title,
            timestamp: c.timestamp,
            start_seconds: c.start_seconds || 0,
            end_seconds: c.end_seconds || (c.start_seconds || 0) + (c.duration_seconds || 0),
            end_timestamp: c.end_timestamp || '',
            duration_seconds: c.duration_seconds || 0,
            duration_str: c.duration_str || '05:00',
            summary: c.summary || '',
            description: c.description || c.summary || '',
            speakers: c.speakers || [],
            key_points: c.key_points || [],
            action_item_ids: c.action_item_ids || [],
            decision_count: c.decision_count || 0,
          }));
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`${STORAGE_CHAPTERS_PREFIX}${meetingId}`, JSON.stringify(chaptersData));
            } catch (e) {
              console.warn('Could not save chapters to storage:', e);
            }
          }
        }
      }

      // 6. Assemble complete live meeting details
      const liveMeeting: RichMeetingDetails = {
        ...DESIGN_SPRINT_MEETING_DETAILS,
        id: meetingId,
        title: meetingTitle,
        workspace_name: clientName,
        date_formatted: startsAtFormatted,
        total_duration_formatted: durationFormatted,
        total_duration_seconds: totalDurationSeconds,
        participants: liveParticipants,
        summary: summaryData,
        chapters: chaptersData,
        tags: ['Live', 'Sprint 2', statusStr]
      };

      return {
        meeting: liveMeeting,
        transcript: transcriptData,
        candidates: liveCandidates,
        isLiveBackend: true
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
