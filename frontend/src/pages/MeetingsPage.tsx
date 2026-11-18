import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarPlus,
  GitFork,
  ArrowRight,
  Clock,
  AlertCircle,
  Plus,
  LoaderCircle,
  Video,
  ListTodo,
  Sparkles,
  CheckCircle2,
  FileText,
  Search,
  Copy,
  Check,
  User,
  SplitSquareVertical,
  Calendar,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../context/WorkspaceContext';
import { WorkflowChainsView } from '../components/kanban/WorkflowChainsView';
import { TaskDependencyModal } from '../components/kanban/TaskDependencyModal';
import { FollowUpModal } from '../components/meetings/FollowUpModal';
import { CreateMeetingModal } from '../components/meetings/CreateMeetingModal';
import { CreateMeeting } from './CreateMeeting';
import { OnlineMeetingAutomationHub } from '../components/meetings/OnlineMeetingAutomationHub';
import { WhatsAppShareButton } from '../components/kanban/WhatsAppShareButton';
import type { KanbanTaskItem, TaskStatus, TaskPriority } from '../components/kanban/KanbanCard';
import type { TranscriptSegment } from '../types/review';
import { reviewApi, INITIAL_TRANSCRIPT_SEGMENTS } from '../services/reviewApi';
import { DESIGN_SPRINT_TRANSCRIPT } from '../data/mockMeetingDetails';
import { Button } from '../components/ui/button';

interface MeetingItem {
  id: string;
  title: string;
  starts_at: string;
  timezone: string;
  status: string;
  organiser_id: string;
  conference_url?: string | null;
  created_at: string;
}

interface ExtractedActionCandidate {
  id: string;
  meeting_id: string;
  type: string;
  task: string;
  owner_name?: string | null;
  owner_user_id?: string | null;
  deadline_raw?: string | null;
  deadline_utc?: string | null;
  priority: string;
  source_excerpt: string;
  review_status: string;
  rejection_reason?: string | null;
  created_at: string;
}

interface LoadedTranscriptData {
  id: string;
  source?: string;
  canonical_text?: string | null;
  raw_text?: string | null;
  file_name?: string | null;
  segments: TranscriptSegment[];
}

const DEMO_MEETINGS: MeetingItem[] = [
  {
    id: 'mtg-sprint-102',
    title: 'Sprint 2 Architecture & AI Staging Review',
    starts_at: '2026-10-11T10:00:00Z',
    timezone: 'Asia/Kolkata',
    status: 'ready',
    organiser_id: '00000000-0000-0000-0000-000000000001',
    created_at: '2026-10-11T10:00:00Z',
  },
  {
    id: 'mtg-ds-01',
    title: 'Design Sprint Review & Next Steps',
    starts_at: '2026-10-14T10:00:00Z',
    timezone: 'Asia/Kolkata',
    status: 'ready',
    organiser_id: '00000000-0000-0000-0000-000000000001',
    created_at: '2026-10-14T10:00:00Z',
  },
];

const DEMO_TASKS_SPRINT_102: KanbanTaskItem[] = [
  {
    id: 'demo-task-1',
    workspace_id: 'ws-team-10',
    meeting_id: 'mtg-sprint-102',
    title: 'Implement Supabase RLS security policies for workspace tables',
    description: 'Ensure members can only read and write data within their authorized workspace scope per CR-01.',
    deadline_utc: '2026-10-14T23:59:59Z',
    priority: 'urgent',
    status: 'in_progress',
    source_excerpt: 'Can you own the implementation of Supabase RLS security policies for workspace tables by October 14th?',
    created_at: '2026-10-11T10:15:00Z',
    updated_at: '2026-10-11T10:15:00Z',
    task_assignees: [
      {
        user_id: '00000000-0000-0000-0000-000000000004',
        is_primary: true,
        profiles: {
          id: '00000000-0000-0000-0000-000000000004',
          display_name: 'Arnav Pandita',
          email: 'arnav.pandita@actionpulse.io',
        },
      },
    ],
  },
  {
    id: 'demo-task-2',
    workspace_id: 'ws-team-10',
    meeting_id: 'mtg-sprint-102',
    title: 'Write database migration scripts and test admin vs member permissions',
    description: 'Validate schema migration scripts and test permission enforcement under RLS.',
    deadline_utc: '2026-10-14T23:59:59Z',
    priority: 'high',
    status: 'todo',
    source_excerpt: "I will write the migration scripts and test admin vs team_member permissions.",
    created_at: '2026-10-11T10:16:00Z',
    updated_at: '2026-10-11T10:16:00Z',
    task_assignees: [
      {
        user_id: '00000000-0000-0000-0000-000000000004',
        is_primary: true,
        profiles: {
          id: '00000000-0000-0000-0000-000000000004',
          display_name: 'Arnav Pandita',
          email: 'arnav.pandita@actionpulse.io',
        },
      },
    ],
  },
  {
    id: 'demo-task-3',
    workspace_id: 'ws-team-10',
    meeting_id: 'mtg-sprint-102',
    title: 'Add drag-and-drop file uploader with mime type error boundaries',
    description: 'Support .vtt, .srt, .txt, and .docx formats following the storage path convention.',
    deadline_utc: '2026-10-15T23:59:59Z',
    priority: 'normal',
    status: 'done',
    source_excerpt: 'Make sure the drag-and-drop file uploader has instant upload feedback and error boundaries for unsupported mime types by October 15th.',
    created_at: '2026-10-11T10:18:00Z',
    updated_at: '2026-10-11T10:18:00Z',
    completed_at: '2026-10-13T14:30:00Z',
    task_assignees: [
      {
        user_id: '00000000-0000-0000-0000-000000000005',
        is_primary: true,
        profiles: {
          id: '00000000-0000-0000-0000-000000000005',
          display_name: 'Bharat Odedara',
          email: 'bharat.odedara@actionpulse.io',
        },
      },
    ],
  },
  {
    id: 'demo-task-4',
    workspace_id: 'ws-team-10',
    meeting_id: 'mtg-sprint-102',
    title: 'Sanitize user inputs in multi-line paste widget',
    description: 'Strip dangerous HTML and script injections before dispatching transcript text.',
    deadline_utc: '2026-10-15T23:59:59Z',
    priority: 'high',
    status: 'todo',
    source_excerpt: 'someone needs to sanitize user inputs in the multi-line paste widget to strip dangerous HTML and scripts',
    created_at: '2026-10-11T10:20:00Z',
    updated_at: '2026-10-11T10:20:00Z',
    task_assignees: [
      {
        user_id: '00000000-0000-0000-0000-000000000001',
        is_primary: true,
        profiles: {
          id: '00000000-0000-0000-0000-000000000001',
          display_name: 'Madhav Chauhan',
          email: 'madhav.chauhan@actionpulse.io',
        },
      },
    ],
  },
  {
    id: 'demo-task-5',
    workspace_id: 'ws-team-10',
    meeting_id: 'mtg-sprint-102',
    title: 'Implement CR-01 AI Attestation disclaimer banner',
    description: 'Display AI-generated suggestions disclaimer across all review and staging screens.',
    deadline_utc: '2026-10-16T23:59:59Z',
    priority: 'normal',
    status: 'todo',
    source_excerpt: "per CR-01 compliance, we must add the AI Attestation disclaimer banner stating: 'AI-generated suggestions. Verify before publishing.'",
    created_at: '2026-10-11T10:22:00Z',
    updated_at: '2026-10-11T10:22:00Z',
    task_assignees: [
      {
        user_id: '00000000-0000-0000-0000-000000000006',
        is_primary: true,
        profiles: {
          id: '00000000-0000-0000-0000-000000000006',
          display_name: 'Yuvraj Katara',
          email: 'yuvraj.katara@actionpulse.io',
        },
      },
    ],
  },
];

