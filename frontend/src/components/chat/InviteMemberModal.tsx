import { useState } from 'react';
import { UserPlus, Search, X, Loader2, Check, AlertCircle } from 'lucide-react';

import { useChat } from '../../context/ChatContext';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
  existingMemberIds: string[];
  onMemberAdded?: () => void;
}

export default function InviteMemberModal({
  isOpen,
  onClose,
  channelId,
  channelName,
  existingMemberIds,
  onMemberAdded,
}: InviteMemberModalProps) {
  const { workspaceMembers, addChannelMember } = useChat();

  const [query, setQuery] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentMemberIds = new Set([...existingMemberIds, ...addedIds]);

  const nonMembers = workspaceMembers.filter((m) => !currentMemberIds.has(m.id));

  const filteredMembers = nonMembers.filter((m) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    const name = (m.display_name || '').toLowerCase();
    const email = (m.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const handleAdd = async (userId: string) => {
    setAddingId(userId);
    setError(null);

    try {
      await addChannelMember(channelId, userId);
      setAddedIds((prev) => new Set([...prev, userId]));
      if (onMemberAdded) {
        onMemberAdded();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add member to channel');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex h-[80vh] max-h-[550px] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Add Members</h2>
              <p className="text-xs text-slate-500">Add workspace members to #{channelName}</p>
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

        {/* Search */}
        <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-3">
          <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email..."
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
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Member list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {nonMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-slate-700">All members already added</p>
              <p className="mt-1 text-xs text-slate-400">
                Every member in this workspace is already in #{channelName}.
              </p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No members found matching &quot;{query}&quot;
            </div>
          ) : (
            filteredMembers.map((member) => {
              const isAdding = addingId === member.id;
              const isAdded = addedIds.has(member.id);

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-2.5 transition hover:border-slate-200 hover:bg-slate-50/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-xs font-bold text-white">
                      {member.display_name?.charAt(0).toUpperCase() ||
                        member.email?.charAt(0).toUpperCase() ||
                        'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {member.display_name || member.email?.split('@')[0] || 'User'}
                      </p>
                      <p className="truncate text-[10px] text-slate-400">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isAdded ? (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                        <Check className="h-3.5 w-3.5" />
                        Added
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isAdding}
                        onClick={() => void handleAdd(member.id)}
                        className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {isAdding ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Add'
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

