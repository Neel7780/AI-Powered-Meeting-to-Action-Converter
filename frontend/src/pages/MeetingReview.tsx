import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCheck, 
  Sparkles, 
  ArrowLeft, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  Users, 
  AlertCircle, 
  Layers, 
  ChevronRight, 
  ShieldCheck, 
  Search,
  Plus,
  Trash2,
  Lock,
  Calendar,
  Check,
  X
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import type { 
  ActionItemCandidate, 
  MeetingDetails, 
  TranscriptSegment, 
  WorkspaceMember,
  ManualTask 
} from '../types/review';
import { reviewApi } from '../services/reviewApi';
import { TranscriptViewer } from '../components/review/TranscriptViewer';
import { ActionItemReviewCard } from '../components/review/ActionItemReviewCard';

interface MeetingReviewProps {
  meetingId?: string;
  onNavigateBack?: () => void;
  onNavigateToKanban?: () => void;
}

export const MeetingReview: React.FC<MeetingReviewProps> = ({
  meetingId: propMeetingId,
  onNavigateBack,
  onNavigateToKanban
}) => {
  const navigate = useNavigate();
  const { id: routeMeetingId } = useParams<{ id: string }>();
  const effectiveMeetingId = propMeetingId || routeMeetingId || 'mtg-sprint-102';

  const [meeting, setMeeting] = useState<MeetingDetails | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [candidates, setCandidates] = useState<ActionItemCandidate[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [manualTasks, setManualTasks] = useState<ManualTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & selection
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  const [activeTimestamp, setActiveTimestamp] = useState<string | null>(null);
  const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  // Manual Task Assignment Modal / Form State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const isNoAiMode = meeting?.ai_processing === false;

  const loadData = async () => {
    try {
      setLoading(true);
      const [mtgData, transData, candData, memData, taskData] = await Promise.all([
        reviewApi.fetchMeetingDetails(effectiveMeetingId),
        reviewApi.fetchTranscript(effectiveMeetingId),
        reviewApi.fetchActionItemCandidates(effectiveMeetingId),
        reviewApi.fetchWorkspaceMembers('ws-team-10'),
        reviewApi.fetchMeetingTasks(effectiveMeetingId)
      ]);

      setMeeting(mtgData);
      setTranscript(transData);
      setCandidates(candData);
      setMembers(memData);
      setManualTasks(taskData);

      // Pre-select first member in assignee dropdown
      if (memData.length > 0 && !taskAssigneeId) {
        setTaskAssigneeId(memData[0].user_id || memData[0].id);
      }
    } catch (err) {
      console.error('Failed to load meeting review workspace data:', err);
      showToast('Error loading meeting data', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [effectiveMeetingId]);

  const totalItems = candidates.length;
  const pendingItems = candidates.filter(c => c.status === 'pending');
  const approvedItems = candidates.filter(c => c.status === 'approved');
  const rejectedItems = candidates.filter(c => c.status === 'rejected');
  const unassignedPendingItems = pendingItems.filter(c => !c.assignee_id);
  const completionPercentage = totalItems > 0 
    ? Math.round(((approvedItems.length + rejectedItems.length) / totalItems) * 100) 
    : 0;

  const actionItemSegmentIds = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach(c => {
      if (c.transcript_segment_id) {
        set.add(c.transcript_segment_id);
      }
    });
    return set;
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (assigneeFilter === 'unassigned' && item.assignee_id) {
        return false;
      }
      if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned' && item.assignee_id !== assigneeFilter) {
        return false;
      }
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesMember = item.assignee?.full_name.toLowerCase().includes(q) || false;
        if (!matchesTitle && !matchesDesc && !matchesMember) {
          return false;
        }
      }
      return true;
    });
  }, [candidates, statusFilter, assigneeFilter, searchFilter]);

  const filteredManualTasks = useMemo(() => {
    return manualTasks.filter(task => {
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q) || false;
        const matchesAssignee = task.assignee?.full_name.toLowerCase().includes(q) || false;
        if (!matchesTitle && !matchesDesc && !matchesAssignee) return false;
      }
      if (assigneeFilter !== 'all' && assigneeFilter !== 'unassigned') {
        if (task.assignee_user_id !== assigneeFilter) return false;
      }
      return true;
    });
  }, [manualTasks, searchFilter, assigneeFilter]);

  const handleApprove = async (id: string) => {
    try {
      const updated = await reviewApi.approveActionItem(id, effectiveMeetingId);
      setCandidates(prev => prev.map(c => c.id === id ? updated : c));
      showToast(`Approved "${updated.title.slice(0, 32)}..."`, 'success');
    } catch (err) {
      console.error('Approve failed:', err);
      showToast('Failed to approve action item', 'warning');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const updated = await reviewApi.rejectActionItem(id, effectiveMeetingId);
      setCandidates(prev => prev.map(c => c.id === id ? updated : c));
      showToast(`Rejected item`, 'info');
    } catch (err) {
      console.error('Reject failed:', err);
      showToast('Failed to reject action item', 'warning');
    }
  };

  const handleRevert = async (id: string) => {
    try {
      const updated = await reviewApi.revertActionItem(id);
      setCandidates(prev => prev.map(c => c.id === id ? updated : c));
      showToast(`Reverted back to pending review`, 'info');
    } catch (err) {
      console.error('Revert failed:', err);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<ActionItemCandidate>) => {
    try {
      const updated = await reviewApi.updateActionItem(id, updates);
      setCandidates(prev => prev.map(c => c.id === id ? updated : c));
      showToast(`Updated action item details`, 'success');
    } catch (err) {
      console.error('Update failed:', err);
      showToast('Failed to update action item', 'warning');
    }
  };

  const handleApproveAll = async () => {
    if (unassignedPendingItems.length > 0) {
      const confirmMsg = `There are ${unassignedPendingItems.length} candidate item(s) without an assigned owner (Assignee Required). Would you like to approve all currently assigned pending items (${pendingItems.length - unassignedPendingItems.length})?`;
      if (!window.confirm(confirmMsg)) {
        return;
      }
      const eligibleIds = pendingItems.filter(c => c.assignee_id).map(c => c.id);
      if (eligibleIds.length === 0) {
        showToast('Please assign owners to pending items before approving', 'warning');
        return;
      }
      const updatedList = await reviewApi.approveAllActionItems(effectiveMeetingId, eligibleIds);
      setCandidates(updatedList);
      showToast(`Batch approved ${eligibleIds.length} assigned action items!`, 'success');
      return;
    }

    if (pendingItems.length === 0) {
      showToast('No pending action items to approve', 'info');
      return;
    }

    try {
      const updatedList = await reviewApi.approveAllActionItems(effectiveMeetingId);
      setCandidates(updatedList);
      showToast(`Successfully approved all ${pendingItems.length} pending action items!`, 'success');
    } catch (err) {
      console.error('Batch approve failed:', err);
      showToast('Failed to batch approve action items', 'warning');
    }
  };

  const handleCreateManualTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      showToast('Task title is required', 'warning');
      return;
    }

    setIsAssigning(true);
    try {
      const created = await reviewApi.createManualTask(
        effectiveMeetingId, 
        meeting?.workspace_id || 'ws-team-10', 
        {
          title: taskTitle.trim(),
          description: taskDescription.trim() || undefined,
          assignee_user_id: taskAssigneeId || null,
          priority: taskPriority,
          deadline_utc: taskDueDate ? new Date(taskDueDate).toISOString() : null,
          source_excerpt: 'Manual task assignment (No-AI mode)'
        }
      );

      setManualTasks(prev => [created, ...prev]);
      setShowAssignModal(false);
      setTaskTitle('');
      setTaskDescription('');
      setTaskDueDate('');
      showToast(`Assigned "${created.title.slice(0, 30)}..." to ${created.assignee?.full_name || 'member'}!`, 'success');
    } catch (err: any) {
      console.error('Failed to assign task:', err);
      showToast(err?.message || 'Failed to create task', 'warning');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDeleteManualTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await reviewApi.deleteManualTask(effectiveMeetingId, taskId);
      setManualTasks(prev => prev.filter(t => t.id !== taskId));
      showToast('Task deleted successfully', 'info');
    } catch (err) {
      console.error('Failed to delete task:', err);
      showToast('Failed to delete task', 'warning');
    }
  };

  const handleReset = async () => {
    if (window.confirm('Reset candidate items back to demo state?')) {
      const fresh = await reviewApi.resetToInitialData();
      setCandidates(fresh);
      showToast('Reset staging gate candidate items to default state', 'info');
    }
  };

  const handleJumpToTranscript = (timestamp: string, segmentId?: string) => {
    setActiveTimestamp(timestamp);
    if (segmentId) {
      setHighlightedSegmentId(segmentId);
    } else {
      const found = transcript.find(s => s.timestamp === timestamp);
      if (found) setHighlightedSegmentId(found.id);
    }
  };

  const handleSelectTranscriptTimestamp = (timestamp: string, segmentId: string) => {
    setActiveTimestamp(timestamp);
    setHighlightedSegmentId(segmentId);

    const matchingCandidate = candidates.find(
      c => c.transcript_segment_id === segmentId || c.transcript_timestamp === timestamp
    );
    if (matchingCandidate) {
      setSelectedCandidateId(matchingCandidate.id);
    }
  };

  const goBack = onNavigateBack || (() => navigate('/meetings'));
  const goKanban = onNavigateToKanban || (() => navigate('/tasks'));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Loading Meeting Review Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/70 text-slate-900">
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-900 text-emerald-50 border-emerald-700' 
            : toastMessage.type === 'warning'
            ? 'bg-amber-900 text-amber-50 border-amber-700'
            : 'bg-slate-900 text-slate-50 border-slate-700'
        }`}>
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toastMessage.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-400" />}
          {toastMessage.type === 'info' && <Clock className="w-4 h-4 text-indigo-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={goBack}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                title="Back to meetings list"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  {isNoAiMode ? (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-600" />
                      <span>No-AI Privacy Mode</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                      <span>AI Staging Gate</span>
                    </span>
                  )}
                  <span className="text-slate-300">/</span>
                  <span className="text-xs font-medium text-slate-500">
                    {meeting?.organiser_name} (Organiser)
                  </span>
                </div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  {meeting?.title}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Quick Mode Indicator / Switcher for Demo */}
              <button
                onClick={() => {
                  navigate(isNoAiMode ? '/meetings/mtg-sprint-102/review' : '/meetings/mtg-private-no-ai/review');
                }}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                title="Switch between AI Mode and No-AI Mode view"
              >
                {isNoAiMode ? "View AI Demo Mode" : "View No-AI Demo Mode"}
              </button>

              {/* Status / Actions */}
              {isNoAiMode ? (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <span className="text-slate-500">Manual Tasks:</span>
                    <span className="font-semibold text-slate-800">
                      {manualTasks.length} assigned
                    </span>
                  </div>

                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white flex items-center gap-1.5 transition shadow-xs"
                    title="Manually assign a task to a workspace participant"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Assign Task</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <span className="text-slate-500">Staging Review:</span>
                    <span className="font-semibold text-slate-800">
                      {approvedItems.length} approved • {pendingItems.length} pending
                    </span>
                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden ml-1">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-300" 
                        style={{ width: `${completionPercentage}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center gap-1 transition"
                    title="Add manual task"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Task</span>
                  </button>

                  <button
                    onClick={handleReset}
                    title="Reset demo items back to original state"
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs flex items-center gap-1 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Reset</span>
                  </button>

                  <button
                    onClick={handleApproveAll}
                    disabled={pendingItems.length === 0}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white flex items-center gap-1.5 transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Approve all eligible pending action items in batch"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Approve All ({pendingItems.length})</span>
                  </button>
                </div>
              )}

              <button
                onClick={goKanban}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 transition"
                title="View published tasks on Kanban board"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Kanban Board</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* COMPLIANCE / PRIVACY BANNER */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-3">
        {isNoAiMode ? (
          <div className="p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-center gap-2 text-emerald-950 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                <strong>🔒 No-AI Privacy Mode Active:</strong> Meeting transcripts are 100% confidential and never read by external AI. Managers manually assign tasks to participants below.
              </span>
            </div>
            <div className="text-[11px] text-emerald-800 hidden sm:flex items-center gap-1.5 font-semibold">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Zero AI Transfer • DPDP Compliant</span>
            </div>
          </div>
        ) : (
          <div className="p-2.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200/80 rounded-xl flex items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-center gap-2 text-purple-900 font-medium">
              <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
              <span>
                <strong>AI Attestation (CR-01):</strong> AI-generated suggestions. Verify before publishing.
              </span>
            </div>
            <div className="text-[11px] text-purple-700 hidden sm:flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Staging Gate Protocol</span>
            </div>
          </div>
        )}
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 flex-1 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
          
          {/* LEFT: TRANSCRIPT & NOTES VIEWER */}
          <div className="lg:col-span-5 xl:col-span-5 h-[calc(100vh-14rem)] min-h-[500px]">
            <TranscriptViewer
              segments={transcript}
              activeTimestamp={activeTimestamp}
              highlightedSegmentId={highlightedSegmentId}
              onSelectTimestamp={handleSelectTranscriptTimestamp}
              actionItemSegmentIds={actionItemSegmentIds}
            />
          </div>

          {/* RIGHT: TASK MANAGEMENT WORKSPACE */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col h-[calc(100vh-14rem)] min-h-[500px] bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            
            {/* NO-AI MODE PANEL: MANUAL TASK ASSIGNMENT */}
            {isNoAiMode ? (
              <div className="flex flex-col h-full">
                {/* Search & Actions Header */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>Manually Assigned Tasks</span>
                        <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                          {manualTasks.length} tasks
                        </span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        In No-AI Mode, workspace managers assign tasks directly to team members.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white flex items-center gap-1.5 transition shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Assign Task</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search assigned tasks..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition placeholder:text-slate-400"
                      />
                    </div>

                    <div className="relative flex items-center">
                      <Users className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                      <select
                        value={assigneeFilter}
                        onChange={(e) => setAssigneeFilter(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-slate-700 cursor-pointer appearance-none"
                      >
                        <option value="all">All Assignees</option>
                        {members.map(m => (
                          <option key={m.id} value={m.user_id || m.id}>
                            {m.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Task List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                  {filteredManualTasks.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                        <Lock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">No manual tasks assigned yet</p>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                          Since this is a No-AI meeting, no automated extractions are generated. 
                          Click below to manually delegate action items to workspace participants.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAssignModal(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Assign First Task</span>
                      </button>
                    </div>
                  ) : (
                    filteredManualTasks.map((task) => {
                      const priorityColor = 
                        task.priority === 'urgent' ? 'bg-red-50 text-red-700 border-red-200' :
                        task.priority === 'high' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        task.priority === 'low' ? 'bg-slate-50 text-slate-700 border-slate-200' :
                        'bg-blue-50 text-blue-700 border-blue-200';

                      return (
                        <div
                          key={task.id}
                          className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-xs transition space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${priorityColor}`}>
                                  {task.priority}
                                </span>
                                <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                  {task.status.replace('_', ' ')}
                                </span>
                                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>Private / Manual</span>
                                </span>
                              </div>
                              <h3 className="text-sm font-bold text-slate-900 leading-snug">
                                {task.title}
                              </h3>
                              {task.description && (
                                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                  {task.description}
                                </p>
                              )}
                            </div>

                            <button
                              onClick={() => handleDeleteManualTask(task.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete task"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
                            {/* Assignee Card */}
                            <div className="flex items-center gap-2">
                              {task.assignee ? (
                                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                                    {task.assignee.initials || task.assignee.full_name.slice(0, 2).toUpperCase()}
                                  </div>
                                  <span className="font-semibold text-slate-800 text-[11px]">
                                    {task.assignee.full_name}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    ({task.assignee.role.replace('_', ' ')})
                                  </span>
                                </div>
                              ) : (
                                <span className="text-amber-600 font-medium text-[11px]">Unassigned</span>
                              )}
                            </div>

                            {/* Due date */}
                            {task.deadline_utc && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-600">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>Due {task.deadline_utc.split('T')[0]}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Total: <strong>{manualTasks.length}</strong> tasks assigned
                  </span>
                  <button
                    onClick={goKanban}
                    className="font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <span>View all on Kanban Board</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* STANDARD AI STAGING GATE PANEL */
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-slate-100 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900">
                        Candidate Action Items
                      </h2>
                      <span className="text-xs bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">
                        {candidates.length} total
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-lg text-xs font-medium">
                      <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-2.5 py-1 rounded-md transition ${
                          statusFilter === 'all' 
                            ? 'bg-white text-slate-900 shadow-xs font-semibold' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        All ({candidates.length})
                      </button>
                      <button
                        onClick={() => setStatusFilter('pending')}
                        className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                          statusFilter === 'pending' 
                            ? 'bg-white text-amber-900 shadow-xs font-semibold' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Pending ({pendingItems.length})
                      </button>
                      <button
                        onClick={() => setStatusFilter('approved')}
                        className={`px-2.5 py-1 rounded-md transition ${
                          statusFilter === 'approved' 
                            ? 'bg-white text-emerald-900 shadow-xs font-semibold' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Approved ({approvedItems.length})
                      </button>
                      <button
                        onClick={() => setStatusFilter('rejected')}
                        className={`px-2.5 py-1 rounded-md transition ${
                          statusFilter === 'rejected' 
                            ? 'bg-white text-slate-800 shadow-xs font-semibold' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Rejected ({rejectedItems.length})
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search candidate items..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition placeholder:text-slate-400"
                      />
                    </div>

                    <div className="relative flex items-center">
                      <Users className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                      <select
                        value={assigneeFilter}
                        onChange={(e) => setAssigneeFilter(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-slate-700 cursor-pointer appearance-none"
                      >
                        <option value="all">All Assignees</option>
                        <option value="unassigned">⚠️ Unassigned Only ({unassignedPendingItems.length})</option>
                        {members.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {unassignedPendingItems.length > 0 && statusFilter !== 'approved' && statusFilter !== 'rejected' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center justify-between text-xs text-amber-900">
                      <div className="flex items-center gap-1.5 font-medium">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>
                          {unassignedPendingItems.length} candidate item(s) require an assignee before approval.
                        </span>
                      </div>
                      <button
                        onClick={() => setAssigneeFilter('unassigned')}
                        className="text-[11px] font-semibold underline hover:text-amber-950"
                      >
                        Filter unassigned
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                  {filteredCandidates.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 space-y-2">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="text-xs font-medium text-slate-600">
                        No candidate items found for current filter.
                      </p>
                      <button
                        onClick={() => {
                          setStatusFilter('all');
                          setSearchFilter('');
                          setAssigneeFilter('all');
                        }}
                        className="text-xs text-indigo-600 hover:underline font-semibold"
                      >
                        Reset all filters
                      </button>
                    </div>
                  ) : (
                    filteredCandidates.map((item) => (
                      <ActionItemReviewCard
                        key={item.id}
                        item={item}
                        members={members}
                        isSelected={selectedCandidateId === item.id}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onRevert={handleRevert}
                        onUpdate={handleUpdate}
                        onJumpToTranscript={handleJumpToTranscript}
                      />
                    ))
                  )}
                </div>

                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">
                    Showing {filteredCandidates.length} of {candidates.length} items
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-700 font-semibold">
                      {approvedItems.length} Approved
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-amber-700 font-semibold">
                      {pendingItems.length} Pending
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-rose-700 font-semibold">
                      {rejectedItems.length} Rejected
                    </span>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      </main>

      {/* MODAL: ASSIGN TASK TO WORKSPACE PARTICIPANT */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Assign Task to Participant</h3>
                  <p className="text-xs text-slate-500">Manual task assignment (No-AI private meeting)</p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualTask} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prepare confidential audit spreadsheet"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Assignee (Workspace Member)
                  </label>
                  <select
                    value={taskAssigneeId}
                    onChange={(e) => setTaskAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.id} value={m.user_id || m.id}>
                        {m.full_name} ({m.role.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Priority
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Due Date
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Description / Context (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Details, expectations, or background from the meeting..."
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>This task will be synced directly to the Kanban board under your workspace.</span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {isAssigning ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Assigning...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Assign Task</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingReview;