const DEMO_TASKS_DS_01: KanbanTaskItem[] = [
  {
    id: 'demo-task-ds-1',
    workspace_id: 'ws-team-10',
    meeting_id: 'mtg-ds-01',
    title: 'Tweak accent colors from blue to teal for better accessibility',
    description: 'Update design system tokens and ensure high-contrast visibility.',
    deadline_utc: '2026-10-18T23:59:59Z',
    priority: 'normal',
    status: 'in_progress',
    source_excerpt: "Got it — I'll tweak the accent colors. Maybe shift from blue to teal for better visibility.",
    created_at: '2026-10-14T10:05:00Z',
    updated_at: '2026-10-14T10:05:00Z',
    task_assignees: [
      {
        user_id: 'user-karthik',
        is_primary: true,
        profiles: {
          id: 'user-karthik',
          display_name: 'Karthik',
          email: 'karthik@actionpulse.io',
        },
      },
    ],
  },
  {
    id: 'demo-task-ds-2',
    workspace_id: 'ws-team-10',
    meeting_id: 'mtg-ds-01',
    title: 'Add dedicated tab for Action Items under Meeting Review',
    description: 'Separate general insights from extracted task candidates to ease post-meeting review.',
    deadline_utc: '2026-10-19T23:59:59Z',
    priority: 'high',
    status: 'done',
    source_excerpt: "One quick note — we should also improve how 'Action Items' are displayed... maybe give them their own dedicated tab.",
    created_at: '2026-10-14T10:07:00Z',
    updated_at: '2026-10-14T10:07:00Z',
    completed_at: '2026-10-15T11:00:00Z',
    task_assignees: [
      {
        user_id: 'user-asha',
        is_primary: true,
        profiles: {
          id: 'user-asha',
          display_name: 'Asha',
          email: 'asha@actionpulse.io',
        },
      },
    ],
  },
  {
    id: 'demo-task-ds-3',
    workspace_id: 'ws-team-10',
    meeting_id: 'mtg-ds-01',
    title: 'Optimize API calls for real-time summary generation',
    description: 'Cut down API latency to under one second for live summary generation.',
    deadline_utc: '2026-10-20T23:59:59Z',
    priority: 'high',
    status: 'done',
    source_excerpt: 'From the dev side, the live transcription latency is now under one second. I also optimized the API calls for faster summary generation.',
    created_at: '2026-10-14T10:10:00Z',
    updated_at: '2026-10-14T10:10:00Z',
    completed_at: '2026-10-15T16:20:00Z',
    task_assignees: [
      {
        user_id: 'user-vikram',
        is_primary: true,
        profiles: {
          id: 'user-vikram',
          display_name: 'Vikram',
          email: 'vikram@actionpulse.io',
        },
      },
    ],
  },
];

