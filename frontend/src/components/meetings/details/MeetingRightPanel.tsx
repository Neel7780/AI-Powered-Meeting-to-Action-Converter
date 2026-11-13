import React, { useState } from 'react';
import { FileText, Bookmark, Mic, Columns, GitFork, SplitSquareVertical, ArrowRight, User, Clock } from 'lucide-react';
import { MeetingSummaryTab } from './MeetingSummaryTab';
import { MeetingChaptersTab } from './MeetingChaptersTab';
import { MeetingTranscriptTab } from './MeetingTranscriptTab';
import { MeetingChaptersTranscriptSplitView } from './MeetingChaptersTranscriptSplitView';
import type { RichMeetingDetails, MeetingChapter } from '../../../types/meetingDetails';
import type { TranscriptSegment, ActionItemCandidate } from '../../../types/review';

interface RightPanelProps {
  meeting: RichMeetingDetails;
  transcript: TranscriptSegment[];
  candidates: ActionItemCandidate[];
  playbackSeconds: number;
  highlightedTimestamp: string | null;
  highlightedSegmentId?: string | null;
  onSeek: (seconds: number) => void;
  onSelectTimestamp: (timestamp: string, segmentId?: string, seconds?: number) => void;
  splitView: boolean;
  onToggleSplitView: () => void;
}

