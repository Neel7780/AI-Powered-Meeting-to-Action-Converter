import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { KanbanTaskItem } from './KanbanCard';
import {
  X,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  Link as LinkIcon,
  Send,
  HelpCircle,
  ExternalLink,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchTaskCommunications,
  submitPrerequisiteInquiry,
  submitPrerequisiteReply,
  resolvePrerequisiteInquiry,
  type TaskCommunicationItem,
} from '../../services/taskCommunicationApi';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';

export interface TaskPrerequisiteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  task: KanbanTaskItem | null;
  allTasks: KanbanTaskItem[];
  workspaceId?: string;
  onPrerequisiteLinked?: (taskId: string, blockedById: string) => void;
}

const QUICK_PROMPTS = [
  'What tasks must be completed before I begin this?',
  'Do we have the required API keys or repository credentials?',
  'Who provides the design spec or input assets for this?',
  'Is this blocked by any pending client or external decision?',
];

export const TaskPrerequisiteDialog: React.FC<TaskPrerequisiteDialogProps> = ({
  isOpen,
  onClose,
  task,
  allTasks,
  workspaceId,
  onPrerequisiteLinked,
}) => {
  const [communications, setCommunications] = useState<TaskCommunicationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [selectedPrereqTaskId, setSelectedPrereqTaskId] = useState<string>('');
  const [markResolvedOnReply, setMarkResolvedOnReply] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);

  // Load current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) {
        setCurrentUserId(data.user.id);
      }
    });
  }, []);

  const { currentRole } = useWorkspace();

  // Determine user role relative to this task:
  // A manager is either a workspace admin/organiser or the task creator
  const isManager = useMemo(() => {
    if (currentRole === 'admin' || currentRole === 'organiser') return true;
    if (!currentUserId || !task) return false;
    return task.created_by === currentUserId;
  }, [currentUserId, task, currentRole]);

  // Existing blocker task if any
  const currentBlockingTask = useMemo(() => {
    if (!task?.blocked_by) return null;
    return allTasks.find((t) => t.id === task.blocked_by);
  }, [task?.blocked_by, allTasks]);

  // Downstream tasks to avoid circular dependencies in dropdown
  const eligiblePrerequisiteOptions = useMemo(() => {
    if (!task) return [];
    return allTasks.filter((t) => t.id !== task.id && t.blocked_by !== task.id);
  }, [allTasks, task]);

  // Load communications
  const loadCommunications = async () => {
    if (!task || !workspaceId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchTaskCommunications(workspaceId, task.id);
      setCommunications(data);
    } catch (err: any) {
      console.warn('Failed to load task communications:', err);
      setErrorMsg(err.message || 'Could not load communication history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && task) {
      loadCommunications();
      setInputText('');
      setSelectedPrereqTaskId('');
      setMarkResolvedOnReply(false);
    }
  }, [isOpen, task?.id]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [communications]);

  if (!isOpen || !task) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !workspaceId || !task) return;

    setIsSending(true);
    setErrorMsg(null);

    try {
      if (isManager) {
        // Manager sends reply
        const replyItem = await submitPrerequisiteReply(workspaceId, task.id, {
          content: inputText.trim(),
          suggested_prerequisite_task_id: selectedPrereqTaskId || null,
          mark_as_resolved: markResolvedOnReply,
        });
        setCommunications((prev) => [...prev, replyItem]);
        if (selectedPrereqTaskId && onPrerequisiteLinked) {
          onPrerequisiteLinked(task.id, selectedPrereqTaskId);
        }
      } else {
        // Assignee asks inquiry
        const inquiryItem = await submitPrerequisiteInquiry(
          workspaceId,
          task.id,
          inputText.trim()
        );
        setCommunications((prev) => [...prev, inquiryItem]);
      }
      setInputText('');
      setSelectedPrereqTaskId('');
      setMarkResolvedOnReply(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleResolve = async (inquiryId: string) => {
    if (!workspaceId || !task) return;
    try {
      await resolvePrerequisiteInquiry(workspaceId, task.id, inquiryId);
      setCommunications((prev) =>
        prev.map((c) => (c.id === inquiryId ? { ...c, status: 'resolved' } : c))
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resolve inquiry.');
    }
  };

  // WhatsApp 1-tap fallback url
  const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(
    `Hi! Regarding task: "${task.title}". Could you please clarify the prerequisites? ${inputText.trim() || 'Do we have any blockers or required assets before starting?'}`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#202020] dark:bg-[#0c0c0e] dark:text-white overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prereq-dialog-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-[#1e1e22]">
          <div className="space-y-1 pr-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
                <MessageSquare className="size-3.5" />
                2-Way Prerequisite Communication
              </span>
              {task.blocked_by && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-900/40">
                  <AlertCircle className="size-3" />
                  Blocked
                </span>
              )}
            </div>
            <h2 id="prereq-dialog-title" className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
              {task.title}
            </h2>
            {currentBlockingTask ? (
              <p className="text-xs text-slate-500 dark:text-neutral-400 flex items-center gap-1">
                <LinkIcon className="size-3 text-red-500" />
                Currently blocked by: <span className="font-semibold text-slate-700 dark:text-neutral-200">{currentBlockingTask.title}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Direct channel between Assignee & Manager to clarify prerequisites and dependencies.
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={loadCommunications}
              title="Refresh conversation"
              className="text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white"
            >
              <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-white"
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-5 mt-3 p-3 rounded-lg text-xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Message Thread Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[220px]">
          {isLoading && communications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-neutral-500 text-sm">
              <RefreshCw className="size-6 animate-spin mb-2 text-indigo-500" />
              <span>Loading prerequisite conversation...</span>
            </div>
          ) : communications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4 rounded-xl border border-dashed border-slate-200 dark:border-neutral-800 bg-slate-50/50 dark:bg-white/[0.02]">
              <HelpCircle className="size-10 text-indigo-400 mb-2" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-200">
                No prerequisite questions yet
              </h3>
              <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-sm mt-1">
                {isManager
                  ? 'The assignee has not submitted prerequisite inquiries yet. You can post clarifying guidelines or link a prerequisite task below.'
                  : 'Unsure what credentials, specs, or preceding tasks are required? Ask your manager below to ensure you have everything needed to succeed.'}
              </p>
            </div>
          ) : (
            communications.map((item) => {
              const isSenderMe = item.sender_id === currentUserId;
              const isReply = item.message_type === 'reply';

              return (
                <div
                  key={item.id}
                  className={`flex flex-col ${isSenderMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-500 dark:text-neutral-400">
                    <span className="font-semibold text-slate-700 dark:text-neutral-300">
                      {item.sender?.display_name || (isReply ? 'Manager' : 'Assignee')}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400">
                      {isReply ? 'Manager (Admin) Reply' : 'Assignee Question'}
                    </span>
                    <span>•</span>
                    <span>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed ${
                      isReply
                        ? 'bg-indigo-50 border border-indigo-200/80 text-slate-900 dark:bg-indigo-950/40 dark:border-indigo-900/60 dark:text-neutral-100'
                        : 'bg-white border border-slate-200 text-slate-900 dark:bg-[#151518] dark:border-neutral-800 dark:text-neutral-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{item.content}</p>

                    {/* Attached Prerequisite Task Indicator */}
                    {item.suggested_prerequisite_task_id && (
                      <div className="mt-2.5 pt-2 border-t border-indigo-200/60 dark:border-indigo-900/40 flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                        <LinkIcon className="size-3.5 text-indigo-500 shrink-0" />
                        <span>Prerequisite Linked:</span>
                        <span className="font-semibold underline underline-offset-2">
                          {item.suggested_prerequisite_task_title || 'Workspace Task'}
                        </span>
                      </div>
                    )}

                    {/* Status & Resolve Footer */}
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] pt-1.5 border-t border-black/5 dark:border-white/5">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          item.status === 'resolved'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : item.status === 'answered'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {item.status === 'resolved' ? (
                          <>
                            <CheckCircle2 className="size-3" /> Resolved
                          </>
                        ) : item.status === 'answered' ? (
                          <>
                            <Clock className="size-3" /> Answered
                          </>
                        ) : (
                          <>
                            <HelpCircle className="size-3" /> Needs Answer
                          </>
                        )}
                      </span>

                      {item.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => handleResolve(item.id)}
                          className="text-slate-500 hover:text-emerald-600 dark:text-neutral-400 dark:hover:text-emerald-400 font-medium transition-colors"
                        >
                          Mark Resolved
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={threadEndRef} />
        </div>

        {/* Quick Suggestion Chips (Assignee Helper) */}
        {!isManager && (
          <div className="px-5 pb-2">
            <div className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 mb-1.5 flex items-center gap-1">
              <Sparkles className="size-3 text-indigo-500" />
              <span>Suggested prerequisite questions:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputText(prompt)}
                  className="text-[11px] text-left px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Manager Option: Link a Task Prerequisite */}
        {isManager && (
          <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-white/[0.02] border-t border-slate-100 dark:border-neutral-800/80 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label htmlFor="prereq-select" className="text-xs font-semibold text-slate-700 dark:text-neutral-300 flex items-center gap-1.5">
                <LinkIcon className="size-3 text-indigo-500" />
                Link a Prerequisite Task (Optional):
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markResolvedOnReply}
                  onChange={(e) => setMarkResolvedOnReply(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Mark inquiry as resolved with this reply</span>
              </label>
            </div>
            <select
              id="prereq-select"
              value={selectedPrereqTaskId}
              onChange={(e) => setSelectedPrereqTaskId(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-800 dark:border-neutral-800 dark:bg-[#121214] dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- No dependency task to link --</option>
              {eligiblePrerequisiteOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Input & Action Bar */}
        <form onSubmit={handleSend} className="p-4 border-t border-slate-100 dark:border-[#1e1e22] bg-white dark:bg-[#0c0c0e]">
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isManager
                  ? 'Write your reply regarding prerequisites or dependencies...'
                  : 'Ask your manager about required credentials, assets, or blockers...'
              }
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-neutral-800 dark:bg-[#121214] dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-indigo-400"
            />
            <div className="flex flex-col gap-1.5 justify-end">
              <Button
                type="submit"
                disabled={isSending || !inputText.trim()}
                className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                <Send className="size-3.5" />
                <span>{isSending ? 'Sending...' : isManager ? 'Reply' : 'Ask'}</span>
              </Button>

              {/* Zero-Budget WhatsApp 1-tap fallback for urgent reachout */}
              {!isManager && (
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800/40 transition-colors"
                  title="Share inquiry with manager via WhatsApp"
                >
                  <ExternalLink className="size-3" />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
