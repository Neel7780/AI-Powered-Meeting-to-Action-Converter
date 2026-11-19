import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MeetingDetailsSidebar } from '../components/meetings/details/MeetingDetailsSidebar';
import { MeetingTopNav } from '../components/meetings/details/MeetingTopNav';
import { MeetingVideoPlayer } from '../components/meetings/details/MeetingVideoPlayer';
import { MeetingTimelineMultiTrack } from '../components/meetings/details/MeetingTimelineMultiTrack';
import { MeetingRightPanel } from '../components/meetings/details/MeetingRightPanel';
import { MeetingShareModal } from '../components/meetings/details/MeetingShareModal';
import { meetingDetailsService } from '../services/meetingDetailsService';

import type { TranscriptSegment, ActionItemCandidate } from '../types/review';
import type { RichMeetingDetails } from '../types/meetingDetails';

export const MeetingDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [meeting, setMeeting] = useState<RichMeetingDetails | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [candidates, setCandidates] = useState<ActionItemCandidate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Transcript navigation position; recording playback is unavailable.
  const [playbackSeconds, setPlaybackSeconds] = useState<number>(0);
  const isPlaying = false;
  const [highlightedTimestamp, setHighlightedTimestamp] = useState<string | null>(null);
  const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null);

  const [splitView, setSplitView] = useState<boolean>(false);
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Fetch real meeting data if ID is passed
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setMeeting(null); setError(null); setIsLoading(true);
      try {
        const result = await meetingDetailsService.loadMeetingStudioData(id || '');
        if (isMounted) {
          setMeeting(result.meeting);
          setTranscript(result.transcript);
          setCandidates(result.candidates);
        }
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : 'Unable to load meeting.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();
  return () => {
      isMounted = false;
    };
  }, [id]);

  const handleSeek = (newSeconds: number) => {
    setPlaybackSeconds(newSeconds);
    // Find closest segment to highlight by time distance
    let closest = transcript[0];
    let minDiff = Infinity;
    for (const seg of transcript) {
      const diff = Math.abs(seg.start_seconds - newSeconds);
      if (diff < minDiff) {
        minDiff = diff;
        closest = seg;
      }
    }
    if (closest && minDiff <= 30) {
      setHighlightedTimestamp(closest.timestamp);
      setHighlightedSegmentId(closest.id);
    }
  };

  const handleSelectTimestamp = (timestamp: string, segmentId?: string, seconds?: number) => {
    let found = segmentId ? transcript.find((s) => s.id === segmentId) : undefined;
    if (!found) {
      found = transcript.find((s) => s.timestamp === timestamp);
    }
    if (!found && seconds !== undefined) {
      let minDiff = Infinity;
      for (const seg of transcript) {
        const diff = Math.abs(seg.start_seconds - seconds);
        if (diff < minDiff) {
          minDiff = diff;
          found = seg;
        }
      }
    }

    if (found) {
      setPlaybackSeconds(found.start_seconds);
      setHighlightedTimestamp(found.timestamp);
      setHighlightedSegmentId(found.id);
    } else {
      if (seconds !== undefined) {
        setPlaybackSeconds(seconds);
      }
      setHighlightedTimestamp(timestamp);
      setHighlightedSegmentId(null);
    }
  };

  if (isLoading) return <div className="p-6" role="status">Loading meeting details…</div>;
  if (error || !meeting) return <div className="p-6" role="alert">{error || 'Meeting not found'}</div>;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0c10] text-slate-100 font-sans">
      {/* Desktop Left Sidebar (Matching Screenshot) */}
      <div className="hidden lg:block shrink-0 h-full">
        <MeetingDetailsSidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-64 h-full bg-[#0d0f12]">
            <MeetingDetailsSidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Studio Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header & Breadcrumbs */}
        <MeetingTopNav
          meeting={meeting}
          onOpenShare={() => setIsShareOpen(true)}
          onToggleMobileMenu={() => setMobileSidebarOpen(true)}
          splitView={splitView}
          onToggleSplitView={() => setSplitView(!splitView)}
        />

        {/* Studio Content Grid */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5">
          {isLoading && (
            <div className="mb-2 text-center text-xs text-teal-400">
              Loading meeting details...
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full max-w-[1720px] mx-auto items-start">
            {/* Left Column (Video Player + Multi-Track Timeline) */}
            <div className="lg:col-span-6 xl:col-span-7 flex flex-col space-y-4">
              <MeetingVideoPlayer
                meeting={meeting}
                playbackSeconds={playbackSeconds}
                onSeek={handleSeek}
                isPlaying={isPlaying}
                onTogglePlay={() => {}}
              />

              <MeetingTimelineMultiTrack
                meeting={meeting}
                playbackSeconds={playbackSeconds}
                onSeek={handleSeek}
                onSelectTimestamp={handleSelectTimestamp}
              />
            </div>

            {/* Right Column (Summary, Chapters & Transcript) */}
            <div className="lg:col-span-6 xl:col-span-5 h-[calc(100vh-5.5rem)] min-h-[580px]">
              <MeetingRightPanel
                meeting={meeting}
                transcript={transcript}
                candidates={candidates}
                playbackSeconds={playbackSeconds}
                highlightedTimestamp={highlightedTimestamp}
                highlightedSegmentId={highlightedSegmentId}
                onSeek={handleSeek}
                onSelectTimestamp={handleSelectTimestamp}
                splitView={splitView}
                onToggleSplitView={() => setSplitView(!splitView)}
              />
            </div>
          </div>
        </main>
      </div>

      {/* Share Modal */}
      <MeetingShareModal
        meeting={meeting}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </div>
  );
};

export default MeetingDetailsPage;