export const MeetingRightPanel: React.FC<RightPanelProps> = ({
  meeting,
  transcript,
  candidates,
  playbackSeconds,
  highlightedTimestamp,
  highlightedSegmentId,
  onSeek,
  onSelectTimestamp,
  splitView,
  onToggleSplitView
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'chapters' | 'transcript' | 'split' | 'tasks'>('summary');

  const handleSelectChapter = (chapter: MeetingChapter) => {
    onSeek(chapter.start_seconds);
  };

  const handleNavigateToTranscript = (timestamp: string, segmentId?: string, seconds?: number) => {
    onSelectTimestamp(timestamp, segmentId, seconds);
    if (!splitView && activeTab !== 'split') {
      setActiveTab('transcript');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0f14] rounded-2xl border border-[#202531] shadow-xl overflow-hidden">
      {/* Top Main Tab Navigation */}
      <div className="flex items-center justify-between p-2.5 border-b border-[#1f2430] bg-[#10131a] select-none">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
          {/* 1. Summary Tab */}
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-medium transition ${
              activeTab === 'summary' && !splitView
                ? 'bg-[#1e2330] text-teal-300 font-semibold shadow-xs border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a23]'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-teal-400" />
            <span>Summary</span>
          </button>

          {/* 2. Chapters Tab */}
          <button
            onClick={() => setActiveTab('chapters')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-medium transition ${
              activeTab === 'chapters' && !splitView
                ? 'bg-[#1e2330] text-teal-300 font-semibold shadow-xs border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a23]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-teal-400" />
            <span>Chapters</span>
            {meeting.chapters.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-teal-950 text-teal-300 border border-teal-800/40">
                {meeting.chapters.length}
              </span>
            )}
          </button>

          {/* 3. Transcript Tab */}
          <button
            onClick={() => setActiveTab('transcript')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-medium transition ${
              activeTab === 'transcript' && !splitView
                ? 'bg-[#1e2330] text-teal-300 font-semibold shadow-xs border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a23]'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-teal-400" />
            <span>Transcript</span>
            {transcript.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                {transcript.length}
              </span>
            )}
          </button>

          {/* 4. Split View Tab (Chapters + Transcript) */}
          <button
            onClick={() => setActiveTab('split')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-medium transition ${
              activeTab === 'split' && !splitView
                ? 'bg-[#1e2330] text-teal-300 font-semibold shadow-xs border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a23]'
            }`}
          >
            <SplitSquareVertical className="w-3.5 h-3.5 text-teal-400" />
            <span>Split View</span>
          </button>

          {/* 5. Tasks Tab */}
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-medium transition ${
              activeTab === 'tasks' && !splitView
                ? 'bg-[#1e2330] text-indigo-300 font-semibold shadow-xs border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a23]'
            }`}
          >
            <GitFork className="w-3.5 h-3.5 text-indigo-400" />
            <span>Tasks</span>
            {candidates.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/40">
                {candidates.length}
              </span>
            )}
          </button>
        </div>

        {/* Side-by-side split button */}
        <button
          onClick={onToggleSplitView}
          className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
            splitView
              ? 'bg-teal-950/60 text-teal-300 border-teal-800/50'
              : 'bg-[#161a22] text-slate-400 border-[#262c3a] hover:text-white'
          }`}
          title="Toggle side-by-side split view"
        >
          <Columns className="w-3 h-3" />
          <span>{splitView ? 'Single View' : 'Side-by-Side'}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {splitView || activeTab === 'split' ? (
          /* Combined Chapters + Transcript Split View (Phase 5) */
          <div className="h-full p-3 sm:p-4 overflow-hidden">
            <MeetingChaptersTranscriptSplitView
              chapters={meeting.chapters}
              segments={transcript}
              playbackSeconds={playbackSeconds}
              highlightedTimestamp={highlightedTimestamp}
              highlightedSegmentId={highlightedSegmentId}
              onSeek={onSeek}
              onSelectTimestamp={onSelectTimestamp}
              candidates={candidates}
            />
          </div>
        ) : (
          /* Standalone Tab Views */
          <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
            {activeTab === 'summary' && (
              <MeetingSummaryTab
                summary={meeting.summary}
                candidates={candidates}
                onSelectTimestamp={handleNavigateToTranscript}
                onJumpToCandidate={(candidateId) => onSelectTimestamp('', candidateId)}
              />
            )}

            {activeTab === 'chapters' && (
              <MeetingChaptersTab
                chapters={meeting.chapters}
                playbackSeconds={playbackSeconds}
                onSelectChapter={handleSelectChapter}
                onNavigateToTranscript={handleNavigateToTranscript}
              />
            )}

            {activeTab === 'transcript' && (
              <MeetingTranscriptTab
                segments={transcript}
                playbackSeconds={playbackSeconds}
                highlightedTimestamp={highlightedTimestamp}
                highlightedSegmentId={highlightedSegmentId}
                chapters={meeting.chapters}
                onSeek={onSeek}
                onSelectTimestamp={handleNavigateToTranscript}
                candidates={candidates}
              />
            )}

            {activeTab === 'tasks' && (
              <div className="p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#202531]">
                  <div className="flex items-center gap-2">
                    <GitFork className="w-4 h-4 text-indigo-400" />
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Extracted Action Items ({candidates.length})
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Grounded commitments with verbatim transcript quotes
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {candidates.map((cand) => (
                    <div
                      key={cand.id}
                      className="p-3.5 rounded-xl bg-[#131620] border border-[#222838] hover:border-indigo-500/40 transition space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <span className="mt-1 size-2 rounded-full bg-indigo-400 shrink-0" />
                          <h4 className="text-xs font-semibold text-white leading-snug">{cand.title}</h4>
                        </div>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md capitalize shrink-0 ${
                          cand.status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : cand.status === 'rejected'
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}>
                          {cand.status}
                        </span>
                      </div>

                      {cand.description && cand.description !== cand.title && (
                        <p className="text-[11px] text-slate-400 pl-4">{cand.description}</p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-[11px] pl-4">
                        <div className="flex items-center gap-3 text-slate-400">
                          <span className="flex items-center gap-1 text-slate-300">
                            <User className="size-3 text-slate-500" />
                            {cand.assignee?.full_name || 'Unassigned'}
                          </span>
                          {cand.due_date && (
                            <span className="flex items-center gap-1 text-neutral-400">
                              <Clock className="size-3 text-neutral-500" />
                              {cand.due_date}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleNavigateToTranscript(cand.transcript_timestamp, cand.transcript_segment_id)}
                          className="flex items-center gap-1 text-teal-400 hover:text-teal-300 text-xs font-mono transition"
                          title="Jump to quote in transcript"
                        >
                          <span>{cand.transcript_timestamp}</span>
                          <ArrowRight className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
