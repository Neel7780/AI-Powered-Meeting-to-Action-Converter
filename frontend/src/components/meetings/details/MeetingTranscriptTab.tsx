import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Edit3, 
  Copy, 
  Check, 
  Clock, 
  Sparkles, 
  X, 
  CheckCircle2,
  Download,
  ChevronDown
} from 'lucide-react';
import type { TranscriptSegment, ActionItemCandidate } from '../../../types/review';
import type { MeetingChapter } from '../../../types/meetingDetails';

interface TranscriptTabProps {
  segments: TranscriptSegment[];
  playbackSeconds: number;
  highlightedTimestamp?: string | null;
  highlightedSegmentId?: string | null;
  chapters?: MeetingChapter[];
  onSeek?: (seconds: number) => void;
  onSelectTimestamp?: (timestamp: string, segmentId?: string, seconds?: number) => void;
  candidates?: ActionItemCandidate[];
  onOpenActionItem?: (candidateId: string) => void;
}

// Consistent coloured avatars based on speaker name
const SPEAKER_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  cyan: { bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-500/30' },
  rose: { bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30' },
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30' },
  teal: { bg: 'bg-teal-500/15', text: 'text-teal-300', border: 'border-teal-500/30' },
};

const COLOR_KEYS = ['cyan', 'emerald', 'purple', 'amber', 'indigo', 'rose', 'blue', 'teal'] as const;

function getSpeakerColorTheme(speakerName: string, explicitColor?: string) {
  if (explicitColor && SPEAKER_COLOR_MAP[explicitColor]) {
    return SPEAKER_COLOR_MAP[explicitColor];
  }
  let hash = 0;
  for (let i = 0; i < speakerName.length; i++) {
    hash = speakerName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const key = COLOR_KEYS[Math.abs(hash) % COLOR_KEYS.length];
  return SPEAKER_COLOR_MAP[key];
}

export const MeetingTranscriptTab: React.FC<TranscriptTabProps> = ({
  segments,
  playbackSeconds,
  highlightedTimestamp,
  highlightedSegmentId,
  chapters = [],
  onSeek,
  onSelectTimestamp,
  candidates = [],
  onOpenActionItem
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all');
  const [editableSegments, setEditableSegments] = useState<TranscriptSegment[]>(segments);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setEditableSegments(segments);
  }, [segments]);

  // Extract unique speakers (without guessing or fabricating)
  const speakers = useMemo(() => {
    return Array.from(new Set(segments.map((s) => s.speaker_name))).filter(Boolean);
  }, [segments]);

  // Map candidate action items to segments
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

  // Active chapter time boundaries if chapter filter is applied
  const activeChapterFilter = useMemo(() => {
    if (selectedChapterId === 'all') return null;
    return chapters.find((c) => c.id === selectedChapterId) || null;
  }, [selectedChapterId, chapters]);

  // Filtered segments by speaker, search query, and chapter boundaries
  const filteredSegments = useMemo(() => {
    return editableSegments.filter((seg) => {
      // 1. Speaker filter
      const matchSpeaker =
        selectedSpeaker === 'all' || seg.speaker_name === selectedSpeaker;

      // 2. Search query (text, speaker name, timestamp)
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        q === '' ||
        seg.text.toLowerCase().includes(q) ||
        seg.speaker_name.toLowerCase().includes(q) ||
        seg.timestamp.includes(q);

      // 3. Chapter filter
      let matchChapter = true;
      if (activeChapterFilter) {
        const startSec = activeChapterFilter.start_seconds;
        const endSec = activeChapterFilter.end_seconds ?? (startSec + activeChapterFilter.duration_seconds);
        matchChapter = seg.start_seconds >= startSec && (endSec ? seg.start_seconds <= endSec : true);
      }

      return matchSpeaker && matchSearch && matchChapter;
    });
  }, [editableSegments, selectedSpeaker, searchQuery, activeChapterFilter]);

  // Auto-scroll to highlighted segment or active playing segment
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

  const handleExportTxt = () => {
    const textContent = editableSegments
      .map((s) => `[${s.timestamp}] ${s.speaker_name}:\n${s.text}\n`)
      .join('\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meeting_transcript_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportVtt = () => {
    let vttContent = 'WEBVTT\n\n';
    editableSegments.forEach((s, idx) => {
      const startMins = Math.floor(s.start_seconds / 60);
      const startSecs = s.start_seconds % 60;
      const endTotal = s.end_ms ? Math.floor(s.end_ms / 1000) : s.start_seconds + 5;
      const endMins = Math.floor(endTotal / 60);
      const endSecs = endTotal % 60;

      const formatTime = (m: number, sec: number) =>
        `00:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.000`;

      vttContent += `${idx + 1}\n`;
      vttContent += `${formatTime(startMins, startSecs)} --> ${formatTime(endMins, endSecs)}\n`;
      vttContent += `<v ${s.speaker_name}>${s.text}\n\n`;
    });

    const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meeting_transcript_${new Date().toISOString().slice(0, 10)}.vtt`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleTextChange = (id: string, newText: string) => {
    setEditableSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text: newText } : s))
    );
  };

  const handleSegmentClick = (seg: TranscriptSegment) => {
    if (onSeek) onSeek(seg.start_seconds);
    if (onSelectTimestamp) onSelectTimestamp(seg.timestamp, seg.id, seg.start_seconds);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0f14] text-slate-200 text-xs sm:text-[13px] select-none">
      {/* ========================================================= */}
      {/* Compact Toolbar (Search, Filters, Copy, Export, Edit)    */}
      {/* ========================================================= */}
      <div className="p-3 sm:p-4 border-b border-white/10 bg-[#10131a] space-y-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Live Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="size-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search dialogue, speaker, or timestamp…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-[#151922] border border-[#242b38] rounded-xl text-slate-200 placeholder:text-neutral-500 focus:outline-hidden focus:border-teal-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                title="Clear search"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* 2. Speaker Filter Dropdown */}
          <div className="relative">
            <select
              aria-label="Filter by speaker"
              value={selectedSpeaker}
              onChange={(e) => setSelectedSpeaker(e.target.value)}
              className="h-8 rounded-xl bg-[#151922] border border-[#242b38] px-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-teal-500 cursor-pointer"
            >
              <option value="all">All Speakers ({speakers.length})</option>
              {speakers.map((spk) => (
                <option key={spk} value={spk}>{spk}</option>
              ))}
            </select>
          </div>

          {/* 3. Chapter Filter Dropdown */}
          {chapters.length > 0 && (
            <div className="relative">
              <select
                aria-label="Filter by chapter"
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                className="h-8 rounded-xl bg-[#151922] border border-[#242b38] px-2.5 text-xs text-teal-300 focus:outline-hidden focus:border-teal-500 cursor-pointer max-w-[170px] truncate"
              >
                <option value="all">All Chapters ({chapters.length})</option>
                {chapters.map((chap, idx) => (
                  <option key={chap.id} value={chap.id}>
                    Ch {idx + 1}: {chap.timestamp} {chap.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 4. Edit Mode Toggle */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
              isEditMode
                ? 'bg-amber-950/80 text-amber-300 border-amber-800/60 shadow-xs'
                : 'bg-[#151922] hover:bg-[#1d2330] text-slate-300 border-[#242b38]'
            }`}
            title="Toggle inline transcript text editing"
          >
            <Edit3 className="size-3.5 text-slate-400" />
            <span className="hidden sm:inline">{isEditMode ? 'Done' : 'Edit'}</span>
          </button>

          {/* 5. Copy Transcript */}
          <button
            onClick={handleCopyFullTranscript}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151922] hover:bg-[#1d2330] border border-[#242b38] text-slate-300 hover:text-white text-xs font-medium transition"
            title="Copy whole transcript with timestamps"
          >
            {copied ? <Check className="size-3.5 text-teal-400" /> : <Copy className="size-3.5 text-slate-400" />}
            <span className="hidden md:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* 6. Export Menu Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151922] hover:bg-[#1d2330] border border-[#242b38] text-slate-300 hover:text-white text-xs font-medium transition"
              title="Export transcript as .txt or .vtt"
            >
              <Download className="size-3.5 text-slate-400" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="size-3 text-slate-500" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-30 w-44 rounded-xl bg-[#151922] border border-[#242b38] p-1.5 shadow-2xl space-y-1">
                <button
                  onClick={handleExportTxt}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-white/10 transition flex items-center justify-between"
                >
                  <span>Text File (.txt)</span>
                  <span className="text-[10px] text-neutral-400 font-mono">Clean</span>
                </button>
                <button
                  onClick={handleExportVtt}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-white/10 transition flex items-center justify-between"
                >
                  <span>WebVTT (.vtt)</span>
                  <span className="text-[10px] text-teal-400 font-mono">Timed</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Indicators & Quick Speaker Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px] pt-1">
          <span className="text-neutral-500 font-medium text-[10px] uppercase tracking-wider shrink-0">
            Speakers:
          </span>

          <button
            onClick={() => setSelectedSpeaker('all')}
            className={`px-2 py-0.5 rounded-full border transition shrink-0 font-medium ${
              selectedSpeaker === 'all'
                ? 'bg-teal-500 text-slate-950 border-teal-400 font-bold'
                : 'bg-[#151821] text-neutral-400 border-[#222734] hover:text-white'
            }`}
          >
            All ({segments.length})
          </button>

          {speakers.map((spk) => {
            const isSelected = selectedSpeaker === spk;
            const theme = getSpeakerColorTheme(spk);
            const count = segments.filter((s) => s.speaker_name === spk).length;

            return (
              <button
                key={spk}
                onClick={() => setSelectedSpeaker(spk)}
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border transition shrink-0 whitespace-nowrap ${
                  isSelected
                    ? 'bg-teal-500 text-slate-950 border-teal-400 font-bold'
                    : `bg-[#13161f] ${theme.text} ${theme.border} hover:bg-[#1a202c]`
                }`}
              >
                <span>{spk}</span>
                <span className="opacity-70 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* Dialogue Stream with Separation and Consistent Avatars    */}
      {/* ========================================================= */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
        {filteredSegments.length === 0 ? (
          <div className="text-center py-16 text-neutral-400 text-xs space-y-2">
            <Search className="mx-auto size-8 text-neutral-600" />
            <p>No matching dialogue lines found for your filter criteria.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSpeaker('all');
                setSelectedChapterId('all');
              }}
              className="text-teal-400 hover:underline font-medium text-xs mt-1"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          filteredSegments.map((seg, idx) => {
            const isHighlighted =
              (highlightedSegmentId && seg.id === highlightedSegmentId) ||
              (!highlightedSegmentId && highlightedTimestamp === seg.timestamp);
            const isCurrentlyPlaying =
              playbackSeconds >= seg.start_seconds &&
              playbackSeconds < seg.start_seconds + 30;
            const linkedCandidates = candidateBySegment.get(seg.id) || [];
            const theme = getSpeakerColorTheme(seg.speaker_name, seg.speaker_color);
            const initials = seg.speaker_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase() || 'P';

            // Check if speaker changed from previous segment for separation
            const isNewSpeaker = idx === 0 || filteredSegments[idx - 1].speaker_name !== seg.speaker_name;

            return (
              <div
                key={seg.id}
                ref={(el) => {
                  segmentRefs.current[seg.id] = el;
                }}
                className={`transition-all duration-200 rounded-xl p-3 -mx-1 space-y-2 border ${
                  isHighlighted
                    ? 'bg-teal-950/40 border-teal-500/60 ring-1 ring-teal-500/40 shadow-lg'
                    : isCurrentlyPlaying
                    ? 'bg-[#151a24] border-l-2 border-teal-400 border-white/5'
                    : 'bg-[#10131a]/60 hover:bg-[#141822] border-white/5'
                } ${isNewSpeaker ? 'mt-4 pt-3 border-t border-white/10' : ''}`}
              >
                {/* Speaker Header with Coloured Avatar & Clickable Timestamp */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {/* Consistent coloured speaker avatar */}
                    <div
                      className={`grid size-6 place-items-center rounded-full text-[10px] font-bold border ${theme.bg} ${theme.text} ${theme.border}`}
                      title={seg.speaker_name}
                    >
                      {initials}
                    </div>

                    <span className="font-semibold text-white text-xs sm:text-[13px] tracking-tight">
                      {seg.speaker_name}
                    </span>

                    {/* Clickable timestamp pill that seeks recording & highlights */}
                    <button
                      type="button"
                      onClick={() => handleSegmentClick(seg)}
                      className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-medium transition flex items-center gap-1 cursor-pointer ${
                        isHighlighted || isCurrentlyPlaying
                          ? 'bg-teal-500 text-slate-950 font-bold shadow-xs'
                          : 'bg-white/5 text-neutral-400 hover:text-teal-300 hover:bg-white/10'
                      }`}
                      title="Click to seek recording and highlight segment"
                    >
                      <Clock className="size-2.5" />
                      <span>{seg.timestamp}</span>
                    </button>
                  </div>

                  {linkedCandidates.length > 0 && (
                    <span className="text-[10px] font-semibold text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-800/50 flex items-center gap-1">
                      <Sparkles className="size-2.5 text-teal-400" />
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
                    className="w-full p-2.5 bg-[#171c26] text-slate-100 border border-[#2b3342] rounded-lg text-xs leading-relaxed focus:outline-hidden focus:border-teal-500"
                  />
                ) : (
                  <p className="text-slate-200 text-xs sm:text-[13px] leading-relaxed pl-8 select-text">
                    {seg.text}
                  </p>
                )}

                {/* Candidate Action Item Reference Banner */}
                {linkedCandidates.length > 0 && (
                  <div className="pt-1.5 pl-8 space-y-1.5">
                    {linkedCandidates.map((cand) => (
                      <div
                        key={cand.id}
                        className="p-2.5 rounded-lg bg-[#141b24] border border-teal-800/30 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="size-3.5 text-teal-400 shrink-0" />
                          <div className="truncate">
                            <span className="font-semibold text-slate-200 text-xs truncate">
                              {cand.title}
                            </span>
                            <span className="text-[11px] text-neutral-400 ml-2">
                              Assignee: <strong className="text-slate-300">{cand.assignee?.full_name || 'Unassigned'}</strong>
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenActionItem?.(cand.id)}
                          className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 hover:bg-teal-500 hover:text-slate-950 text-[10px] font-bold border border-teal-600/40 transition shrink-0"
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

      {/* Footer Info */}
      <div className="border-t border-white/10 px-4 py-2 flex items-center justify-between text-[11px] text-neutral-400 bg-[#0e1015]">
        <span>{filteredSegments.length} of {segments.length} segments displayed</span>
        <span className="font-mono text-teal-400">ActionPulse Dialogue Sync</span>
      </div>
    </div>
  );
};
