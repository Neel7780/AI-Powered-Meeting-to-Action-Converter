import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  ExternalLink,
  Filter,
  LoaderCircle,
  Quote,
  RefreshCw,
  Sparkles,
  User,
} from 'lucide-react';
import { getWorkspaceChatMeetings, sendChatMessage } from '../../services/chatApi';
import type { ChatMessage, MeetingOption } from '../../types/chat';

interface ChatInterfaceProps {
  workspaceId?: string;
  isCompact?: boolean;
  onClose?: () => void;
  title?: string;
}

const STARTER_PROMPTS = [
  {
    icon: '📌',
    title: 'Last Meeting Decisions',
    query: 'What did we decide in the last meeting?',
    hint: 'Review key agreements and formal decisions',
  },
  {
    icon: '⏱️',
    title: 'Pending Action Items',
    query: 'Which tasks are still pending?',
    hint: 'List open todo, in-progress, and blocked tasks',
  },
  {
    icon: '👤',
    title: 'Assigned Responsibilities',
    query: 'What action items are assigned to each team member?',
    hint: 'Breakdown of owners and upcoming deadlines',
  },
  {
    icon: '🔍',
    title: 'Summarize Recent Topics',
    query: 'Summarize the main discussion topics and blockers across recent meetings',
    hint: 'Synthesize discussions and concerns',
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

/** Render bold, code snippets, and status tags */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

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

export default function ChatInterface({
  workspaceId,
  isCompact = false,
  onClose,
  title = 'AI Meeting Copilot',
}: ChatInterfaceProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [meetings, setMeetings] = useState<MeetingOption[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('');
  const [expandedCitations, setExpandedCitations] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load available meetings for the scoping selector
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    getWorkspaceChatMeetings(workspaceId)
      .then((data) => {
        if (!cancelled) setMeetings(data);
      })
      .catch((err) => console.error('Failed to load chat meetings:', err));

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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

    try {
      // Build history of previous turns (excluding initial greeting)
      const historyTurns = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await sendChatMessage({
        workspace_id: workspaceId,
        meeting_id: selectedMeetingId ? selectedMeetingId : null,
        query: text,
        history: historyTurns,
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

      setMessages((prev) => [...prev, assistantMessage]);

      // Automatically expand citations if present
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

  const clearChat = () => {
    setMessages([]);
    setExpandedCitations({});
  };

  const selectedMeetingTitle =
    meetings.find((m) => m.id === selectedMeetingId)?.title || 'All Workspace Meetings';

  return (
    <div className={`flex flex-col h-full bg-[#050508] text-white ${isCompact ? '' : 'rounded-xl border border-white/10'}`}>
      {/* Top Header / Scoping Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#08080c] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-medium tracking-tight text-white">{title}</h2>
            <p className="text-[11px] text-neutral-400">
              Grounded in meetings & tasks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Meeting Scoping Selector */}
          <div className="relative flex items-center">
            <Filter className="pointer-events-none absolute left-2.5 size-3.5 text-neutral-400" />
            <select
              value={selectedMeetingId}
              onChange={(e) => setSelectedMeetingId(e.target.value)}
              title="Select meeting scope"
              className="h-8 max-w-[190px] sm:max-w-[240px] appearance-none truncate rounded-md border border-white/10 bg-[#0e0e14] pl-8 pr-7 text-xs text-neutral-200 transition-colors hover:border-white/20 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">🌐 All Meetings ({meetings.length})</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  📅 {m.title}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 size-3 text-neutral-500" />
          </div>

          {/* Clear button */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              title="Clear conversation"
              className="grid size-8 place-items-center rounded-md border border-white/10 text-neutral-400 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white"
            >
              <RefreshCw className="size-3.5" />
            </button>
          )}

          {/* Close button for compact modal/drawer */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-md border border-white/10 text-neutral-400 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white"
              aria-label="Close chat"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Scope Pill Banner */}
      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-1.5 text-[11px] text-neutral-400">
        <span className="flex items-center gap-1.5 truncate">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Active Scope: <span className="font-medium text-neutral-200 truncate">{selectedMeetingTitle}</span>
        </span>
        <span className="text-neutral-500 font-mono">
          {meetings.length} meeting{meetings.length === 1 ? '' : 's'} indexed
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center py-8 text-center">
            <div className="grid size-12 place-items-center rounded-2xl border border-indigo-500/20 bg-indigo-500/5 text-indigo-400 shadow-inner">
              <Sparkles className="size-6" />
            </div>
            <h3 className="mt-4 text-base font-medium tracking-tight text-white">
              Meeting Intelligence Copilot
            </h3>
            <p className="mt-1 max-w-sm text-xs text-neutral-400">
              Ask about past discussions, decisions made, or pending task assignments.
            </p>

            {/* Starter Prompts Grid */}
            <div className="mt-6 grid w-full max-w-xl gap-2 sm:grid-cols-2">
              {STARTER_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(p.query)}
                  className="group flex flex-col items-start rounded-lg border border-white/10 bg-[#09090e] p-3 text-left transition-all hover:border-indigo-500/40 hover:bg-indigo-500/[0.03]"
                >
                  <span className="flex items-center gap-2 text-xs font-medium text-white group-hover:text-indigo-300">
                    <span>{p.icon}</span>
                    <span>{p.title}</span>
                  </span>
                  <span className="mt-1 text-[11px] text-neutral-500 group-hover:text-neutral-400">
                    {p.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            const hasCitations = msg.citations && msg.citations.length > 0;
            const isCitationOpen = expandedCitations[msg.id];

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="grid size-7 shrink-0 place-items-center rounded-md border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
                    <Bot className="size-4" />
                  </div>
                )}

                <div className={`max-w-[85%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Message Bubble */}
                  <div
                    className={`rounded-xl px-4 py-3 ${
                      isUser
                        ? 'border border-indigo-500/30 bg-indigo-600/20 text-white'
                        : 'panel border-white/10 bg-[#0a0a0f]'
                    }`}
                  >
                    {isUser ? (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <FormattedContent content={msg.content} />
                    )}
                  </div>

                  {/* Supporting Evidence / Citations Accordion */}
                  {hasCitations && (
                    <div className="rounded-lg border border-white/10 bg-[#06060a] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleCitations(msg.id)}
                        className="flex w-full items-center justify-between px-3 py-2 text-xs text-neutral-400 transition-colors hover:bg-white/[0.03] hover:text-white"
                      >
                        <span className="flex items-center gap-1.5 font-medium text-indigo-400">
                          <Quote className="size-3.5" />
                          Supporting Evidence & Citations ({msg.citations!.length})
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

                  {/* Suggested Follow-up Questions */}
                  {!isUser && msg.suggestedFollowups && msg.suggestedFollowups.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {msg.suggestedFollowups.map((followup, fIdx) => (
                        <button
                          key={fIdx}
                          type="button"
                          onClick={() => handleSend(followup)}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-neutral-300 transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-white"
                        >
                          💬 {followup}
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-neutral-500 px-1">{msg.timestamp}</p>
                </div>

                {isUser && (
                  <div className="grid size-7 shrink-0 place-items-center rounded-md border border-white/15 bg-white/5 text-neutral-300">
                    <User className="size-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex items-start gap-3">
            <div className="grid size-7 shrink-0 place-items-center rounded-md border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
              <Sparkles className="size-4 animate-pulse" />
            </div>
            <div className="panel flex items-center gap-2.5 rounded-xl border-white/10 bg-[#0a0a0f] px-4 py-3 text-xs text-neutral-400">
              <LoaderCircle className="size-4 animate-spin text-indigo-400" />
              <span>Analyzing transcripts and verifying citations…</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-white/10 bg-[#08080c] p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-end gap-2"
        >
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              rows={isCompact ? 2 : 2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedMeetingId
                  ? `Ask about "${selectedMeetingTitle}"…`
                  : 'Ask about previous meetings, decisions, or pending tasks…'
              }
              disabled={loading || !workspaceId}
              className="w-full resize-none rounded-lg border border-white/10 bg-[#0e0e14] px-3.5 py-2.5 pr-10 text-xs text-white placeholder-neutral-500 transition-colors focus:border-indigo-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={!input.trim() || loading || !workspaceId}
            className="flex h-10 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-600 px-3.5 text-xs font-medium text-white transition-all hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600"
          >
            <span className="hidden sm:inline mr-1">Ask</span>
            <CornerDownLeft className="size-3.5" />
          </button>
        </form>

        <p className="mt-1.5 text-center text-[10px] text-neutral-500">
          Answers are grounded directly in your workspace meetings & tasks.
        </p>
      </div>
    </div>
  );
}
