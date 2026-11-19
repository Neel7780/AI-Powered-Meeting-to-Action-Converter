import React, { useState } from 'react';
import { 
  Bookmark, 
  Play, 
  ArrowRight, 
  Users,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import type { MeetingChapter } from '../../../types/meetingDetails';

interface ChaptersTabProps {
  chapters: MeetingChapter[];
  playbackSeconds: number;
  onSelectChapter: (chapter: MeetingChapter) => void;
  onNavigateToTranscript: (timestamp: string, segmentId?: string, seconds?: number) => void;
  selectedChapterId?: string | null;
}

export const MeetingChaptersTab: React.FC<ChaptersTabProps> = ({
  chapters,
  playbackSeconds,
  onSelectChapter,
  onNavigateToTranscript,
  selectedChapterId
}) => {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);

  // Derive active chapter from playback time or user click
  const getActiveChapterId = () => {
    if (selectedChapterId) return selectedChapterId;
    if (internalSelectedId) return internalSelectedId;
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (playbackSeconds >= chapters[i].start_seconds) {
        return chapters[i].id;
      }
    }
    return chapters[0]?.id;
  };

  const activeChapterId = getActiveChapterId();

  const handleChapterClick = (chapter: MeetingChapter) => {
    setInternalSelectedId(chapter.id);
    onSelectChapter(chapter);
    onNavigateToTranscript(chapter.timestamp, undefined, chapter.start_seconds);
  };

  return (
    <div className="p-4 sm:p-5 space-y-4 text-slate-200">
      {/* Header explanation */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div>
          <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
            <Bookmark className="size-4 text-teal-400" />
            <span>Meeting Chapters & Timeline</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Compact topic breakdown derived from verbatim transcript timestamps.
          </p>
        </div>
        <span className="text-[11px] font-mono text-teal-300 bg-teal-950/70 px-2.5 py-0.5 rounded-full border border-teal-800/40">
          {chapters.length} Chapters
        </span>
      </div>

      {chapters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-neutral-400">
          No chapters recorded for this meeting.
        </div>
      ) : (
        /* Clean Compact Timeline */
        <div className="relative pl-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-teal-500/20 space-y-3">
          {chapters.map((chap, index) => {
            const isActive = chap.id === activeChapterId;
            const formattedIndex = String(index + 1).padStart(2, '0');
            const endDisplay = chap.end_timestamp
              ? chap.end_timestamp
              : chap.end_seconds !== undefined
              ? `${String(Math.floor(chap.end_seconds / 60)).padStart(2, '0')}:${String(chap.end_seconds % 60).padStart(2, '0')}`
              : null;

            return (
              <div
                key={chap.id}
                onClick={() => handleChapterClick(chap)}
                className={`relative rounded-xl p-3.5 transition-all duration-200 border cursor-pointer group ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-950/40 via-[#131922] to-[#0f131a] border-teal-500/50 ring-1 ring-teal-500/30 shadow-lg'
                    : 'bg-[#0f1217] hover:bg-[#141820] border-white/10 hover:border-teal-500/30'
                }`}
              >
                {/* Timeline node */}
                <span
                  className={`absolute -left-6 top-4 grid size-5 -translate-x-1/2 place-items-center rounded-full text-[10px] font-mono font-bold transition-all ${
                    isActive
                      ? 'bg-teal-400 text-black ring-4 ring-teal-500/20 shadow-sm'
                      : 'border border-white/20 bg-[#0d0f14] text-neutral-400 group-hover:border-teal-400 group-hover:text-teal-300'
                  }`}
                >
                  {formattedIndex}
                </span>

                {/* Chapter Header row */}
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-teal-400 font-bold">
                      Ch {formattedIndex}
                    </span>

                    <h3 className="text-xs sm:text-[13px] font-semibold text-white group-hover:text-teal-300 transition">
                      {chap.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    {/* Timestamp Range Pill */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleChapterClick(chap);
                      }}
                      className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold transition ${
                        isActive
                          ? 'bg-teal-500 text-slate-950'
                          : 'bg-white/5 text-teal-300 border border-teal-800/40 hover:bg-teal-950/60'
                      }`}
                      title="Seek player to chapter start"
                    >
                      <Play className="size-2.5 fill-current" />
                      <span>{chap.timestamp}</span>
                      {endDisplay && <span className="opacity-70">– {endDisplay}</span>}
                    </button>

                    <span className="text-[10px] text-neutral-400 font-mono hidden sm:inline">
                      ({chap.duration_str})
                    </span>

                    {isActive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/15 border border-teal-500/30 px-2 py-0.2 text-[10px] font-medium text-teal-300">
                        <span className="size-1.5 rounded-full bg-teal-400 animate-pulse" />
                        Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Chapter Description */}
                <p className="text-[11px] sm:text-xs text-neutral-300 leading-relaxed mb-2">
                  {chap.description || chap.summary}
                </p>

                {/* Associated speakers & Key Metrics Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-[11px]">
                  {/* Speakers */}
                  {chap.speakers && chap.speakers.length > 0 && (
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <Users className="size-3 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[200px] sm:max-w-none text-slate-300">
                        {chap.speakers.join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Badges and Transcript navigation */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    {((chap.action_item_ids && chap.action_item_ids.length > 0) || ((chap.action_item_count ?? 0) > 0)) && (
                      <span className="inline-flex items-center gap-1 text-[10px] rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 px-1.5 py-0.2 font-medium">
                        <Sparkles className="size-2.5 text-indigo-400" />
                        {(chap.action_item_ids?.length || chap.action_item_count)} Action Item{(chap.action_item_ids?.length || chap.action_item_count || 1) > 1 ? 's' : ''}
                      </span>
                    )}

                    {chap.decision_count > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-1.5 py-0.2 font-medium">
                        <CheckCircle2 className="size-2.5 text-emerald-400" />
                        {chap.decision_count} Decision{chap.decision_count > 1 ? 's' : ''}
                      </span>
                    )}

                    <span className="flex items-center gap-1 text-[11px] text-teal-400 group-hover:text-teal-300 font-medium pl-1">
                      <span>Jump</span>
                      <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
