import React from 'react';
import type { RichMeetingDetails } from '../../../types/meetingDetails';

interface VideoPlayerProps {
  meeting: RichMeetingDetails;
  playbackSeconds: number;
  onSeek: (seconds: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

export const MeetingVideoPlayer: React.FC<VideoPlayerProps> = ({ meeting }) => (
  <section className="rounded-2xl border border-white/10 p-8 text-center">
    <h2 className="font-semibold">{meeting.title}</h2>
    <p className="mt-3 text-slate-400">Recording playback is unavailable for this meeting.</p>
    <p className="text-sm text-slate-400">Use the transcript and chapters to review the meeting.</p>
  </section>
);
