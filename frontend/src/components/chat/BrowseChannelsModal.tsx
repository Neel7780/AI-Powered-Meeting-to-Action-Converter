import { useState, useEffect, useCallback } from 'react';
import {
  Hash,
  Search,
  X,
  Users,
  Check,
  Loader2,
  Compass,
  Plus,
  AlertCircle,
} from 'lucide-react';

import { useChat } from '../../context/ChatContext';
import type { ChannelDiscoveryItem } from '../../types/chat';

interface BrowseChannelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateChannel?: () => void;
}

export default function BrowseChannelsModal({
  isOpen,
  onClose,
  onCreateChannel,
}: BrowseChannelsModalProps) {
  const { discoverPublicChannels, joinPublicChannel, setActiveConversationId } = useChat();

  const [query, setQuery] = useState('');
  const [channels, setChannels] = useState<ChannelDiscoveryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const fetchChannels = useCallback(
    async (searchQuery: string) => {
      setLoading(true);
      setError(null);
      try {
        const results = await discoverPublicChannels(searchQuery.trim() || undefined);
        setChannels(results);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to search public channels');
      } finally {
        setLoading(false);
      }
    },
    [discoverPublicChannels]
  );

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setChannels([]);
      setError(null);
      return;
    }

    const timer = setTimeout(() => {
      void fetchChannels(query);
    }, 200);

    return () => clearTimeout(timer);
  }, [isOpen, query, fetchChannels]);

  if (!isOpen) return null;

  const handleJoin = async (channel: ChannelDiscoveryItem) => {
    if (channel.is_member) {
      setActiveConversationId(channel.id);
      onClose();
      return;
    }

    setJoiningId(channel.id);
    setError(null);
    try {
      await joinPublicChannel(channel.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join channel');
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex h-[85vh] max-h-[640px] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Browse Channels</h2>
              <p className="text-xs text-slate-500">
                Discover and join public channels in this workspace
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-3">
          <div className="flex flex-1 items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by channel name or description..."
              className="ml-2 w-full text-xs text-slate-800 placeholder-slate-400 outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {onCreateChannel && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onCreateChannel();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Channel</span>
            </button>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {loading && channels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
              <p className="mt-2 text-xs">Finding public channels...</p>
            </div>
          ) : channels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                <Hash className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No public channels found</p>
              <p className="mt-1 text-xs text-slate-400 max-w-sm">
                {query
                  ? `No public channels matched "${query}". Try searching for something else or create a new channel.`
                  : 'There are no public channels in this workspace yet.'}
              </p>
            </div>
          ) : (
            channels.map((chan) => {
              const isJoining = joiningId === chan.id;
              return (
                <div
                  key={chan.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/80 p-3.5 transition hover:border-slate-300 hover:bg-slate-50/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <Hash className="h-4 w-4" />
                      </div>
                      <span className="truncate text-sm font-bold text-slate-900">
                        {chan.name}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        <Users className="h-3 w-3 text-slate-400" />
                        {chan.member_count} {chan.member_count === 1 ? 'member' : 'members'}
                      </span>
                    </div>

                    {(chan.topic || chan.description) && (
                      <p className="mt-1.5 line-clamp-2 text-xs text-slate-600">
                        {chan.topic || chan.description}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    {chan.is_member ? (
                      <button
                        type="button"
                        onClick={() => handleJoin(chan)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Joined</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isJoining}
                        onClick={() => void handleJoin(chan)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
                      >
                        {isJoining ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Joining...</span>
                          </>
                        ) : (
                          <span>Join</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-3 text-right">
          <span className="text-xs text-slate-400">
            {channels.length} {channels.length === 1 ? 'channel' : 'channels'} available
          </span>
        </div>
      </div>
    </div>
  );
}

