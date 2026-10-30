import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { KanbanColumn } from '@/components/kanban/KanbanColumn';
import { TaskDependencyModal } from '@/components/kanban/TaskDependencyModal';
import { WorkflowChainsView } from '@/components/kanban/WorkflowChainsView';
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
  GitFork,
  LayoutGrid,
  Bot,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MeetingOption {
  id: string;
  title: string;
  starts_at?: string;
}

// Fallback seed tasks for zero-configuration demo testing & Sprint 2 Dependency Chains
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
    blocked_by: null,
    execution_type: 'human',
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
    blocked_by: null,
    execution_type: 'human',
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
    blocked_by: null,
    execution_type: 'human',
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
    execution_type: 'agent',
    source_excerpt: 'Email notification service needs to stay well within Brevo 300 emails per day limit.',
    external_owner_label: 'Automated SMTP Checker',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    meetings: {
      id: 'mtg-product-review',
      title: 'Weekly Sprint Review',
      starts_at: new Date().toISOString(),
    },
    task_assignees: [],
  },
  {
    id: 'demo-task-5',
    workspace_id: 'default-workspace',
    meeting_id: 'mtg-q3-planning',
    title: 'Schedule automated daily digest cron job for overdue action items',
    description: 'Trigger daily digest emails at 09:00 AM UTC once Brevo SMTP limits are verified.',
    deadline_utc: new Date(Date.now() + 86400000 * 5).toISOString(),
    priority: 'normal',
    status: 'blocked',
    blocked_by: 'demo-task-4',
    execution_type: 'human',
    source_excerpt: 'The daily digest email job should run every morning after we confirm SMTP limits.',
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
    id: 'demo-task-6',
    workspace_id: 'default-workspace',
    meeting_id: 'mtg-product-review',
    title: 'Agent: Research competitor action-item schemas and draft benchmark report',
    description: 'AI agent will crawl open schemas, summarize extraction formats, and prepare a comparison document.',
    deadline_utc: new Date(Date.now() + 86400000 * 3).toISOString(),
    priority: 'high',
    status: 'blocked',
    blocked_by: 'demo-task-3',
    execution_type: 'agent',
    source_excerpt: 'Let an AI agent research competitor tools and prepare the initial benchmarking report.',
    external_owner_label: 'ActionPulse AI Agent',
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

  // Sprint 2 Feature State: Active View & Dependency Modal
  const [activeView, setActiveView] = useState<'kanban' | 'chains'>('kanban');
  const [selectedTaskForDependency, setSelectedTaskForDependency] = useState<KanbanTaskItem | null>(null);

  // Filter states
  const [filterType, setFilterType] = useState<'all' | 'assigned'>('all');
  const [executionFilter, setExecutionFilter] = useState<'all' | 'human' | 'agent'>('all');
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
        setTasks(DEMO_TASKS);
      } else if (taskData && taskData.length > 0) {
        setTasks(taskData as unknown as KanbanTaskItem[]);
      } else {
        setTasks(DEMO_TASKS);
      }
    } catch (err: unknown) {
      console.warn('Network exception while fetching tasks, using fallback dataset:', err);
      setTasks(DEMO_TASKS);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 3. Setup Supabase Realtime subscription
  useEffect(() => {
    if (!activeWorkspaceId) return;

    const channel = supabase
      .channel(`realtime:tasks:${activeWorkspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `workspace_id=eq.${activeWorkspaceId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedRow = payload.new as KanbanTaskItem;
            setTasks((prev) =>
              prev.map((t) => (t.id === updatedRow.id ? { ...t, ...updatedRow } : t))
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
      prev.map((t) => {
        if (t.id === taskId) {
          return { ...t, status: newStatus };
        }
        // If this task is completed ('done'), automatically unblock any downstream tasks!
        if (newStatus === 'done' && t.blocked_by === taskId && t.status === 'blocked') {
          return { ...t, status: 'todo' };
        }
        return t;
      })
    );

    if (taskId.startsWith('demo-')) return; // sample cards only live in memory

    setUpdatingTaskIds((prev) => new Set(prev).add(taskId));

    try {
      // Column-level security grants UPDATE (status) to authenticated users;
      // updated_at is handled automatically by the tasks_set_updated_at trigger.
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) {
        console.error('Supabase status update error:', error.message);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t))
        );
        setErrorMsg(`Failed to move task: ${error.message}`);
      } else if (newStatus === 'done') {
        // Automatically persist unblocking of downstream dependent tasks
        await supabase
          .from('tasks')
          .update({ status: 'todo' })
          .eq('blocked_by', taskId)
          .eq('status', 'blocked');
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

  // 5. Sprint 2: Handle Task Dependency & Execution Routing Update
  const handleUpdateDependency = async (
    taskId: string,
    blockedById: string | null,
    executionType?: 'human' | 'agent'
  ) => {
    let resolvedNewStatus: TaskStatus | undefined;

    setTasks((prev) => {
      const prerequisite = blockedById ? prev.find((t) => t.id === blockedById) : null;
      return prev.map((t) => {
        if (t.id === taskId) {
          // If a prerequisite is set that is not 'done', auto-mark this task as 'blocked'
          let newStatus = t.status;
          if (blockedById && prerequisite && prerequisite.status !== 'done') {
            newStatus = 'blocked';
          } else if (!blockedById && t.status === 'blocked') {
            newStatus = 'todo';
          }
          resolvedNewStatus = newStatus;
          return {
            ...t,
            blocked_by: blockedById,
            status: newStatus,
            execution_type: executionType || t.execution_type,
          };
        }
        return t;
      });
    });

    if (taskId.startsWith('demo-')) return;

    try {
      // Update task status if dependency state altered it
      if (resolvedNewStatus) {
        await supabase
          .from('tasks')
          .update({ status: resolvedNewStatus })
          .eq('id', taskId);
      }

      await supabase
        .from('tasks')
        .update({ blocked_by: blockedById })
        .eq('id', taskId);
    } catch (err) {
      console.warn('Dependency updated in local/demo mode:', err);
    }
  };

  // 6. Filter & Search Logic
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Assignment filter: "All Workspace Tasks" vs "Assigned to Me"
      if (filterType === 'assigned') {
        const isAssigned = task.task_assignees?.some((a) => a.user_id === currentUserId);
        if (!isAssigned) return false;
      }

      // Execution type filter
      if (executionFilter === 'agent' && task.execution_type !== 'agent') return false;
      if (executionFilter === 'human' && task.execution_type === 'agent') return false;

      // Meeting filter
      if (selectedMeetingId !== 'all') {
        if (task.meeting_id !== selectedMeetingId) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q) || false;
        const matchesQuote = task.source_excerpt.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesQuote) return false;
      }

      return true;
    });
  }, [tasks, filterType, executionFilter, currentUserId, selectedMeetingId, searchQuery]);

  // 7. Group into Kanban columns
  const todoTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'todo'), [filteredTasks]);
  const inProgressTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'in_progress'), [filteredTasks]);
  const blockedTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'blocked'), [filteredTasks]);
  const doneTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'done'), [filteredTasks]);

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
      {/* Page header with View Switcher (Kanban Board vs Workflow Chains) */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Task Management & Orchestration</p>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 text-3xl font-medium tracking-tight text-white">
            Tasks & Workflow Chains
            {isDemo ? (
              <span className="rounded border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                Sample dataset / active demo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-400">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live
              </span>
            )}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Approved action items, multi-step dependencies, and AI agent execution routing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Sprint 2 View Switcher Tabs: Kanban vs Workflow Chains */}
          <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setActiveView('kanban')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeView === 'kanban'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="size-3.5" />
              <span>Kanban Board</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('chains')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                activeView === 'chains'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <GitFork className="size-3.5 text-indigo-400" />
              <span>Workflow Chains</span>
              {blockedCount > 0 && (
                <span className="ml-1 rounded-full bg-red-500/20 px-1.5 py-0.2 text-[10px] text-red-400 font-mono">
                  {blockedCount}
                </span>
              )}
            </button>
          </div>

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
              All tasks
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

          {/* Filter 2: Execution Mode (Human vs Agent) */}
          <div className="inline-flex rounded-md border border-white/10 bg-white/[0.02] p-0.5">
            <button
              type="button"
              onClick={() => setExecutionFilter('all')}
              className={segmentClass(executionFilter === 'all')}
            >
              All types
            </button>
            <button
              type="button"
              onClick={() => setExecutionFilter('human')}
              className={segmentClass(executionFilter === 'human')}
              title="Tasks assigned to human team members"
            >
              <User className="size-3 text-slate-400" />
              Human
            </button>
            <button
              type="button"
              onClick={() => setExecutionFilter('agent')}
              className={segmentClass(executionFilter === 'agent')}
              title="Automated tasks executed by AI Agents"
            >
              <Bot className="size-3 text-purple-400" />
              Agent
            </button>
          </div>

          {/* Filter 3: Filter by Meeting */}
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
              placeholder="Search tasks, chains, or quotes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="field h-8 w-44 py-0 pl-8 text-xs sm:w-56"
            />
          </div>
        </div>

        {/* Summary Counter */}
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

      {/* Main Content Area */}
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
      ) : activeView === 'chains' ? (
        /* Sprint 2 View: Interactive Workflow Chains & Dependency Graph */
        <WorkflowChainsView
          tasks={tasks}
          onOpenDependencyModal={(task) => setSelectedTaskForDependency(task)}
          onStatusChange={handleStatusChange}
        />
      ) : (
        /* Sprint 1 View: 4-Column Kanban Board */
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 lg:grid-cols-4">
          <KanbanColumn
            status="todo"
            title="To Do"
            tasks={todoTasks}
            allTasks={tasks}
            onStatusChange={handleStatusChange}
            onDropTask={handleStatusChange}
            onOpenDependencyModal={(task) => setSelectedTaskForDependency(task)}
            updatingTaskIds={updatingTaskIds}
          />

          <KanbanColumn
            status="in_progress"
            title="In Progress"
            tasks={inProgressTasks}
            allTasks={tasks}
            onStatusChange={handleStatusChange}
            onDropTask={handleStatusChange}
            onOpenDependencyModal={(task) => setSelectedTaskForDependency(task)}
            updatingTaskIds={updatingTaskIds}
          />

          <KanbanColumn
            status="blocked"
            title="Blocked"
            tasks={blockedTasks}
            allTasks={tasks}
            onStatusChange={handleStatusChange}
            onDropTask={handleStatusChange}
            onOpenDependencyModal={(task) => setSelectedTaskForDependency(task)}
            updatingTaskIds={updatingTaskIds}
          />

          <KanbanColumn
            status="done"
            title="Done"
            tasks={doneTasks}
            allTasks={tasks}
            onStatusChange={handleStatusChange}
            onDropTask={handleStatusChange}
            onOpenDependencyModal={(task) => setSelectedTaskForDependency(task)}
            updatingTaskIds={updatingTaskIds}
          />
        </div>
      )}

      {/* Task Dependency & Workflow Chain Modal */}
      <TaskDependencyModal
        isOpen={Boolean(selectedTaskForDependency)}
        onClose={() => setSelectedTaskForDependency(null)}
        task={selectedTaskForDependency}
        allTasks={tasks}
        onUpdateDependency={handleUpdateDependency}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

export default KanbanBoard;
