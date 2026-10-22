import React from 'react';
import { 
  Video, 
  ChevronRight, 
  Share2, 
  Menu, 
  ExternalLink, 
  Layers, 
  CheckCircle2, 
  SlidersHorizontal 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { RichMeetingDetails } from '../../types/meetingDetails';

interface TopNavProps {
  meeting: RichMeetingDetails;
  onOpenShare: () => void;
  onToggleMobileMenu?: () => void;
  splitView: boolean;
  onToggleSplitView: () => void;
  isLiveBackend?: boolean;
}

export const MeetingTopNav: React.FC<TopNavProps> = ({
  meeting,
  onOpenShare,
  onToggleMobileMenu,
  splitView,
  onToggleSplitView,
  isLiveBackend = false
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

          <span
            className={`hidden md:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              isLiveBackend
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                : 'bg-indigo-950/60 text-indigo-300 border-indigo-700/50'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isLiveBackend ? 'bg-emerald-400 animate-pulse' : 'bg-indigo-400'
              }`}
            />
            <span>{isLiveBackend ? 'Live API' : 'Studio Demo'}</span>
          </span>
        </div>
      </div>

      {/* Right: Mode Switcher, Avatars & Share */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Split View Toggle */}
        <button
          onClick={onToggleSplitView}
          className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
            splitView 
              ? 'bg-teal-950/40 text-teal-300 border-teal-700/50' 
              : 'bg-[#141820] text-slate-400 border-[#222733] hover:text-white'
          }`}
          title="Toggle Summary & Transcript Side-by-Side View"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{splitView ? 'Tabs Mode' : 'Side-by-Side'}</span>
        </button>

        {/* Go to Staging Gate Review */}
        <button
          onClick={() => navigate('/meeting-review')}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-[#151921] hover:bg-[#1b212c] border border-[#232936] rounded-lg transition"
          title="Review and approve candidate action items"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
          <span>Staging Gate ({meeting.summary.decisions.length + 4})</span>
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

        {/* Share Button (Screenshot button) */}
        <button
          onClick={onOpenShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-slate-900 hover:bg-slate-100 font-semibold text-xs shadow-xs transition active:scale-95"
        >
          <Share2 className="w-3.5 h-3.5 text-slate-900" />
          <span>Share</span>
        </button>
      </div>
    </header>
  );
};
