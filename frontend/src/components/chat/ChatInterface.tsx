import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUp,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Filter,
  LoaderCircle,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Quote,
  Sparkles,
  SquarePen,
  Trash2,
} from 'lucide-react';
import {
  createChatSession,
  deleteChatSession,
  getChatSession,
  getChatSessions,
  getWorkspaceChatMeetings,
  sendChatMessage,
} from '../../services/chatApi';
import { useAuth } from '../../context/AuthContext';
import type { ChatMessage, ChatSession, MeetingOption } from '../../types/chat';

interface ChatInterfaceProps {
  workspaceId?: string;
  isCompact?: boolean;
  onClose?: () => void;
  title?: string;
}

const STARTER_PROMPTS = [
  {
    icon: '📋',
    title: 'Summarize decisions',
    query: 'What key decisions and agreements were made across recent meetings?',
  },
  {
    icon: '🚨',
    title: 'Review blockers',
    query: 'Which tasks or deliverables are currently blocked or facing impediments?',
  },
  {
    icon: '👥',
    title: 'My assigned tasks',
    query: 'What action items and tasks are currently assigned to team members?',
  },
  {
    icon: '📝',
    title: 'Draft sprint notes',
    query: 'Draft a concise sprint update and key highlights from recent discussions.',
  },
];

/** Clean custom markdown formatter for assistant responses */
function FormattedContent({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-2 text-sm leading-relaxed text-neutral-200">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Header ###
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="mt-3 text-sm font-semibold tracking-wide text-white">
              {trimmed.replace(/^###\s+/, '')}
            </h4>
          );
        }
        // Header ##
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="mt-3 text-base font-semibold tracking-wide text-white">
              {trimmed.replace(/^##\s+/, '')}
            </h3>
          );
        }

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const bulletText = trimmed.replace(/^[-*]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-400" />
              <div className="min-w-0 flex-1">{renderInline(bulletText)}</div>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="font-mono text-xs text-neutral-400">{numMatch[1]}.</span>
              <div className="min-w-0 flex-1">{renderInline(numMatch[2])}</div>
            </div>
          );
        }

        return <p key={idx}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}

