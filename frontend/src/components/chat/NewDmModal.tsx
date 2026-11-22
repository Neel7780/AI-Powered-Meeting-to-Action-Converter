import { useState } from 'react';
import { Search, X, Loader2, MessageSquare } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

interface NewDmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewDmModal({ isOpen, onClose }: NewDmModalProps) {
  const { user } = useAuth();
  const { workspaceMembers, onlineUsers, openDM } = useChat();

  const [query, setQuery] = useState('');
  const [openingUserId, setOpeningUserId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Filter members excluding current user
  const eligibleMembers = workspaceMembers.filter((m) => m.id !== user?.id);

  const filteredMembers = eligibleMembers.filter((m) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (m.display_name && m.display_name.toLowerCase().includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q))
    );
  });

  const handleSelectUser = async (targetUserId: string) => {
    setOpeningUserId(targetUserId);
    setError('');

    try {
      await openDM(targetUserId);
      onClose();
      setQuery('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start direct message.';
      setError(message);
    } finally {
      setOpeningUserId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Direct Messages</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Member Search */}
        <div className="mt-4 flex items-center rounded-xl border border-slate-300 px-3 py-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="ml-2 w-full text-sm text-slate-900 outline-none"
            autoFocus
          />
        </div>

        {/* Members List */}
        <div className="mt-3 max-h-64 overflow-y-auto space-y-1">
          {filteredMembers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No matching workspace members found.
            </div>
          ) : (
            filteredMembers.map((member) => {
              const isOnline = onlineUsers.has(member.id);
              const isOpening = openingUserId === member.id;

              return (
                <button
                  key={member.id}
                  type="button"
                  disabled={isOpening}
                  onClick={() => handleSelectUser(member.id)}
                  className="flex w-full items-center justify-between rounded-xl p-2.5 text-left transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-sm">
                        {member.display_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {member.display_name}
                      </p>
                      <p className="text-xs text-slate-400">{member.email}</p>
                    </div>
                  </div>

                  <div>
                    {isOpening ? (
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                    ) : (
                      <span className="text-xs font-semibold text-indigo-600 hover:underline">
                        Message
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
