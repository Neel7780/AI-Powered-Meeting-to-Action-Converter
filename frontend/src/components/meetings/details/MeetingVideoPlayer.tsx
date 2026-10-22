import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Settings, 
  Tag, 
  Calendar,
  Sparkles,
  Sliders
} from 'lucide-react';
import type { RichMeetingDetails } from '../../types/meetingDetails';

interface VideoPlayerProps {
  meeting: RichMeetingDetails;
  playbackSeconds: number;
  onSeek: (seconds: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export const MeetingVideoPlayer: React.FC<VideoPlayerProps> = ({
  meeting,
  playbackSeconds,
  onSeek,
  isPlaying,
  onTogglePlay
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const totalSeconds = meeting.total_duration_seconds; // 2747s (45:47)

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSec = Number(e.target.value);
    onSeek(newSec);
  };

  const handleSkip = (delta: number) => {
    const newSec = Math.max(0, Math.min(totalSeconds, playbackSeconds + delta));
    onSeek(newSec);
  };

  const progressPercent = totalSeconds > 0 ? (playbackSeconds / totalSeconds) * 100 : 0;

  return (
    <div className="flex flex-col space-y-3">
      {/* Video Container Box */}
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#12151c] to-[#0a0c10] border border-[#202531] shadow-2xl group flex items-center justify-center">
        {/* Main Presenter Video Image (Man with glasses smiling / waving) */}
        <img
          src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1200&q=80"
          alt="Meeting Presenter Karthik"
          className="w-full h-full object-cover select-none pointer-events-none transition duration-700 filter contrast-[1.05]"
        />

        {/* Ambient Top Shadow Overlay */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

        {/* Picture-in-Picture Box (Second Presenter - Asha smiling) */}
        <div className="absolute right-4 bottom-14 sm:bottom-16 w-24 sm:w-36 aspect-video rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black/80 z-20 transition transform group-hover:scale-105">
          <img
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80"
            alt="Participant Asha"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[9px] font-medium text-white">
            Asha
          </div>
        </div>

        {/* Live Audio Indicator Animation when playing */}
        {isPlaying && (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] text-teal-300">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping mr-1" />
            <span>Active Speaker: Karthik</span>
          </div>
        )}

        {/* Play/Pause Center Overlay on Hover */}
        <button
          onClick={onTogglePlay}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition duration-200 cursor-pointer"
        >
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-2xl transform active:scale-95 transition">
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-white" />
            ) : (
              <Play className="w-6 h-6 fill-white translate-x-0.5" />
            )}
          </div>
        </button>

        {/* Bottom Video Controls Bar */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-6 pb-2 px-3 sm:px-4 z-30 flex flex-col gap-2">
          {/* Progress Bar Track */}
          <div className="relative w-full flex items-center group/scrubber cursor-pointer">
            <input
              type="range"
              min={0}
              max={totalSeconds}
              value={playbackSeconds}
              onChange={handleSliderChange}
              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white focus:outline-none transition-all group-hover/scrubber:h-1.5"
            />
            {/* Visual White Scrub Dot */}
            <div
              className="absolute w-3 h-3 bg-white rounded-full shadow pointer-events-none -translate-x-1/2"
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          {/* Controls Bottom Row */}
          <div className="flex items-center justify-between text-white text-xs select-none">
            {/* Left Controls: Time & Volume */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] sm:text-xs font-semibold px-2 py-0.5 bg-black/40 rounded-md border border-white/10">
                {formatTime(playbackSeconds)}
              </span>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1 hover:text-teal-300 transition"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Center Controls: 10s Rewind, Play/Pause, 10s Forward */}
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => handleSkip(-10)}
                className="p-1 hover:text-teal-300 transition"
                title="Rewind 10 seconds"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={onTogglePlay}
                className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center hover:bg-slate-200 transition active:scale-95 shadow-md"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-black" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-black translate-x-0.5" />
                )}
              </button>

              <button
                onClick={() => handleSkip(10)}
                className="p-1 hover:text-teal-300 transition"
                title="Forward 10 seconds"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Right Controls: Total Time, Speed, Settings & Fullscreen */}
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-mono text-[11px] sm:text-xs text-slate-400 hidden sm:inline">
                {meeting.total_duration_formatted}
              </span>

              {/* Speed selector */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="px-1.5 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[10px] font-semibold tracking-wider transition"
                >
                  {playbackSpeed}x
                </button>
                {showSpeedMenu && (
                  <div className="absolute right-0 bottom-full mb-1 bg-[#161a22] border border-[#2b3240] rounded-lg shadow-xl p-1 z-50 flex flex-col text-xs">
                    {[1, 1.25, 1.5, 2].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => {
                          setPlaybackSpeed(spd);
                          setShowSpeedMenu(false);
                        }}
                        className={`px-2 py-1 rounded text-left hover:bg-[#202735] ${
                          playbackSpeed === spd ? 'text-teal-300 font-bold' : 'text-slate-300'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1 hover:text-teal-300 transition"
                title="Fullscreen"
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4" />
                ) : (
                  <Maximize className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Meeting Title & Meta Badges (Below Video in Screenshot) */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
            {meeting.title}
          </h1>

          <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Tag className="w-3.5 h-3.5 text-teal-400" />
              <span>{meeting.tags[0]}</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{meeting.date_formatted}</span>
            </div>

            <div className="hidden sm:flex items-center gap-1 text-[11px] text-teal-400 bg-teal-950/40 border border-teal-800/40 px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" />
              <span>Gemini 3.1 Flash-Lite</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
