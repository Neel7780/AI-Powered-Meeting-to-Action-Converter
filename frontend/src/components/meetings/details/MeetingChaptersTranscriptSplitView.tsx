import React, { useState } from 'react';
import { Bookmark, Mic, SplitSquareVertical } from 'lucide-react';
import { MeetingChaptersTab } from './MeetingChaptersTab';
import { MeetingTranscriptTab } from './MeetingTranscriptTab';
import type { MeetingChapter } from '../../../types/meetingDetails';
import type { TranscriptSegment, ActionItemCandidate } from '../../../types/review';

interface SplitViewProps {
  chapters: MeetingChapter[];
  segments: TranscriptSegment[];
  playbackSeconds: number;
  highlightedTimestamp?: string | null;
  highlightedSegmentId?: string | null;
  onSeek?: (seconds: number) => void;
  onSelectTimestamp?: (timestamp: string, segmentId?: string, seconds?: number) => void;
  candidates?: ActionItemCandidate[];
  onOpenActionItem?: (candidateId: string) => void;
}

export const MeetingChaptersTranscriptSplitView: React.FC<SplitViewProps> = ({
  chapters,
  segments,
  playbackSeconds,
  highlightedTimestamp,
  highlightedSegmentId,
  onSeek,
  onSelectTimestamp,
  candidates = [],
  onOpenActionItem
}) => {
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [currentHighlightedTimestamp, setCurrentHighlightedTimestamp] = useState<string | null>(
    highlightedTimestamp || null
  );
  const [currentHighlightedSegmentId, setCurrentHighlightedSegmentId] = useState<string | null>(
    highlightedSegmentId || null
  );

  const handleSelectChapter = (chapter: MeetingChapter) => {
    setActiveChapterId(chapter.id);
    setCurrentHighlightedTimestamp(chapter.timestamp);

    // Find first segment in that chapter
    const matchingSegment = segments.find(
      (s) => s.start_seconds >= chapter.start_seconds || s.timestamp === chapter.timestamp
    );
    if (matchingSegment) {
      setCurrentHighlightedSegmentId(matchingSegment.id);
    } else {
      setCurrentHighlightedSegmentId(null);
    }

    if (onSeek) {
      onSeek(chapter.start_seconds);
    }
  };

  const handleNavigateToTranscript = (timestamp: string, segmentId?: string, seconds?: number) => {
    setCurrentHighlightedTimestamp(timestamp);
    if (segmentId) {
      setCurrentHighlightedSegmentId(segmentId);
    } else {
      const match = segments.find((s) => s.timestamp === timestamp || (seconds !== undefined && s.start_seconds >= seconds));
      if (match) setCurrentHighlightedSegmentId(match.id);
    }

    if (onSelectTimestamp) {
      onSelectTimestamp(timestamp, segmentId, seconds);
    }
    if (seconds !== undefined && onSeek) {
      onSeek(seconds);
    }
  };

  const handleTranscriptTimestampSelect = (timestamp: string, segmentId?: string, seconds?: number) => {
    setCurrentHighlightedTimestamp(timestamp);
    if (segmentId) setCurrentHighlightedSegmentId(segmentId);

    // Sync active chapter on left
    if (seconds !== undefined) {
      for (let i = chapters.length - 1; i >= 0; i--) {
        if (seconds >= chapters[i].start_seconds) {
          setActiveChapterId(chapters[i].id);
          break;
        }
      }
    }

    if (onSelectTimestamp) {
      onSelectTimestamp(timestamp, segmentId, seconds);
    }
    if (seconds !== undefined && onSeek) {
      onSeek(seconds);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Split View Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <SplitSquareVertical className="size-4 text-teal-400" />
          <h3 className="text-xs sm:text-sm font-semibold text-white">
            Combined Chapters & Transcript Split View
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30">
            Interactive Sync
          </span>
        </div>
        <span className="text-[11px] text-neutral-400 hidden sm:inline">
          Click any chapter node on the left to scrub dialogue on the right
        </span>
      </div>

      {/* Two-Pane Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[560px]">
        {/* Left Panel: Meeting Chapters */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl border border-white/10 bg-[#0c0e14] overflow-hidden shadow-xl">
          <div className="px-4 py-3 border-b border-white/10 bg-[#10131a] flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-teal-300">
              <Bookmark className="size-3.5 text-teal-400" />
              Meeting Chapters Timeline
            </span>
            <span className="text-[10px] font-mono text-neutral-400">
              {chapters.length} topics
            </span>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
            <MeetingChaptersTab
              chapters={chapters}
              playbackSeconds={playbackSeconds}
              onSelectChapter={handleSelectChapter}
              onNavigateToTranscript={handleNavigateToTranscript}
              selectedChapterId={activeChapterId}
            />
          </div>
        </div>

        {/* Right Panel: Meeting Transcript */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl border border-white/10 bg-[#0c0e14] overflow-hidden shadow-xl">
          <div className="px-4 py-3 border-b border-white/10 bg-[#10131a] flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-teal-300">
              <Mic className="size-3.5 text-teal-400" />
              Synchronized Transcript Dialogue
            </span>
            <span className="text-[10px] font-mono text-neutral-400">
              {segments.length} segments
            </span>
          </div>

          <div className="flex-1 overflow-hidden">
            <MeetingTranscriptTab
              segments={segments}
              playbackSeconds={playbackSeconds}
              highlightedTimestamp={currentHighlightedTimestamp}
              highlightedSegmentId={currentHighlightedSegmentId}
              chapters={chapters}
              onSeek={onSeek}
              onSelectTimestamp={handleTranscriptTimestampSelect}
              candidates={candidates}
              onOpenActionItem={onOpenActionItem}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

