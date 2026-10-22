import React from 'react';
import { 
  Bookmark, 
  Clock, 
  Play, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Users, 
  Tag,
  ChevronRight
} from 'lucide-react';
import type { MeetingChapter } from '../../types/meetingDetails';

interface ChaptersTabProps {
  chapters: MeetingChapter[];
  playbackSeconds: number;
  onSelectChapter: (chapter: MeetingChapter) => void;
  onNavigateToTranscript: (timestamp: string, segmentId?: string, seconds?: number) => void;
}

export const MeetingChaptersTab: React.FC<ChaptersTabProps> = ({
  chapters,
  playbackSeconds,
  onSelectChapter,
  onNavigateToTranscript
}) => {
  // Determine active chapter
  const getActiveChapterId = () => {
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (playbackSeconds >= chapters[i].start_seconds) {
        return chapters[i].id;
      }
    }
    return chapters[0]?.id;
  };

  const activeChapterId = getActiveChapterId();

  return (
    <div className="p-4 sm:p-5 space-y-4 text-slate-200">
      {/* Header explanation */}
      <div className="flex items-center justify-between pb-1 border-b border-[#1e232f]">
        <div>
          <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
            <Bookmark className="w-4 h-4 text-teal-400" />
            <span>Meeting Chapters & Topics</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Click any chapter to jump video & navigate to the exact transcript section.
          </p>
        </div>
        <span className="text-xs font-mono text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/40">
          {chapters.length} Chapters
        </span>
      </div>

      {/* Chapters List */}
      <div className="space-y-3">
        {chapters.map((chap, index) => {
          const isActive = chap.id === activeChapterId;

          return (
            <div
              key={chap.id}
              className={`rounded-2xl p-4 transition duration-200 border relative overflow-hidden group ${
                isActive
                  ? 'bg-gradient-to-r from-teal-950/40 via-[#151c24] to-[#12161f] border-teal-700/60 shadow-lg ring-1 ring-teal-500/30'
                  : 'bg-[#13161d] hover:bg-[#181c25] border-[#222734] hover:border-[#2f3747]'
              }`}
            >
              {/* Active Indicator Bar on Left */}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-400" />
              )}

              {/* Top row: Timestamp, duration, active badge */}
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Chapter {index + 1}
                  </span>

                  <button
                    onClick={() => onSelectChapter(chap)}
                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md font-mono text-xs font-semibold border transition ${
                      isActive
                        ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-xs'
                        : 'bg-[#1c222e] text-teal-400 border-[#283244] hover:bg-teal-950'
                    }`}
                    title="Jump video to chapter start"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{chap.timestamp}</span>
                  </button>

                  <span className="text-[11px] text-slate-400 font-mono">
                    ({chap.duration_str})
                  </span>
                </div>

                {isActive && (
                  <span className="text-[10px] font-semibold text-teal-300 bg-teal-950 px-2 py-0.5 rounded-full border border-teal-800/60 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                    Now Playing
                  </span>
                )}
              </div>

              {/* Title & Summary */}
              <div className="space-y-1.5 mb-3">
                <h3 className="text-sm font-bold text-white group-hover:text-teal-300 transition leading-snug">
                  {chap.title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {chap.summary}
                </p>
              </div>

              {/* Key Bullet Points */}
              {chap.key_points.length > 0 && (
                <div className="space-y-1 mb-3 bg-[#0e1116]/60 p-2.5 rounded-xl border border-[#1e2330]">
                  {chap.key_points.map((kp, kIdx) => (
                    <div key={kIdx} className="flex items-start gap-2 text-[11px] text-slate-400">
                      <span className="text-teal-400">•</span>
                      <span>{kp}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer: Speakers, Badges & Navigate Button */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1e232f]/80 flex-wrap text-xs">
                {/* Speakers */}
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>{chap.speakers.join(', ')}</span>
                </div>

                {/* Badges & 1-Click Navigate to Transcript */}
                <div className="flex items-center gap-2">
                  {((chap.action_item_ids && chap.action_item_ids.length > 0) || (chap.action_item_count && chap.action_item_count > 0)) && (
                    <span className="text-[10px] bg-indigo-950/70 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800/40 font-medium">
                      {(chap.action_item_ids?.length || chap.action_item_count)} Action Item{(chap.action_item_ids?.length || chap.action_item_count || 1) > 1 ? 's' : ''}
                    </span>
                  )}

                  {chap.decision_count > 0 && (
                    <span className="text-[10px] bg-emerald-950/70 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800/40 font-medium">
                      {chap.decision_count} Decision{chap.decision_count > 1 ? 's' : ''}
                    </span>
                  )}

                  {/* Primary Navigate Button */}
                  <button
                    onClick={() => onNavigateToTranscript(chap.timestamp, undefined, chap.start_seconds)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#1c222e] hover:bg-teal-600 hover:text-white text-teal-300 border border-[#2a3447] text-xs font-semibold transition active:scale-95 ml-auto"
                    title="Jump to this chapter in the transcript"
                  >
                    <span>Go to Transcript</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
