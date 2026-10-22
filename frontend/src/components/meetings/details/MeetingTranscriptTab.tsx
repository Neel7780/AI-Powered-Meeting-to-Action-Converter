import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Edit3, 
  Copy, 
  Check, 
  Clock, 
  Sparkles, 
  User, 
  ChevronDown, 
  ArrowUp, 
  ArrowDown, 
  X,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import type { TranscriptSegment, ActionItemCandidate } from '../../types/review';

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

  // Filtered segments
  const filteredSegments = useMemo(() => {
    return editableSegments.filter((seg) => {
      const matchesSpeaker = selectedSpeaker === 'all' || seg.speaker_name === selectedSpeaker;
      const matchesSearch =
        searchQuery.trim() === '' ||
        seg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        seg.speaker_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        seg.timestamp.includes(searchQuery);

      return matchesSpeaker && matchesSearch;
    });
  }, [editableSegments, selectedSpeaker, searchQuery]);

  // Auto-scroll when highlightedTimestamp or highlightedSegmentId changes
  useEffect(() => {
    let match: TranscriptSegment | undefined;
    if (highlightedSegmentId) {
      match = segments.find((s) => s.id === highlightedSegmentId);
    }
    if (!match && highlightedTimestamp) {
      match = segments.find((s) => s.timestamp === highlightedTimestamp);
    }
    if (match && segmentRefs.current[match.id]) {
      segmentRefs.current[match.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedTimestamp, highlightedSegmentId, segments]);

  const handleCopy = () => {
    const fullText = editableSegments
      .map((s) => `${s.speaker_name} (${s.timestamp}): ${s.text}`)
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

  // Helper to render text with query highlight & token styling matching the screenshot
  const renderTextContent = (text: string) => {
    // Screenshot highlight token: "General, AI Insights, and Workspaces."
    const token = 'General, AI Insights, and Workspaces.';
    if (text.includes(token)) {
      const parts = text.split(token);
      return (
        <span>
          {parts[0]}
          <span className="px-1.5 py-0.5 rounded-md bg-blue-600 text-white font-semibold text-xs shadow-xs mx-0.5">
            {token}
          </span>
          {parts[1]}
        </span>
      );
    }

    if (!searchQuery.trim()) return text;

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const splitParts = text.split(regex);

    return splitParts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-400 text-black px-1 rounded font-bold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0e1117] text-slate-200 select-text">
      {/* Search & Actions Bar (Screenshot Top Controls) */}
      <div className="p-3.5 border-b border-[#1d222e] bg-[#11141b] flex items-center justify-between gap-2 flex-wrap">
        {/* Search Input Box */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search for transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-[#181c25] border border-[#252b39] rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 transition"
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

        {/* Action Icons (Pencil edit and Copy sheets from screenshot) */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`p-1.5 rounded-lg border transition ${
              isEditMode
                ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-xs'
                : 'bg-[#181c25] hover:bg-[#202633] text-slate-400 hover:text-white border-[#252b39]'
            }`}
            title={isEditMode ? 'Exit edit mode' : 'Edit transcript text'}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-[#181c25] hover:bg-[#202633] text-slate-400 hover:text-white border-[#252b39] transition"
            title="Copy entire transcript"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Speaker Filter Pills */}
      <div className="px-3 py-2 border-b border-[#1b202a] bg-[#0c0e14] flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
        <button
          onClick={() => setSelectedSpeaker('all')}
          className={`px-2.5 py-0.5 rounded-full transition font-medium ${
            selectedSpeaker === 'all'
              ? 'bg-teal-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-200 bg-[#161a22]'
          }`}
        >
          All ({editableSegments.length})
        </button>
        {speakers.map((spk) => (
          <button
            key={spk}
            onClick={() => setSelectedSpeaker(spk)}
            className={`px-2.5 py-0.5 rounded-full transition font-medium ${
              selectedSpeaker === spk
                ? 'bg-teal-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200 bg-[#161a22]'
            }`}
          >
            {spk}
          </button>
        ))}
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
                ref={(el) => (segmentRefs.current[seg.id] = el)}
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
                      <span>Action Item Detected</span>
                    </span>
                  )}
                </div>

                {/* Dialog Body (Editable in Edit Mode) */}
                {isEditMode ? (
                  <textarea
                    value={seg.text}
                    onChange={(e) => handleTextChange(seg.id, e.target.value)}
                    className="w-full text-xs text-slate-200 bg-[#171b25] p-2 rounded-lg border border-[#2b3342] focus:outline-none focus:border-teal-500"
                    rows={2}
                  />
                ) : (
                  <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed">
                    {renderTextContent(seg.text)}
                  </p>
                )}

                {/* Connected Action Items Context Cards */}
                {linkedCandidates.length > 0 && (
                  <div className="pt-1.5 space-y-1.5">
                    {linkedCandidates.map((cand) => (
                      <div
                        key={cand.id}
                        onClick={() => onOpenActionItem?.(cand.id)}
                        className="p-2 rounded-lg bg-[#141824] hover:bg-[#1a2030] border border-teal-800/30 cursor-pointer transition flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                          <span className="font-medium text-teal-200 truncate">
                            {cand.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 bg-[#1c2232] px-1.5 py-0.5 rounded flex-shrink-0">
                          {cand.assignee?.full_name || 'Unassigned'}
                        </span>
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
