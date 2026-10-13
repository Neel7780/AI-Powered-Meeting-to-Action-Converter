import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Search, 
  Clock, 
  Sparkles, 
  Volume2, 
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

const SPEAKER_COLORS: Record<string, { bg: string; text: string; border: string; pill: string }> = {
  emerald: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    pill: 'bg-emerald-100 text-emerald-800'
  },
  indigo: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    pill: 'bg-indigo-100 text-indigo-800'
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    pill: 'bg-purple-100 text-purple-800'
  },
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    pill: 'bg-blue-100 text-blue-800'
  },
  amber: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    pill: 'bg-amber-100 text-amber-800'
  }
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSeconds, setPlaybackSeconds] = useState(12);
  const [copied, setCopied] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const speakers = useMemo(() => {
    return Array.from(new Set(segments.map(s => s.speaker_name)));
  }, [segments]);

  const maxSeconds = useMemo(() => {
    if (segments.length === 0) return 2520;
    const last = segments[segments.length - 1];
    return Math.max(last.start_seconds + 90, 2520);
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

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setPlaybackSeconds(prev => {
          if (prev >= maxSeconds) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, maxSeconds]);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCopyTranscript = () => {
    const text = segments.map(s => `[${s.timestamp}] ${s.speaker_name}: ${s.text}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSegmentClick = (segment: TranscriptSegment) => {
    setPlaybackSeconds(segment.start_seconds);
    if (onSelectTimestamp) {
      onSelectTimestamp(segment.timestamp, segment.id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/70 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Meeting Transcript</h3>
              <p className="text-xs text-slate-500">
                Click any timestamp to synchronize review context
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyTranscript}
              title="Copy entire transcript"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition text-xs flex items-center gap-1 font-medium"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              onClick={() => setIsCompact(!isCompact)}
              title={isCompact ? 'Comfortable view' : 'Compact view'}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition"
            >
              {isCompact ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg p-2.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? 'Pause playback' : 'Play audio transcript'}
            className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition shadow-xs flex-shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <div className="flex-1 space-y-1">
            <div className="flex justify-between items-center text-[11px] font-mono text-slate-500">
              <span className="font-semibold text-slate-700">{formatSeconds(playbackSeconds)}</span>
              <span>{formatSeconds(maxSeconds)}</span>
            </div>
            <div 
              className="h-1.5 bg-slate-100 rounded-full overflow-hidden cursor-pointer relative"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                const newSec = Math.floor(pos * maxSeconds);
                setPlaybackSeconds(newSec);
              }}
            >
              <div 
                className="h-full bg-indigo-600 transition-all rounded-full"
                style={{ width: `${(playbackSeconds / maxSeconds) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex items-center text-xs text-slate-400 gap-1 pl-1 border-l border-slate-100">
            <Volume2 className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search transcript or timestamps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition placeholder:text-slate-400"
            />
          </div>

          <div className="relative flex items-center">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <select
              value={selectedSpeaker}
              onChange={(e) => setSelectedSpeaker(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-slate-700 cursor-pointer appearance-none"
            >
              <option value="all">All Speakers ({speakers.length})</option>
              {speakers.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100/80">
        {filteredSegments.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Search className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs">No transcript segments match your filter criteria.</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedSpeaker('all'); }}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              Clear filters
            </button>
          </div>
        ) : (
          filteredSegments.map((segment) => {
            const isHighlighted = highlightedSegmentId === segment.id;
            const isTimestampActive = activeTimestamp === segment.timestamp;
            const hasActionItem = actionItemSegmentIds.has(segment.id);
            const speakerTheme = SPEAKER_COLORS[segment.speaker_color || 'indigo'] || SPEAKER_COLORS.indigo;

            return (
              <div
                key={segment.id}
                ref={(el) => { segmentRefs.current[segment.id] = el; }}
                onClick={() => handleSegmentClick(segment)}
                className={`pt-3 first:pt-0 group transition-all duration-200 rounded-lg cursor-pointer ${
                  isHighlighted
                    ? 'p-3 bg-amber-50/70 border-2 border-amber-300 shadow-sm ring-2 ring-amber-200/50 -mx-1'
                    : isTimestampActive
                    ? 'p-2 bg-indigo-50/50 border border-indigo-200 rounded-lg'
                    : 'hover:bg-slate-50/80 p-2'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${speakerTheme.pill}`}>
                      {segment.speaker_name.split(' ').map(n => n[0]).join('')}
                    </div>

                    <span className="text-xs font-semibold text-slate-800">
                      {segment.speaker_name}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSegmentClick(segment);
                      }}
                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded font-medium transition flex items-center gap-1 ${
                        isHighlighted || isTimestampActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700'
                      }`}
                      title="Click to jump to this timestamp"
                    >
                      <Clock className="w-2.5 h-2.5" />
                      {segment.timestamp}
                    </button>
                  </div>

                  {hasActionItem && (
                    <span 
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                      title="An action item was extracted from this transcript segment"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                      Item Detected
                    </span>
                  )}
                </div>

                <p className={`text-slate-700 leading-relaxed ${
                  isCompact ? 'text-[11px]' : 'text-xs'
                } ${isHighlighted ? 'font-medium text-slate-900' : ''}`}>
                  {segment.text}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>{filteredSegments.length} segments displayed</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Audio synchronized
        </span>
      </div>
    </div>
  );
};