/** Render bold, code snippets, status tags, and italics */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*[^*\n]+?\*|`.*?`)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      // Highlight status badges
      if (['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'].includes(boldText.toUpperCase())) {
        const colors: Record<string, string> = {
          TODO: 'bg-neutral-800 text-neutral-300 border-neutral-700',
          IN_PROGRESS: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
          BLOCKED: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
          DONE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
        };
        const colorClass = colors[boldText.toUpperCase()] || 'bg-white/10 text-white';
        return (
          <span
            key={index}
            className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase ${colorClass}`}
          >
            {boldText}
          </span>
        );
      }
      return (
        <strong key={index} className="font-semibold text-white">
          {boldText}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return (
        <em key={index} className="italic text-neutral-300">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-xs text-indigo-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/** Local storage helpers scoped by authenticated user and workspace */
const getLocalSessions = (userId: string, wsId: string): ChatSession[] => {
  try {
    const raw = localStorage.getItem(`actionpulse_chat_sessions_${userId}_${wsId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalSessions = (userId: string, wsId: string, list: ChatSession[]) => {
  try {
    localStorage.setItem(`actionpulse_chat_sessions_${userId}_${wsId}`, JSON.stringify(list));
  } catch {
    // ignore
  }
};

function groupSessions(list: ChatSession[]) {
  const today: ChatSession[] = [];
  const previous: ChatSession[] = [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  for (const s of list) {
    const time = new Date(s.updated_at || s.created_at).getTime();
    if (time >= startOfToday) {
      today.push(s);
    } else {
      previous.push(s);
    }
  }

  return { today, previous };
}

export default function ChatInterface({
  workspaceId,
  isCompact: _isCompact = false,
  onClose,
  title = 'AI Meeting Copilot',
}: ChatInterfaceProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || 'anon';

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [meetings, setMeetings] = useState<MeetingOption[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('');
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Load available meetings and chat sessions (scoped to both workspace and user)
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    // Load local sessions immediately for instant UX
    const cached = getLocalSessions(userId, workspaceId);
    setSessions(cached);
    setActiveSessionId(null);
    setSelectedMeetingId('');
    setMessages([]);
    setExpandedCitations({});

    // Fetch backend sessions and merge
    getChatSessions(workspaceId)
      .then((serverSessions) => {
        if (cancelled || !serverSessions || serverSessions.length === 0) return;
        setSessions((prev) => {
          const map = new Map<string, ChatSession>();
          prev.forEach((s) => map.set(s.id, s));
          serverSessions.forEach((s) => {
            const existing = map.get(s.id);
            map.set(s.id, existing ? { ...existing, ...s } : s);
          });
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
          saveLocalSessions(userId, workspaceId, merged);
          return merged;
        });
      })
      .catch((err) => console.warn('Could not sync chat sessions with server:', err));

    getWorkspaceChatMeetings(workspaceId)
      .then((data) => {
        if (!cancelled) setMeetings(data);
      })
      .catch((err) => {
        console.error('Failed to load chat meetings:', err);
        if (!cancelled) setMeetings([]);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, userId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setExpandedCitations({});
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSelectSession = async (session: ChatSession) => {
    if (activeSessionId === session.id) return;
    setActiveSessionId(session.id);
    setSelectedMeetingId(session.selected_meeting_id || '');
    setExpandedCitations({});

    if (session.messages && session.messages.length > 0) {
      setMessages(session.messages);
    } else {
      setMessages([]);
      try {
        const detail = await getChatSession(session.id);
        if (detail.messages) {
          const formatted: ChatMessage[] = detail.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            citations: m.citations || [],
            suggestedFollowups: m.suggested_followups || [],
          }));
          setMessages(formatted);
          setSessions((prev) => {
            const updated = prev.map((s) => (s.id === session.id ? { ...s, messages: formatted } : s));
            if (workspaceId) saveLocalSessions(userId, workspaceId, updated);
            return updated;
          });
        }
      } catch (err) {
        console.warn('Could not fetch server session detail:', err);
      }
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      deleteChatSession(sessionId).catch(() => {});
    } catch {
      // ignore
    }
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId);
      if (workspaceId) saveLocalSessions(userId, workspaceId, updated);
      return updated;
    });
    if (activeSessionId === sessionId) {
      handleNewChat();
    }
  };

  const handleSend = async (queryText?: string) => {
    const text = (queryText || input).trim();
    if (!text || loading || !workspaceId) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      const titleCandidate = text.length > 30 ? text.slice(0, 30) + '...' : text;
      let createdSession: ChatSession;
      try {
        createdSession = await createChatSession(workspaceId, titleCandidate, selectedMeetingId);
      } catch (err) {
        console.warn('Backend session creation fallback:', err);
        const nowIso = new Date().toISOString();
        const fallbackUuid =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');
        createdSession = {
          id: fallbackUuid,
          workspace_id: workspaceId,
          title: titleCandidate,
          selected_meeting_id: selectedMeetingId || null,
          created_at: nowIso,
          updated_at: nowIso,
        };
      }

      currentSessionId = createdSession.id;
      setActiveSessionId(currentSessionId);

      const newSession: ChatSession = {
        ...createdSession,
        messages: [userMessage],
      };
      setSessions((prev) => {
        const next = [newSession, ...prev.filter((s) => s.id !== currentSessionId)];
        saveLocalSessions(userId, workspaceId, next);
        return next;
      });
    } else {
      setSessions((prev) => {
        const next = prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, messages: [...(s.messages || []), userMessage] }
            : s
        );
        saveLocalSessions(userId, workspaceId, next);
        return next;
      });
    }

    try {
      // Build history of previous turns
      const historyTurns = messages
        .filter((m) => !m.id.startsWith('err-') && !m.content.startsWith('⚠️'))
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await sendChatMessage({
        workspace_id: workspaceId,
        meeting_id: selectedMeetingId ? selectedMeetingId : null,
        query: text,
        history: historyTurns,
        session_id: currentSessionId,
      });

      const assistantMessage: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: res.citations || [],
        suggestedFollowups: res.suggested_followups || [],
        contextCount: res.meeting_context_count,
      };

      setMessages((prev) => {
        const nextMessages = [...prev, assistantMessage];
        if (currentSessionId) {
          setSessions((sPrev) => {
            const sNext = sPrev.map((s) =>
              s.id === currentSessionId
                ? {
                    ...s,
                    updated_at: new Date().toISOString(),
                    messages: nextMessages,
                  }
                : s
            );
            saveLocalSessions(userId, workspaceId, sNext);
            return sNext;
          });
        }
        return nextMessages;
      });

      if (res.citations && res.citations.length > 0) {
        setExpandedCitations((prev) => ({ ...prev, [assistantMessage.id]: true }));
      }
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Unable to retrieve answer:** ${err?.message || 'Server error. Please try again.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleCitations = (messageId: string) => {
    setExpandedCitations((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const selectedMeetingTitle =
    meetings.find((m) => m.id === selectedMeetingId)?.title || 'All Workspace Meetings';
  const { today, previous } = groupSessions(sessions);

  return (
    <div className="flex h-full w-full bg-[#08080c] text-white overflow-hidden">
      {/* 1. Left Chat History Sub-Panel (Foldable into a ChatGPT-style slim strip) */}
      <aside
        className={`${
          isHistoryOpen ? 'w-60 min-w-[240px]' : 'w-14 min-w-[56px]'
        } shrink-0 border-r border-white/[0.06] bg-[#0c0c12]/95 backdrop-blur-md flex flex-col transition-all duration-300 overflow-hidden select-none`}
      >
        {isHistoryOpen ? (
          /* EXPANDED VIEW: Full Chat History with Titles & Delete */
          <>
            {/* Sub-panel Header */}
            <div className="p-3 border-b border-white/[0.06] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  className="grid size-7 place-items-center rounded-lg border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Fold chat history into slim strip"
                >
                  <PanelLeftClose className="size-3.5" />
                </button>
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  Chats
                </span>
              </div>
              <button
                type="button"
                onClick={handleNewChat}
                className="flex items-center gap-1 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-white transition-all hover:border-indigo-400 hover:bg-indigo-500/20 active:scale-95"
                title="Start new chat"
              >
                <SquarePen className="size-3 text-indigo-400" />
                <span>New</span>
              </button>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-4">
              {sessions.length === 0 ? (
                <div className="p-4 text-center text-xs text-neutral-500">
                  No previous chats yet. Start a new conversation!
                </div>
              ) : (
                <>
                  {today.length > 0 && (
                    <div>
                      <p className="px-2 py-1 text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">
                        Today
                      </p>
                      <div className="space-y-0.5">
                        {today.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => handleSelectSession(s)}
                            className={`group relative flex items-center justify-between rounded-xl px-2.5 py-2 text-xs cursor-pointer transition-all ${
                              activeSessionId === s.id
                                ? 'bg-indigo-500/15 border border-indigo-500/30 text-white font-medium'
                                : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                              <MessageSquare className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                              <span className="truncate">{s.title || 'New Conversation'}</span>
                            </div>
                            {/* Delete Button (🗑️) at the end */}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSession(e, s.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 transition-all shrink-0"
                              title="Delete chat"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {previous.length > 0 && (
                    <div>
                      <p className="px-2 py-1 text-[10px] uppercase font-semibold text-neutral-500 tracking-wider">
                        Previous
                      </p>
                      <div className="space-y-0.5">
                        {previous.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => handleSelectSession(s)}
                            className={`group relative flex items-center justify-between rounded-xl px-2.5 py-2 text-xs cursor-pointer transition-all ${
                              activeSessionId === s.id
                                ? 'bg-indigo-500/15 border border-indigo-500/30 text-white font-medium'
                                : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                              <MessageSquare className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                              <span className="truncate">{s.title || 'New Conversation'}</span>
                            </div>
                            {/* Delete Button (🗑️) at the end */}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSession(e, s.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 transition-all shrink-0"
                              title="Delete chat"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          /* COLLAPSED STRIP VIEW: Slim vertical icon rail like ChatGPT screenshot */
          <div className="flex flex-col items-center py-3 space-y-2.5 h-full">
            {/* Top Expand button */}
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="grid size-9 place-items-center rounded-xl border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Expand Chat History"
            >
              <PanelLeft className="size-4" />
            </button>

            {/* New Chat icon button (SquarePen like ChatGPT) */}
            <button
              type="button"
              onClick={handleNewChat}
              className="grid size-9 place-items-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/25 hover:text-white transition-all shadow-sm"
              title="New Chat"
            >
              <SquarePen className="size-4" />
            </button>

            <div className="w-5 h-[1px] bg-white/10 my-0.5" />

            {/* Recent chats quick icon rail */}
            <div className="flex-1 w-full overflow-y-auto flex flex-col items-center space-y-1.5 px-1 py-1">
              {sessions.slice(0, 8).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectSession(s)}
                  className={`grid size-9 place-items-center rounded-xl transition-all ${
                    activeSessionId === s.id
                      ? 'bg-indigo-500/25 border border-indigo-500/50 text-indigo-300 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/5 border border-transparent'
                  }`}
                  title={s.title || 'Chat'}
                >
                  <MessageSquare className="size-4" />
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* 2. Main Chat Canvas */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top Header / Scoping Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-[#0c0c12]/90 backdrop-blur-md px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
              <Sparkles className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-white">{title}</h2>
                <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                  AI Copilot
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Grounded in transcripts & Kanban tasks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Meeting Scoping Selector Pill */}
            <div className="relative flex items-center">
              <Filter className="pointer-events-none absolute left-3 size-3.5 text-neutral-400" />
              <select
                value={selectedMeetingId}
                onChange={(e) => setSelectedMeetingId(e.target.value)}
                title="Select meeting scope"
                className="h-8 max-w-[190px] sm:max-w-[240px] appearance-none truncate rounded-full border border-white/10 bg-[#14141c] pl-8 pr-7 text-xs text-neutral-200 transition-colors hover:border-white/25 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">🌐 All Meetings ({meetings.length})</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    📅 {m.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 size-3 text-neutral-500" />
            </div>

            {/* + New Chat Button in header */}
            <button
              type="button"
              onClick={handleNewChat}
              title="Start a fresh new chat session"
              className="flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:border-indigo-400 hover:bg-indigo-500/20 active:scale-95"
            >
              <Plus className="size-3.5 text-indigo-400" />
              <span>New Chat</span>
            </button>

            {/* Close button for compact modal/drawer */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="grid size-8 place-items-center rounded-full border border-white/10 text-neutral-400 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white"
                aria-label="Close chat"
              >
                ✕
              </button>
            )}
          </div>
        </div>

      {/* Main Canvas */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col">
        <div className="max-w-3xl mx-auto w-full h-full flex flex-col justify-between flex-1">
          {messages.length === 0 ? (
            /* Gemini & ChatGPT Empty State: Vertically Centered on Canvas with Mid-Screen Input Capsule */
            <div className="my-auto flex flex-col items-center justify-center text-center animate-fadeIn py-8 w-full">
              <div className="grid size-14 place-items-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 shadow-inner mb-6">
                <Sparkles className="size-7" />
              </div>
              <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white mb-2">
                How can I help with your meetings today?
              </h1>
              <p className="text-xs text-neutral-400 max-w-sm mb-8">
                Query across transcripts, decisions, and action items with grounded citations.
              </p>

              {/* Mid-Screen Input Capsule */}
              <div className="w-full max-w-2xl px-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="relative flex items-center rounded-full border border-indigo-500/30 bg-[#14141c]/90 px-4 py-2.5 shadow-2xl backdrop-blur-md transition-all focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20"
                >
                  <span
                    className="mr-2 grid size-7 place-items-center rounded-full bg-white/5 text-neutral-400"
                    title={`Active Scope: ${selectedMeetingTitle}`}
                  >
                    <Filter className="size-3.5" />
                  </span>

                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      selectedMeetingId
                        ? `Ask about "${selectedMeetingTitle}"…`
                        : 'Message Meeting Copilot or type @ to scope…'
                    }
                    disabled={loading || !workspaceId}
                    className="flex-1 max-h-32 min-h-[38px] resize-none bg-transparent py-2 text-sm text-white placeholder-neutral-500 outline-none disabled:opacity-50"
                  />

                  <button
                    type="submit"
                    disabled={!input.trim() || loading || !workspaceId}
                    className={`ml-2 grid size-8 shrink-0 place-items-center rounded-full transition-all ${
                      input.trim() && !loading && workspaceId
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-100 hover:opacity-90'
                        : 'bg-white/10 text-neutral-500 cursor-not-allowed scale-95'
                    }`}
                    title="Send message"
                  >
                    <ArrowUp className="size-4 stroke-[2.5]" />
                  </button>
                </form>

                {/* 4 Minimalist Horizontal Suggestion Chips beneath input */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {STARTER_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSend(p.query)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#121218] px-3.5 py-1.5 text-xs text-neutral-300 transition-all hover:border-indigo-500/40 hover:bg-white/[0.04] hover:text-white"
                    >
                      <span>{p.icon}</span>
                      <span>{p.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Active Message Flow: Suggestions are gone, pure conversation */
            <div className="space-y-6 pb-4">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const hasCitations = msg.citations && msg.citations.length > 0;
                const isCitationOpen = expandedCitations[msg.id];
                const isLatestAssistant = !isUser && idx === messages.length - 1;

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="grid size-8 shrink-0 place-items-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 mt-0.5">
                        <Sparkles className="size-4" />
                      </div>
                    )}

                    <div className={`space-y-2.5 ${isUser ? 'max-w-[80%]' : 'flex-1 min-w-0'}`}>
                      {/* Message Content */}
                      <div
                        className={
                          isUser
                            ? 'rounded-[22px] rounded-br-sm border border-white/10 bg-[#1e1e28] px-4 py-3 text-sm text-white shadow-sm whitespace-pre-wrap leading-relaxed'
                            : 'space-y-2 text-neutral-100 text-sm leading-relaxed'
                        }
                      >
                        {isUser ? (
                          msg.content
                        ) : (
                          <FormattedContent content={msg.content} />
                        )}
                      </div>

                      {/* Supporting Evidence / Citations Accordion */}
                      {hasCitations && (
                        <div className="rounded-xl border border-white/10 bg-[#0e0e14] overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleCitations(msg.id)}
                            className="flex w-full items-center justify-between px-3 py-2 text-xs text-neutral-400 transition-colors hover:bg-white/[0.03] hover:text-white"
                          >
                            <span className="flex items-center gap-1.5 font-medium text-indigo-400">
                              <Quote className="size-3.5" />
                              Supporting Citations ({msg.citations!.length})
                            </span>
                            {isCitationOpen ? (
                              <ChevronUp className="size-3.5" />
                            ) : (
                              <ChevronDown className="size-3.5" />
                            )}
                          </button>

                          {isCitationOpen && (
                            <div className="divide-y divide-white/5 border-t border-white/10 px-3 py-2 space-y-2">
                              {msg.citations!.map((cit, cIdx) => (
                                <div key={cIdx} className="pt-2 first:pt-0 space-y-1.5">
                                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                                    <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 font-mono uppercase text-indigo-300">
                                      {cit.source_type}
                                    </span>
                                    {cit.meeting_title && (
                                      <span className="truncate text-neutral-400">
                                        Meeting: <strong className="text-neutral-300">{cit.meeting_title}</strong>
                                      </span>
                                    )}
                                  </div>

                                  <blockquote className="border-l-2 border-indigo-500/40 pl-2.5 text-xs italic text-neutral-300">
                                    "{cit.excerpt}"
                                  </blockquote>

                                  {/* Interactive Action Buttons */}
                                  <div className="flex flex-wrap items-center gap-2 pt-1">
                                    {cit.meeting_id && (
                                      <button
                                        type="button"
                                        onClick={() => navigate(`/meetings/${cit.meeting_id}/review`)}
                                        className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-neutral-300 hover:border-white/20 hover:bg-white/10 hover:text-white"
                                      >
                                        <Calendar className="size-3" />
                                        View Meeting
                                        <ExternalLink className="size-2.5" />
                                      </button>
                                    )}
                                    {(cit.task_id || cit.source_type === 'task') && (
                                      <button
                                        type="button"
                                        onClick={() => navigate('/kanban')}
                                        className="inline-flex items-center gap-1 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                                      >
                                        <CheckSquare className="size-3" />
                                        View in Kanban
                                        <ExternalLink className="size-2.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action Bar (Copy, Timestamp) */}
                      {!isUser && (
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-neutral-500">
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-white/5 hover:text-neutral-300"
                            title="Copy answer"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="size-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                        </div>
                      )}

                      {/* Suggested Follow-up Questions: ONLY on latest assistant message */}
                      {isLatestAssistant && !loading && msg.suggestedFollowups && msg.suggestedFollowups.length > 0 && (
                        <div className="pt-2 flex flex-wrap gap-1.5">
                          {msg.suggestedFollowups.map((followup, fIdx) => (
                            <button
                              key={fIdx}
                              type="button"
                              onClick={() => handleSend(followup)}
                              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300 transition-all hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-white"
                            >
                              💬 {followup}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Loading Indicator */}
              {loading && (
                <div className="flex items-start gap-3.5">
                  <div className="grid size-8 shrink-0 place-items-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
                    <Sparkles className="size-4 animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#121218] px-4 py-2.5 text-xs text-neutral-400">
                    <LoaderCircle className="size-3.5 animate-spin text-indigo-400" />
                    <span>Analyzing transcripts and verifying citations…</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Docked Floating Capsule Input Bar: ONLY rendered when active messages exist */}
      {messages.length > 0 && (
        <div className="border-t border-white/5 bg-[#09090e]/90 backdrop-blur-md px-4 py-3 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="relative flex items-center rounded-full border border-white/15 bg-[#14141c] px-3.5 py-1.5 shadow-2xl transition-all focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/30"
            >
              {/* Filter icon pill */}
              <div className="mr-2 flex items-center" title={`Active Scope: ${selectedMeetingTitle}`}>
                <span className="grid size-7 place-items-center rounded-full bg-white/5 text-neutral-400">
                  <Filter className="size-3.5" />
                </span>
              </div>

              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedMeetingId
                    ? `Ask about "${selectedMeetingTitle}"…`
                    : 'Message Meeting Copilot…'
                }
                disabled={loading || !workspaceId}
                className="flex-1 max-h-32 min-h-[36px] resize-none bg-transparent py-2 text-sm text-white placeholder-neutral-500 outline-none disabled:opacity-50"
              />

              {/* Circular upward-arrow send button */}
              <button
                type="submit"
                disabled={!input.trim() || loading || !workspaceId}
                className={`ml-2 grid size-8 shrink-0 place-items-center rounded-full transition-all ${
                  input.trim() && !loading && workspaceId
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25 scale-100 hover:opacity-90'
                    : 'bg-white/10 text-neutral-500 cursor-not-allowed scale-95'
                }`}
                title="Send message"
              >
                <ArrowUp className="size-4 stroke-[2.5]" />
              </button>
            </form>

            <p className="mt-2 text-center text-[11px] text-neutral-500">
              Answers are grounded directly in your workspace meetings & tasks.
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
