import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Edit3, 
  Copy, 
  Check, 
  Clock, 
  Sparkles, 
  X, 
  CheckCircle2 
} from 'lucide-react';
import type { TranscriptSegment, ActionItemCandidate } from '../../../types/review';

interface TranscriptTabProps {
  segments: TranscriptSegment[];
  playbackSeconds: number;
  highlightedTimestamp?: string | null;
  highlightedSegmentId?: string | null;
  onSeek: (seconds: number) => void;
  candidates?: ActionItemCandidate[];
  onOpenActionItem?: (candidateId: string) => void;
}

export const MeetingTranscriptTab: React.FC<TranscriptTabProps> = ({
  segments,
  playbackSeconds,
  highlightedTimestamp,
  highlightedSegmentId,
  onSeek,
  candidates = [],
  onOpenActionItem
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');
  const [editableSegments, setEditableSegments] = useState<TranscriptSegment[]>(segments);

  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setEditableSegments(segments);
  }, [segments]);

  // Extract unique speakers
  const speakers = useMemo(() => {
    return Array.from(new Set(segments.map((s) => s.speaker_name)));
  }, [segments]);

  // Map candidates to segments
  const candidateBySegment = useMemo(() => {
    const map = new Map<string, ActionItemCandidate[]>();
    candidates.forEach((cand) => {
      if (cand.transcript_segment_id) {
        const list = map.get(cand.transcript_segment_id) || [];
        list.push(cand);
        map.set(cand.transcript_segment_id, list);
      }
    });
    return map;
  }, [candidates]);

  // Filtered segments by speaker & search query
  const filteredSegments = useMemo(() => {
    return editableSegments.filter((seg) => {
      const matchSpeaker =
        selectedSpeaker === 'all' || seg.speaker_name === selectedSpeaker;
      const matchSearch =
        searchQuery.trim() === '' ||
        seg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        seg.speaker_name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSpeaker && matchSearch;
    });
  }, [editableSegments, selectedSpeaker, searchQuery]);

  // Auto-scroll to active playing segment or highlighted timestamp
  useEffect(() => {
    const activeId = highlightedSegmentId;
    if (activeId && segmentRefs.current[activeId]) {
      segmentRefs.current[activeId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      return;
    }

    if (highlightedTimestamp) {
      const match = segments.find((s) => s.timestamp === highlightedTimestamp);
      if (match && segmentRefs.current[match.id]) {
        segmentRefs.current[match.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedSegmentId, highlightedTimestamp, segments]);

  const handleCopyFullTranscript = () => {
    const fullText = editableSegments
      .map((s) => `[${s.timestamp}] ${s.speaker_name}: ${s.text}`)
      .join('\n\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTextChange = (id: string, newText: string) => {
    setEditableSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text: newText } : s))
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0f14] text-slate-200 text-xs sm:text-[13px] select-none">
      {/* Search & Filter Header Bar */}
      <div className="p-3 sm:p-4 border-b border-[#1f2430] bg-[#10131a] space-y-2.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search transcript, speaker or phrase..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-[#151922] border border-[#242b38] rounded-xl text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Edit Mode Toggle Button */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
              isEditMode
                ? 'bg-amber-950/80 text-amber-300 border-amber-800/60 shadow-xs'
                : 'bg-[#151922] hover:bg-[#1d2330] text-slate-300 border-[#242b38]'
            }`}
            title="Edit speaker names or transcript text"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">{isEditMode ? 'Done' : 'Edit'}</span>
          </button>

          {/* Copy Full Transcript */}
          <button
            onClick={handleCopyFullTranscript}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151922] hover:bg-[#1d2330] border border-[#242b38] text-slate-300 hover:text-white text-xs font-medium transition"
            title="Copy whole transcript with timestamps"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden md:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Speaker Chips Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 text-[11px]">
          <span className="text-slate-400 font-medium mr-1 text-[10px] uppercase tracking-wider">
            Speakers:
          </span>

          <button
            onClick={() => setSelectedSpeaker('all')}
            className={`px-2.5 py-0.5 rounded-full border transition font-medium ${
              selectedSpeaker === 'all'
                ? 'bg-teal-500 text-slate-950 border-teal-400 font-bold'
                : 'bg-[#151821] text-slate-400 border-[#222734] hover:text-white hover:bg-[#1a202c]'
            }`}
          >
            All ({segments.length})
          </button>

          {speakers.map((spk) => {
            const count = segments.filter((s) => s.speaker_name === spk).length;
            const isSelected = selectedSpeaker === spk;

            return (
              <button
                key={spk}
                onClick={() => setSelectedSpeaker(spk)}
                className={`px-2.5 py-0.5 rounded-full border transition whitespace-nowrap ${
                  isSelected
                    ? 'bg-teal-500 text-slate-950 border-teal-400 font-bold'
                    : 'bg-[#151821] text-slate-300 border-[#222734] hover:text-white hover:bg-[#1a202c]'
                }`}
              >
                <span>{spk}</span>
                <span className="ml-1 opacity-70 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Transcript Dialogue List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 scrollbar-thin scrollbar-thumb-slate-800">
        {filteredSegments.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No matching transcript lines found for "{searchQuery}".
          </div>
        ) : (
          filteredSegments.map((seg) => {
            const isHighlighted =
              (highlightedSegmentId && seg.id === highlightedSegmentId) ||
              (!highlightedSegmentId && highlightedTimestamp === seg.timestamp);
            const isCurrentlyPlaying =
              playbackSeconds >= seg.start_seconds &&
              playbackSeconds < seg.start_seconds + 30;
            const linkedCandidates = candidateBySegment.get(seg.id) || [];

            return (
              <div
                key={seg.id}
                ref={(el) => {
                  segmentRefs.current[seg.id] = el;
                }}
                className={`transition duration-300 rounded-xl p-3 -mx-2 space-y-1.5 ${
                  isHighlighted
                    ? 'bg-teal-950/40 border border-teal-500/50 ring-1 ring-teal-500/30 shadow-md'
                    : isCurrentlyPlaying
                    ? 'bg-[#151a24] border-l-2 border-teal-400'
                    : 'hover:bg-[#13161f]'
                }`}
              >
                {/* Speaker Header with Clickable Timestamp */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs sm:text-[13px] tracking-tight">
                      {seg.speaker_name}:
                    </span>

                    <button
                      onClick={() => onSeek(seg.start_seconds)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:text-teal-300 hover:bg-[#1e2432] transition flex items-center gap-1 cursor-pointer"
                      title="Jump video to this timestamp"
                    >
                      <Clock className="w-2.5 h-2.5 text-slate-400" />
                      <span>{seg.timestamp}</span>
                    </button>
                  </div>

                  {linkedCandidates.length > 0 && (
                    <span className="text-[10px] font-semibold text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-800/50 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-teal-400" />
                      <span>{linkedCandidates.length} Action Item{linkedCandidates.length > 1 ? 's' : ''}</span>
                    </span>
                  )}
                </div>

                {/* Transcript Body Text (Editable or Read-Only) */}
                {isEditMode ? (
                  <textarea
                    value={seg.text}
                    onChange={(e) => handleTextChange(seg.id, e.target.value)}
                    rows={2}
                    className="w-full p-2 bg-[#171c26] text-slate-200 border border-[#2b3342] rounded-lg text-xs leading-relaxed focus:outline-none focus:border-teal-500"
                  />
                ) : (
                  <p className="text-slate-300 text-xs sm:text-[13px] leading-relaxed select-text">
                    {seg.text}
                  </p>
                )}

                {/* Staging Gate Candidate Badge below verbatim excerpt */}
                {linkedCandidates.length > 0 && (
                  <div className="pt-1.5 space-y-1.5">
                    {linkedCandidates.map((cand) => (
                      <div
                        key={cand.id}
                        className="p-2.5 rounded-lg bg-[#141b24] border border-teal-800/30 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                          <div className="truncate">
                            <span className="font-semibold text-slate-200 text-xs truncate">
                              {cand.title}
                            </span>
                            <span className="text-[11px] text-slate-400 ml-2">
                              Assignee: <strong className="text-slate-300">{cand.assignee?.full_name || 'Unassigned'}</strong>
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => onOpenActionItem?.(cand.id)}
                          className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 hover:bg-teal-500 hover:text-slate-950 text-[10px] font-bold border border-teal-600/40 transition flex-shrink-0"
                          title="Inspect AI confidence & evidence quote"
                        >
                          Review Gate
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
