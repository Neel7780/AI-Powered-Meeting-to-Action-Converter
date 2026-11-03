import React from 'react';
import { 
  Video, 
  ChevronRight, 
  Share2, 
  Menu, 
  Layers, 
  CheckCircle2, 
  SlidersHorizontal 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { RichMeetingDetails } from '../../../types/meetingDetails';

interface TopNavProps {
  meeting: RichMeetingDetails;
  onOpenShare: () => void;
  onToggleMobileMenu?: () => void;
  splitView: boolean;
  onToggleSplitView: () => void;
}

export const MeetingTopNav: React.FC<TopNavProps> = ({
  meeting,
  onOpenShare,
  onToggleMobileMenu,
  splitView,
  onToggleSplitView,
}) => {
  const navigate = useNavigate();

  return (
    <header className="h-14 border-b border-[#1e2229] bg-[#0f1217] px-4 flex items-center justify-between gap-3 text-slate-300 select-none">
      {/* Left: Mobile Menu & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a1f29] lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium truncate">
          <div className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition cursor-pointer" onClick={() => navigate('/meetings')}>
            <Video className="w-4 h-4 text-slate-400" />
            <span>Meetings</span>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-slate-400 hidden md:inline hover:text-slate-200 transition cursor-pointer">November</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 hidden md:inline flex-shrink-0" />
          <span className="text-slate-400 hidden sm:inline hover:text-slate-200 transition cursor-pointer">Client 04</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 hidden sm:inline flex-shrink-0" />

          <span className="font-semibold text-white truncate">
            {meeting.title}
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Toggle split view on desktop */}
        <button
          onClick={onToggleSplitView}
          className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-lg transition ${
            splitView
              ? 'bg-teal-950/80 text-teal-300 border-teal-700/60 shadow-xs'
              : 'bg-[#151921] hover:bg-[#1b212c] text-slate-400 hover:text-slate-200 border-[#232936]'
          }`}
          title="Toggle split screen view"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{splitView ? 'Split: ON' : 'Split: OFF'}</span>
        </button>

        {/* Share Button */}
        <button
          onClick={onOpenShare}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-lg shadow-xs transition active:scale-95"
          title="Share meeting summary via Link, WhatsApp or Email"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Share</span>
        </button>

        {/* Go to Review */}
        <button
          onClick={() => navigate('/meeting-review')}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-[#151921] hover:bg-[#1b212c] border border-[#232936] rounded-lg transition"
          title="Open Action Item Review & Staging Gate"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
          <span className="hidden md:inline">Review Items</span>
        </button>

        {/* Go to Kanban */}
        <button
          onClick={() => navigate('/tasks')}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-[#151921] hover:bg-[#1b212c] border border-[#232936] rounded-lg transition"
          title="Go to Kanban Board"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span>Board</span>
        </button>

        {/* Participant Avatars */}
        <div className="flex items-center -space-x-1.5 mr-1">
          {meeting.participants.map((p, idx) => (
            <div
              key={idx}
              className="relative group cursor-pointer"
              title={`${p.name} (${p.role})`}
            >
              {p.avatar ? (
                <img
                  src={p.avatar}
                  alt={p.name}
                  className="w-7 h-7 rounded-full border-2 border-[#0f1217] object-cover ring-1 ring-[#2a303d]"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-700 border-2 border-[#0f1217] flex items-center justify-center text-[10px] font-bold text-white">
                  {p.initials}
                </div>
              )}
              {p.online && (
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-[#0f1217] rounded-full" />
              )}
            </div>
          ))}
        </div>
      </div>
    </header>
  );
};
