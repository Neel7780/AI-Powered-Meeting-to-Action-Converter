import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Filter
} from 'lucide-react';
import type { TranscriptSegment } from '../../types/review';

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  activeTimestamp?: string | null;
  highlightedSegmentId?: string | null;
  onSelectTimestamp?: (timestamp: string, segmentId: string) => void;
  actionItemSegmentIds?: Set<string>;
}

// Speaker avatar tints, keyed by segment.speaker_color
const SPEAKER_PILLS: Record<string, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-300',
  indigo: 'bg-indigo-500/15 text-indigo-300',
  purple: 'bg-purple-500/15 text-purple-300',
  blue: 'bg-blue-500/15 text-blue-300',
  amber: 'bg-amber-500/15 text-amber-300',
};

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  segments,
  activeTimestamp,
  highlightedSegmentId,
  onSelectTimestamp,
  actionItemSegmentIds = new Set()
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');
  const [copied, setCopied] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const speakers = useMemo(() => {
    return Array.from(new Set(segments.map(s => s.speaker_name)));
  }, [segments]);

  const filteredSegments = useMemo(() => {
    return segments.filter(seg => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        seg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        seg.speaker_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        seg.timestamp.includes(searchQuery);

      const matchesSpeaker =
        selectedSpeaker === 'all' ||
        seg.speaker_name === selectedSpeaker;

      return matchesSearch && matchesSpeaker;
    });
  }, [segments, searchQuery, selectedSpeaker]);

  useEffect(() => {
    if (highlightedSegmentId && segmentRefs.current[highlightedSegmentId]) {
      const el = segmentRefs.current[highlightedSegmentId];
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedSegmentId]);

  const handleCopyTranscript = () => {
    const text = segments.map(s => `[${s.timestamp}] ${s.speaker_name}: ${s.text}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSegmentClick = (segment: TranscriptSegment) => {
    if (onSelectTimestamp) {
      onSelectTimestamp(segment.timestamp, segment.id);
    }
  };

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      <div className="space-y-3 border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-md border border-white/15 bg-white/5 text-white">
              <Clock className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-medium text-white">Meeting transcript</h3>
              <p className="text-xs text-neutral-500">
                Click any timestamp to synchronize review context
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopyTranscript}
              title="Copy entire transcript"
              className="flex items-center gap-1 rounded-md p-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsCompact(!isCompact)}
              title={isCompact ? 'Comfortable view' : 'Compact view'}
              aria-label={isCompact ? 'Comfortable view' : 'Compact view'}
              className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              {isCompact ? <Maximize2 className="size-3.5" /> : <Minimize2 className="size-3.5" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              aria-label="Search transcript"
              placeholder="Search transcript or timestamps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="field h-8 py-0 pl-8 text-xs"
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
            <select
              aria-label="Filter by speaker"
              value={selectedSpeaker}
              onChange={(e) => setSelectedSpeaker(e.target.value)}
              className="field h-8 cursor-pointer py-0 pl-8 text-xs"
            >
              <option value="all">All speakers ({speakers.length})</option>
              {speakers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        {filteredSegments.length === 0 ? (
          <div className="space-y-2 py-12 text-center">
            <Search className="mx-auto size-8 text-neutral-700" />
            <p className="text-xs text-neutral-400">No transcript segments match your filter criteria.</p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setSelectedSpeaker('all'); }}
              className="text-xs font-medium text-white underline-offset-4 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          filteredSegments.map((segment) => {
            const isHighlighted = highlightedSegmentId === segment.id;
            const isTimestampActive = activeTimestamp === segment.timestamp;
            const hasActionItem = actionItemSegmentIds.has(segment.id);
            const speakerPill = SPEAKER_PILLS[segment.speaker_color || 'indigo'] || SPEAKER_PILLS.indigo;

            return (
              <div
                key={segment.id}
                ref={(el) => { segmentRefs.current[segment.id] = el; }}
                onClick={() => handleSegmentClick(segment)}
                className={`group cursor-pointer rounded-md border p-2.5 transition-colors duration-200 ${
                  isHighlighted
                    ? 'border-amber-500/40 bg-amber-500/[0.06]'
                    : isTimestampActive
                    ? 'border-white/20 bg-white/[0.04]'
                    : 'border-transparent hover:bg-white/[0.03]'
                }`}
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`grid size-6 place-items-center rounded-full text-[10px] font-semibold ${speakerPill}`}>
                      {segment.speaker_name.split(' ').map(n => n[0]).join('')}
                    </div>

                    <span className="text-xs font-medium text-white">
                      {segment.speaker_name}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSegmentClick(segment);
                      }}
                      className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                        isHighlighted || isTimestampActive
                          ? 'bg-white text-black'
                          : 'bg-white/5 text-neutral-400 group-hover:text-white'
                      }`}
                      title="Click to jump to this timestamp"
                    >
                      <Clock className="size-2.5" />
                      {segment.timestamp}
                    </button>
                  </div>

                  {hasActionItem && (
                    <span
                      className="inline-flex items-center gap-1 rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400"
                      title="An action item was extracted from this transcript segment"
                    >
                      <Sparkles className="size-2.5" />
                      Item detected
                    </span>
                  )}
                </div>

                <p className={`leading-relaxed ${
                  isCompact ? 'text-[11px]' : 'text-xs'
                } ${isHighlighted ? 'text-white' : 'text-neutral-300'}`}>
                  {segment.text}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-[11px] text-neutral-500">
        <span>{filteredSegments.length} segments displayed</span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
          Transcript synchronized
        </span>
      </div>
    </div>
  );
};
