import { useEffect, useState, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../context/WorkspaceContext';
import { WorkflowChainsView } from '../components/kanban/WorkflowChainsView';
import { TaskDependencyModal } from '../components/kanban/TaskDependencyModal';
import { CreateMeeting } from './CreateMeeting';
import type { KanbanTaskItem, TaskStatus } from '../components/kanban/KanbanCard';
import { reviewApi } from '../services/reviewApi';
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

export default function MeetingsPage() {
  const { currentWorkspace, currentRole } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const navigate = useNavigate();

  const isOrganiserOrAdmin = currentRole === 'admin' || currentRole === 'organiser';

  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [allTasks, setAllTasks] = useState<KanbanTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTaskForDependency, setSelectedTaskForDependency] = useState<KanbanTaskItem | null>(null);

  // 1. Fetch meetings and tasks for the active workspace
  const loadWorkspaceMeetingData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);

    try {
      const [meetingsRes, tasksRes] = await Promise.all([
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
              is_primary,
              profiles (
                id,
                display_name,
                email,
                avatar_url
              )
            )
          `)
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
      ]);

      const meetingList = (meetingsRes.data || []) as MeetingItem[];
      setMeetings(meetingList);

      const taskList = (tasksRes.data || []) as unknown as KanbanTaskItem[];
      setAllTasks(taskList);

      // Default select the most recent meeting if none selected
      if (meetingList.length > 0 && !selectedMeetingId) {
        setSelectedMeetingId(meetingList[0].id);
      }
    } catch (err) {
      console.error('Failed to load meetings data:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, selectedMeetingId]);

  useEffect(() => {
    loadWorkspaceMeetingData();
  }, [loadWorkspaceMeetingData]);

  // Currently selected meeting details
  const activeMeeting = useMemo(() => {
    return meetings.find((m) => m.id === selectedMeetingId) || null;
  }, [meetings, selectedMeetingId]);

  // Tasks generated specifically from the selected meeting
  const meetingTasks = useMemo(() => {
    if (!selectedMeetingId) return [];
    return allTasks.filter((t) => t.meeting_id === selectedMeetingId);
  }, [allTasks, selectedMeetingId]);

  // Task status transition handler
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
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
      await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
      if (newStatus === 'done') {
        await supabase.from('tasks').update({ status: 'todo' }).eq('blocked_by', taskId).eq('status', 'blocked');
      }
    } catch (err) {
      console.warn('Status update fallback:', err);
    }
  };

  // Task dependency update handler
  const handleUpdateDependency = async (
    taskId: string,
    blockedById: string | null,
    executionType?: 'human' | 'agent'
  ) => {
    setAllTasks((prev) => {
      const prereq = blockedById ? prev.find((t) => t.id === blockedById) : null;
      return prev.map((t) => {
        if (t.id === taskId) {
          let st = t.status;
          if (blockedById && prereq && prereq.status !== 'done') {
            st = 'blocked';
          } else if (!blockedById && t.status === 'blocked') {
            st = 'todo';
          }
          return {
            ...t,
            blocked_by: blockedById,
            status: st,
            execution_type: executionType || t.execution_type,
          };
        }
        return t;
      });
    });

    try {
      if (workspaceId) {
        await reviewApi.updateTaskDependency(workspaceId, taskId, blockedById, executionType);
      }
    } catch (err) {
      console.warn('Backend dependency update warning:', err);
    }
  };

  if (showCreateModal) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCreateModal(false)}
            className="text-neutral-400 hover:text-white"
          >
            ← Back to Meetings & Chains
          </Button>
        </div>
        <CreateMeeting />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <CalendarPlus className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Meeting Action Items & Workflow Chains
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Turn meeting decisions into sequential dependency pipelines for your team
              </p>
            </div>
          </div>
        </div>

        {isOrganiserOrAdmin && (
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
          >
            <Plus className="size-4 mr-1.5" />
            New Meeting
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-neutral-400">
          <LoaderCircle className="size-5 animate-spin text-indigo-400" />
          <span>Loading meetings and workflow dependencies…</span>
        </div>
      ) : meetings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-12 text-center">
          <CalendarPlus className="mx-auto size-10 text-neutral-600 mb-3" />
          <h3 className="text-base font-semibold text-white">No meetings recorded yet</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1 mb-5">
            Create a meeting and upload or paste a transcript to automatically extract action items and dependency chains.
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
          {/* 2. Left Column: Meeting Directory */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Workspace Meetings ({meetings.length})
              </h2>
              <span className="text-[11px] text-neutral-500">Select to view chains</span>
            </div>

            <div className="space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
              {meetings.map((m) => {
                const isSelected = m.id === selectedMeetingId;
                const mTasks = allTasks.filter((t) => t.meeting_id === m.id);
                const blockedCount = mTasks.filter((t) => t.status === 'blocked').length;

                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMeetingId(m.id)}
                    role="button"
                    tabIndex={0}
                    className={`rounded-xl border p-4 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30'
                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white line-clamp-1">{m.title}</h3>
                      <span
                        className={`inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${
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
                        <ListTodo className="size-3 text-neutral-500" />
                        {mTasks.length} tasks
                      </span>
                    </div>

                    {blockedCount > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5 text-[11px] text-amber-400">
                        <AlertCircle className="size-3 shrink-0" />
                        <span>{blockedCount} dependent task(s) waiting on prerequisites</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Right Column: Meeting Action Items & Workflow Chains Showcase */}
          <div className="lg:col-span-8 space-y-6">
            {activeMeeting ? (
              <>
                {/* Meeting Header Banner */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono uppercase tracking-wider text-indigo-400">
                          Meeting Workflow Sequence
                        </span>
                        <span className="inline-block size-1 rounded-full bg-neutral-600" />
                        <span className="text-xs text-neutral-400">{activeMeeting.timezone}</span>
                      </div>
                      <h2 className="text-xl font-bold text-white mt-1">{activeMeeting.title}</h2>
                    </div>

                    <div className="flex items-center gap-2.5 self-start sm:self-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/meetings/${activeMeeting.id}/review`)}
                        className="border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs"
                      >
                        Review / Transcript <ArrowRight className="size-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/10 text-center">
                    <div className="rounded-lg bg-white/[0.02] p-2 border border-white/5">
                      <span className="text-[11px] text-neutral-400 block">Total Action Items</span>
                      <span className="text-base font-bold text-white">{meetingTasks.length}</span>
                    </div>
                    <div className="rounded-lg bg-white/[0.02] p-2 border border-white/5">
                      <span className="text-[11px] text-neutral-400 block">Completed</span>
                      <span className="text-base font-bold text-emerald-400">
                        {meetingTasks.filter((t) => t.status === 'done').length}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white/[0.02] p-2 border border-white/5">
                      <span className="text-[11px] text-neutral-400 block">Blocked by Dependency</span>
                      <span className="text-base font-bold text-amber-400">
                        {meetingTasks.filter((t) => t.status === 'blocked').length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Workflow Chains View for this specific meeting */}
                {meetingTasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center space-y-3">
                    <GitFork className="mx-auto size-8 text-neutral-600" />
                    <h3 className="text-sm font-semibold text-white">No tasks created yet for this meeting</h3>
                    <p className="text-xs text-neutral-400 max-w-md mx-auto">
                      AI has parsed candidate items, but they need to be approved in the Staging Gate before appearing as active workflow tasks.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/meetings/${activeMeeting.id}/review`)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      Open Meeting Review Gate
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <GitFork className="size-4 text-indigo-400" />
                        <h3 className="text-sm font-semibold text-white">
                          Dependency Chains & Execution Sequences
                        </h3>
                      </div>
                      <span className="text-xs text-neutral-400">
                        Step-by-step downstream task progression
                      </span>
                    </div>

                    <WorkflowChainsView
                      tasks={meetingTasks}
                      onOpenDependencyModal={(task) => setSelectedTaskForDependency(task)}
                      onStatusChange={handleStatusChange}
                    />
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Task Dependency Modal */}
      <TaskDependencyModal
        isOpen={Boolean(selectedTaskForDependency)}
        onClose={() => setSelectedTaskForDependency(null)}
        task={selectedTaskForDependency}
        allTasks={meetingTasks.length > 0 ? meetingTasks : allTasks}
        onUpdateDependency={handleUpdateDependency}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
