import React, { useState } from 'react';
import { 
  Home, 
  Calendar, 
  Video, 
  FileText, 
  Layers, 
  Users, 
  Folder, 
  Plus, 
  Settings, 
  HelpCircle, 
  ChevronDown, 
  Search,
  Sparkles,
  CheckSquare
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export const MeetingDetailsSidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const generalNavItems = [
    { label: 'Home', icon: Home, path: '/dashboard' },
    { label: 'Calendar', icon: Calendar, path: '/dashboard' },
    { label: 'Meetings', icon: Video, path: '/meetings', active: true },
    { label: 'Tasks', icon: CheckSquare, path: '/tasks' },
    { label: 'Notes', icon: FileText, path: '/meeting-review' },
    { label: 'Integrations', icon: Layers, path: '/dashboard' },
    { label: 'Team', icon: Users, path: '/team' },
  ];

  const workspacesFolders = [
    { label: 'Client Calls', count: 8 },
    { label: 'Team Review', count: 14, active: true },
    { label: 'Personal', count: 3 },
  ];

  return (
    <aside className="w-64 h-full bg-[#0d0f12] text-slate-300 border-r border-[#1e2229] flex flex-col select-none text-[13px] font-sans">
      {/* Workspace Switcher */}
      <div className="p-3.5 border-b border-[#1e2229]">
        <button
          onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
          className="w-full flex items-center justify-between p-2 rounded-xl bg-[#13161c] hover:bg-[#1a1e27] border border-[#222733] transition group text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-inner flex-shrink-0">
              K
            </div>
            <div className="truncate">
              <div className="font-semibold text-white truncate text-xs leading-tight">
                Karthik's Workspace
              </div>
              <div className="text-[11px] text-slate-400 truncate">Karthik (Admin)</div>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition flex-shrink-0" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search meetings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#13161c] border border-[#222733] rounded-lg text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 transition"
          />
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 space-y-5 py-2 scrollbar-thin scrollbar-thumb-slate-800">
        {/* General */}
        <div>
          <div className="px-2 pb-1.5 text-[10px] font-semibold tracking-wider uppercase text-slate-400">
            General
          </div>
          <div className="space-y-0.5">
            {generalNavItems.map((item) => {
              const Icon = item.icon;
              const isSelected = item.path === '/meetings' ? true : location.pathname === item.path;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    navigate(item.path);
                    onCloseMobile?.();
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-medium transition ${
                    isSelected
                      ? 'bg-[#1e232e] text-white font-semibold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#151820]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-teal-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Workspaces Folders */}
        <div>
          <div className="px-2 pb-1.5 text-[10px] font-semibold tracking-wider uppercase text-slate-400">
            Workspaces
          </div>
          <div className="space-y-0.5">
            {workspacesFolders.map((folder) => (
              <div
                key={folder.label}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition ${
                  folder.active
                    ? 'text-teal-300 bg-teal-950/20 border border-teal-800/30 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#151820]'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Folder className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{folder.label}</span>
                </div>
                <span className="text-[10px] text-slate-400 bg-[#161a22] px-1.5 py-0.5 rounded">
                  {folder.count}
                </span>
              </div>
            ))}

            <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-teal-400 hover:bg-[#151820] text-xs transition">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Folder</span>
            </button>
          </div>
        </div>

        {/* AI Quick Insight Tag */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-teal-950/20 border border-indigo-800/30 text-xs text-slate-300 space-y-1.5">
          <div className="flex items-center gap-1.5 text-teal-300 font-semibold text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>AI Staging Gate Active</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Gemini 3.1 Flash-Lite extracted 4 action items and 3 decisions with sub-second sync.
          </p>
        </div>
      </div>

      {/* Bottom Settings */}
      <div className="p-3 border-t border-[#1e2229] space-y-0.5">
        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#151820] transition"
        >
          <Settings className="w-4 h-4 text-slate-400" />
          <span>Settings</span>
        </button>
        <button
          onClick={() => window.open('https://github.com/Neel7780/AI-Powered-Meeting-to-Action-Converter', '_blank')}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#151820] transition"
        >
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span>Help center</span>
        </button>
      </div>
    </aside>
  );
};
