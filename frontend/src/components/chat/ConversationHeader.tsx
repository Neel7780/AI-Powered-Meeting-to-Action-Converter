import { useState } from 'react';
import {
  Hash,
  Lock,
  Search,
  PanelRight,
  Menu,
  X,
  User as UserIcon,
} from 'lucide-react';

import { useChat } from '../../context/ChatContext';

interface ConversationHeaderProps {
  onToggleSidebar?: () => void;
  onToggleDetails?: () => void;
  isDetailsOpen?: boolean;
}

export default function ConversationHeader({
  onToggleSidebar,
  onToggleDetails,
  isDetailsOpen,
}: ConversationHeaderProps) {
  const { activeConversation, onlineUsers, searchQuery, setSearchQuery } = useChat();
  const [showSearch, setShowSearch] = useState(false);

  if (!activeConversation) {
    return (
      <header className="flex h-14 items-center border-b border-slate-200 bg-white px-4">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="mr-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <p className="text-sm font-medium text-slate-400">Select a conversation</p>
      </header>
    );
  }

  const isChannel = activeConversation.type === 'channel';
  const isOnline = activeConversation.other_user?.id
    ? onlineUsers.has(activeConversation.other_user.id)
    : false;

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      {/* Left info */}
      <div className="flex items-center gap-3 truncate">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            title="Channels"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="flex items-center gap-2 truncate">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            {isChannel ? (
              activeConversation.is_private ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Hash className="h-4 w-4" />
              )
            ) : (
              <UserIcon className="h-4 w-4" />
            )}
          </div>

          <div className="truncate">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleDetails}
                className="text-left font-bold text-sm text-slate-900 truncate hover:text-indigo-600 transition"
                title="View details"
              >
                {activeConversation.name}
              </button>

              {!isChannel && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                  {isOnline ? 'Active now' : 'Offline'}
                </span>
              )}
            </div>

            {isChannel && activeConversation.topic && (
              <p className="truncate text-xs text-slate-400">
                {activeConversation.topic}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1">
        {showSearch ? (
          <div className="flex items-center rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversation..."
              className="ml-2 w-28 text-xs text-slate-900 outline-none sm:w-44"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setShowSearch(false);
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            title="Search messages"
          >
            <Search className="h-4 w-4" />
          </button>
        )}

        {onToggleDetails && (
          <button
            type="button"
            onClick={onToggleDetails}
            className={`rounded-lg p-2 transition ${
              isDetailsOpen
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
            title="Conversation Details"
          >
            <PanelRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  );
}