const SPEAKER_PILL_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30' },
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30' },
  cyan: { bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30' },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; badgeClass: string }> = {
  urgent: { label: 'Urgent', badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  high: { label: 'High', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  normal: { label: 'Normal', badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  low: { label: 'Low', badgeClass: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30' },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; badgeClass: string }> = {
  todo: { label: 'To Do', badgeClass: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30' },
  in_progress: { label: 'In Progress', badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  blocked: { label: 'Blocked', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  done: { label: 'Done', badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
};

export default function MeetingsPage() {
  const { currentWorkspace, currentRole } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const navigate = useNavigate();

  const isOrganiserOrAdmin = currentRole === 'admin' || currentRole === 'organiser';

  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [allTasks, setAllTasks] = useState<KanbanTaskItem[]>([]);
  const [candidateItems, setCandidateItems] = useState<ExtractedActionCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  // Modals & Navigation
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false);
  const [selectedTaskForDependency, setSelectedTaskForDependency] = useState<KanbanTaskItem | null>(null);
  const [activeTab, setActiveTab] = useState<'workflows' | 'automation'>('workflows');
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);

  // Meeting filters & search
  const [meetingFilter, setMeetingFilter] = useState<'all' | 'past' | 'upcoming'>('all');
  const [meetingSearch, setMeetingSearch] = useState('');

  // Selected meeting view controls
  const [activeViewMode, setActiveViewMode] = useState<'tasks' | 'transcript' | 'split' | 'chains'>('tasks');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [taskSearch, setTaskSearch] = useState('');
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('all');
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Transcript state for active meeting
  const [transcriptData, setTranscriptData] = useState<LoadedTranscriptData | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Fetch meetings, confirmed tasks, and candidate items dynamically from Supabase
  const loadWorkspaceMeetingData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);

    try {
      const [meetingsRes, tasksRes, candidatesRes] = await Promise.all([
        supabase
          .from('meetings')
          .select('id, title, starts_at, timezone, status, organiser_id, conference_url, created_at')
          .eq('workspace_id', workspaceId)
          .order('starts_at', { ascending: false }),
        supabase
          .from('tasks')
          .select(`
            id,
            workspace_id,
            meeting_id,
            title,
            description,
            deadline_utc,
            priority,
            status,
            blocked_by,
            source_excerpt,
            external_owner_label,
            created_at,
            updated_at,
            completed_at,
            meetings (
              id,
              title,
              starts_at
            ),
            task_assignees (
              user_id,
              is_primary
            )
          `)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        supabase
          .from('extracted_items')
          .select('id, meeting_id, type, task, owner_name, owner_user_id, deadline_raw, deadline_utc, priority, source_excerpt, review_status, rejection_reason, created_at')
          .eq('type', 'action')
          .order('created_at', { ascending: true }),
      ]);

      const rawMeetingList = (meetingsRes.data || []) as MeetingItem[];
      // If workspace has no meetings yet, provide demo meetings so the user can immediately experience old meetings
      const finalMeetingList = rawMeetingList.length > 0 ? rawMeetingList : DEMO_MEETINGS;
      setMeetings(finalMeetingList);

      const rawTasks = (tasksRes.data || []) as any[];
      const userIds = Array.from(
        new Set(
          rawTasks
            .flatMap((t) => (t.task_assignees || []).map((a: any) => a.user_id))
            .filter(Boolean)
        )
      );

      const profileMap = new Map<string, any>();
      if (userIds.length > 0) {
        try {
          const { data: profiles, error: pErr } = await supabase
            .from('profiles')
            .select('id, display_name, email, avatar_url')
            .in('id', userIds);
          if (!pErr && profiles) {
            profiles.forEach((p) => profileMap.set(p.id, p));
          }
        } catch {
          // fallback
        }
      }

      const taskList: KanbanTaskItem[] = rawTasks.map((t) => ({
        ...t,
        execution_type: t.execution_type || (t.external_owner_label === 'AI Agent' ? 'agent' : 'human'),
        task_assignees: (t.task_assignees || []).map((a: any) => ({
          user_id: a.user_id,
          is_primary: Boolean(a.is_primary),
          profiles: profileMap.get(a.user_id) || {
            id: a.user_id,
            display_name: null,
            email: null,
            avatar_url: null,
          },
        })),
      }));
      setAllTasks(taskList);

      const candidateList = (candidatesRes.data || []) as ExtractedActionCandidate[];
      setCandidateItems(candidateList);

      // Default select the most recent meeting if none selected or if current selection is not in list
      if (finalMeetingList.length > 0 && (!selectedMeetingId || !finalMeetingList.some((m) => m.id === selectedMeetingId))) {
        setSelectedMeetingId(finalMeetingList[0].id);
      }
    } catch (err) {
      console.error('Failed to load meetings data from Supabase:', err);
      // Fallback to demo meetings
      setMeetings(DEMO_MEETINGS);
      if (!selectedMeetingId || !DEMO_MEETINGS.some((m) => m.id === selectedMeetingId)) {
        setSelectedMeetingId(DEMO_MEETINGS[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId, selectedMeetingId]);

  useEffect(() => {
    loadWorkspaceMeetingData();
  }, [loadWorkspaceMeetingData]);

  // 2. Fetch transcript specifically for the active meeting
  useEffect(() => {
    if (!selectedMeetingId) {
      setTranscriptData(null);
      return;
    }

    let isMounted = true;
    setTranscriptLoading(true);

    const loadTranscript = async () => {
      try {
        // A. Handle demo meetings
        if (selectedMeetingId === 'mtg-sprint-102') {
          if (isMounted) {
            setTranscriptData({
              id: 'tr-sprint-102',
              source: 'txt',
              canonical_text: INITIAL_TRANSCRIPT_SEGMENTS.map(s => `${s.speaker_name} (${s.timestamp}): ${s.text}`).join('\n\n'),
              segments: INITIAL_TRANSCRIPT_SEGMENTS,
            });
          }
          return;
        }
        if (selectedMeetingId === 'mtg-ds-01') {
          if (isMounted) {
            setTranscriptData({
              id: 'tr-ds-01',
              source: 'vtt',
              canonical_text: DESIGN_SPRINT_TRANSCRIPT.map(s => `${s.speaker_name} (${s.timestamp}): ${s.text}`).join('\n\n'),
              segments: DESIGN_SPRINT_TRANSCRIPT,
            });
          }
          return;
        }

        // B. Query Supabase transcripts table
        const { data: tRow, error: tErr } = await supabase
          .from('transcripts')
          .select('id, raw_text, canonical_text, source, file_name')
          .eq('meeting_id', selectedMeetingId)
          .maybeSingle();

        if (tErr) throw tErr;
        if (!tRow) {
          if (isMounted) setTranscriptData(null);
          return;
        }

        // Query transcript segments
        const { data: segs, error: sErr } = await supabase
          .from('transcript_segments')
          .select('*')
          .eq('transcript_id', tRow.id)
          .order('segment_index', { ascending: true });

        if (sErr) throw sErr;

        const colors = ['indigo', 'emerald', 'purple', 'blue', 'cyan', 'amber', 'rose'];
        const formattedSegments: TranscriptSegment[] = (segs || []).map((s, idx) => {
          const startMs = Number(s.start_ms || 0);
          const startSec = Math.floor(startMs / 1000);
          const mins = Math.floor(startSec / 60);
          const secs = startSec % 60;
          const timestamp = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          return {
            id: s.id,
            transcript_id: s.transcript_id,
            meeting_id: selectedMeetingId,
            segment_index: s.segment_index ?? idx,
            speaker_name: s.speaker_name || 'Speaker',
            speaker_color: colors[idx % colors.length],
            start_ms: s.start_ms,
            end_ms: s.end_ms,
            start_seconds: startSec,
            timestamp,
            text: s.text,
          };
        });

        if (isMounted) {
          setTranscriptData({
            id: tRow.id,
            source: tRow.source,
            raw_text: tRow.raw_text,
            canonical_text: tRow.canonical_text,
            file_name: tRow.file_name,
            segments: formattedSegments,
          });
        }
      } catch (err) {
        console.warn('Transcript fetch notice:', err);
        if (isMounted) setTranscriptData(null);
      } finally {
        if (isMounted) setTranscriptLoading(false);
      }
    };

    loadTranscript();

    return () => {
      isMounted = false;
    };
  }, [selectedMeetingId]);

  // Helper to determine if a meeting is past / old
  const isPastMeeting = (m: MeetingItem) => {
    try {
      const mtgTime = new Date(m.starts_at).getTime();
      return mtgTime <= Date.now() || m.status === 'completed' || m.status === 'archived';
    } catch {
      return false;
    }
  };

  // Filtered meetings list based on tab (all / past / upcoming) and search term
  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      const isPast = isPastMeeting(m);
      if (meetingFilter === 'past' && !isPast) return false;
      if (meetingFilter === 'upcoming' && isPast) return false;

      if (meetingSearch.trim()) {
        const q = meetingSearch.toLowerCase();
        return (
          m.title.toLowerCase().includes(q) ||
          m.status.toLowerCase().includes(q) ||
          (m.starts_at && new Date(m.starts_at).toLocaleDateString().toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [meetings, meetingFilter, meetingSearch]);

  const pastMeetingsCount = useMemo(() => {
    return meetings.filter((m) => isPastMeeting(m)).length;
  }, [meetings]);

  const upcomingMeetingsCount = useMemo(() => {
    return meetings.filter((m) => !isPastMeeting(m)).length;
  }, [meetings]);

  // Currently selected active meeting details
  const activeMeeting = useMemo(() => {
    return meetings.find((m) => m.id === selectedMeetingId) || null;
  }, [meetings, selectedMeetingId]);

  // Tasks generated specifically from the selected meeting
  const meetingTasks = useMemo(() => {
    if (!selectedMeetingId) return [];
    const directTasks = allTasks.filter((t) => t.meeting_id === selectedMeetingId);
    if (directTasks.length > 0) return directTasks;

    // If demo meeting and no direct tasks in Supabase yet, use demo tasks
    if (selectedMeetingId === 'mtg-sprint-102') return DEMO_TASKS_SPRINT_102;
    if (selectedMeetingId === 'mtg-ds-01') return DEMO_TASKS_DS_01;

    return [];
  }, [allTasks, selectedMeetingId]);

  // Filtered tasks for selected meeting
  const filteredTasks = useMemo(() => {
    return meetingTasks.filter((t) => {
      if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) return false;
      if (taskSearch.trim()) {
        const q = taskSearch.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = (t.description || '').toLowerCase().includes(q);
        const matchesAssignee =
          (t.task_assignees || []).some(
            (a) =>
              a.profiles?.display_name?.toLowerCase().includes(q) ||
              a.profiles?.email?.toLowerCase().includes(q)
          ) || (t.external_owner_label?.toLowerCase().includes(q) ?? false);
        return matchesTitle || matchesDesc || matchesAssignee;
      }
      return true;
    });
  }, [meetingTasks, taskStatusFilter, taskSearch]);

  // Unique speakers in active meeting transcript
  const transcriptSpeakers = useMemo(() => {
    if (!transcriptData?.segments) return [];
    return Array.from(new Set(transcriptData.segments.map((s) => s.speaker_name)));
  }, [transcriptData]);

  // Filtered transcript segments
  const filteredSegments = useMemo(() => {
    if (!transcriptData?.segments) return [];
    return transcriptData.segments.filter((seg) => {
      if (selectedSpeaker !== 'all' && seg.speaker_name !== selectedSpeaker) return false;
      if (transcriptSearch.trim()) {
        const q = transcriptSearch.toLowerCase();
        return (
          seg.text.toLowerCase().includes(q) ||
          seg.speaker_name.toLowerCase().includes(q) ||
          seg.timestamp.includes(q)
        );
      }
      return true;
    });
  }, [transcriptData, selectedSpeaker, transcriptSearch]);

  // Candidate items extracted from the selected meeting (pending review/approval only)
  const candidateWorkflowTasks = useMemo(() => {
    if (!selectedMeetingId) return [];
    const cands = candidateItems.filter(
      (c) =>
        c.meeting_id === selectedMeetingId &&
        (c.review_status === 'needs_review' || c.review_status === 'pending')
    );
    return cands.map((c) => {
      let blockedById: string | null = null;
      if (c.rejection_reason && c.rejection_reason.startsWith('depends_on:')) {
        blockedById = c.rejection_reason.split('depends_on:')[1]?.trim() || null;
      }
      return {
        id: c.id,
        workspace_id: workspaceId || '',
        meeting_id: c.meeting_id,
        title: c.task || c.source_excerpt || 'Action Item',
        description: c.source_excerpt || '',
        deadline_utc: c.deadline_utc || null,
        priority: (c.priority as any) || 'normal',
        status: (blockedById ? 'blocked' : 'todo') as TaskStatus,
        blocked_by: blockedById,
        execution_type: 'human' as const,
        source_excerpt: c.source_excerpt || '',
        external_owner_label: c.owner_name || null,
        created_at: c.created_at,
        updated_at: c.created_at,
        meetings: activeMeeting
          ? { id: activeMeeting.id, title: activeMeeting.title, starts_at: activeMeeting.starts_at }
          : undefined,
        task_assignees: c.owner_user_id
          ? [
              {
                user_id: c.owner_user_id,
                is_primary: true,
                profiles: {
                  id: c.owner_user_id,
                  display_name: c.owner_name || 'Assigned Member',
                  email: '',
                },
              },
            ]
          : [],
      } as KanbanTaskItem;
    });
  }, [candidateItems, selectedMeetingId, workspaceId, activeMeeting]);

  // 1-Click Approve all candidate chains for this meeting
  const handleApproveAllCandidates = async () => {
    if (!selectedMeetingId) return;
    const cands = candidateItems.filter(
      (c) =>
        c.meeting_id === selectedMeetingId &&
        (c.review_status === 'needs_review' || c.review_status === 'pending')
    );
    if (cands.length === 0) return;
    setApproving(true);
    try {
      const itemsToApprove = cands.map((c) => ({
        id: c.id,
        meeting_id: c.meeting_id,
        title: c.task,
        description: c.source_excerpt,
        due_date: c.deadline_utc,
        extracted_due_date: c.deadline_utc,
        assignee_id: c.owner_user_id || null,
        assignee: null,
        blocked_by_id: c.rejection_reason?.startsWith('depends_on:')
          ? c.rejection_reason.split('depends_on:')[1]?.trim() || null
          : null,
        status: 'pending' as const,
        confidence_score: 0.95,
        transcript_timestamp: '00:00',
        created_at: c.created_at,
        updated_at: c.created_at,
      }));
      await reviewApi.approveActionItems(selectedMeetingId, itemsToApprove as any);
      setCandidateItems((prev) =>
        prev.map((c) =>
          c.meeting_id === selectedMeetingId &&
          (c.review_status === 'needs_review' || c.review_status === 'pending')
            ? { ...c, review_status: 'approved' }
            : c
        )
      );
      await loadWorkspaceMeetingData();
      showToast('Action items approved and synced to task board!');
    } catch (err) {
      console.error('Failed to approve workflow items:', err);
    } finally {
      setApproving(false);
    }
  };

  // Task status transition handler (Compliant with Backend RLS rules)
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const prevTasks = allTasks;
    setAllTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) return { ...t, status: newStatus };
        if (newStatus === 'done' && t.blocked_by === taskId && t.status === 'blocked') {
          return { ...t, status: 'todo' };
        }
        return t;
      })
    );

    try {
      if (workspaceId) {
        await reviewApi.updateTaskStatus(workspaceId, taskId, newStatus);
      } else {
        await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
      }
      showToast(`Task status updated to ${STATUS_CONFIG[newStatus].label}`);
    } catch (err: any) {
      console.warn('Backend status update error, attempting direct fallback:', err);
      try {
        await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
        showToast(`Task status updated to ${STATUS_CONFIG[newStatus].label}`);
      } catch (fallbackErr: any) {
        setAllTasks(prevTasks);
        showToast(fallbackErr?.message || 'Failed to update task status');
      }
    }
  };

  // Copy full transcript text
  const handleCopyTranscript = () => {
    if (!transcriptData) return;
    let fullText = '';
    if (transcriptData.segments.length > 0) {
      fullText = transcriptData.segments
        .map((s) => `${s.speaker_name} (${s.timestamp}): ${s.text}`)
        .join('\n\n');
    } else {
      fullText = transcriptData.canonical_text || transcriptData.raw_text || '';
    }

    if (fullText) {
      navigator.clipboard.writeText(fullText);
      setCopiedTranscript(true);
      showToast('Transcript copied to clipboard!');
      setTimeout(() => setCopiedTranscript(false), 2500);
    }
  };

  // Jump from task quote to transcript segment
  const handleJumpToTranscript = (sourceExcerpt: string) => {
    if (!transcriptData?.segments) return;
    if (activeViewMode !== 'split') {
      setActiveViewMode('transcript');
    }

    const cleanExcerpt = sourceExcerpt.replace(/^["'“”\s]+/, '').slice(0, 20).toLowerCase();

    // Find segment that contains excerpt snippet
    const targetSegment = transcriptData.segments.find((seg) => {
      const excerptWords = cleanExcerpt.split(' ').slice(0, 4).join(' ');
      const segText = seg.text.toLowerCase();
      return (
        segText.includes(cleanExcerpt) ||
        (excerptWords && segText.includes(excerptWords))
      );
    });

    if (targetSegment) {
      setHighlightedSegmentId(targetSegment.id);
      setTimeout(() => {
        const el = segmentRefs.current[targetSegment.id];
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  // Handle new meeting created callback
  const handleMeetingCreated = (newMeeting: any) => {
    if (newMeeting && newMeeting.id) {
      setSelectedMeetingId(newMeeting.id);
      loadWorkspaceMeetingData();
      showToast(`Meeting "${newMeeting.title}" created successfully!`);
    }
  };

  // Advanced meeting creator view
  if (showAdvancedCreate) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <CreateMeeting
          onSuccess={(created) => {
            setShowAdvancedCreate(false);
            handleMeetingCreated(created);
          }}
          onCancel={() => setShowAdvancedCreate(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-indigo-500/40 bg-neutral-900/95 px-4 py-3 text-xs font-medium text-white shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header with Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <CalendarPlus className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Meeting Transcripts & Action Items
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Browse old and new meetings, read verbatim transcripts, and manage AI-extracted tasks
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadWorkspaceMeetingData()}
            className="border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300 text-xs"
          >
            <RefreshCw className="size-3.5 mr-1" />
            Refresh
          </Button>

          {isOrganiserOrAdmin && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 text-xs"
            >
              <Plus className="size-4 mr-1.5" />
              New Meeting
            </Button>
          )}
        </div>
      </div>

      {/* 2. Top Navigation Tabs (Workflow Hub vs Online Automation) */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-1">
        <button
          onClick={() => setActiveTab('workflows')}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-all ${
            activeTab === 'workflows'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Calendar className="size-3.5 text-indigo-400" />
          <span>Meeting Library & Action Boards</span>
        </button>

        <button
          onClick={() => setActiveTab('automation')}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-all ${
            activeTab === 'automation'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Video className="size-3.5 text-indigo-400" />
          <span>Online Meeting Automation</span>
        </button>
      </div>

      {activeTab === 'automation' && workspaceId ? (
        <OnlineMeetingAutomationHub
          workspaceId={workspaceId}
          onMeetingCreated={loadWorkspaceMeetingData}
        />
      ) : loading ? (
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-neutral-400">
          <LoaderCircle className="size-5 animate-spin text-indigo-400" />
          <span>Loading meetings, transcripts, and tasks…</span>
        </div>
      ) : meetings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
          <CalendarPlus className="mx-auto size-10 text-neutral-600 mb-3" />
          <h3 className="text-base font-semibold text-white">No meetings recorded yet</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1 mb-5">
            Create a new meeting to paste or upload a transcript. Action items, owners, and deadlines will be automatically extracted.
          </p>
          {isOrganiserOrAdmin && (
            <Button onClick={() => setShowCreateModal(true)} size="sm">
              <Plus className="size-4 mr-1.5" />
              Create First Meeting
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 3. Left Column: Meeting Directory with Old/Past Filters & Search */}
          <div className="lg:col-span-4 space-y-3.5">
            {/* Filter pills: All / Old & Past / Upcoming */}
            <div className="flex items-center gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setMeetingFilter('all')}
                className={`flex-1 rounded-lg py-1.5 text-center font-medium transition-colors ${
                  meetingFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                All ({meetings.length})
              </button>
              <button
                type="button"
                onClick={() => setMeetingFilter('past')}
                className={`flex-1 rounded-lg py-1.5 text-center font-medium transition-colors ${
                  meetingFilter === 'past'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Old Meetings ({pastMeetingsCount})
              </button>
              <button
                type="button"
                onClick={() => setMeetingFilter('upcoming')}
                className={`flex-1 rounded-lg py-1.5 text-center font-medium transition-colors ${
                  meetingFilter === 'upcoming'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Upcoming ({upcomingMeetingsCount})
              </button>
            </div>

            {/* Search meetings input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-3.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Search meetings by title or date..."
                value={meetingSearch}
                onChange={(e) => setMeetingSearch(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                {meetingFilter === 'past'
                  ? 'Past Meeting Sessions'
                  : meetingFilter === 'upcoming'
                  ? 'Scheduled Upcoming'
                  : 'All Sessions'} ({filteredMeetings.length})
              </span>
              <span className="text-[11px] text-neutral-500">Click to view transcript & tasks</span>
            </div>

            {/* Meeting cards list */}
            <div className="space-y-2.5 max-h-[calc(100vh-17rem)] overflow-y-auto pr-1">
              {filteredMeetings.length === 0 ? (
                <div className="p-6 text-center text-xs text-neutral-500 rounded-xl border border-dashed border-white/10">
                  No meetings matching the filter.
                </div>
              ) : (
                filteredMeetings.map((m) => {
                  const isSelected = m.id === selectedMeetingId;
                  const isPast = isPastMeeting(m);
                  const mTasks = allTasks.filter((t) => t.meeting_id === m.id);
                  const taskCount = mTasks.length > 0
                    ? mTasks.length
                    : m.id === 'mtg-sprint-102'
                    ? DEMO_TASKS_SPRINT_102.length
                    : m.id === 'mtg-ds-01'
                    ? DEMO_TASKS_DS_01.length
                    : 0;

                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMeetingId(m.id)}
                      role="button"
                      tabIndex={0}
                      className={`group rounded-xl border p-4 text-left transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30 shadow-lg shadow-indigo-500/10'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20'
                      }`}
                    >
                      {/* Active indicator stripe */}
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                      )}

                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-white line-clamp-1 group-hover:text-indigo-300 transition-colors">
                          {m.title}
                        </h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isPast && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-300 border border-white/10">
                              Old
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${
                              m.status === 'ready'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : m.status === 'failed'
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {m.status}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center gap-3 text-xs text-neutral-400">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-neutral-500" />
                          {new Date(m.starts_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>

                        {m.conference_url && (
                          <span className="flex items-center gap-1 text-indigo-400">
                            <Video className="size-3" /> Call
                          </span>
                        )}

                        <span className="flex items-center gap-1 ml-auto">
                          <ListTodo className="size-3 text-indigo-400" />
                          <span className="font-medium text-white">{taskCount} tasks</span>
                        </span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-neutral-400">
                        {m.status === 'ready' ? (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <FileText className="size-3" /> Transcript ready
                          </span>
                        ) : m.status === 'processing' ? (
                          <span className="flex items-center gap-1 text-amber-400">
                            <LoaderCircle className="size-3 animate-spin" /> Processing…
                          </span>
                        ) : m.status === 'failed' ? (
                          <span className="flex items-center gap-1 text-rose-400">
                            <FileText className="size-3" /> Transcript failed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-neutral-500">
                            <FileText className="size-3" /> No transcript
                          </span>
                        )}
                        <span className="text-[10px] text-neutral-500">{m.timezone || 'UTC'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 4. Right Column: Selected Meeting Workspace with Transcript & Tasks */}
          <div className="lg:col-span-8 space-y-6">
            {activeMeeting ? (
              <>
                {/* Meeting Header Banner */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {isPastMeeting(activeMeeting) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            <Clock className="size-3" /> Past Meeting Archive
                          </span>
                        )}
                        <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                          {activeMeeting.timezone}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-white mt-1.5">{activeMeeting.title}</h2>
                      <p className="text-xs text-neutral-400 mt-1 flex items-center gap-2">
                        <span>
                          {new Date(activeMeeting.starts_at).toLocaleDateString(undefined, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                        {activeMeeting.conference_url && (
                          <a
                            href={activeMeeting.conference_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 ml-2 underline"
                          >
                            <Video className="size-3" /> Join Call
                          </a>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFollowUpModal(true)}
                        className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 text-xs"
                      >
                        <Sparkles className="size-3.5 mr-1 text-indigo-400" />
                        Draft Follow-Up
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/meetings/${activeMeeting.id}/review`)}
                        className="border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs"
                      >
                        Staging Review Gate <ArrowRight className="size-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/10 text-center">
                    <div className="rounded-xl bg-white/[0.02] p-2.5 border border-white/5">
                      <span className="text-[11px] text-neutral-400 block">Total Tasks</span>
                      <span className="text-lg font-bold text-white">{meetingTasks.length}</span>
                    </div>
                    <div className="rounded-xl bg-white/[0.02] p-2.5 border border-white/5">
                      <span className="text-[11px] text-neutral-400 block">Completed</span>
                      <span className="text-lg font-bold text-emerald-400">
                        {meetingTasks.filter((t) => t.status === 'done').length}
                      </span>
                    </div>
                    <div className="rounded-xl bg-white/[0.02] p-2.5 border border-white/5">
                      <span className="text-[11px] text-neutral-400 block">Blocked</span>
                      <span className="text-lg font-bold text-amber-400">
                        {meetingTasks.filter((t) => t.status === 'blocked').length}
                      </span>
                    </div>
                    <div className="rounded-xl bg-white/[0.02] p-2.5 border border-white/5">
                      <span className="text-[11px] text-neutral-400 block">Transcript</span>
                      <span className="text-lg font-bold text-indigo-300">
                        {transcriptData?.segments?.length
                          ? `${transcriptData.segments.length} segs`
                          : transcriptLoading
                          ? 'Loading…'
                          : 'Available'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* View Switcher: Tasks | Transcript | Split View | Chains */}
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('tasks')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                        activeViewMode === 'tasks'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-neutral-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <ListTodo className="size-3.5" />
                      Tasks ({meetingTasks.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveViewMode('transcript')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                        activeViewMode === 'transcript'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-neutral-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <FileText className="size-3.5" />
                      Transcript ({transcriptData?.segments?.length || (transcriptData ? 'Text' : '0')})
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveViewMode('split')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                        activeViewMode === 'split'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-neutral-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <SplitSquareVertical className="size-3.5" />
                      Split View
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveViewMode('chains')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                        activeViewMode === 'chains'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-neutral-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <GitFork className="size-3.5" />
                      Workflow Chains
                    </button>
                  </div>
                </div>

                {/* Candidate Action Items Approval Banner */}
                {candidateWorkflowTasks.length > 0 && (
                  <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                        <Sparkles className="size-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                          {candidateWorkflowTasks.length} AI-Extracted Action Items Available
                        </h4>
                        <p className="text-[11px] text-neutral-300 mt-0.5">
                          Extracted from this meeting's transcript and ready for approval into confirmed tasks.
                        </p>
                      </div>
                    </div>

                    {isOrganiserOrAdmin && (
                      <Button
                        size="sm"
                        disabled={approving}
                        onClick={handleApproveAllCandidates}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 text-xs h-8"
                      >
                        <CheckCircle2 className="size-3.5 mr-1.5" />
                        {approving ? 'Approving…' : 'Approve All to Board'}
                      </Button>
                    )}
                  </div>
                )}

                {/* ========================================================= */}
                {/* VIEW 1: TASKS TAB */}
                {/* ========================================================= */}
                {activeViewMode === 'tasks' && (
                  <div className="space-y-4">
                    {/* Task Filters & Search */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-xl border border-white/10 text-xs overflow-x-auto">
                        {['all', 'todo', 'in_progress', 'blocked', 'done'].map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setTaskStatusFilter(st)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                              taskStatusFilter === st
                                ? 'bg-indigo-600 text-white'
                                : 'text-neutral-400 hover:text-white'
                            }`}
                          >
                            {st === 'all' ? 'All' : STATUS_CONFIG[st as TaskStatus]?.label || st}
                          </button>
                        ))}
                      </div>

                      <div className="relative sm:w-64">
                        <Search className="absolute left-3 top-2.5 size-3.5 text-neutral-500" />
                        <input
                          type="text"
                          placeholder="Search tasks or assignees..."
                          value={taskSearch}
                          onChange={(e) => setTaskSearch(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {filteredTasks.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center space-y-2">
                        <ListTodo className="mx-auto size-8 text-neutral-600" />
                        <h4 className="text-sm font-semibold text-white">No tasks found</h4>
                        <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                          No tasks match the active filter for this meeting.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredTasks.map((t) => {
                          const priority = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.normal;
                          const status = STATUS_CONFIG[t.status] || STATUS_CONFIG.todo;
                          const primaryAssignee = t.task_assignees?.[0]?.profiles;

                          return (
                            <div
                              key={t.id}
                              className="rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] p-4.5 transition-all space-y-3"
                            >
                              {/* Top meta row */}
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {/* Status selector dropdown */}
                                  <div className="relative inline-block">
                                    <select
                                      value={t.status}
                                      onChange={(e) => handleStatusChange(t.id, e.target.value as TaskStatus)}
                                      className={`text-xs font-semibold px-2.5 py-1 rounded-md border appearance-none pr-6 cursor-pointer bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${status.badgeClass}`}
                                    >
                                      <option value="todo">To Do</option>
                                      <option value="in_progress">In Progress</option>
                                      <option value="blocked">Blocked</option>
                                      <option value="done">Done</option>
                                    </select>
                                    <ChevronDown className="absolute right-1.5 top-2 size-3 pointer-events-none text-neutral-400" />
                                  </div>

                                  {/* Priority badge */}
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${priority.badgeClass}`}>
                                    {priority.label}
                                  </span>

                                  {t.external_owner_label && (
                                    <span className="text-[11px] text-neutral-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                      Owner: {t.external_owner_label}
                                    </span>
                                  )}
                                </div>

                                {/* Right: Due date & WhatsApp Share */}
                                <div className="flex items-center gap-2.5">
                                  {t.deadline_utc && (
                                    <span className="text-xs text-neutral-400 flex items-center gap-1">
                                      <Clock className="size-3 text-neutral-500" />
                                      {new Date(t.deadline_utc).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                      })}
                                    </span>
                                  )}

                                  <WhatsAppShareButton
                                    taskTitle={t.title}
                                    deadlineUtc={t.deadline_utc}
                                    priority={t.priority}
                                    status={t.status}
                                    assigneeName={primaryAssignee?.display_name || t.external_owner_label}
                                    meetingTitle={activeMeeting.title}
                                  />
                                </div>
                              </div>

                              {/* Task Title & Description */}
                              <div>
                                <h4 className="text-sm font-semibold text-white">{t.title}</h4>
                                {t.description && (
                                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                                    {t.description}
                                  </p>
                                )}
                              </div>

                              {/* Grounding Quote / Verbatim Source Excerpt */}
                              {t.source_excerpt && (
                                <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-2.5 flex items-start justify-between gap-3 text-xs">
                                  <div className="flex items-start gap-2 text-indigo-300">
                                    <span className="text-indigo-400 font-serif text-base leading-none">“</span>
                                    <span className="italic line-clamp-2">{t.source_excerpt}</span>
                                    <span className="text-indigo-400 font-serif text-base leading-none">”</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleJumpToTranscript(t.source_excerpt)}
                                    className="shrink-0 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium underline flex items-center gap-1"
                                  >
                                    View in Transcript →
                                  </button>
                                </div>
                              )}

                              {/* Assignee & Prerequisite Footer */}
                              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
                                <div className="flex items-center gap-2">
                                  <div className="flex size-5 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-semibold text-indigo-300">
                                    {primaryAssignee?.display_name?.charAt(0) || <User className="size-3" />}
                                  </div>
                                  <span>{primaryAssignee?.display_name || 'Unassigned'}</span>
                                </div>

                                {t.blocked_by && (
                                  <span className="text-amber-400 text-[11px] flex items-center gap-1">
                                    <AlertCircle className="size-3" />
                                    Has prerequisite dependency
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ========================================================= */}
                {/* VIEW 2: TRANSCRIPT TAB */}
                {/* ========================================================= */}
                {activeViewMode === 'transcript' && (
                  <div className="space-y-4">
                    {/* Transcript Controls Bar */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-1 sm:w-64">
                          <Search className="absolute left-3 top-2.5 size-3.5 text-neutral-500" />
                          <input
                            type="text"
                            placeholder="Search transcript dialogue..."
                            value={transcriptSearch}
                            onChange={(e) => setTranscriptSearch(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>

                        {transcriptSpeakers.length > 0 && (
                          <div className="relative">
                            <select
                              value={selectedSpeaker}
                              onChange={(e) => setSelectedSpeaker(e.target.value)}
                              className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs text-white appearance-none pr-7 cursor-pointer focus:border-indigo-500 focus:outline-none"
                            >
                              <option value="all">All Speakers ({transcriptSpeakers.length})</option>
                              {transcriptSpeakers.map((spk) => (
                                <option key={spk} value={spk}>
                                  {spk}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-2 size-3 pointer-events-none text-neutral-400" />
                          </div>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyTranscript}
                        className="border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs h-8 shrink-0"
                      >
                        {copiedTranscript ? (
                          <>
                            <Check className="size-3.5 mr-1 text-emerald-400" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5 mr-1 text-neutral-400" />
                            Copy Full Transcript
                          </>
                        )}
                      </Button>
                    </div>

                    {transcriptLoading ? (
                      <div className="p-12 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                        <LoaderCircle className="size-4 animate-spin text-indigo-400" />
                        <span>Loading transcript segments…</span>
                      </div>
                    ) : filteredSegments.length > 0 ? (
                      <div className="space-y-3">
                        {filteredSegments.map((seg) => {
                          const pillStyle = SPEAKER_PILL_STYLES[seg.speaker_color || 'indigo'] || SPEAKER_PILL_STYLES.indigo;
                          const isHighlighted = highlightedSegmentId === seg.id;

                          // Check if any task quoted this segment
                          const matchingTask = meetingTasks.find((t) => {
                            if (!t.source_excerpt) return false;
                            const clean = t.source_excerpt.replace(/^["'“”\s]+/, '').slice(0, 20).toLowerCase();
                            return clean && seg.text.toLowerCase().includes(clean);
                          });

                          return (
                            <div
                              key={seg.id}
                              ref={(el) => {
                                segmentRefs.current[seg.id] = el;
                              }}
                              className={`rounded-xl border p-4 transition-all ${
                                isHighlighted
                                  ? 'border-indigo-500 bg-indigo-500/15 ring-2 ring-indigo-500/40 shadow-lg'
                                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${pillStyle.bg} ${pillStyle.text} ${pillStyle.border}`}
                                  >
                                    <span className="size-1.5 rounded-full bg-current" />
                                    {seg.speaker_name}
                                  </span>

                                  <span className="text-[11px] font-mono text-neutral-400">
                                    {seg.timestamp}
                                  </span>
                                </div>

                                {matchingTask && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md">
                                    <Sparkles className="size-3 text-amber-400" />
                                    Grounded Task: {matchingTask.title.slice(0, 28)}…
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-neutral-200 leading-relaxed font-sans">
                                {transcriptSearch ? (
                                  seg.text.split(new RegExp(`(${transcriptSearch})`, 'gi')).map((part, i) =>
                                    part.toLowerCase() === transcriptSearch.toLowerCase() ? (
                                      <mark key={i} className="bg-amber-500/30 text-amber-200 rounded px-0.5">
                                        {part}
                                      </mark>
                                    ) : (
                                      part
                                    )
                                  )
                                ) : (
                                  seg.text
                                )}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : transcriptData?.canonical_text || transcriptData?.raw_text ? (
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                        <pre className="text-xs text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed">
                          {transcriptData.canonical_text || transcriptData.raw_text}
                        </pre>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center space-y-3">
                        <FileText className="mx-auto size-8 text-neutral-600" />
                        <h4 className="text-sm font-semibold text-white">No transcript attached to this meeting</h4>
                        <p className="text-xs text-neutral-400 max-w-md mx-auto">
                          Upload or paste a meeting transcript in the Review Gate to automatically extract grounded action items.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => navigate(`/meetings/${activeMeeting.id}/review`)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                        >
                          Upload Transcript in Review Gate
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* ========================================================= */}
                {/* VIEW 3: SPLIT VIEW (Side-by-Side: Transcript & Tasks) */}
                {/* ========================================================= */}
                {activeViewMode === 'split' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Pane: Transcript */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3 max-h-[75vh] overflow-y-auto">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <FileText className="size-3.5 text-indigo-400" />
                          Meeting Transcript
                        </h3>
                        <span className="text-[11px] text-neutral-400">
                          {filteredSegments.length} segments
                        </span>
                      </div>

                      {filteredSegments.map((seg) => {
                        const pillStyle = SPEAKER_PILL_STYLES[seg.speaker_color || 'indigo'] || SPEAKER_PILL_STYLES.indigo;
                        const isHighlighted = highlightedSegmentId === seg.id;

                        return (
                          <div
                            key={seg.id}
                            ref={(el) => {
                              segmentRefs.current[seg.id] = el;
                            }}
                            className={`rounded-xl border p-3 text-xs transition-all ${
                              isHighlighted
                                ? 'border-indigo-500 bg-indigo-500/20 ring-1 ring-indigo-500'
                                : 'border-white/5 bg-white/[0.01]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className={`text-[11px] font-semibold ${pillStyle.text}`}>
                                {seg.speaker_name}
                              </span>
                              <span className="text-[10px] font-mono text-neutral-500">{seg.timestamp}</span>
                            </div>
                            <p className="text-neutral-300 text-[11px] leading-relaxed">{seg.text}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Right Pane: Tasks */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3 max-h-[75vh] overflow-y-auto">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <ListTodo className="size-3.5 text-indigo-400" />
                          Extracted Action Items
                        </h3>
                        <span className="text-[11px] text-neutral-400">
                          {meetingTasks.length} tasks
                        </span>
                      </div>

                      {meetingTasks.length === 0 ? (
                        <div className="p-8 text-center text-xs text-neutral-500 rounded-xl border border-dashed border-white/10">
                          No confirmed tasks for this meeting yet.
                        </div>
                      ) : (
                        meetingTasks.map((t) => {
                          const priority = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.normal;
                          const status = STATUS_CONFIG[t.status] || STATUS_CONFIG.todo;

                          return (
                            <div
                              key={t.id}
                              className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${status.badgeClass}`}>
                                  {status.label}
                                </span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${priority.badgeClass}`}>
                                  {priority.label}
                                </span>
                              </div>

                              <h4 className="font-semibold text-white text-xs">{t.title}</h4>

                              {t.source_excerpt && (
                                <button
                                  type="button"
                                  onClick={() => handleJumpToTranscript(t.source_excerpt)}
                                  className="w-full text-left p-2 rounded bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 italic hover:bg-indigo-500/20 transition-colors"
                                >
                                  “{t.source_excerpt.slice(0, 90)}…”
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* VIEW 4: WORKFLOW CHAINS TAB */}
                {/* ========================================================= */}
                {activeViewMode === 'chains' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <GitFork className="size-4 text-indigo-400" />
                        <h3 className="text-sm font-semibold text-white">
                          Sequential Dependency Chains
                        </h3>
                      </div>
                    </div>

                    {meetingTasks.length > 0 ? (
                      <WorkflowChainsView
                        tasks={meetingTasks}
                        onOpenDependencyModal={(task) => setSelectedTaskForDependency(task)}
                        onStatusChange={handleStatusChange}
                      />
                    ) : candidateWorkflowTasks.length > 0 ? (
                      <WorkflowChainsView
                        tasks={candidateWorkflowTasks}
                        onOpenDependencyModal={(task) => setSelectedTaskForDependency(task)}
                        onStatusChange={handleStatusChange}
                      />
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-xs text-neutral-400">
                        No dependency chains recorded for this meeting.
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* 5. Create Meeting Modal (Integrated directly on page) */}
      <CreateMeetingModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        workspaceId={workspaceId || ''}
        onMeetingCreated={handleMeetingCreated}
        onSwitchToAdvanced={() => setShowAdvancedCreate(true)}
      />

      {/* 6. 1-Click Meeting Follow-Up Modal */}
      {activeMeeting && (
        <FollowUpModal
          isOpen={showFollowUpModal}
          onClose={() => setShowFollowUpModal(false)}
          meetingId={activeMeeting.id}
          meetingTitle={activeMeeting.title}
        />
      )}

      {/* 7. Task Dependency Modal */}
      <TaskDependencyModal
        isOpen={Boolean(selectedTaskForDependency)}
        onClose={() => setSelectedTaskForDependency(null)}
        task={selectedTaskForDependency}
        allTasks={meetingTasks.length > 0 ? meetingTasks : allTasks}
        onUpdateDependency={async (taskId, blockedById, executionType) => {
          setAllTasks((prev) =>
            prev.map((t) => {
              if (t.id === taskId) {
                return {
                  ...t,
                  blocked_by: blockedById,
                  status: blockedById ? 'blocked' : 'todo',
                  execution_type: executionType || t.execution_type,
                };
              }
              return t;
            })
          );
          if (workspaceId) {
            await reviewApi.updateTaskDependency(workspaceId, taskId, blockedById, executionType);
          }
        }}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
