import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  Hash,
  Loader2,
  RefreshCw,
  User as UserIcon,
} from 'lucide-react';

import type { WorkspaceMessage } from '../../types/workspaceChat';
import { useChat } from '../../context/ChatContext';
import MessageItem from './MessageItem';

interface MessageListProps {
  onReply: (message: WorkspaceMessage) => void;
}

function getDateLabel(isoString: string): string {
  const d = new Date(isoString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function MessageList({ onReply }: MessageListProps) {
  const {
    messages,
    loadingMessages,
    loadingOlderMessages,
    hasMoreMessages,
    messagesError,
    loadOlderMessages,
    retryLoadMessages,
    activeConversation,
    typingUsers,
    searchQuery,
  } = useChat();

  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Auto scroll to bottom
  const scrollToBottom = (smooth = true) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  useEffect(() => {
    lastMessageIdRef.current = null;
    scrollToBottom(false);
  }, [activeConversation?.id]);

  // Only scroll to bottom when a NEW message arrives at the end (not when prepending older history)
  const latestMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
  useEffect(() => {
    if (!latestMessageId) return;
    const prevLatestId = lastMessageIdRef.current;
    lastMessageIdRef.current = latestMessageId;

    if (!containerRef.current) return;
    if (prevLatestId === null) {
      // Initial load of conversation: jump straight to latest messages
      scrollToBottom(false);
      return;
    }
    if (prevLatestId !== latestMessageId) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 180;
      if (isNearBottom) {
        scrollToBottom(true);
      }
    }
  }, [latestMessageId]);

  const handleLoadOlder = async () => {
    const el = containerRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    const prevScrollTop = el?.scrollTop ?? 0;

    await loadOlderMessages();

    if (el) {
      requestAnimationFrame(() => {
        const nextScrollHeight = el.scrollHeight;
        el.scrollTop = prevScrollTop + (nextScrollHeight - prevScrollHeight);
      });
    }
  };

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isAway = scrollHeight - scrollTop - clientHeight > 200;
      setShowScrollBottom(isAway);
    }
  };

  // Filter messages if search query exists
  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) =>
        m.content.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : messages;

  const typingNames = Object.values(typingUsers);

  if (loadingMessages) {
    return (
      <div className="flex-1 space-y-4 p-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-10 w-10 rounded-2xl bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-slate-200" />
              <div className="h-3 w-3/4 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="relative flex-1 overflow-y-auto px-2 py-4 sm:px-4"
    >
      {/* Error State with Retry */}
      {messagesError && messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-base font-bold text-slate-900">Could not load messages</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">{messagesError}</p>
          <button
            type="button"
            onClick={() => void retryLoadMessages()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600 shadow-sm">
            {activeConversation?.type === 'channel' ? (
              <Hash className="h-8 w-8" />
            ) : (
              <UserIcon className="h-8 w-8" />
            )}
          </div>

          <h3 className="mt-4 text-lg font-bold text-slate-900">
            {activeConversation?.type === 'channel'
              ? `Welcome to #${activeConversation.name}!`
              : `This is the start of your direct messages with ${
                  activeConversation?.name || 'this team member'
                }`}
          </h3>

          <p className="mt-1 max-w-sm text-sm text-slate-500">
            {activeConversation?.type === 'channel'
              ? activeConversation.description ||
                'This channel is ready for your team discussions, meeting follow-ups, and action items.'
              : 'Send a message, share files, or ping them with a team sticker to collaborate.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {messagesError && (
            <div className="mb-3 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {messagesError}
              </span>
              <button
                type="button"
                onClick={() => void retryLoadMessages()}
                className="inline-flex items-center gap-1 font-semibold underline hover:text-red-900"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          )}

          {hasMoreMessages && !searchQuery.trim() && (
            <div className="mb-3 flex justify-center">
              <button
                type="button"
                disabled={loadingOlderMessages}
                onClick={() => void handleLoadOlder()}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-xs transition hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-700 disabled:opacity-50"
              >
                {loadingOlderMessages && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {loadingOlderMessages ? 'Loading older messages...' : 'Load older messages'}
              </button>
            </div>
          )}

          {filteredMessages.map((msg, idx) => {
            const prevMsg = filteredMessages[idx - 1];
            const currentDateLabel = getDateLabel(msg.created_at);
            const prevDateLabel = prevMsg ? getDateLabel(prevMsg.created_at) : null;
            const showDateHeader = currentDateLabel !== prevDateLabel;

            // Grouping: same sender, same date, within 5 minutes, no parent quote
            const isGrouped =
              Boolean(prevMsg) &&
              !showDateHeader &&
              prevMsg?.sender_id === msg.sender_id &&
              !msg.parent &&
              !prevMsg?.parent &&
              new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() <
                5 * 60 * 1000;

            return (
              <div key={msg.id}>
                {showDateHeader && (
                  <div className="relative my-4 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <span className="relative rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm border border-slate-200">
                      {currentDateLabel}
                    </span>
                  </div>
                )}

                <MessageItem
                  message={msg}
                  isGrouped={isGrouped}
                  onReply={onReply}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Typing Indicator */}
      {typingNames.length > 0 && (
        <div className="sticky bottom-2 left-4 mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1 text-xs text-slate-500 shadow-sm backdrop-blur">
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-600 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-600 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-600" />
          </span>
          <span>
            {typingNames.join(', ')} {typingNames.length > 1 ? 'are' : 'is'} typing...
          </span>
        </div>
      )}

      {/* Scroll to bottom button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="fixed bottom-24 right-8 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-700 hover:scale-105 active:scale-95"
          title="Jump to recent messages"
        >
          <ArrowDown className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
