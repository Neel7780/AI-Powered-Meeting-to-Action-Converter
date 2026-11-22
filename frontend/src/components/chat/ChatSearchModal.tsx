import { useState, useEffect, useRef } from 'react';
import { Search, X, Hash, MessageSquare, Loader2, Calendar } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import type { ChatMessageSearchResult } from '../../types/workspaceChat';

interface ChatSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatSearchModal({
  isOpen,
  onClose,
}: ChatSearchModalProps) {
  const { activeConversation, searchMessages, setActiveConversationId } = useChat();

  const [query, setQuery] = useState('');
  const [scopeToCurrent, setScopeToCurrent] = useState(false);
  const [results, setResults] = useState<ChatMessageSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setHasSearched(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const convId = scopeToCurrent && activeConversation ? activeConversation.id : undefined;
        const res = await searchMessages(trimmed, convId);
        setResults(res);
        setHasSearched(true);
      } catch (err) {
        console.error('Search failed:', err);
        setResults([]);
        setHasSearched(true);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, scopeToCurrent, activeConversation, searchMessages]);

  const handleSelectResult = (result: ChatMessageSearchResult) => {
    setActiveConversationId(result.conversation_id);
    onClose();
  };

  const highlightMatch = (text: string, term: string) => {
    if (!term.trim()) return text;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          className="rounded-xs bg-amber-200 px-0.5 font-semibold text-slate-900 dark:bg-amber-800 dark:text-white"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const formatResultTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search messages"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl transition animate-in fade-in zoom-in-95 dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Input Bar */}
        <div className="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages, files, keywords across workspace..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none dark:text-white"
          />
          {isSearching && <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />}
          {query && !isSearching && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Scope Selector Filters */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Scope:</span>
            <button
              type="button"
              onClick={() => setScopeToCurrent(false)}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                !scopeToCurrent
                  ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400'
              }`}
            >
              Entire Workspace
            </button>
            {activeConversation && (
              <button
                type="button"
                onClick={() => setScopeToCurrent(true)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition ${
                  scopeToCurrent
                    ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-700 dark:text-white'
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400'
                }`}
              >
                {activeConversation.type === 'channel' ? (
                  <Hash className="h-3 w-3" />
                ) : (
                  <MessageSquare className="h-3 w-3" />
                )}
                <span>{activeConversation.name || 'Current'}</span>
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-400">
            {hasSearched ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Press ESC to close'}
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {!query.trim() ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Type keywords above to search accessible conversations.
            </div>
          ) : isSearching && results.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-xs text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-600" /> Searching messages...
            </div>
          ) : results.length === 0 && hasSearched ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No messages found matching &quot;{query}&quot;.
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((res) => (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => handleSelectResult(res)}
                  className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition hover:bg-indigo-50/60 dark:hover:bg-slate-800/80"
                >
                  {/* Sender Avatar */}
                  <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 text-xs font-bold text-white shadow-xs">
                    {res.sender_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Result Body */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">
                          {res.sender_name}
                        </span>
                        <span className="flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {res.conversation_type === 'channel' ? (
                            <Hash className="h-2.5 w-2.5" />
                          ) : (
                            <MessageSquare className="h-2.5 w-2.5" />
                          )}
                          {res.conversation_name}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                        <Calendar className="h-2.5 w-2.5" />
                        {formatResultTime(res.created_at)}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      {highlightMatch(res.content, query)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

