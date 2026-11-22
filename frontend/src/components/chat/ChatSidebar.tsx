import { useState } from 'react';
import {
  AlertCircle,
  Hash,
  Lock,
  Plus,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  Compass,
} from 'lucide-react';

import { useChat } from '../../context/ChatContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import CreateChannelModal from './CreateChannelModal';
import NewDmModal from './NewDmModal';
import BrowseChannelsModal from './BrowseChannelsModal';

interface ChatSidebarProps {
  onSelectConversation?: () => void;
}

export default function ChatSidebar({ onSelectConversation }: ChatSidebarProps) {
  const { currentWorkspace, currentRole } = useWorkspace();
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    loadingConversations,
    conversationsError,
    refreshConversations,
    onlineUsers,
    unreadCounts,
  } = useChat();

  const [filterText, setFilterText] = useState('');
  const [showChannels, setShowChannels] = useState(true);
  const [showDms, setShowDms] = useState(true);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [showBrowseChannelsModal, setShowBrowseChannelsModal] = useState(false);
  const [showNewDmModal, setShowNewDmModal] = useState(false);

  const channels = conversations.filter((c) => c.type === 'channel');
  const dms = conversations.filter((c) => c.type === 'dm');

  const filteredChannels = channels.filter((c) =>
    (c.name || '').toLowerCase().includes(filterText.toLowerCase().trim())
  );

  const filteredDms = dms.filter((c) =>
    (c.name || '').toLowerCase().includes(filterText.toLowerCase().trim())
  );

  const handleSelect = (id: string) => {
    setActiveConversationId(id);
    if (onSelectConversation) onSelectConversation();
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-slate-200 bg-slate-50/70 text-slate-800 lg:w-64">
      {/* Workspace Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 bg-white">
        <div className="truncate">
          <h2 className="truncate text-sm font-bold text-slate-900">
            {currentWorkspace?.name || 'Workspace'}
          </h2>
          <p className="text-[10px] text-slate-400 capitalize">
            {currentRole || 'member'} • Chat
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewDmModal(true)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          title="New Message"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Quick Filter */}
      <div className="p-3">
        <div className="flex items-center rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-xs focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-200">
          <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Jump to channel or DM..."
            className="ml-2 w-full text-xs text-slate-800 placeholder-slate-400 outline-none"
          />
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4">
        {conversationsError && (
          <div className="mx-1 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Failed to load chats</p>
                <p className="mt-0.5 text-[11px] text-red-600">{conversationsError}</p>
                <button
                  type="button"
                  onClick={() => void refreshConversations()}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {loadingConversations && conversations.length === 0 ? (
          <div className="space-y-2 px-2 py-2 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 rounded-xl bg-slate-200/70" />
            ))}
          </div>
        ) : (
        <>
        {/* Channels Section */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-slate-500">
            <button
              type="button"
              onClick={() => setShowChannels((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider hover:text-slate-800"
            >
              {showChannels ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <span>Channels ({filteredChannels.length})</span>
            </button>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setShowBrowseChannelsModal(true)}
                className="rounded p-1 hover:bg-slate-200 hover:text-slate-800"
                title="Browse Public Channels"
              >
                <Compass className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowCreateChannelModal(true)}
                className="rounded p-1 hover:bg-slate-200 hover:text-slate-800"
                title="Create Channel"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {showChannels && (
            <div className="mt-1 space-y-0.5">
              {filteredChannels.length === 0 ? (
                <p className="px-3 py-1.5 text-xs text-slate-400">No channels found</p>
              ) : (
                filteredChannels.map((channel) => {
                  const isActive = activeConversationId === channel.id;
                  const unread = unreadCounts[channel.id] || 0;

                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => handleSelect(channel.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                          : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {channel.is_private ? (
                          <Lock className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        ) : (
                          <Hash className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        )}
                        <span className="truncate">{channel.name}</span>
                      </div>

                      {unread > 0 && !isActive && (
                        <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {unread}
                        </span>
                      )}
                    </button>
                  );
                })
              )}

              {/* Browse all channels link */}
              <button
                type="button"
                onClick={() => setShowBrowseChannelsModal(true)}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 transition"
              >
                <Compass className="h-3.5 w-3.5 text-slate-400" />
                <span>Browse all channels</span>
              </button>
            </div>
          )}
        </div>

        {/* Direct Messages Section */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-slate-500">
            <button
              type="button"
              onClick={() => setShowDms((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider hover:text-slate-800"
            >
              {showDms ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <span>Direct Messages ({filteredDms.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNewDmModal(true)}
              className="rounded p-1 hover:bg-slate-200 hover:text-slate-800"
              title="Start DM"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {showDms && (
            <div className="mt-1 space-y-0.5">
              {filteredDms.length === 0 ? (
                <p className="px-3 py-1.5 text-xs text-slate-400">No direct messages yet</p>
              ) : (
                filteredDms.map((dm) => {
                  const isActive = activeConversationId === dm.id;
                  const isOnline = dm.other_user?.id
                    ? onlineUsers.has(dm.other_user.id)
                    : false;
                  const unread = unreadCounts[dm.id] || 0;

                  return (
                    <button
                      key={dm.id}
                      type="button"
                      onClick={() => handleSelect(dm.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                          : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div className="relative shrink-0">
                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-lg text-[10px] font-bold ${
                              isActive ? 'bg-white text-indigo-600' : 'bg-slate-300 text-slate-700'
                            }`}
                          >
                            {dm.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          {isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white bg-emerald-500" />
                          )}
                        </div>
                        <span className="truncate">{dm.name}</span>
                      </div>

                      {unread > 0 && !isActive && (
                        <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {unread}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* Modals */}
      <CreateChannelModal
        isOpen={showCreateChannelModal}
        onClose={() => setShowCreateChannelModal(false)}
      />

      <BrowseChannelsModal
        isOpen={showBrowseChannelsModal}
        onClose={() => setShowBrowseChannelsModal(false)}
        onCreateChannel={() => {
          setShowBrowseChannelsModal(false);
          setShowCreateChannelModal(true);
        }}
      />

      <NewDmModal
        isOpen={showNewDmModal}
        onClose={() => setShowNewDmModal(false)}
      />
    </aside>
  );
}
