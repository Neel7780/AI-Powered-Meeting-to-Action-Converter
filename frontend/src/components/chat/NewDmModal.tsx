import { useState } from 'react';
import { Search, X, Loader2, MessageSquare, Users, Check } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

interface NewDmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewDmModal({ isOpen, onClose }: NewDmModalProps) {
  const { user } = useAuth();
  const { workspaceMembers, onlineUsers, openDM, createGroupConversation } = useChat();

  const [query, setQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const removeSelectedUser = (userId: string) => {
    setSelectedUserIds((prev) => prev.filter((id) => id !== userId));
  };

  const handleSubmit = async () => {
    if (selectedUserIds.length === 0) return;
    setIsSubmitting(true);
    setError('');

    try {
      if (selectedUserIds.length === 1) {
        // 1:1 Direct Message
        await openDM(selectedUserIds[0]);
      } else {
        // Group Conversation (2+ other members)
        await createGroupConversation({
          participantIds: selectedUserIds,
          name: groupName.trim() || undefined,
        });
      }
      onClose();
      setSelectedUserIds([]);
      setGroupName('');
      setQuery('');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to start conversation.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isGroup = selectedUserIds.length >= 2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New conversation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition animate-in fade-in zoom-in-95 dark:border dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              {isGroup ? <Users className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isGroup ? 'New Group Conversation' : 'Direct Messages'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Selected Member Pills */}
        {selectedUserIds.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selectedUserIds.map((id) => {
              const mem = workspaceMembers.find((m) => m.id === id);
              const displayName = mem?.display_name || mem?.email?.split('@')[0] || 'User';
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300"
                >
                  {displayName}
                  <button
                    type="button"
                    onClick={() => removeSelectedUser(id)}
                    className="rounded-full p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Optional Group Name Input when 2+ members are chosen */}
        {isGroup && (
          <div className="mt-3">
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name (optional)..."
              maxLength={80}
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        )}

        {/* Member Search */}
        <div className="mt-3 flex items-center rounded-xl border border-slate-300 px-3 py-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="ml-2 w-full text-sm text-slate-900 outline-none dark:bg-transparent dark:text-white"
            autoFocus
          />
        </div>

        {/* Members List */}
        <div className="mt-3 max-h-60 overflow-y-auto space-y-1">
          {filteredMembers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No matching workspace members found.
            </div>
          ) : (
            filteredMembers.map((member) => {
              const isOnline = onlineUsers.has(member.id);
              const isSelected = selectedUserIds.includes(member.id);

              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleSelectUser(member.id)}
                  className={`flex w-full items-center justify-between rounded-xl p-2.5 text-left transition ${
                    isSelected
                      ? 'bg-indigo-50/80 font-medium text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
                  }`}
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
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {member.display_name}
                      </p>
                      <p className="text-xs text-slate-400">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    {isSelected ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    ) : (
                      <div className="h-5 w-5 rounded-full border border-slate-300 dark:border-slate-600" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer / Submit Button */}
        {selectedUserIds.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3 flex justify-end dark:border-slate-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isGroup
                ? `Start Group Chat (${selectedUserIds.length} members)`
                : 'Start Direct Message'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
