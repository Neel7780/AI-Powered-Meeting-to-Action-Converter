import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Video,
  ListTodo,
  Sparkles,
  Plus,
  Download,
  RefreshCw,
  Building2,
  ArrowRight,
  Search,
  X,
  CalendarCheck2,
  CheckSquare2,
  Loader2,
  Mail,
  Upload,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../context/WorkspaceContext';
import { Button } from '../components/ui/button';
import { CreateMeetingModal } from '../components/meetings/CreateMeetingModal';
import { ScheduleMeetingModal } from '../components/meetings/ScheduleMeetingModal';
import { FollowUpModal } from '../components/meetings/FollowUpModal';
import { postApi } from '../services/reviewApi';
import {
  getCalendarStatus,
  getCalendarConnectUrl,
  getUpcomingCalendarEvents,
  type CalendarStatus,
  type CalendarEventItem,
} from '../services/calendarApi';

export interface CalendarMeeting {
  id: string;
  title: string;
  starts_at: string;
  ends_at?: string | null;
  timezone: string;
  organiser_id?: string;
  conference_url?: string | null;
  workspace_id: string;
  workspace_name?: string;
  workspace_color_idx?: number;
  created_at?: string;
  tasks_count?: number;
  description?: string | null;
  source_excerpt?: string | null;
  calendar_event_id?: string | null;
  calendar_provider?: string | null;
  is_demo?: boolean;
}

export interface CalendarTask {
  id: string;
  title: string;
  deadline_utc: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  workspace_id: string;
  workspace_name?: string;
  workspace_color_idx?: number;
  meeting_id?: string | null;
  meeting_title?: string | null;
  source_excerpt?: string | null;
}

type ViewMode = 'month' | 'week' | 'agenda';
type TimeFilter = 'all' | 'upcoming' | 'past';
type ContentFilter = 'all' | 'meetings' | 'tasks';

const WORKSPACE_PALETTES = [
  {
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-400',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    dot: 'bg-indigo-400',
    chip: 'bg-indigo-950/70 border-indigo-500/40 text-indigo-200 hover:border-indigo-400',
  },
  {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-400',
    chip: 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200 hover:border-emerald-400',
  },
  {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dot: 'bg-amber-400',
    chip: 'bg-amber-950/70 border-amber-500/40 text-amber-200 hover:border-amber-400',
  },
  {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    dot: 'bg-rose-400',
    chip: 'bg-rose-950/70 border-rose-500/40 text-rose-200 hover:border-rose-400',
  },
  {
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    text: 'text-sky-400',
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    dot: 'bg-sky-400',
    chip: 'bg-sky-950/70 border-sky-500/40 text-sky-200 hover:border-sky-400',
  },
  {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    dot: 'bg-purple-400',
    chip: 'bg-purple-950/70 border-purple-500/40 text-purple-200 hover:border-purple-400',
  },
  {
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    text: 'text-teal-400',
    badge: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    dot: 'bg-teal-400',
    chip: 'bg-teal-950/70 border-teal-500/40 text-teal-200 hover:border-teal-400',
  },
];

function getWorkspacePalette(idx: number) {
  return WORKSPACE_PALETTES[idx % WORKSPACE_PALETTES.length];
}

const PRIORITY_BADGES: Record<string, string> = {
  urgent: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  high: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  normal: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  low: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/40',
};

const STATUS_BADGES: Record<string, string> = {
  todo: 'bg-neutral-800 text-neutral-300 border-neutral-700',
  in_progress: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  blocked: 'bg-red-500/20 text-red-300 border-red-500/40',
  done: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
};

