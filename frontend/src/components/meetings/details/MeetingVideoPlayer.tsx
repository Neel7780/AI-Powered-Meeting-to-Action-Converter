import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Calendar,
  Sparkles
} from 'lucide-react';
import type { RichMeetingDetails } from '../../../types/meetingDetails';

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
    <div className="relative rounded-2xl overflow-hidden bg-[#0a0c10] border border-[#202531] shadow-2xl flex flex-col group select-none">
      {/* Aspect Ratio Video Container */}
      <div className="relative aspect-video w-full bg-gradient-to-br from-[#121620] via-[#0b0e14] to-[#151b26] flex items-center justify-center overflow-hidden">
        {/* Animated Gradient Glow when playing */}
        <div
          className={`absolute inset-0 bg-radial from-teal-500/10 via-transparent to-transparent pointer-events-none transition-opacity duration-1000 ${
            isPlaying ? 'opacity-100' : 'opacity-40'
          }`}
        />

        {/* Video Canvas Placeholder matching screenshot with avatars */}
        <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center space-y-3">
          <div className="relative flex items-center justify-center">
            {/* Pulsing ring during playback */}
            {isPlaying && (
              <div className="absolute w-24 h-24 rounded-full bg-teal-400/20 animate-ping" />
            )}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-teal-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-xl ring-2 ring-teal-400/30">
              <span className="text-3xl font-black text-white tracking-widest">DS</span>
            </div>
          </div>

          <div className="space-y-1 max-w-md">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight drop-shadow-sm">
              {meeting.title}
            </h2>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>{meeting.date_formatted}</span>
              </span>
            </div>
          </div>

          {/* Current Speaker Banner Indicator (Screenshot replica) */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs text-slate-200">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span>Active Speaker: <strong className="text-teal-300">Asha Rao</strong> (PM)</span>
          </div>
        </div>

        {/* Big Center Play/Pause Overlay Button */}
        <button
          onClick={onTogglePlay}
          className="absolute z-20 w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all transform hover:scale-105 active:scale-95 shadow-2xl"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-white" />
          ) : (
            <Play className="w-6 h-6 fill-white translate-x-0.5" />
          )}
        </button>

        {/* Chapter pill indicator badge overlay in top-left */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-xs text-slate-200">
          <Sparkles className="w-3 h-3 text-teal-400" />
          <span className="font-medium text-teal-300">Chapter 3:</span>
          <span className="truncate max-w-[180px] sm:max-w-[260px] text-slate-300">
            Action Item Staging Gate
          </span>
        </div>
      </div>

      {/* Video Scrubber & Playhead Controls Bar */}
      <div className="bg-[#0f1218] border-t border-[#1e2330] p-3 space-y-2 select-none">
        {/* Progress Bar Slider */}
        <div className="relative flex items-center group/scrubber cursor-pointer">
          <input
            type="range"
            min={0}
            max={totalSeconds}
            value={playbackSeconds}
            onChange={handleSliderChange}
            className="w-full h-1.5 bg-[#1e2330] rounded-lg appearance-none cursor-pointer accent-teal-400 focus:outline-none"
          />
          {/* Visual Custom Progress Fill */}
          <div
            className="absolute left-0 top-0 bottom-0 h-1.5 bg-gradient-to-r from-teal-500 to-teal-300 rounded-lg pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Control Buttons Row */}
        <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
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
  );
};
