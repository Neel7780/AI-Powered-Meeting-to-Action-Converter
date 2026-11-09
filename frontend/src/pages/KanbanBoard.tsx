import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { KanbanColumn } from '@/components/kanban/KanbanColumn';
import { TaskDependencyModal } from '@/components/kanban/TaskDependencyModal';
import { TaskPrerequisiteDialog } from '@/components/kanban/TaskPrerequisiteDialog';
import { WorkflowChainsView } from '@/components/kanban/WorkflowChainsView';
import { reviewApi } from '@/services/reviewApi';
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
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MeetingOption {
  id: string;
  title: string;
  starts_at?: string;
}

export interface KanbanBoardProps {
  workspaceId?: string;
}

export function KanbanBoard({ workspaceId: propWorkspaceId }: KanbanBoardProps = {}) {
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { user: authUser } = useAuth();
  const activeWorkspaceId = propWorkspaceId || currentWorkspace?.id;
  const currentUserId = authUser?.id || null;

  const [tasks, setTasks] = useState<KanbanTaskItem[]>([]);
  const [meetings, setMeetings] = useState<MeetingOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updatingTaskIds, setUpdatingTaskIds] = useState<Set<string>>(new Set());

  // Sprint 2 Feature State: Active View & Dependency Modal
  const [activeView, setActiveView] = useState<'kanban' | 'chains'>('kanban');
  const [selectedTaskForDependency, setSelectedTaskForDependency] = useState<KanbanTaskItem | null>(null);
  const [prereqModalTask, setPrereqModalTask] = useState<KanbanTaskItem | null>(null);
  const [isPrereqModalOpen, setIsPrereqModalOpen] = useState(false);

  const handleOpenPrereqDialog = (task: KanbanTaskItem) => {
    setPrereqModalTask(task);
    setIsPrereqModalOpen(true);
  };

  const handlePrerequisiteLinked = (taskId: string, blockedById: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, blocked_by: blockedById, status: t.status === 'done' ? 'done' : 'blocked' }
          : t
      )
    );
  };

  // Filter states
  const [filterType, setFilterType] = useState<'all' | 'assigned'>('all');
  const [executionFilter, setExecutionFilter] = useState<'all' | 'human' | 'agent'>('all');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reset workspace-specific states whenever activeWorkspaceId changes
  useEffect(() => {
    setSelectedMeetingId('all');
    setTasks([]);
    setMeetings([]);
    setErrorMsg(null);
  }, [activeWorkspaceId]);

  // Fetch tasks and meetings from Supabase strictly scoped to activeWorkspaceId
  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (!activeWorkspaceId) {
      setTasks([]);
      setMeetings([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMsg(null);

    try {
      const [taskRes, meetingRes] = await Promise.all([
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
            created_by,
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
          .eq('workspace_id', activeWorkspaceId)
          .order('created_at', { ascending: false }),
        supabase
          .from('meetings')
          .select('id, title, starts_at')
          .eq('workspace_id', activeWorkspaceId)
          .order('starts_at', { ascending: false }),
      ]);

      const meetingList = (meetingRes.data || []) as MeetingOption[];
      setMeetings(meetingList);
      setSelectedMeetingId((prev) => {
        if (prev === 'all') return 'all';
        return meetingList.some((m) => m.id === prev) ? prev : 'all';
      });

      if (taskRes.error) {
        console.error('Supabase tasks fetch error:', taskRes.error.message);
        setErrorMsg(`Failed to load tasks: ${taskRes.error.message}`);
        setTasks([]);
      } else {
        const rawTasks = (taskRes.data || []) as any[];
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
          } catch (pErr) {
            console.warn('Profile lookup warning:', pErr);
          }
        }

        const mapped: KanbanTaskItem[] = rawTasks.map((t) => ({
          ...t,
          execution_type:
            t.execution_type || (t.external_owner_label === 'AI Agent' ? 'agent' : 'human'),
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
        setTasks(mapped);
      }
    } catch (err: unknown) {
      console.error('Network exception while fetching tasks:', err);
      setTasks([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Setup Supabase Realtime subscription for both tasks and task_assignees
  useEffect(() => {
    if (!activeWorkspaceId) return;

    const channel = supabase
      .channel(`realtime:kanban:${activeWorkspaceId}`)
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
            const updatedRow = payload.new as any;
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_assignees',
        },
        () => {
          fetchData(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, activeWorkspaceId]);

  // Handle Status Change with backend validation & cascade
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask || targetTask.status === newStatus) return;

    // Prerequisite check: Cannot move task out of blocked if prerequisite is not completed
    if (newStatus !== 'blocked' && targetTask.blocked_by) {
      const prereq = tasks.find((t) => t.id === targetTask.blocked_by);
      if (prereq && prereq.status !== 'done') {
        setErrorMsg(`Cannot advance "${targetTask.title}": Prerequisite task is not completed yet.`);
        return;
      }
    }

    const previousStatus = targetTask.status;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return { ...t, status: newStatus };
        }
        // If this task is completed ('done'), automatically unblock downstream tasks
        if (newStatus === 'done' && t.blocked_by === taskId && t.status === 'blocked') {
          return { ...t, status: 'todo' };
        }
        // If moved backwards from done, re-block downstream tasks
        if (previousStatus === 'done' && newStatus !== 'done' && t.blocked_by === taskId && t.status !== 'blocked') {
          return { ...t, status: 'blocked' };
        }
        return t;
      })
    );

    setUpdatingTaskIds((prev) => new Set(prev).add(taskId));

    try {
      if (activeWorkspaceId) {
        await reviewApi.updateTaskStatus(activeWorkspaceId, taskId, newStatus);
      } else {
        await supabase
          .from('tasks')
          .update({ status: newStatus })
          .eq('id', taskId);
      }
    } catch (err: any) {
      console.warn('Backend update failed, trying direct Supabase fallback:', err);
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ status: newStatus })
          .eq('id', taskId);

        if (error) {
          throw error;
        } else if (newStatus === 'done') {
          await supabase
            .from('tasks')
            .update({ status: 'todo' })
            .eq('blocked_by', taskId)
            .eq('status', 'blocked');
        } else if (previousStatus === 'done') {
          await supabase
            .from('tasks')
            .update({ status: 'blocked' })
            .eq('blocked_by', taskId)
            .neq('status', 'blocked');
        }
      } catch (dbErr: any) {
        console.error('Supabase status update error:', dbErr?.message || err?.message);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t))
        );
        setErrorMsg(`Failed to move task: ${dbErr?.message || err?.message || 'Update error'}`);
      }
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

    try {
      if (activeWorkspaceId) {
        await reviewApi.updateTaskDependency(
          activeWorkspaceId,
          taskId,
          blockedById,
          executionType
        );
      }
    } catch (err: any) {
      console.warn('Backend dependency update warning, falling back to local state:', err);
      if (err?.message) {
        setErrorMsg(`Failed to update dependency: ${err.message}`);
      }
    }
  };

  // 6. Filter & Search Logic
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Assignment filter: "All Workspace Tasks" vs "Assigned to Me"
      if (filterType === 'assigned') {
        const isAssigned = Boolean(
          currentUserId &&
          task.task_assignees?.some((a) => a.user_id === currentUserId)
        );
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
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-white">Tasks & Workflow Chains</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Approved action items, multi-step dependencies, and AI agent execution routing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View switcher: Kanban vs Workflow Chains */}
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
            asChild
            className="hidden sm:inline-flex border border-white/10 bg-white/[0.03] text-xs text-neutral-300 hover:text-white"
            title="View Sprint Velocity & Progress Diff"
          >
            <Link to="/velocity">
              <TrendingUp className="size-3.5 text-emerald-400 mr-1" />
              <span>Sprint Velocity</span>
            </Link>
          </Button>

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
      {workspaceLoading || isLoading ? (
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
      ) : !activeWorkspaceId ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-[#060606] p-12 text-center">
          <Users className="size-10 text-neutral-500 mb-3" />
          <h3 className="text-lg font-medium text-white">No Workspace Selected</h3>
          <p className="mt-1 text-sm text-neutral-400 max-w-md">
            Please select or create a workspace to view and manage its tasks and workflow chains.
          </p>
        </div>
      ) : activeView === 'chains' ? (
        /* Sprint 2 View: Interactive Workflow Chains & Dependency Graph (Meeting-Aware) */
        <WorkflowChainsView
          tasks={filteredTasks}
          allTasks={tasks}
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
            onOpenPrereqDialog={handleOpenPrereqDialog}
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
            onOpenPrereqDialog={handleOpenPrereqDialog}
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
            onOpenPrereqDialog={handleOpenPrereqDialog}
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
            onOpenPrereqDialog={handleOpenPrereqDialog}
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
        onOpenPrereqDialog={handleOpenPrereqDialog}
      />

      {/* 2-Way Task Prerequisite Communication Dialog */}
      <TaskPrerequisiteDialog
        isOpen={isPrereqModalOpen}
        onClose={() => {
          setIsPrereqModalOpen(false);
          setPrereqModalTask(null);
        }}
        task={prereqModalTask}
        allTasks={tasks}
        workspaceId={activeWorkspaceId}
        onPrerequisiteLinked={handlePrerequisiteLinked}
      />
    </div>
  );
}

export default KanbanBoard;
