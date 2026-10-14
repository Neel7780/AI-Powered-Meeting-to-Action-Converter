import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { KanbanColumn } from '@/components/kanban/KanbanColumn';
import type { KanbanTaskItem, TaskStatus } from '@/components/kanban/KanbanCard';
import {
  Users,
  UserCheck,
  Calendar,
  Search,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MeetingOption {
  id: string;
  title: string;
  starts_at?: string;
}

// Fallback seed tasks for zero-configuration demo testing
const DEMO_TASKS: KanbanTaskItem[] = [
  {
    id: 'demo-task-1',
    workspace_id: 'default-workspace',
    meeting_id: 'mtg-q3-planning',
    title: 'Migrate PostgreSQL connection pool to Supabase transaction pooler',
    description: 'Update DATABASE_URL to use Supabase port 6543 to prevent connection saturation during peak workloads.',
    deadline_utc: new Date(Date.now() + 86400000 * 2).toISOString(),
    priority: 'urgent',
    status: 'in_progress',
    source_excerpt: 'We need to switch our database connection strings to the transaction pooler on port 6543 before Friday.',
    external_owner_label: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    meetings: {
      id: 'mtg-q3-planning',
      title: 'Q3 Infra Architecture Sync',
      starts_at: new Date().toISOString(),
    },
    task_assignees: [
      {
        user_id: 'current-user',
        is_primary: true,
        profiles: {
          id: 'current-user',
          display_name: 'You (Me)',
          email: 'lead@actionpulse.io',
        },
      },
    ],
  },
  {
    id: 'demo-task-2',
    workspace_id: 'default-workspace',
    meeting_id: 'mtg-q3-planning',
    title: 'Implement 1-Tap WhatsApp share URL generator for assignee tasks',
    description: 'Ensure prefilled wa.me/?text=... conforms to zero-cost WhatsApp constraint without paid APIs.',
    deadline_utc: new Date(Date.now() + 86400000 * 4).toISOString(),
    priority: 'high',
    status: 'done',
    source_excerpt: 'The WhatsApp sharing link must be one-tap and generated purely via wa.me to stay in zero-cost free tier.',
    external_owner_label: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    meetings: {
      id: 'mtg-q3-planning',
      title: 'Q3 Infra Architecture Sync',
      starts_at: new Date().toISOString(),
    },
    task_assignees: [
      {
        user_id: 'current-user',
        is_primary: true,
        profiles: {
          id: 'current-user',
          display_name: 'You (Me)',
          email: 'lead@actionpulse.io',
        },
      },
    ],
  },
  {
    id: 'demo-task-3',
    workspace_id: 'default-workspace',
    meeting_id: 'mtg-product-review',
    title: 'Configure ground-truth LLM prompt defense delimiters for Gemini',
    description: 'Wrap raw transcript payloads inside xml tags to prevent prompt injection attacks.',
    deadline_utc: new Date(Date.now() + 86400000 * 1).toISOString(),
    priority: 'normal',
    status: 'todo',
    source_excerpt: 'Action items extracted by Gemini must be grounded with a verbatim source quote from the transcript.',
    external_owner_label: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    meetings: {
      id: 'mtg-product-review',
      title: 'Weekly Sprint Review',
      starts_at: new Date().toISOString(),
    },
    task_assignees: [
      {
        user_id: 'teammate-neel',
        is_primary: true,
        profiles: {
          id: 'teammate-neel',
          display_name: 'Neel Khatri',
          email: 'neel@actionpulse.io',
        },
      },
    ],
  },
  {
    id: 'demo-task-4',
    workspace_id: 'default-workspace',
    meeting_id: 'mtg-product-review',
    title: 'Verify Brevo SMTP rate limit before staging automated daily digests',
    description: 'Check free tier 300 emails/day cap to ensure daily digest cron job does not bounce.',
    deadline_utc: new Date(Date.now() - 86400000 * 1).toISOString(),
    priority: 'high',
    status: 'blocked',
    blocked_by: 'demo-task-1',
    source_excerpt: 'Email notification service needs to stay well within Brevo 300 emails per day limit.',
    external_owner_label: 'External SMTP Provider',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    meetings: {
      id: 'mtg-product-review',
      title: 'Weekly Sprint Review',
      starts_at: new Date().toISOString(),
    },
    task_assignees: [],
  },
];

export interface KanbanBoardProps {
  workspaceId?: string;
}

export function KanbanBoard({ workspaceId: propWorkspaceId }: KanbanBoardProps = {}) {
  const { currentWorkspace } = useWorkspace();
  const activeWorkspaceId = propWorkspaceId || currentWorkspace?.id;

  const [tasks, setTasks] = useState<KanbanTaskItem[]>([]);
  const [meetings, setMeetings] = useState<MeetingOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Set<string>>(new Set());

  // Filter states
  const [filterType, setFilterType] = useState<'all' | 'assigned'>('all');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch current logged-in user
  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
        } else {
          // Fallback to demo user ID so "Assigned to Me" can be previewed
          setCurrentUserId('current-user');
        }
      } catch {
        setCurrentUserId('current-user');
      }
    }
    loadUser();
  }, []);

  // 2. Fetch tasks and meetings from Supabase
  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMsg(null);

    try {
      // Query tasks with meetings & assignees scoped to activeWorkspaceId
      let taskQuery = supabase
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
            is_primary,
            profiles (
              id,
              display_name,
              email,
              avatar_url
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (activeWorkspaceId) {
        taskQuery = taskQuery.eq('workspace_id', activeWorkspaceId);
      }

      const { data: taskData, error: taskError } = await taskQuery;

      // Fetch distinct meetings for the filter dropdown scoped to activeWorkspaceId
      let meetingQuery = supabase
        .from('meetings')
        .select('id, title, starts_at')
        .order('starts_at', { ascending: false });

      if (activeWorkspaceId) {
        meetingQuery = meetingQuery.eq('workspace_id', activeWorkspaceId);
      }

      const { data: meetingData } = await meetingQuery;

      if (meetingData && meetingData.length > 0) {
        setMeetings(meetingData as MeetingOption[]);
      }

      if (taskError) {
        console.warn('Supabase tasks fetch warning, using demo dataset:', taskError.message);
        // If Supabase has no tasks or RLS returned empty/error during development, show demo tasks
        setTasks(DEMO_TASKS);
        setMeetings([
          { id: 'mtg-q3-planning', title: 'Q3 Infra Architecture Sync' },
          { id: 'mtg-product-review', title: 'Weekly Sprint Review' },
        ]);
      } else if (taskData && taskData.length > 0) {
        setTasks(taskData as unknown as KanbanTaskItem[]);
      } else {
        // Table is empty in fresh database
        setTasks(DEMO_TASKS);
        setMeetings([
          { id: 'mtg-q3-planning', title: 'Q3 Infra Architecture Sync' },
          { id: 'mtg-product-review', title: 'Weekly Sprint Review' },
        ]);
      }
    } catch (err: unknown) {
      console.warn('Error fetching tasks from Supabase:', err);
      setTasks(DEMO_TASKS);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 3. Supabase Realtime Subscription scoped to activeWorkspaceId
  useEffect(() => {
    const channel = supabase
      .channel(`kanban-tasks-${activeWorkspaceId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          ...(activeWorkspaceId ? { filter: `workspace_id=eq.${activeWorkspaceId}` } : {}),
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new as { id: string; status: TaskStatus; updated_at?: string };
            setTasks((prev) =>
              prev.map((t) =>
                t.id === updatedRow.id
                  ? { ...t, status: updatedRow.status, updated_at: updatedRow.updated_at || new Date().toISOString() }
                  : t
              )
            );
          } else if (payload.eventType === 'INSERT') {
            fetchData(true);
          } else if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id: string };
            setTasks((prev) => prev.filter((t) => t.id !== oldRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, activeWorkspaceId]);

  // 4. Handle Status Change (both Drag-and-Drop and Status Selector Dropdown)
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask || targetTask.status === newStatus) return;

    const previousStatus = targetTask.status;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    if (taskId.startsWith('demo-')) return; // sample cards only live in memory

    setUpdatingTaskIds((prev) => new Set(prev).add(taskId));

    try {
      // Direct update of status column allowed by RLS for assignees & admins
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) {
        console.error('Supabase status update error:', error.message);
        // Rollback on error
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t))
        );
        setErrorMsg(`Failed to move task: ${error.message}`);
      }
    } catch (err: unknown) {
      console.warn('Update threw exception, running in local/demo mode:', err);
    } finally {
      setUpdatingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // 5. Filter & Search Logic
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Assignment filter: "All Workspace Tasks" vs "Assigned to Me"
      if (filterType === 'assigned') {
        const isAssigned = task.task_assignees?.some(
          (a) => a.user_id === currentUserId
        );
        if (!isAssigned) return false;
      }

      // Meeting filter
      if (selectedMeetingId !== 'all' && task.meeting_id !== selectedMeetingId) {
        return false;
      }

      // Keyword Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q) ?? false;
        const matchesExcerpt = task.source_excerpt.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesExcerpt) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, filterType, currentUserId, selectedMeetingId, searchQuery]);

  // Tasks partitioned into the 4 kanban columns
  const todoTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'todo'), [filteredTasks]);
  const inProgressTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'in_progress'), [filteredTasks]);
  const blockedTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'blocked'), [filteredTasks]);
  const doneTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'done'), [filteredTasks]);

  // Metrics summary
  const totalCount = filteredTasks.length;
  const doneCount = doneTasks.length;
  const blockedCount = blockedTasks.length;
  const isDemo = tasks.some((t) => t.id.startsWith('demo-'));

  const segmentClass = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
      on ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
    }`;

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Task board</p>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-3xl font-medium tracking-tight text-white">
            Tasks
            {isDemo ? (
              <span className="rounded border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                Sample data / not saved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-400">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live
              </span>
            )}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">Approved action items from your workspace meetings.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            title="Refresh tasks"
          >
            <RefreshCw className={isRefreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button asChild size="sm">
            <Link to="/meetings">
              <Plus />
              New meeting
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar & Statistics */}
      <div className="mb-5 flex flex-col gap-3 border-y border-white/10 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filter 1: All Workspace Tasks vs. Assigned to Me */}
          <div className="inline-flex rounded-md border border-white/10 bg-white/[0.02] p-0.5">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              aria-pressed={filterType === 'all'}
              className={segmentClass(filterType === 'all')}
            >
              <Users className="size-3.5" />
              All workspace tasks
            </button>
            <button
              type="button"
              onClick={() => setFilterType('assigned')}
              aria-pressed={filterType === 'assigned'}
              className={segmentClass(filterType === 'assigned')}
            >
              <UserCheck className="size-3.5" />
              Assigned to me
            </button>
          </div>

          {/* Filter 2: Filter by Meeting */}
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
            <select
              aria-label="Filter by meeting"
              value={selectedMeetingId}
              onChange={(e) => setSelectedMeetingId(e.target.value)}
              className="field h-8 w-auto cursor-pointer py-0 pl-8 text-xs"
            >
              <option value="all">All source meetings</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              aria-label="Search tasks"
              placeholder="Search tasks or quotes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="field h-8 w-44 py-0 pl-8 text-xs sm:w-60"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
          <span>
            Total <span className="text-white">{totalCount}</span>
          </span>
          <span className="h-3 w-px bg-white/10" />
          <span className="inline-flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            Done {doneCount}
          </span>
          {blockedCount > 0 && (
            <>
              <span className="h-3 w-px bg-white/10" />
              <span className="inline-flex items-center gap-1.5 text-red-400">
                <AlertTriangle className="size-3.5" />
                Blocked {blockedCount}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Error notification banner if any */}
      {errorMsg && (
        <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="shrink-0 font-medium underline-offset-4 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Kanban Board Layout: 4 Columns */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex h-[520px] animate-pulse flex-col gap-3 rounded-xl border border-white/10 bg-[#040404] p-4"
            >
              <div className="h-6 w-24 rounded bg-white/5" />
              <div className="h-28 w-full rounded-lg bg-white/5" />
              <div className="h-28 w-full rounded-lg bg-white/5" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: To Do */}
          <KanbanColumn
            status="todo"
            title="To Do"
            tasks={todoTasks}
            onStatusChange={handleStatusChange}
            onDropTask={handleStatusChange}
            updatingTaskIds={updatingTaskIds}
          />

          {/* Column 2: In Progress */}
          <KanbanColumn
            status="in_progress"
            title="In Progress"
            tasks={inProgressTasks}
            onStatusChange={handleStatusChange}
            onDropTask={handleStatusChange}
            updatingTaskIds={updatingTaskIds}
          />

          {/* Column 3: Blocked */}
          <KanbanColumn
            status="blocked"
            title="Blocked"
            tasks={blockedTasks}
            onStatusChange={handleStatusChange}
            onDropTask={handleStatusChange}
            updatingTaskIds={updatingTaskIds}
          />

          {/* Column 4: Done */}
          <KanbanColumn
            status="done"
            title="Done"
            tasks={doneTasks}
            onStatusChange={handleStatusChange}
            onDropTask={handleStatusChange}
            updatingTaskIds={updatingTaskIds}
          />
        </div>
      )}
    </div>
  );
}

export default KanbanBoard;
