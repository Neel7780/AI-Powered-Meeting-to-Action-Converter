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
  Search 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { 
  ActionItemCandidate, 
  MeetingDetails, 
  TranscriptSegment, 
  WorkspaceMember 
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
  meetingId = 'mtg-sprint-102',
  onNavigateBack,
  onNavigateToKanban
}) => {
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<MeetingDetails | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [candidates, setCandidates] = useState<ActionItemCandidate[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  const [activeTimestamp, setActiveTimestamp] = useState<string | null>(null);
  const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'warning' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [mtgData, transData, candData, memData] = await Promise.all([
        reviewApi.fetchMeetingDetails(meetingId),
        reviewApi.fetchTranscript(meetingId),
        reviewApi.fetchActionItemCandidates(meetingId),
        reviewApi.fetchWorkspaceMembers('ws-team-10')
      ]);

      setMeeting(mtgData);
      setTranscript(transData);
      setCandidates(candData);
      setMembers(memData);
    } catch (err) {
      console.error('Failed to load meeting review workspace data:', err);
      showToast('Error loading meeting data', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [meetingId]);

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

  const handleApprove = async (id: string) => {
    try {
      const updated = await reviewApi.approveActionItem(id, meetingId);
      setCandidates(prev => prev.map(c => c.id === id ? updated : c));
      showToast(`Approved "${updated.title.slice(0, 32)}..."`, 'success');
    } catch (err) {
      console.error('Approve failed:', err);
      showToast('Failed to approve action item', 'warning');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const updated = await reviewApi.rejectActionItem(id, meetingId);
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
      const updatedList = await reviewApi.approveAllActionItems(meetingId, eligibleIds);
      setCandidates(updatedList);
      showToast(`Batch approved ${eligibleIds.length} assigned action items!`, 'success');
      return;
    }

    if (pendingItems.length === 0) {
      showToast('No pending action items to approve', 'info');
      return;
    }

    try {
      const updatedList = await reviewApi.approveAllActionItems(meetingId);
      setCandidates(updatedList);
      showToast(`Successfully approved all ${pendingItems.length} pending action items!`, 'success');
    } catch (err) {
      console.error('Batch approve failed:', err);
      showToast('Failed to batch approve action items', 'warning');
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
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    FE 4: Staging Gate
                  </span>
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

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-3">
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
      </div>

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 flex-1 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
          <div className="lg:col-span-5 xl:col-span-5 h-[calc(100vh-14rem)] min-h-[500px]">
            <TranscriptViewer
              segments={transcript}
              activeTimestamp={activeTimestamp}
              highlightedSegmentId={highlightedSegmentId}
              onSelectTimestamp={handleSelectTranscriptTimestamp}
              actionItemSegmentIds={actionItemSegmentIds}
            />
          </div>

          <div className="lg:col-span-7 xl:col-span-7 flex flex-col h-[calc(100vh-14rem)] min-h-[500px] bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
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

        </div>
      </main>
    </div>
  );
};

export default MeetingReview;
