import { useState, useMemo } from 'react';
import { X, Search, Hash, MessageSquare, Send, Loader2, Check } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import * as chatService from '../../services/chatService';
import type { WorkspaceMessage } from '../../types/workspaceChat';

interface ForwardMessageModalProps {
  message: WorkspaceMessage;
  onClose: () => void;
}

export default function ForwardMessageModal({
  message,
  onClose,
}: ForwardMessageModalProps) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { conversations } = useChat();

  const [search, setSearch] = useState('');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [isForwarding, setIsForwarding] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      // Don't forward back to the exact same conversation
      if (c.id === message.conversation_id) return false;
      const name = (c.name || '').toLowerCase();
      return name.includes(q);
    });
  }, [conversations, search, message.conversation_id]);

  const handleForward = async () => {
    if (!selectedConvId || !currentWorkspace || !user) return;
    setIsForwarding(true);
    setErrorMessage('');

    try {
      const senderName = message.sender?.display_name || 'Member';
      let forwardContent = `> **Forwarded from ${senderName}:**\n> ${message.content.replace(/\n/g, '\n> ')}`;
      if (comment.trim()) {
        forwardContent = `${comment.trim()}\n\n${forwardContent}`;
      }

      await chatService.sendMessage({
        workspaceId: currentWorkspace.id,
        conversationId: selectedConvId,
        senderId: user.id,
        content: forwardContent,
      });

      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: unknown) {
      console.error('Failed to forward message:', err);
      const msg = err instanceof Error ? err.message : 'Failed to forward message';
      setErrorMessage(msg);
      setIsForwarding(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Forward message"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl transition animate-in fade-in zoom-in-95 dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Forward Message
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Message Preview */}
        <div className="my-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs dark:border-indigo-900/40 dark:bg-indigo-950/30">
          <p className="font-semibold text-indigo-900 dark:text-indigo-300">
            {message.sender?.display_name || 'Member'}
          </p>
          <p className="mt-1 line-clamp-3 text-slate-700 dark:text-slate-300">
            {message.content}
          </p>
        </div>

        {/* Search destination */}
        <div className="relative my-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels or DMs..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* Conversation List */}
        <div className="max-h-48 overflow-y-auto space-y-1">
          {filteredConversations.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">
              No conversations found.
            </p>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedConvId === conv.id;
              const isChannel = conv.type === 'channel';

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                    isSelected
                      ? 'bg-indigo-50 font-semibold text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {isChannel ? (
                      <Hash className="h-4 w-4 shrink-0 text-slate-400" />
                    ) : (
                      <MessageSquare className="h-4 w-4 shrink-0 text-indigo-500" />
                    )}
                    <span className="truncate">{conv.name || 'Direct Message'}</span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-indigo-600" />}
                </button>
              );
            })
          )}
        </div>

        {/* Optional Comment */}
        <div className="mt-3">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add an optional comment..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* Error message */}
        {errorMessage && (
          <p className="mt-2 text-xs text-red-600">{errorMessage}</p>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedConvId || isForwarding || isSuccess}
            onClick={handleForward}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isForwarding ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Forwarding...
              </>
            ) : isSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" /> Sent!
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" /> Forward
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

