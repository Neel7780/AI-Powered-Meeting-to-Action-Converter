import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { KanbanColumn } from '@/components/kanban/KanbanColumn';
import type { KanbanTaskItem, TaskStatus } from '@/components/kanban/KanbanCard';
import {
  Kanban,
  Users,
  UserCheck,
  Calendar,
  Search,
  RefreshCw,
  Plus,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MeetingOption {
  id: string;
  title: string;
  meeting_date?: string;
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
      meeting_date: new Date().toISOString(),
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
      meeting_date: new Date().toISOString(),
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
      meeting_date: new Date().toISOString(),
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
      meeting_date: new Date().toISOString(),
    },
    task_assignees: [],
  },
];

export function KanbanBoard() {
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
      // Query tasks with meetings & assignees
      const { data: taskData, error: taskError } = await supabase
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
            meeting_date
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

      // Fetch distinct meetings for the filter dropdown
      const { data: meetingData } = await supabase
        .from('meetings')
        .select('id, title, meeting_date')
        .order('meeting_date', { ascending: false });

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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 3. Supabase Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel('kanban-tasks-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
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
  }, [fetchData]);

  // 4. Handle Status Change (both Drag-and-Drop and Status Selector Dropdown)
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask || targetTask.status === newStatus) return;

    const previousStatus = targetTask.status;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

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

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      {/* Top Banner / Navigation */}
      <header className="sticky top-0 z-30 border-b border-[#1c1c1c] bg-black/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Left: Branding & Back link */}
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-white transition-colors"
                title="Return to Landing Page"
              >
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>

              <div className="h-4 w-px bg-[#262626]" />

              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-lg border border-white/20 bg-white text-black font-bold shadow-sm">
                  <Kanban className="size-4 text-black" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
                    ActionPulse Kanban
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                      <Sparkles className="size-3" /> Live
                    </span>
                  </h1>
                  <p className="text-[11px] text-neutral-400">Workspace Action Items</p>
                </div>
              </div>
            </div>

            {/* Right: Quick actions & Meeting navigation */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchData(true)}
                disabled={isRefreshing}
                className="text-neutral-400 hover:text-white"
                title="Refresh tasks"
              >
                <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline ml-1.5">Refresh</span>
              </Button>

              <Button
                asChild
                size="sm"
                className="bg-white text-black font-semibold hover:bg-neutral-200 transition-colors"
              >
                <Link to="/create-meeting">
                  <Plus className="size-3.5 mr-1" />
                  <span>New Meeting</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Filter Toolbar & Statistics */}
      <section className="border-b border-[#181818] bg-[#070707] py-3.5">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
            {/* Left Filter Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Filter 1: All Workspace Tasks vs. Assigned to Me */}
              <div className="inline-flex rounded-lg border border-[#222222] bg-[#0d0d0d] p-0.5">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    filterType === 'all'
                      ? 'bg-white text-black shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Users className="size-3.5" />
                  <span>All Workspace Tasks</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('assigned')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    filterType === 'assigned'
                      ? 'bg-white text-black shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <UserCheck className="size-3.5" />
                  <span>Assigned to Me</span>
                </button>
              </div>

              {/* Filter 2: Filter by Meeting */}
              <div className="flex items-center gap-1.5">
                <Calendar className="size-3.5 text-neutral-500" />
                <select
                  value={selectedMeetingId}
                  onChange={(e) => setSelectedMeetingId(e.target.value)}
                  className="h-8 rounded-md border border-[#222222] bg-[#0d0d0d] px-2.5 text-xs text-neutral-200 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark]"
                >
                  <option value="all">All Source Meetings</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search tasks or quotes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-44 sm:w-60 rounded-md border border-[#222222] bg-[#0d0d0d] pl-8 pr-3 text-xs text-white placeholder:text-neutral-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20"
                />
              </div>
            </div>

            {/* Right Summary Badges */}
            <div className="flex items-center gap-3 text-xs text-neutral-400">
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-500">Total:</span>
                <span className="font-semibold text-white">{totalCount}</span>
              </div>
              <div className="h-3 w-px bg-[#262626]" />
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="size-3.5" />
                <span>Done: {doneCount}</span>
              </div>
              {blockedCount > 0 && (
                <>
                  <div className="h-3 w-px bg-[#262626]" />
                  <div className="flex items-center gap-1.5 text-red-400">
                    <AlertTriangle className="size-3.5" />
                    <span>Blocked: {blockedCount}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Error notification banner if any */}
      {errorMsg && (
        <div className="border-b border-red-500/20 bg-red-950/40 px-4 py-2 text-center text-xs text-red-300">
          {errorMsg}
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="ml-3 underline hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Kanban Board Layout: 4 Columns */}
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[520px] rounded-xl border border-[#181818] bg-[#050505] p-4 animate-pulse flex flex-col gap-3"
              >
                <div className="h-6 w-24 bg-white/5 rounded" />
                <div className="h-28 w-full bg-white/5 rounded-lg" />
                <div className="h-28 w-full bg-white/5 rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
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
      </main>
    </div>
  );
}

export default KanbanBoard;
