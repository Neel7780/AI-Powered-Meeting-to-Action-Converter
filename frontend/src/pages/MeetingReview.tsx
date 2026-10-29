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
  LoaderCircle,
  ShieldCheck,
  Search
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  ActionItemCandidate,
  MeetingDetails,
  TranscriptSegment,
  WorkspaceMember
} from '../types/review';
import { reviewApi } from '../services/reviewApi';
import { TranscriptViewer } from '../components/review/TranscriptViewer';
import { ActionItemReviewCard } from '../components/review/ActionItemReviewCard';
import { Button } from '../components/ui/button';

interface MeetingReviewProps {
  meetingId?: string;
  onNavigateBack?: () => void;
  onNavigateToKanban?: () => void;
}

export const MeetingReview: React.FC<MeetingReviewProps> = ({
  meetingId: meetingIdProp,
  onNavigateBack,
  onNavigateToKanban
}) => {
  const navigate = useNavigate();
  const { id: routeMeetingId } = useParams();
  const meetingId = meetingIdProp || routeMeetingId || 'mtg-sprint-102';
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
      const [mtgData, transData] = await Promise.all([
        reviewApi.fetchMeetingDetails(meetingId),
        reviewApi.fetchTranscript(meetingId)
      ]);
      const memData = await reviewApi.fetchWorkspaceMembers(mtgData.workspace_id);
      const candData = await reviewApi.fetchActionItemCandidates(meetingId, memData);

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
      const item = candidates.find(c => c.id === id);
      if (!item) return;
      const [updated] = await reviewApi.approveActionItems(meetingId, [item]);
      setCandidates(prev => prev.map(c => c.id === id ? updated : c));
      showToast(`Approved "${updated.title.slice(0, 32)}..."`, 'success');
    } catch (err) {
      console.error('Approve failed:', err);
      showToast(`Failed to approve: ${(err as Error).message}`, 'warning');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const item = candidates.find(c => c.id === id);
      if (!item) return;
      const updated = await reviewApi.rejectActionItem(meetingId, item);
      setCandidates(prev => prev.map(c => c.id === id ? updated : c));
      showToast(`Rejected item`, 'info');
    } catch (err) {
      console.error('Reject failed:', err);
      showToast(`Failed to reject: ${(err as Error).message}`, 'warning');
    }
  };

  const handleRevert = async (id: string) => {
    try {
      const updated = await reviewApi.revertActionItem(id);
      setCandidates(prev => prev.map(c => c.id === id ? updated : c));
      showToast(`Reverted back to pending review`, 'info');
    } catch (err) {
      console.error('Revert failed:', err);
      showToast((err as Error).message, 'warning');
    }
  };

  const handleUpdate = async (id: string, updates: Partial<ActionItemCandidate>) => {
    try {
      const item = candidates.find(c => c.id === id);
      if (!item) return;
      const updated = await reviewApi.editActionItem(item, updates, members);
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
      const eligible = pendingItems.filter(c => c.assignee_id);
      if (eligible.length === 0) {
        showToast('Please assign owners to pending items before approving', 'warning');
        return;
      }
      await approveBatch(eligible);
      return;
    }

    if (pendingItems.length === 0) {
      showToast('No pending action items to approve', 'info');
      return;
    }

    await approveBatch(pendingItems);
  };

  const approveBatch = async (items: ActionItemCandidate[]) => {
    try {
      const updated = await reviewApi.approveActionItems(meetingId, items);
      const byId = new Map(updated.map(u => [u.id, u]));
      setCandidates(prev => prev.map(c => byId.get(c.id) || c));
      showToast(`Approved ${updated.length} action item(s)`, 'success');
    } catch (err) {
      console.error('Batch approve failed:', err);
      showToast(`Failed to approve: ${(err as Error).message}`, 'warning');
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

  const statusTabs = [
    ['all', 'All', candidates.length],
    ['pending', 'Pending', pendingItems.length],
    ['approved', 'Approved', approvedItems.length],
    ['rejected', 'Rejected', rejectedItems.length],
  ] as const;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-black text-sm text-neutral-500">
        <LoaderCircle className="size-4 animate-spin" />
        Loading meeting review…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      {toastMessage && (
        <div
          role="status"
          className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-md border border-white/15 bg-[#0a0a0c] px-4 py-2.5 text-xs font-medium text-white shadow-2xl"
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="size-4 text-emerald-400" />}
          {toastMessage.type === 'warning' && <AlertCircle className="size-4 text-amber-400" />}
          {toastMessage.type === 'info' && <Clock className="size-4 text-neutral-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={goBack}
                title="Back to meetings"
                aria-label="Back to meetings"
              >
                <ArrowLeft />
              </Button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="eyebrow">Review gate</span>
                  <span className="text-neutral-700">/</span>
                  <span className="truncate text-xs text-neutral-500">
                    {meeting?.organiser_name} (Organiser)
                  </span>
                </div>
                <h1 className="truncate text-base font-medium tracking-tight text-white sm:text-lg">
                  {meeting?.title}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:shrink-0">
              <div className="hidden items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs sm:flex">
                <span className="text-neutral-500">Review:</span>
                <span className="font-medium text-white">
                  {approvedItems.length} approved · {pendingItems.length} pending
                </span>
                <div className="ml-1 h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                title="Reset demo items back to original state"
              >
                <RotateCcw />
                <span className="hidden md:inline">Reset</span>
              </Button>

              <Button
                size="sm"
                onClick={handleApproveAll}
                disabled={pendingItems.length === 0}
                title="Approve all eligible pending action items in batch"
              >
                <CheckCheck />
                Approve all ({pendingItems.length})
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={goKanban}
                title="View published tasks on the task board"
              >
                <Layers />
                Task board
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-neutral-300">
            <Sparkles className="size-4 shrink-0 text-amber-400" />
            <span>
              <strong className="font-medium text-white">AI attestation:</strong> AI-generated suggestions. Verify before publishing.
            </span>
          </div>
          <div className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-500 sm:flex">
            <ShieldCheck className="size-3.5 text-emerald-400" />
            <span>Human approval required</span>
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid flex-1 grid-cols-1 items-start gap-5 lg:grid-cols-12">
          <div className="h-[calc(100vh-14rem)] min-h-[500px] lg:col-span-5">
            <TranscriptViewer
              segments={transcript}
              activeTimestamp={activeTimestamp}
              highlightedSegmentId={highlightedSegmentId}
              onSelectTimestamp={handleSelectTranscriptTimestamp}
              actionItemSegmentIds={actionItemSegmentIds}
            />
          </div>

          <div className="panel flex h-[calc(100vh-14rem)] min-h-[500px] flex-col overflow-hidden lg:col-span-7">
            <div className="space-y-3 border-b border-white/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-white">
                    Candidate action items
                  </h2>
                  <span className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300">
                    {candidates.length} total
                  </span>
                </div>

                <div className="inline-flex rounded-md border border-white/10 bg-white/[0.02] p-0.5 text-xs">
                  {statusTabs.map(([value, label, count]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatusFilter(value)}
                      aria-pressed={statusFilter === value}
                      className={`rounded px-2.5 py-1 font-medium transition-colors ${
                        statusFilter === value
                          ? 'bg-white text-black'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    aria-label="Search candidate items"
                    placeholder="Search candidate items..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="field h-8 py-0 pl-8 text-xs"
                  />
                </div>

                <div className="relative">
                  <Users className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
                  <select
                    aria-label="Filter by assignee"
                    value={assigneeFilter}
                    onChange={(e) => setAssigneeFilter(e.target.value)}
                    className="field h-8 cursor-pointer py-0 pl-8 text-xs"
                  >
                    <option value="all">All assignees</option>
                    <option value="unassigned">Unassigned only ({unassignedPendingItems.length})</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {unassignedPendingItems.length > 0 && statusFilter !== 'approved' && statusFilter !== 'rejected' && (
                <div className="flex items-center justify-between gap-2 rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-neutral-300">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="size-4 shrink-0 text-amber-400" />
                    <span>
                      {unassignedPendingItems.length} candidate item(s) require an assignee before approval.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAssigneeFilter('unassigned')}
                    className="shrink-0 font-medium text-amber-400 underline-offset-4 hover:underline"
                  >
                    Filter unassigned
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {filteredCandidates.length === 0 ? (
                <div className="space-y-2 py-16 text-center">
                  <CheckCircle2 className="mx-auto size-8 text-neutral-700" />
                  <p className="text-xs font-medium text-neutral-400">
                    No candidate items found for current filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('all');
                      setSearchFilter('');
                      setAssigneeFilter('all');
                    }}
                    className="text-xs font-medium text-white underline-offset-4 hover:underline"
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

            <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-xs text-neutral-500">
              <span>
                Showing {filteredCandidates.length} of {candidates.length} items
              </span>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span className="text-emerald-400">
                  {approvedItems.length} approved
                </span>
                <span className="text-neutral-700">|</span>
                <span className="text-amber-400">
                  {pendingItems.length} pending
                </span>
                <span className="text-neutral-700">|</span>
                <span className="text-red-400">
                  {rejectedItems.length} rejected
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