/** Downloads an RFC 5545 .ics iCalendar file for Google Calendar, Apple Calendar, or Outlook */
function exportMeetingToIcs(meeting: CalendarMeeting) {
  const start = new Date(meeting.starts_at);
  const end = meeting.ends_at
    ? new Date(meeting.ends_at)
    : new Date(start.getTime() + 45 * 60 * 1000);

  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const escapeIcs = (str: string) => {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  };

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ActionPulse//Personal Meeting Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${meeting.id}@actionpulse.io`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(start)}`,
    `DTEND:${formatDate(end)}`,
    `SUMMARY:${escapeIcs(meeting.title)}`,
    `DESCRIPTION:${escapeIcs(meeting.description || `ActionPulse Meeting for ${meeting.workspace_name || 'Workspace'}`)}`,
    meeting.conference_url ? `LOCATION:${escapeIcs(meeting.conference_url)}` : 'LOCATION:Virtual Room',
  ];

  if (meeting.conference_url) {
    icsLines.push(`URL:${meeting.conference_url}`);
  }

  icsLines.push('STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR');

  const content = icsLines.filter(Boolean).join('\r\n');
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${meeting.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const { workspaces, currentWorkspace, switchWorkspace, loading: workspaceLoading } = useWorkspace();

  // State
  const [meetings, setMeetings] = useState<CalendarMeeting[]>([]);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [googleEvents, setGoogleEvents] = useState<CalendarEventItem[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Selected item modals
  const [activeMeeting, setActiveMeeting] = useState<CalendarMeeting | null>(null);
  const [activeTask, setActiveTask] = useState<CalendarTask | null>(null);
  const [activeGCalEvent, setActiveGCalEvent] = useState<CalendarEventItem | null>(null);

  // Scheduling modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleInitialDate, setScheduleInitialDate] = useState<string | undefined>(undefined);
  const [scheduleInitialTitle, setScheduleInitialTitle] = useState<string | undefined>(undefined);
  const [scheduleInitialUrl, setScheduleInitialUrl] = useState<string | undefined>(undefined);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState<string | undefined>(undefined);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpMeeting, setFollowUpMeeting] = useState<{ id: string; title: string } | null>(null);
  const [sendingInvitesMeetingId, setSendingInvitesMeetingId] = useState<string | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

  const handleOpenSchedule = (dateStr?: string, title?: string, confUrl?: string) => {
    setScheduleInitialDate(dateStr);
    setScheduleInitialTitle(title);
    setScheduleInitialUrl(confUrl);
    setShowScheduleModal(true);
  };

  // Google Calendar Integration state
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [calendarSyncNotice, setCalendarSyncNotice] = useState<string | null>(null);

  // Build mapping from workspaceId -> index
  const workspaceColorMap = useMemo(() => {
    const map = new Map<string, number>();
    workspaces.forEach((ws, idx) => {
      map.set(ws.id, idx);
    });
    return map;
  }, [workspaces]);

  const workspaceNameMap = useMemo(() => {
    const map = new Map<string, string>();
    workspaces.forEach((ws) => {
      map.set(ws.id, ws.name);
    });
    return map;
  }, [workspaces]);

  // Load actual meetings and tasks across all user's workspaces
  const fetchAllWorkspaceData = useCallback(async () => {
    if (workspaceLoading) return;
    setIsLoading(true);

    try {
      const workspaceIds = workspaces.map((w) => w.id);
      let loadedMeetings: CalendarMeeting[] = [];
      let loadedTasks: CalendarTask[] = [];

      if (workspaceIds.length > 0) {
        // 1. Fetch real meetings from Supabase for all user's workspaces
        const { data: dbMeetings, error: mtgErr } = await supabase
          .from('meetings')
          .select('id, title, starts_at, timezone, organiser_id, conference_url, workspace_id, calendar_event_id, calendar_provider, created_at')
          .in('workspace_id', workspaceIds)
          .order('starts_at', { ascending: false });

        if (!mtgErr && dbMeetings) {
          // 2. Fetch task counts for these meetings
          const { data: allTaskCounts } = await supabase
            .from('tasks')
            .select('id, meeting_id')
            .in('workspace_id', workspaceIds);

          const taskCountMap = new Map<string, number>();
          allTaskCounts?.forEach((t) => {
            if (t.meeting_id) {
              taskCountMap.set(t.meeting_id, (taskCountMap.get(t.meeting_id) || 0) + 1);
            }
          });

          loadedMeetings = dbMeetings.map((m) => {
            const wsIdx = workspaceColorMap.get(m.workspace_id) ?? 0;
            const wsName = workspaceNameMap.get(m.workspace_id) || 'Workspace';
            const startD = new Date(m.starts_at);
            const endD = new Date(startD.getTime() + 45 * 60 * 1000);
            return {
              id: m.id,
              title: m.title,
              starts_at: m.starts_at,
              ends_at: endD.toISOString(),
              timezone: m.timezone || 'Asia/Kolkata',
              organiser_id: m.organiser_id,
              conference_url: m.conference_url,
              workspace_id: m.workspace_id,
              workspace_name: wsName,
              workspace_color_idx: wsIdx,
              created_at: m.created_at,
              tasks_count: taskCountMap.get(m.id) || 0,
              calendar_event_id: m.calendar_event_id,
              calendar_provider: m.calendar_provider,
              is_demo: false,
            };
          });
        }

        // 3. Fetch real tasks that have deadlines
        const { data: dbTasks, error: taskErr } = await supabase
          .from('tasks')
          .select('id, title, deadline_utc, priority, status, workspace_id, meeting_id, source_excerpt')
          .in('workspace_id', workspaceIds)
          .not('deadline_utc', 'is', null)
          .order('deadline_utc', { ascending: true });

        if (!taskErr && dbTasks) {
          const meetingTitleMap = new Map<string, string>();
          loadedMeetings.forEach((m) => meetingTitleMap.set(m.id, m.title));

          loadedTasks = dbTasks.map((t) => {
            const wsIdx = workspaceColorMap.get(t.workspace_id) ?? 0;
            const wsName = workspaceNameMap.get(t.workspace_id) || 'Workspace';
            return {
              id: t.id,
              title: t.title,
              deadline_utc: t.deadline_utc,
              priority: (t.priority as any) || 'normal',
              status: (t.status as any) || 'todo',
              workspace_id: t.workspace_id,
              workspace_name: wsName,
              workspace_color_idx: wsIdx,
              meeting_id: t.meeting_id,
              meeting_title: t.meeting_id ? meetingTitleMap.get(t.meeting_id) || null : null,
              source_excerpt: t.source_excerpt,
            };
          });
        }
      }
      setMeetings(loadedMeetings);
      setTasks(loadedTasks);
    } catch (err) {
      console.warn('[ActionPulse] Calendar fetch note:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaces, workspaceLoading, workspaceColorMap, workspaceNameMap]);

  useEffect(() => {
    fetchAllWorkspaceData();
  }, [fetchAllWorkspaceData]);

  // Check Google Calendar connection status for the target workspace
  const activeWorkspaceId = selectedWorkspaceId !== 'all' ? selectedWorkspaceId : currentWorkspace?.id;
  useEffect(() => {
    if (!activeWorkspaceId) return;
    getCalendarStatus(activeWorkspaceId)
      .then((status) => setCalendarStatus(status))
      .catch(() => setCalendarStatus(null));
  }, [activeWorkspaceId]);

  const handleSyncGoogleCalendar = async () => {
    if (!activeWorkspaceId) return;
    setSyncingCalendar(true);
    setCalendarSyncNotice(null);
    try {
      if (!calendarStatus?.connected) {
        sessionStorage.setItem('calendar_return_to', '/calendar');
        const redirectUri = `${window.location.origin}/calendar/callback`;
        const authUrl = await getCalendarConnectUrl(activeWorkspaceId, redirectUri);
        window.location.href = authUrl;
        return;
      }
      const data = await getUpcomingCalendarEvents(activeWorkspaceId, 30);
      setGoogleEvents(data.events || []);
      setCalendarSyncNotice(`Synced ${data.events.length} Google Calendar event(s) successfully.`);
      await fetchAllWorkspaceData();
    } catch (err: any) {
      setCalendarSyncNotice(
        err?.message || 'Google Calendar sync failed. Reconnect your account to refresh permissions.'
      );
    } finally {
      setSyncingCalendar(false);
    }
  };

  // Filtered meetings
  const filteredMeetings = useMemo(() => {
    const now = new Date().getTime();
    return meetings.filter((meeting) => {
      if (contentFilter === 'tasks') return false;

      if (selectedWorkspaceId !== 'all' && meeting.workspace_id !== selectedWorkspaceId) {
        return false;
      }

      const meetingTime = new Date(meeting.starts_at).getTime();
      const isPast = meetingTime < now;

      if (timeFilter === 'upcoming' && isPast) return false;
      if (timeFilter === 'past' && !isPast) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = meeting.title.toLowerCase().includes(q);
        const matchWs = (meeting.workspace_name || '').toLowerCase().includes(q);
        const matchDesc = (meeting.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchWs && !matchDesc) return false;
      }

      return true;
    });
  }, [meetings, selectedWorkspaceId, timeFilter, contentFilter, searchQuery]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    const now = new Date().getTime();
    return tasks.filter((task) => {
      if (contentFilter === 'meetings') return false;

      if (selectedWorkspaceId !== 'all' && task.workspace_id !== selectedWorkspaceId) {
        return false;
      }

      const deadlineTime = new Date(task.deadline_utc).getTime();
      const isPast = deadlineTime < now;

      if (timeFilter === 'upcoming' && isPast) return false;
      if (timeFilter === 'past' && !isPast) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchWs = (task.workspace_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchWs) return false;
      }

      return true;
    });
  }, [tasks, selectedWorkspaceId, timeFilter, contentFilter, searchQuery]);

  // Filtered Google Events (only show if not imported yet)
  const unimportedGCalEvents = useMemo(() => {
    return googleEvents.filter((ev) => !ev.already_imported);
  }, [googleEvents]);

  // Counts for tabs
  const upcomingCount = useMemo(() => {
    const now = new Date().getTime();
    const mtgs = meetings.filter((m) => {
      const matchWs = selectedWorkspaceId === 'all' || m.workspace_id === selectedWorkspaceId;
      return matchWs && new Date(m.starts_at).getTime() >= now;
    }).length;
    const tsks = tasks.filter((t) => {
      const matchWs = selectedWorkspaceId === 'all' || t.workspace_id === selectedWorkspaceId;
      return matchWs && new Date(t.deadline_utc).getTime() >= now;
    }).length;
    return mtgs + tsks;
  }, [meetings, tasks, selectedWorkspaceId]);

  const pastCount = useMemo(() => {
    const now = new Date().getTime();
    const mtgs = meetings.filter((m) => {
      const matchWs = selectedWorkspaceId === 'all' || m.workspace_id === selectedWorkspaceId;
      return matchWs && new Date(m.starts_at).getTime() < now;
    }).length;
    const tsks = tasks.filter((t) => {
      const matchWs = selectedWorkspaceId === 'all' || t.workspace_id === selectedWorkspaceId;
      return matchWs && new Date(t.deadline_utc).getTime() < now;
    }).length;
    return mtgs + tsks;
  }, [meetings, tasks, selectedWorkspaceId]);

  // Calendar Date Navigation
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Open modal with prefilled date
  const handleDateCellClick = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const isoString = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T10:00`;
    handleOpenSchedule(isoString);
  };

  // Month header text
  const monthYearLabel = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  // Week range label (Monday to Sunday)
  const weekRangeLabel = useMemo(() => {
    const start = new Date(currentDate);
    const rawDay = start.getDay();
    const day = (rawDay + 6) % 7; // Monday = 0
    start.setDate(start.getDate() - day);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }, [currentDate]);

  // Days in month calculation for Month view (Monday - Sunday consistently)
  const monthGridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const rawDay = new Date(year, month, 1).getDay();
    const firstDayIndex = (rawDay + 6) % 7; // Monday = 0, Sunday = 6
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: { date: Date; isCurrentMonth: boolean; dateKey: string }[] = [];

    // Leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      cells.push({ date: d, isCurrentMonth: false, dateKey });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateKey = `${year}-${month + 1}-${d}`;
      cells.push({ date: dateObj, isCurrentMonth: true, dateKey });
    }

    // Trailing days from next month to complete standard grid (35 or 42 cells)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      cells.push({ date: d, isCurrentMonth: false, dateKey });
    }
    return cells;
  }, [currentDate]);

  // Map meetings by dateKey ('YYYY-M-D')
  const meetingsByDateKey = useMemo(() => {
    const map = new Map<string, CalendarMeeting[]>();
    filteredMeetings.forEach((m) => {
      const d = new Date(m.starts_at);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return map;
  }, [filteredMeetings]);

  // Map tasks by dateKey ('YYYY-M-D')
  const tasksByDateKey = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    filteredTasks.forEach((t) => {
      const d = new Date(t.deadline_utc);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [filteredTasks]);

  // Map Google Events by dateKey ('YYYY-M-D')
  const gcalEventsByDateKey = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    unimportedGCalEvents.forEach((ev) => {
      const d = new Date(ev.starts_at);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return map;
  }, [unimportedGCalEvents]);

  // Week view days (Monday to Sunday)
  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const rawDay = start.getDay();
    const day = (rawDay + 6) % 7; // Monday = 0
    start.setDate(start.getDate() - day);

    const days: { date: Date; dateKey: string; isToday: boolean }[] = [];
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      days.push({
        date: d,
        dateKey,
        isToday: dateKey === todayKey,
      });
    }
    return days;
  }, [currentDate]);

  // Today key
  const todayKey = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`;
  }, []);

  // Format meeting time
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  // Format relative countdown
  const getRelativeBadge = (isoString: string) => {
    const now = new Date().getTime();
    const target = new Date(isoString).getTime();
    const diffMs = target - now;
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      const pastDays = Math.abs(diffDays);
      if (pastDays === 0) return 'Concluded earlier today';
      if (pastDays === 1) return 'Yesterday';
      return `${pastDays} days ago`;
    }

    if (diffHours <= 1) return 'Starting soon';
    if (diffHours < 24) return `In ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    if (diffDays === 1) return 'Tomorrow';
    return `In ${diffDays} days`;
  };

  const totalItemCount = filteredMeetings.length + filteredTasks.length;

  return (
    <div className="dashboard-page min-h-screen bg-neutral-950 p-4 sm:p-6 lg:p-8 text-white space-y-6">
      {/* 1. Header & Title Banner */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-cyan-400 shadow-inner">
              <CalendarDays className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Calendar
                {isLoading && <Loader2 className="size-4 animate-spin text-cyan-400" />}
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-normal">
                  All Workspaces
                </span>
              </h1>
              <p className="text-sm text-neutral-400 mt-0.5">
                Meetings and deadlines across your workspaces.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Google Calendar Sync button */}
          <button
            type="button"
            onClick={handleSyncGoogleCalendar}
            disabled={syncingCalendar}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-medium text-neutral-200 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            title={calendarStatus?.connected ? `Connected: ${calendarStatus.account_email}` : 'Connect Google Calendar'}
          >
            <RefreshCw className={`size-3.5 ${syncingCalendar ? 'animate-spin text-cyan-400' : 'text-neutral-400'}`} />
            {calendarStatus?.connected ? 'Sync Google Calendar' : 'Connect Google Calendar'}
          </button>

          {/* Schedule Meeting button */}
          <Button
            onClick={() => handleOpenSchedule()}
            className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs px-4 py-2 rounded-lg shadow-sm"
          >
            <Plus className="size-4" />
            Schedule Meeting
          </Button>

          {/* Import / Transcribe Past Meeting */}
          <Button
            variant="outline"
            onClick={() => {
              setCreateInitialDate(undefined);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 border-white/15 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white text-xs px-3 py-2 rounded-lg"
            title="Upload notes or recording from a past meeting"
          >
            <Upload className="size-3.5 text-neutral-400" />
            <span className="hidden sm:inline">Import Past Meeting</span>
          </Button>
        </div>
      </div>

      {/* Google Calendar sync notification banner */}
      {calendarSyncNotice && (
        <div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-200">
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="size-4 text-cyan-400 shrink-0" />
            <span>{calendarSyncNotice}</span>
          </div>
          <button
            onClick={() => setCalendarSyncNotice(null)}
            className="text-cyan-400 hover:text-cyan-200"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* 2. Workspace Legend Bar & Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-white/[0.02] border border-white/10 rounded-xl p-3.5">
        {/* Workspace selector & filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-400 font-medium flex items-center gap-1.5 mr-1">
            <Building2 className="size-3.5 text-neutral-400" />
            Workspace:
          </span>
          <button
            type="button"
            onClick={() => setSelectedWorkspaceId('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              selectedWorkspaceId === 'all'
                ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            All Workspaces ({meetings.length + tasks.length})
          </button>

          {workspaces.map((ws, idx) => {
            const palette = getWorkspacePalette(idx);
            const isSelected = selectedWorkspaceId === ws.id;
            const count =
              meetings.filter((m) => m.workspace_id === ws.id).length +
              tasks.filter((t) => t.workspace_id === ws.id).length;
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => setSelectedWorkspaceId(ws.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  isSelected
                    ? `${palette.badge} shadow-sm font-semibold`
                    : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className={`size-2 rounded-full ${palette.dot}`} />
                <span>{ws.name}</span>
                <span className="text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>

        {/* View mode switcher & Search */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search meetings & tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-44 sm:w-56 rounded-lg border border-white/10 bg-neutral-900/80 pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-400 focus:border-cyan-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* View Mode Switcher */}
          <div className="inline-flex rounded-lg border border-white/10 bg-neutral-900 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                viewMode === 'month' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                viewMode === 'week' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                viewMode === 'agenda' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Agenda
            </button>
          </div>
        </div>
      </div>

      {/* 3. Filters & Date Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Filter: All / Upcoming / Past */}
          <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-neutral-900/60 p-1 text-xs">
            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                timeFilter === 'all' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              All ({totalItemCount})
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('upcoming')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                timeFilter === 'upcoming' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Upcoming ({upcomingCount})
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('past')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                timeFilter === 'past' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Past ({pastCount})
            </button>
          </div>

          {/* Content Type Filter: All / Meetings / Tasks */}
          <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-neutral-900/60 p-1 text-xs">
            <button
              type="button"
              onClick={() => setContentFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                contentFilter === 'all' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setContentFilter('meetings')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
                contentFilter === 'meetings' ? 'bg-cyan-500/20 text-cyan-300' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Video className="size-3 text-cyan-400" />
              Meetings ({filteredMeetings.length})
            </button>
            <button
              type="button"
              onClick={() => setContentFilter('tasks')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition ${
                contentFilter === 'tasks' ? 'bg-amber-500/20 text-amber-300' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <CheckSquare2 className="size-3 text-amber-400" />
              Tasks Due ({filteredTasks.length})
            </button>
          </div>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToday}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/10 hover:text-white transition"
          >
            Today
          </button>
          <div className="flex items-center rounded-lg border border-white/10 bg-white/5">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous period"
              className="p-1.5 text-neutral-400 hover:text-white transition"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-3 text-xs font-medium text-neutral-200">
              {viewMode === 'week' ? weekRangeLabel : monthYearLabel}
            </span>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next period"
              className="p-1.5 text-neutral-400 hover:text-white transition"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. CALENDAR VIEWS */}

      {/* Month View (Monday - Sunday) */}
      {viewMode === 'month' && (
        <div className="rounded-2xl border border-white/10 bg-neutral-900/50 shadow-xl overflow-hidden backdrop-blur-md">
          {/* Day Headers (Mon - Sun) */}
          <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.03] text-center text-xs font-semibold text-neutral-400 py-3">
            <span>MON</span>
            <span>TUE</span>
            <span>WED</span>
            <span>THU</span>
            <span>FRI</span>
            <span>SAT</span>
            <span>SUN</span>
          </div>

          {/* Month Day Cells Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-white/[0.06]">
            {monthGridDays.map((cell, idx) => {
              const dayMeetings = meetingsByDateKey.get(cell.dateKey) || [];
              const dayTasks = tasksByDateKey.get(cell.dateKey) || [];
              const dayGCal = gcalEventsByDateKey.get(cell.dateKey) || [];
              const isToday = cell.dateKey === todayKey;
              const totalDayItems = dayMeetings.length + dayTasks.length + dayGCal.length;

              return (
                <div
                  key={idx}
                  onClick={() => handleDateCellClick(cell.date)}
                  className={`min-h-[110px] sm:min-h-[135px] p-2 flex flex-col justify-between transition group cursor-pointer ${
                    cell.isCurrentMonth ? 'bg-neutral-950/40' : 'bg-neutral-950/80 opacity-40'
                  } hover:bg-white/[0.04]`}
                >
                  {/* Date Header */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`size-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        isToday
                          ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20'
                          : cell.isCurrentMonth
                          ? 'text-neutral-300'
                          : 'text-neutral-500'
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                    {totalDayItems > 0 && (
                      <span className="text-[10px] font-medium text-neutral-400 group-hover:text-cyan-400 transition">
                        {dayMeetings.length > 0 && `${dayMeetings.length} mtg${dayMeetings.length > 1 ? 's' : ''}`}
                        {dayMeetings.length > 0 && dayTasks.length > 0 && ' • '}
                        {dayTasks.length > 0 && `${dayTasks.length} task${dayTasks.length > 1 ? 's' : ''}`}
                      </span>
                    )}
                  </div>

                  {/* Day Content Chips */}
                  <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[85px] scrollbar-none">
                    {/* Meeting Chips */}
                    {dayMeetings.slice(0, 2).map((meeting) => {
                      const palette = getWorkspacePalette(meeting.workspace_color_idx ?? 0);
                      return (
                        <div
                          key={`mtg-${meeting.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMeeting(meeting);
                          }}
                          className={`group/chip flex items-center justify-between gap-1 rounded-md px-2 py-1 text-[11px] border transition shadow-sm ${palette.chip}`}
                          title={`${meeting.title} (${meeting.workspace_name})`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`size-1.5 rounded-full shrink-0 ${palette.dot}`} />
                            <span className="font-semibold text-neutral-300 shrink-0">
                              {formatTime(meeting.starts_at)}
                            </span>
                            <span className="truncate text-white font-medium">{meeting.title}</span>
                          </div>
                          {meeting.conference_url && (
                            <Video className="size-3 text-cyan-400 shrink-0 opacity-80 group-hover/chip:opacity-100" />
                          )}
                        </div>
                      );
                    })}

                    {/* Task Deadline Chips */}
                    {dayTasks.slice(0, 2).map((task) => {
                      return (
                        <div
                          key={`task-${task.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTask(task);
                          }}
                          className="flex items-center justify-between gap-1 rounded-md px-1.5 py-0.5 text-[10px] bg-amber-500/10 border border-amber-500/25 text-amber-200 hover:border-amber-400 transition"
                          title={`Action item deadline: ${task.title}`}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <CheckSquare2 className="size-2.5 text-amber-400 shrink-0" />
                            <span className="truncate font-medium">{task.title}</span>
                          </div>
                          <span className={`text-[8px] uppercase px-1 rounded ${PRIORITY_BADGES[task.priority] || ''}`}>
                            {task.priority}
                          </span>
                        </div>
                      );
                    })}

                    {/* Synced Google Calendar Events (Unimported) */}
                    {dayGCal.slice(0, 1).map((ev) => {
                      return (
                        <div
                          key={`gcal-${ev.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveGCalEvent(ev);
                          }}
                          className="flex items-center justify-between gap-1 rounded-md px-1.5 py-0.5 text-[10px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 hover:border-indigo-400 transition"
                          title={`Google Calendar: ${ev.title}`}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <CalendarIcon className="size-2.5 text-indigo-400 shrink-0" />
                            <span className="truncate font-medium">{ev.title}</span>
                          </div>
                          <span className="text-[9px] text-indigo-300 font-semibold">GCal</span>
                        </div>
                      );
                    })}

                    {totalDayItems > 3 && (
                      <span className="text-[9px] text-neutral-400 px-1">
                        +{totalDayItems - 3} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="rounded-2xl border border-white/10 bg-neutral-900/50 shadow-xl overflow-hidden backdrop-blur-md">
          <div className="grid grid-cols-7 divide-x divide-white/[0.08]">
            {weekDays.map((col, idx) => {
              const dayMeetings = meetingsByDateKey.get(col.dateKey) || [];
              const dayTasks = tasksByDateKey.get(col.dateKey) || [];
              const dayGCal = gcalEventsByDateKey.get(col.dateKey) || [];
              const dayName = col.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
              const dayNum = col.date.getDate();

              return (
                <div key={idx} className="flex flex-col min-h-[520px]">
                  {/* Column Header */}
                  <div
                    className={`p-3 text-center border-b border-white/10 ${
                      col.isToday ? 'bg-cyan-500/10' : 'bg-white/[0.02]'
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-neutral-400">{dayName}</div>
                    <div
                      className={`inline-flex items-center justify-center size-8 rounded-full text-sm font-bold mt-1 ${
                        col.isToday ? 'bg-cyan-500 text-black' : 'text-white'
                      }`}
                    >
                      {dayNum}
                    </div>
                  </div>

                  {/* Day Content */}
                  <div
                    onClick={() => handleDateCellClick(col.date)}
                    className="flex-1 p-2 space-y-2 bg-neutral-950/40 hover:bg-white/[0.02] transition cursor-pointer overflow-y-auto"
                  >
                    {dayMeetings.length === 0 && dayTasks.length === 0 && dayGCal.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-center p-3 text-[11px] text-neutral-500">
                        No events
                      </div>
                    ) : (
                      <>
                        {/* Meetings */}
                        {dayMeetings.map((meeting) => {
                          const palette = getWorkspacePalette(meeting.workspace_color_idx ?? 0);
                          return (
                            <div
                              key={`week-mtg-${meeting.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMeeting(meeting);
                              }}
                              className={`rounded-xl p-2.5 border transition shadow-sm cursor-pointer ${palette.bg} ${palette.border} hover:border-white/40`}
                            >
                              <div className="flex items-center justify-between gap-1 text-[11px] mb-1">
                                <span className="font-semibold text-cyan-300">
                                  {formatTime(meeting.starts_at)}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${palette.badge}`}>
                                  {meeting.workspace_name}
                                </span>
                              </div>

                              <h4 className="text-xs font-semibold text-white line-clamp-2">
                                {meeting.title}
                              </h4>

                              {meeting.tasks_count !== undefined && meeting.tasks_count > 0 && (
                                <div className="mt-2 flex items-center gap-1 text-[10px] text-neutral-400">
                                  <ListTodo className="size-3 text-emerald-400" />
                                  <span>{meeting.tasks_count} action items</span>
                                </div>
                              )}

                              {meeting.conference_url && (
                                <a
                                  href={meeting.conference_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-2 inline-flex items-center gap-1.5 w-full justify-center text-[10px] font-medium bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 border border-cyan-500/30 rounded-md py-1 transition"
                                >
                                  <Video className="size-3" />
                                  Join Call
                                </a>
                              )}
                            </div>
                          );
                        })}

                        {/* Tasks Due */}
                        {dayTasks.map((task) => (
                          <div
                            key={`week-task-${task.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTask(task);
                            }}
                            className="rounded-lg p-2 border border-amber-500/30 bg-amber-950/20 text-neutral-200 hover:border-amber-400 transition"
                          >
                            <div className="flex items-center justify-between gap-1 text-[10px] mb-1">
                              <span className="font-semibold text-amber-300 flex items-center gap-1">
                                <CheckSquare2 className="size-3 text-amber-400" /> Action Item
                              </span>
                              <span className={`text-[9px] uppercase px-1 rounded ${PRIORITY_BADGES[task.priority] || ''}`}>
                                {task.priority}
                              </span>
                            </div>
                            <h5 className="text-[11px] font-medium text-white line-clamp-2">
                              {task.title}
                            </h5>
                          </div>
                        ))}

                        {/* Google Calendar Events */}
                        {dayGCal.map((ev) => (
                          <div
                            key={`week-gcal-${ev.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveGCalEvent(ev);
                            }}
                            className="rounded-lg p-2 border border-indigo-500/30 bg-indigo-950/20 text-neutral-200 hover:border-indigo-400 transition"
                          >
                            <div className="flex items-center justify-between gap-1 text-[10px] mb-1 text-indigo-300 font-semibold">
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="size-3" /> Google Calendar
                              </span>
                              <span>{formatTime(ev.starts_at)}</span>
                            </div>
                            <h5 className="text-[11px] font-medium text-white line-clamp-2">
                              {ev.title}
                            </h5>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agenda / Schedule Timeline View */}
      {viewMode === 'agenda' && (
        <div className="space-y-4">
          {totalItemCount === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-neutral-900/40 p-12 text-center">
              <CalendarIcon className="size-10 text-neutral-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white">No scheduled meetings or tasks found</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                Create a meeting or connect Google Calendar to get started.
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button
                  onClick={() => handleOpenSchedule()}
                  className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  <Plus className="size-3.5 mr-1" /> Schedule Meeting
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSyncGoogleCalendar}
                  className="text-xs border-white/15 text-neutral-300 hover:bg-white/5"
                >
                  <RefreshCw className="size-3.5 mr-1" /> Sync Google Calendar
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-1 lg:grid-cols-2">
              {/* Meetings in Agenda */}
              {filteredMeetings.map((meeting) => {
                const palette = getWorkspacePalette(meeting.workspace_color_idx ?? 0);
                const startD = new Date(meeting.starts_at);
                const isPast = startD.getTime() < new Date().getTime();
                const relativeText = getRelativeBadge(meeting.starts_at);

                return (
                  <div
                    key={`agenda-mtg-${meeting.id}`}
                    onClick={() => setActiveMeeting(meeting)}
                    className="group relative rounded-2xl border border-white/10 bg-neutral-900/60 p-5 shadow-lg transition hover:border-white/20 hover:bg-neutral-900 cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar: Workspace Badge & Relative timing */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${palette.badge}`}
                        >
                          <span className={`size-1.5 rounded-full ${palette.dot}`} />
                          {meeting.workspace_name}
                        </span>

                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            isPast
                              ? 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {relativeText}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-semibold text-white group-hover:text-cyan-300 transition">
                        {meeting.title}
                      </h3>

                      {/* Date & Time info */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                        <div className="flex items-center gap-1.5 text-neutral-300">
                          <Clock className="size-3.5 text-neutral-400" />
                          <span>
                            {startD.toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                            {' • '}
                            {formatTime(meeting.starts_at)} ({meeting.timezone})
                          </span>
                        </div>

                        {meeting.tasks_count !== undefined && (
                          <div className="flex items-center gap-1.5 text-emerald-400">
                            <ListTodo className="size-3.5" />
                            <span>{meeting.tasks_count} action items</span>
                          </div>
                        )}
                      </div>

                      {meeting.description && (
                        <p className="mt-2.5 text-xs text-neutral-400 line-clamp-2">
                          {meeting.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="mt-4 pt-3.5 border-t border-white/[0.08] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {meeting.conference_url && (
                          <a
                            href={meeting.conference_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600/20 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-600/30 border border-cyan-500/30 transition"
                          >
                            <Video className="size-3.5" />
                            Join Video Call
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportMeetingToIcs(meeting);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/10 hover:text-white transition"
                          title="Export .ics file"
                        >
                          <Download className="size-3" />
                          .ics
                        </button>
                      </div>

                      {!meeting.is_demo && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/meetings/${meeting.id}?tab=overview`);
                          }}
                          className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-cyan-300 transition"
                        >
                          <span>Open meeting</span>
                          <ArrowRight className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Tasks in Agenda */}
              {filteredTasks.map((task) => {
                const palette = getWorkspacePalette(task.workspace_color_idx ?? 0);
                const deadlineD = new Date(task.deadline_utc);
                const isPast = deadlineD.getTime() < new Date().getTime();

                return (
                  <div
                    key={`agenda-task-${task.id}`}
                    onClick={() => setActiveTask(task)}
                    className="group relative rounded-2xl border border-amber-500/20 bg-neutral-900/60 p-5 shadow-lg transition hover:border-amber-500/40 hover:bg-neutral-900 cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${palette.badge}`}>
                          <span className={`size-1.5 rounded-full ${palette.dot}`} />
                          {task.workspace_name}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${PRIORITY_BADGES[task.priority] || ''}`}>
                            {task.priority}
                          </span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${STATUS_BADGES[task.status] || ''}`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <CheckSquare2 className="size-4 text-amber-400 mt-0.5 shrink-0" />
                        <h3 className="text-base font-semibold text-white group-hover:text-amber-300 transition">
                          {task.title}
                        </h3>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
                        <Clock className="size-3.5 text-amber-400" />
                        <span className={isPast ? 'text-rose-400 font-medium' : 'text-neutral-300'}>
                          Due: {deadlineD.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {formatTime(task.deadline_utc)}
                        </span>
                      </div>

                      {task.source_excerpt && (
                        <p className="mt-2.5 text-xs text-neutral-400 italic bg-white/[0.02] p-2.5 rounded-lg border border-white/5 line-clamp-2">
                          &ldquo;{task.source_excerpt}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs">
                      <span className="text-neutral-400">
                        {task.meeting_title ? `From: ${task.meeting_title}` : 'Confirmed Board Task'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/kanban');
                        }}
                        className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium transition"
                      >
                        <span>Open Kanban</span>
                        <ArrowRight className="size-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. MEETING DETAILS MODAL */}
      {activeMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-2xl border border-white/15 bg-neutral-900 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const pal = getWorkspacePalette(activeMeeting.workspace_color_idx ?? 0);
                    return (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${pal.badge}`}>
                        <span className={`size-1.5 rounded-full ${pal.dot}`} />
                        {activeMeeting.workspace_name}
                      </span>
                    );
                  })()}
                  <span className="text-xs text-neutral-400">
                    {getRelativeBadge(activeMeeting.starts_at)}
                  </span>
                  {activeMeeting.calendar_provider && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30">
                      Synced from {activeMeeting.calendar_provider}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white">{activeMeeting.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveMeeting(null)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Timing & Conference Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/[0.03] border border-white/10 rounded-xl p-4 text-xs">
              <div>
                <span className="text-neutral-400 block mb-1">Scheduled Time:</span>
                <span className="font-semibold text-white">
                  {new Date(activeMeeting.starts_at).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <div className="text-neutral-300 mt-0.5">
                  {formatTime(activeMeeting.starts_at)} ({activeMeeting.timezone})
                </div>
              </div>

              <div>
                <span className="text-neutral-400 block mb-1">Meeting Format:</span>
                {activeMeeting.conference_url ? (
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 text-cyan-300 font-semibold">
                      <Video className="size-3.5" /> Virtual Video Call
                    </span>
                    <a
                      href={activeMeeting.conference_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-cyan-400 hover:underline truncate"
                    >
                      {activeMeeting.conference_url}
                    </a>
                  </div>
                ) : (
                  <span className="text-neutral-300">In-Person Meeting</span>
                )}
              </div>
            </div>

            {/* Description & Grounded Excerpt */}
            {activeMeeting.description && (
              <div>
                <h4 className="text-xs font-semibold text-neutral-300 mb-1">Agenda / Description</h4>
                <p className="text-xs text-neutral-400 leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-white/5">
                  {activeMeeting.description}
                </p>
              </div>
            )}

            {activeMeeting.source_excerpt && (
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3">
                <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1 mb-1">
                  <Sparkles className="size-3" /> Grounded Transcript Excerpt
                </span>
                <p className="text-xs text-cyan-100 italic">
                  &ldquo;{activeMeeting.source_excerpt}&rdquo;
                </p>
              </div>
            )}

            {/* Action Items Overview */}
            <div className="flex items-center justify-between text-xs border-t border-white/10 pt-4">
              <div className="flex items-center gap-2 text-neutral-300">
                <ListTodo className="size-4 text-emerald-400" />
                <span>
                  <strong>{activeMeeting.tasks_count || 0}</strong> confirmed action items linked to this session
                </span>
              </div>
              <button
                type="button"
                onClick={() => exportMeetingToIcs(activeMeeting)}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white border border-white/15 px-3 py-1.5 rounded-lg hover:bg-white/5 transition"
              >
                <Download className="size-3.5" />
                Export .ics
              </button>
            </div>

            {/* Modal Footer Controls */}
            {inviteFeedback && (
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200 flex items-center justify-between">
                <span>{inviteFeedback}</span>
                <button type="button" onClick={() => setInviteFeedback(null)} className="text-cyan-400 hover:text-white">
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                disabled={sendingInvitesMeetingId === activeMeeting.id}
                onClick={async () => {
                  setSendingInvitesMeetingId(activeMeeting.id);
                  setInviteFeedback(null);
                  try {
                    const res = await postApi(`/api/meetings/${activeMeeting.id}/send-invites`, {});
                    setInviteFeedback(res.message || 'Invitations dispatched via email!');
                  } catch (err: any) {
                    setInviteFeedback(`Failed: ${err.message || 'Server error'}`);
                  } finally {
                    setSendingInvitesMeetingId(null);
                  }
                }}
                className="text-xs border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                title="Send or resend email invitations with calendar .ics to all meeting participants"
              >
                <Mail className="size-3.5 text-cyan-400 mr-1.5" />
                {sendingInvitesMeetingId === activeMeeting.id ? 'Sending invites...' : 'Send Email Invites'}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setFollowUpMeeting({ id: activeMeeting.id, title: activeMeeting.title });
                  setShowFollowUpModal(true);
                  setActiveMeeting(null);
                }}
                className="text-xs border-white/20 hover:bg-white/10"
              >
                <Sparkles className="size-3.5 text-cyan-400 mr-1.5" />
                Draft follow-up
              </Button>

              {!activeMeeting.is_demo && (
                <Button
                  onClick={() => {
                    switchWorkspace(activeMeeting.workspace_id);
                    navigate(`/meetings/${activeMeeting.id}?tab=overview`);
                  }}
                  className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  Open meeting <ArrowRight className="size-3.5 ml-1.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. TASK DETAILS MODAL */}
      {activeTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-neutral-900 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <CheckSquare2 className="size-3" /> Action Item
                  </span>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${PRIORITY_BADGES[activeTask.priority]}`}>
                    {activeTask.priority}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${STATUS_BADGES[activeTask.status]}`}>
                    {activeTask.status.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white">{activeTask.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTask(null)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-xs space-y-2">
              <div className="flex items-center justify-between text-neutral-300">
                <span className="text-neutral-400">Due Date:</span>
                <span className="font-semibold text-white">
                  {new Date(activeTask.deadline_utc).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between text-neutral-300">
                <span className="text-neutral-400">Workspace:</span>
                <span>{activeTask.workspace_name}</span>
              </div>
              {activeTask.meeting_title && (
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="text-neutral-400">Linked Meeting:</span>
                  <span className="truncate max-w-[200px]">{activeTask.meeting_title}</span>
                </div>
              )}
            </div>

            {activeTask.source_excerpt && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs">
                <span className="text-[11px] font-semibold text-amber-300 block mb-1">
                  Source Transcript Excerpt:
                </span>
                <p className="text-neutral-200 italic">
                  &ldquo;{activeTask.source_excerpt}&rdquo;
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTask(null)}
                className="text-xs border-white/15 text-neutral-300"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setActiveTask(null);
                  navigate('/kanban');
                }}
                className="text-xs bg-amber-600 hover:bg-amber-500 text-white gap-1.5"
              >
                View on Kanban Board <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 7. GCAL EVENT DETAIL & IMPORT MODAL */}
      {activeGCalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-indigo-500/30 bg-neutral-900 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 mb-2">
                  <CalendarIcon className="size-3" /> Google Calendar Event
                </span>
                <h3 className="text-lg font-bold text-white">{activeGCalEvent.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveGCalEvent(null)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs space-y-2">
              <div className="flex items-center justify-between text-neutral-300">
                <span className="text-neutral-400">Scheduled Time:</span>
                <span>{new Date(activeGCalEvent.starts_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-neutral-300">
                <span className="text-neutral-400">Attendees:</span>
                <span>{activeGCalEvent.attendees.length} participants</span>
              </div>
              {activeGCalEvent.conference_url && (
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="text-neutral-400">Video Link:</span>
                  <a
                    href={activeGCalEvent.conference_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline truncate max-w-[200px]"
                  >
                    {activeGCalEvent.conference_url}
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              {activeGCalEvent.conference_url && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(activeGCalEvent.conference_url!, '_blank')}
                  className="text-xs border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 gap-1.5"
                >
                  <Video className="size-3.5" /> Join Call
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  const ev = activeGCalEvent;
                  setActiveGCalEvent(null);
                  const pad = (n: number) => n.toString().padStart(2, '0');
                  const d = new Date(ev.starts_at);
                  const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                  handleOpenSchedule(iso, ev.title, ev.conference_url || undefined);
                }}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
              >
                <Plus className="size-3.5" /> Schedule in ActionPulse
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 8. SCHEDULE MEETING MODAL */}
      {showScheduleModal && currentWorkspace && (
        <ScheduleMeetingModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          workspaceId={currentWorkspace.id}
          initialDate={scheduleInitialDate}
          initialTitle={scheduleInitialTitle}
          initialConferenceUrl={scheduleInitialUrl}
          onMeetingScheduled={() => {
            fetchAllWorkspaceData();
          }}
        />
      )}

      {/* 9. CREATE MEETING MODAL */}
      {showCreateModal && currentWorkspace && (
        <CreateMeetingModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          workspaceId={currentWorkspace.id}
          initialDate={createInitialDate}
          onMeetingCreated={() => {
            setShowCreateModal(false);
            fetchAllWorkspaceData();
          }}
        />
      )}

      {/* 9. FOLLOW-UP MODAL */}
      {showFollowUpModal && followUpMeeting && (
        <FollowUpModal
          isOpen={showFollowUpModal}
          onClose={() => {
            setShowFollowUpModal(false);
            setFollowUpMeeting(null);
          }}
          meetingId={followUpMeeting.id}
          meetingTitle={followUpMeeting.title}
        />
      )}
    </div>
  );
}
