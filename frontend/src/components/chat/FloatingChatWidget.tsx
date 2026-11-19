import { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import ChatInterface from './ChatInterface';

interface FloatingChatWidgetProps {
  workspaceId?: string;
}

export default function FloatingChatWidget({ workspaceId }: FloatingChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!workspaceId) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <div
        className={`mb-3 w-[92vw] sm:w-[480px] h-[580px] max-h-[calc(100vh-120px)] rounded-2xl border border-white/15 dashboard-surface bg-[#07070a]/95 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
          isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'hidden pointer-events-none'
        }`}
      >
        <ChatInterface
          workspaceId={workspaceId}
          isCompact={true}
          isOpen={isOpen}
          onMinimize={() => setIsOpen(false)}
          onClose={() => setIsOpen(false)}
          title="Meeting Copilot"
        />
      </div>

      {/* Floating Pill Toggle Button */}
      {isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="dashboard-chat-launcher group relative flex items-center gap-2 rounded-full border border-indigo-500/40 bg-[#0c0c16]/95 px-3.5 py-2 text-xs font-medium text-indigo-200 shadow-2xl backdrop-blur-md transition-all hover:border-indigo-400 hover:bg-[#141424] hover:text-white active:scale-95"
          aria-label="Minimize AI Meeting Copilot"
          title="Minimize AI Copilot"
        >
          <ChevronDown className="size-3.5 text-indigo-400 transition-transform group-hover:translate-y-0.5" />
          <span className="tracking-wide">Minimize Copilot</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="dashboard-chat-launcher group relative flex items-center gap-2.5 rounded-full border border-indigo-500/35 bg-[#08080c]/90 px-4 py-2.5 text-xs font-medium text-white shadow-2xl backdrop-blur-md transition-all hover:border-indigo-400 hover:bg-[#0d0d14] hover:shadow-indigo-500/20 active:scale-95"
          aria-label="Open AI Meeting Copilot"
          title="Open AI Meeting Copilot"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-indigo-500" />
          </span>

          <Sparkles className="size-4 text-indigo-400 transition-transform group-hover:rotate-12" />
          <span className="tracking-wide">AI Copilot</span>
        </button>
      )}
    </div>
  );
}
