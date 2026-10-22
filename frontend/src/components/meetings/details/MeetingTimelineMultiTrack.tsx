import React, { useState } from 'react';
import { 
  Clock, 
  Scissors, 
  MessageSquare, 
  Target, 
  BarChart3, 
  Play, 
  ChevronRight, 
  Sparkles,
  Search,
  ExternalLink
} from 'lucide-react';
import type { RichMeetingDetails, SpeakerTimelineTrack } from '../../types/meetingDetails';

interface TimelineProps {
  meeting: RichMeetingDetails;
  playbackSeconds: number;
  onSeek: (seconds: number) => void;
  onSelectTimestamp: (timestamp: string, segmentId?: string) => void;
}

export const MeetingTimelineMultiTrack: React.FC<TimelineProps> = ({
  meeting,
  playbackSeconds,
  onSeek,
  onSelectTimestamp
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'clips' | 'comments' | 'trackers' | 'metrics'>('timeline');

  const totalSeconds = meeting.total_duration_seconds; // 2747
  const progressPercent = totalSeconds > 0 ? (playbackSeconds / totalSeconds) * 100 : 0;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSeconds = Math.round(clickRatio * totalSeconds);
    onSeek(targetSeconds);
  };

  const getTrackColorClasses = (color: string) => {
    switch (color) {
      case 'emerald':
        return {
          bar: 'bg-emerald-500',
          dot: 'bg-emerald-400',
          hover: 'hover:bg-emerald-400',
          text: 'text-emerald-400'
        };
      case 'purple':
        return {
          bar: 'bg-indigo-500',
          dot: 'bg-indigo-400',
          hover: 'hover:bg-indigo-400',
          text: 'text-indigo-400'
        };
      case 'cyan':
      default:
        return {
          bar: 'bg-cyan-400',
          dot: 'bg-cyan-300',
          hover: 'hover:bg-cyan-300',
          text: 'text-cyan-400'
        };
    }
  };

  return (
    <div className="rounded-2xl bg-[#11141b] border border-[#202531] overflow-hidden shadow-lg select-none">
      {/* Sub-tabs Header matching screenshot */}
      <div className="flex items-center gap-1 p-2 border-b border-[#1d222d] bg-[#0d0f14] overflow-x-auto scrollbar-none text-xs font-medium">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition ${
            activeTab === 'timeline'
              ? 'bg-[#1e2430] text-white font-semibold shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a22]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-teal-400" />
          <span>Timeline</span>
        </button>

        <button
          onClick={() => setActiveTab('clips')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'clips'
              ? 'bg-[#1e2430] text-white font-semibold shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a22]'
          }`}
        >
          <Scissors className="w-3.5 h-3.5 text-slate-400" />
          <span>Clips</span>
        </button>

        <button
          onClick={() => setActiveTab('comments')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'comments'
              ? 'bg-[#1e2430] text-white font-semibold shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a22]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
          <span>Comments</span>
        </button>

        <button
          onClick={() => setActiveTab('trackers')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'trackers'
              ? 'bg-[#1e2430] text-white font-semibold shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a22]'
          }`}
        >
          <Target className="w-3.5 h-3.5 text-slate-400" />
          <span>Trackers</span>
        </button>

        <button
          onClick={() => setActiveTab('metrics')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'metrics'
              ? 'bg-[#1e2430] text-white font-semibold shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a22]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
          <span>Metrics</span>
        </button>
      </div>

      {/* Content for Timeline tab (Screenshot exact replica) */}
      {activeTab === 'timeline' && (
        <div className="p-4 relative">
          {/* Vertical Moving Scrubber Line across all tracks */}
          <div
            className="absolute top-2 bottom-2 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] pointer-events-none z-30 transition-all duration-150"
            style={{ left: `calc(130px + (100% - 210px) * ${progressPercent / 100})` }}
          >
            {/* Scrubber head dot */}
            <div className="w-2.5 h-2.5 rounded-full bg-white -translate-x-[4px] -translate-y-1 shadow ring-2 ring-teal-500/50" />
          </div>

          <div className="space-y-4">
            {/* Speaker Tracks */}
            {meeting.speaker_tracks.map((track) => {
              const styles = getTrackColorClasses(track.color);
              return (
                <div key={track.speaker} className="flex items-center gap-3">
                  {/* Speaker Label */}
                  <div className="w-28 flex items-center gap-1.5 text-xs font-medium text-slate-300 flex-shrink-0 cursor-pointer hover:text-white">
                    <Play className="w-2.5 h-2.5 fill-slate-400 text-slate-400" />
                    <span className="truncate">{track.speaker}</span>
                  </div>

                  {/* Timeline Track Segment Bar */}
                  <div
                    onClick={handleTimelineClick}
                    className="flex-1 h-3 bg-[#171b24] hover:bg-[#1c212c] rounded-full relative cursor-pointer overflow-hidden border border-[#252b38]/50"
                  >
                    {track.segments.map((seg, idx) => (
                      <div
                        key={idx}
                        className={`absolute top-0.5 bottom-0.5 rounded-full ${styles.bar} ${styles.hover} transition-all`}
                        style={{
                          left: `${seg.start_pct}%`,
                          width: `${seg.width_pct}%`
                        }}
                        title={`${track.speaker}: ${Math.floor(seg.start_seconds / 60)}m - ${Math.floor(seg.end_seconds / 60)}m`}
                      />
                    ))}
                  </div>

                  {/* Percentage & Minutes Stats */}
                  <div className="w-20 text-right text-xs font-mono text-slate-400 flex-shrink-0">
                    <span className="text-slate-300 font-semibold">{track.percentage}%</span>
                    <span className="ml-1 text-[11px] text-slate-400">{track.duration_min}min</span>
                  </div>
                </div>
              );
            })}

            {/* Comments Event Track */}
            <div className="flex items-center gap-3 pt-1 border-t border-[#1d222d]">
              <div className="w-28 flex items-center gap-1.5 text-xs font-medium text-slate-400 flex-shrink-0">
                <Play className="w-2.5 h-2.5 fill-slate-400 text-slate-400" />
                <span>Comments</span>
              </div>

              <div
                onClick={handleTimelineClick}
                className="flex-1 h-2 bg-[#171b24] rounded-full relative cursor-pointer overflow-hidden"
              >
                {/* Dots along comments track */}
                {[5, 12, 19, 28, 42, 55, 68, 77, 86, 94].map((pct, idx) => (
                  <div
                    key={idx}
                    className="absolute top-0 bottom-0 w-1 rounded-full bg-purple-400"
                    style={{ left: `${pct}%` }}
                    title={`Comment at ${pct}%`}
                  />
                ))}
              </div>

              <div className="w-20 text-right text-xs text-slate-400 flex-shrink-0 flex items-center justify-end gap-1 cursor-pointer hover:text-white" onClick={() => setActiveTab('comments')}>
                <span>20</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
              </div>
            </div>

            {/* Clips Event Track */}
            <div className="flex items-center gap-3">
              <div className="w-28 flex items-center gap-1.5 text-xs font-medium text-slate-400 flex-shrink-0">
                <Play className="w-2.5 h-2.5 fill-slate-400 text-slate-400" />
                <span>Clips</span>
              </div>

              <div
                onClick={handleTimelineClick}
                className="flex-1 h-2 bg-[#171b24] rounded-full relative cursor-pointer overflow-hidden"
              >
                {/* Red/orange markers for clips */}
                {[3, 8, 22, 45, 62, 74, 88].map((pct, idx) => (
                  <div
                    key={idx}
                    className="absolute top-0 bottom-0 w-3 rounded-full bg-rose-500/80"
                    style={{ left: `${pct}%` }}
                    title={`Clip marker at ${pct}%`}
                  />
                ))}
              </div>

              <div className="w-20 text-right text-xs text-slate-400 flex-shrink-0 flex items-center justify-end gap-1 cursor-pointer hover:text-white" onClick={() => setActiveTab('clips')}>
                <span>8</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clips Tab */}
      {activeTab === 'clips' && (
        <div className="p-4 space-y-2 max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 text-xs">
          {meeting.clips.map((clip) => (
            <div
              key={clip.id}
              onClick={() => onSeek(clip.start_seconds)}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[#161a22] hover:bg-[#1f2533] border border-[#262d3d] cursor-pointer transition"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-rose-950/60 text-rose-400 flex items-center justify-center font-bold">
                  <Scissors className="w-3 h-3" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200">{clip.title}</div>
                  <div className="text-[11px] text-slate-400">
                    Speaker: {clip.speaker} • {clip.start_timestamp} - {clip.end_timestamp}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-teal-400 bg-teal-950/50 px-2 py-0.5 rounded border border-teal-800/40">
                {clip.tag}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Comments Tab */}
      {activeTab === 'comments' && (
        <div className="p-4 space-y-2.5 max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 text-xs">
          {meeting.comments.map((comm) => (
            <div
              key={comm.id}
              onClick={() => onSeek(comm.seconds)}
              className="p-2.5 rounded-xl bg-[#161a22] hover:bg-[#1f2533] border border-[#262d3d] cursor-pointer transition space-y-1"
            >
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                  <img src={comm.avatar} alt={comm.author} className="w-4 h-4 rounded-full" />
                  <span>{comm.author}</span>
                </div>
                <span className="font-mono text-teal-400">{comm.timestamp}</span>
              </div>
              <p className="text-slate-300 text-xs pl-5.5">{comm.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Trackers Tab */}
      {activeTab === 'trackers' && (
        <div className="p-4 grid grid-cols-2 gap-2 text-xs">
          {meeting.trackers.map((t) => (
            <div key={t.keyword} className="p-2.5 rounded-xl bg-[#161a22] border border-[#262d3d] flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-200">{t.keyword}</span>
                <div className="text-[10px] text-slate-400 capitalize">{t.category}</div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 font-bold text-xs border border-teal-800/40">
                {t.occurrences}x
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Metrics Tab */}
      {activeTab === 'metrics' && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#161a22] border border-[#262d3d]">
            <div className="text-slate-400 text-[11px]">Average Pace</div>
            <div className="text-lg font-bold text-slate-100 mt-1">{meeting.metrics.pacing_wpm} WPM</div>
            <div className="text-[10px] text-teal-400 mt-0.5">Optimal conversation tempo</div>
          </div>
          <div className="p-3 rounded-xl bg-[#161a22] border border-[#262d3d]">
            <div className="text-slate-400 text-[11px]">Sentiment Tone</div>
            <div className="text-sm font-bold text-emerald-400 mt-1">{meeting.metrics.sentiment_score}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">High team cohesion</div>
          </div>
          <div className="p-3 rounded-xl bg-[#161a22] border border-[#262d3d]">
            <div className="text-slate-400 text-[11px]">Staging Items</div>
            <div className="text-lg font-bold text-teal-300 mt-1">{meeting.metrics.action_items_count} Action Items</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{meeting.metrics.decisions_count} Decisions made</div>
          </div>
        </div>
      )}
    </div>
  );
};
