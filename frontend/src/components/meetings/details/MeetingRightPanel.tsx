import React, { useState } from 'react';
import { FileText, Bookmark, Mic, Columns, LayoutGrid } from 'lucide-react';
import { MeetingSummaryTab } from './MeetingSummaryTab';
import { MeetingChaptersTab } from './MeetingChaptersTab';
import { MeetingTranscriptTab } from './MeetingTranscriptTab';
import type { RichMeetingDetails, MeetingChapter } from '../../types/meetingDetails';
import type { TranscriptSegment, ActionItemCandidate } from '../../types/review';

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
  const [activeTab, setActiveTab] = useState<'summary' | 'chapters' | 'transcript'>('transcript');

  const handleSelectChapter = (chapter: MeetingChapter) => {
    onSeek(chapter.start_seconds);
  };

  const handleNavigateToTranscript = (timestamp: string, segmentId?: string, seconds?: number) => {
    onSelectTimestamp(timestamp, segmentId, seconds);
    if (!splitView) {
      setActiveTab('transcript');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0f14] rounded-2xl border border-[#202531] shadow-xl overflow-hidden">
      {/* Top Main Tab Navigation (Matching Screenshot Tabs) */}
      <div className="flex items-center justify-between p-2.5 border-b border-[#1f2430] bg-[#10131a] select-none">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
          {/* Summary Tab Button */}
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-medium transition ${
              activeTab === 'summary' && !splitView
                ? 'bg-[#1e2330] text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a23]'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Summary</span>
          </button>

          {/* Chapters Tab Button */}
          <button
            onClick={() => setActiveTab('chapters')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-medium transition ${
              activeTab === 'chapters' && !splitView
                ? 'bg-[#1e2330] text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a23]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-slate-400" />
            <span>Chapters</span>
          </button>

          {/* Transcript Tab Button */}
          <button
            onClick={() => setActiveTab('transcript')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-medium transition ${
              activeTab === 'transcript' && !splitView
                ? 'bg-[#1e2330] text-white font-semibold shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a23]'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-teal-400" />
            <span>Transcript</span>
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
          title="Display meeting transcript alongside the summary"
        >
          <Columns className="w-3 h-3" />
          <span>{splitView ? 'Single View' : 'Side-by-Side'}</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        {splitView ? (
          /* Side-by-side view (Summary alongside Transcript) */
          <div className="grid grid-cols-2 h-full divide-x divide-[#1e2330]">
            <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
              <MeetingSummaryTab
                summary={meeting.summary}
                candidates={candidates}
                onSelectTimestamp={handleNavigateToTranscript}
                onJumpToCandidate={onSelectTimestamp}
              />
            </div>
            <div className="h-full overflow-hidden">
              <MeetingTranscriptTab
                segments={transcript}
                playbackSeconds={playbackSeconds}
                highlightedTimestamp={highlightedTimestamp}
                highlightedSegmentId={highlightedSegmentId}
                onSeek={onSeek}
                candidates={candidates}
              />
            </div>
          </div>
        ) : (
          /* Single Tab View */
          <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
            {activeTab === 'summary' && (
              <MeetingSummaryTab
                summary={meeting.summary}
                candidates={candidates}
                onSelectTimestamp={handleNavigateToTranscript}
                onJumpToCandidate={onSelectTimestamp}
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
                onSeek={onSeek}
                candidates={candidates}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
