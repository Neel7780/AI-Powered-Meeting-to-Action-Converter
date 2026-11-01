import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Copy,
  Check,
  Share2,
  RefreshCw,
  User,
  Briefcase,
  ListTodo,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Send,
  Eye,
  FileEdit
} from 'lucide-react';
import type {
  DraftFollowUpResponse,
  FollowUpParticipant,
  FollowUpTone
} from '../../types/review';
import { reviewApi } from '../../services/reviewApi';
import { Button } from '../ui/button';

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  meetingTitle?: string;
}

/** Formats inline text with bold, code snippets, status badges, and @mentions */
function renderFollowUpInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|@\w+)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      if (['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'URGENT', 'HIGH', 'NORMAL'].includes(boldText.toUpperCase())) {
        const colors: Record<string, string> = {
          URGENT: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          HIGH: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          NORMAL: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          TODO: 'bg-neutral-800 text-neutral-300 border-neutral-700',
          IN_PROGRESS: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          BLOCKED: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          DONE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        };
        const colorClass = colors[boldText.toUpperCase()] || 'bg-white/10 text-white';
        return (
          <span
            key={index}
            className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${colorClass}`}
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
          className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-indigo-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('@')) {
      return (
        <span
          key={index}
          className="inline-flex items-center rounded bg-indigo-500/15 px-1.5 py-0.5 text-xs font-semibold text-indigo-300"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

/** Rich, formatted markdown preview component for follow-up notes & tables */
function FollowUpPreview({ content }: { content: string }) {
  // Normalize any literal escaped \n strings
  const cleanContent = content.replace(/\\n/g, '\n');
  const rawLines = cleanContent.split('\n');

  // Group table lines together
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];

  const flushTable = (key: string) => {
    if (tableBuffer.length === 0) return;
    const headerLine = tableBuffer[0];
    const dataLines = tableBuffer.slice(2); // Skip separator row (| :--- |)

    const parseRow = (line: string) =>
      line
        .split('|')
        .slice(1, -1)
        .map(cell => cell.trim());

    const headers = parseRow(headerLine);

    elements.push(
      <div key={key} className="overflow-x-auto my-3 rounded-lg border border-white/10 bg-[#090a0f]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04]">
              {headers.map((h, i) => (
                <th key={i} className="px-3.5 py-2.5 font-semibold text-neutral-300">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {dataLines.map((rowLine, rIdx) => {
              const cells = parseRow(rowLine);
              return (
                <tr key={rIdx} className="hover:bg-white/[0.02] transition-colors">
                  {cells.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2 text-neutral-300">
                      {renderFollowUpInline(cell)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableBuffer = [];
  };

  rawLines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Table rows
    if (trimmed.startsWith('|')) {
      tableBuffer.push(trimmed);
      return;
    } else {
      flushTable(`table-${idx}`);
    }

    if (!trimmed) {
      elements.push(<div key={idx} className="h-1.5" />);
      return;
    }

    // Header ###
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={idx} className="mt-4 text-sm font-semibold tracking-wide text-white border-b border-white/5 pb-1">
          {trimmed.replace(/^###\s+/, '')}
        </h4>
      );
      return;
    }

    // Header ##
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={idx} className="mt-4 text-base font-semibold tracking-wide text-white border-b border-white/10 pb-1.5">
          {trimmed.replace(/^##\s+/, '')}
        </h3>
      );
      return;
    }

    // Task checkbox items: - [ ] Task name
    if (trimmed.startsWith('- [ ]') || trimmed.startsWith('* [ ]')) {
      const taskText = trimmed.replace(/^[-*]\s+\[\s*\]\s+/, '');
      elements.push(
        <div key={idx} className="flex items-start gap-2.5 rounded-md border border-white/5 bg-white/[0.02] p-2.5 text-xs text-neutral-200">
          <span className="mt-0.5 size-4 rounded border border-white/20 bg-white/5 shrink-0" />
          <div className="flex-1">{renderFollowUpInline(taskText)}</div>
        </div>
      );
      return;
    }

    // Bullets: - item or * item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const bulletText = trimmed.replace(/^[-*]\s+/, '');
      elements.push(
        <div key={idx} className="flex items-start gap-2 pl-1 text-xs text-neutral-300">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-indigo-400" />
          <div className="flex-1">{renderFollowUpInline(bulletText)}</div>
        </div>
      );
      return;
    }

    // Horizontal rule
    if (trimmed === '---') {
      elements.push(<hr key={idx} className="my-3 border-white/10" />);
      return;
    }

    // Normal paragraph
    elements.push(
      <p key={idx} className="text-xs leading-relaxed text-neutral-300">
        {renderFollowUpInline(trimmed)}
      </p>
    );
  });

  flushTable('table-end');

  return <div className="space-y-2">{elements}</div>;
}

export const FollowUpModal: React.FC<FollowUpModalProps> = ({
  isOpen,
  onClose,
  meetingId,
  meetingTitle = 'Meeting'
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const [tone, setTone] = useState<FollowUpTone>('executive');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('all');
  const [participants, setParticipants] = useState<FollowUpParticipant[]>([]);

  const [subject, setSubject] = useState<string>('');
  const [markdownBody, setMarkdownBody] = useState<string>('');
  const [htmlBody, setHtmlBody] = useState<string>('');
  const [whatsappUrl, setWhatsappUrl] = useState<string>('');
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleGenerate = async (
    targetId: string = selectedTargetId,
    targetTone: FollowUpTone = tone
  ) => {
    try {
      setLoading(true);
      const targetUser = participants.find(p => p.user_id === targetId || p.name === targetId);
      const isAll = targetId === 'all';

      const draft: DraftFollowUpResponse = await reviewApi.draftFollowUp(meetingId, {
        targetUserId: isAll ? null : (targetUser?.user_id || null),
        targetName: isAll ? null : (targetUser?.name || null),
        tone: targetTone
      });

      // Sanitize subject if any raw python tokens leaked
      let cleanSubject = draft.subject || '';
      if (cleanSubject.includes("'text':")) {
        cleanSubject = cleanSubject.replace(/.*'text':\s*['"]?/, '').replace(/['"]?}.*/, '').trim();
      }
      cleanSubject = cleanSubject.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();

      // Sanitize markdown
      let cleanMarkdown = draft.content_markdown || '';
      if (cleanMarkdown.includes("'text':")) {
        cleanMarkdown = cleanMarkdown.replace(/.*'text':\s*['"]?/, '').replace(/['"]?,\s*'extras'.*/s, '').trim();
      }
      cleanMarkdown = cleanMarkdown.replace(/\\n/g, '\n');

      setSubject(cleanSubject || `[ActionPulse] Follow-Up: ${meetingTitle}`);
      setMarkdownBody(cleanMarkdown);
      setHtmlBody(draft.content_html);
      setWhatsappUrl(draft.whatsapp_share_url);
      setRecipientEmails(draft.recipient_emails || []);

      if (draft.participants && draft.participants.length > 0) {
        setParticipants(draft.participants);
      }
    } catch (err) {
      console.error('Failed to generate draft follow-up:', err);
      showToast('Error generating follow-up draft', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleGenerate('all', 'executive');
    }
  }, [isOpen, meetingId]);

  if (!isOpen) return null;

  const handleTargetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedTargetId(val);
    handleGenerate(val, tone);
  };

  const handleToneChange = (newTone: FollowUpTone) => {
    setTone(newTone);
    handleGenerate(selectedTargetId, newTone);
  };

  const handleCopy = async () => {
    try {
      const fullContent = `${subject}\n\n${markdownBody}`;
      await navigator.clipboard.writeText(fullContent);
      setCopied(true);
      showToast('Follow-up copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleSendEmail = async () => {
    if (recipientEmails.length === 0) {
      showToast('No recipient email addresses found', 'error');
      return;
    }

    try {
      setSending(true);
      const res = await reviewApi.sendFollowUp(meetingId, {
        recipient_emails: recipientEmails,
        subject,
        content_markdown: markdownBody,
        content_html: htmlBody
      });
      showToast(res.message || `Dispatched to ${res.recipients_count} recipients`, 'success');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Send follow-up failed:', err);
      showToast(err.message || 'Failed to dispatch email', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-xl border border-white/10 bg-[#0c0d12] text-white shadow-2xl overflow-hidden">
        {/* Toast Alert */}
        {toast && (
          <div
            role="status"
            className="absolute top-4 right-4 z-50 flex items-center gap-2 rounded-md border border-white/10 bg-black/90 px-3.5 py-2 text-xs font-medium shadow-2xl"
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="size-4 text-emerald-400" />
            ) : (
              <AlertCircle className="size-4 text-rose-400" />
            )}
            <span>{toast.text}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
              <Sparkles className="size-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Draft Follow-Up in 1 Click</h2>
                <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-indigo-300 uppercase">
                  Zero-Budget AI
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Personalized recap & deliverables for <span className="text-neutral-200">{meetingTitle}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white transition-colors"
            title="Close dialog"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Control Toolbar: Recipient Selector & Tone Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 bg-[#090a0e] px-6 py-3">
          {/* Personalized Recipient Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="recipient-select" className="text-xs font-medium text-neutral-400 flex items-center gap-1.5">
              <User className="size-3.5 text-indigo-400" />
              Recipient:
            </label>
            <select
              id="recipient-select"
              value={selectedTargetId}
              onChange={handleTargetChange}
              disabled={loading}
              className="rounded-md border border-white/10 bg-[#14151e] px-2.5 py-1 text-xs text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">👥 All Attendees (Team-Wide Summary)</option>
              {participants.map(p => (
                <option key={p.user_id || p.name} value={p.user_id || p.name}>
                  👤 {p.name} {p.task_count > 0 ? `(${p.task_count} tasks)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Tone & Style Toggles */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-400 mr-1">Tone:</span>
            <button
              onClick={() => handleToneChange('executive')}
              disabled={loading}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                tone === 'executive'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200'
              }`}
              title="Concise executive brief with high-level decisions"
            >
              <Briefcase className="size-3" />
              Executive
            </button>
            <button
              onClick={() => handleToneChange('action_focused')}
              disabled={loading}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                tone === 'action_focused'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200'
              }`}
              title="Deliverables table with assignees and deadlines"
            >
              <ListTodo className="size-3" />
              Action-Focused
            </button>
            <button
              onClick={() => handleToneChange('chat')}
              disabled={loading}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                tone === 'chat'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200'
              }`}
              title="Slack / WhatsApp emoji format with @mentions"
            >
              <MessageSquare className="size-3" />
              Slack / Chat
            </button>

            <button
              onClick={() => handleGenerate(selectedTargetId, tone)}
              disabled={loading}
              className="ml-2 rounded-md border border-white/10 bg-white/5 p-1 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
              title="Regenerate draft"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Modal Main Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Subject Field */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">
              Email Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              disabled={loading}
              className="w-full rounded-md border border-white/10 bg-[#11121a] px-3 py-2 text-xs font-medium text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs font-medium text-neutral-400">
              {viewMode === 'preview' ? 'Formatted Preview' : 'Editable Markdown'}
            </span>
            <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-md">
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  viewMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Eye className="size-3" />
                Preview
              </button>
              <button
                onClick={() => setViewMode('edit')}
                className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  viewMode === 'edit' ? 'bg-indigo-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <FileEdit className="size-3" />
                Edit
              </button>
            </div>
          </div>

          {/* Content Area */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <RefreshCw className="size-8 animate-spin text-indigo-400" />
              <p className="text-sm font-medium text-neutral-300">
                Synthesizing meeting transcript & confirmed tasks…
              </p>
              <p className="text-xs text-neutral-500">
                Generating personalized follow-up via Gemini 3.1 Flash-Lite
              </p>
            </div>
          ) : viewMode === 'preview' ? (
            <div className="rounded-lg border border-white/10 bg-[#0e0f17] p-5 text-neutral-200 text-xs leading-relaxed overflow-x-auto select-text">
              <FollowUpPreview content={markdownBody} />
            </div>
          ) : (
            <textarea
              rows={12}
              value={markdownBody}
              onChange={e => setMarkdownBody(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0e0f17] p-4 text-xs font-mono text-neutral-200 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none resize-y"
              placeholder="Enter markdown follow-up..."
            />
          )}

          {/* Recipients List Display */}
          <div className="rounded-lg border border-white/5 bg-white/[0.01] p-3 text-xs">
            <span className="font-medium text-neutral-400">Recipients ({recipientEmails.length}): </span>
            <span className="text-neutral-300">
              {recipientEmails.length > 0 ? recipientEmails.join(', ') : 'No email addresses associated'}
            </span>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-6 py-4">
          {/* Left Actions: WhatsApp & Copy */}
          <div className="flex items-center gap-2">
            {/* 1-Tap WhatsApp Share */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              title="Open WhatsApp with prefilled recap message"
            >
              <Share2 className="size-3.5" />
              Share on WhatsApp
            </a>

            {/* Copy to Clipboard */}
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
              title="Copy markdown text for Slack or docs"
            >
              {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              {copied ? 'Copied!' : 'Copy Markdown'}
            </button>
          </div>

          {/* Right Actions: Cancel & Send Email */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSendEmail}
              disabled={loading || sending || recipientEmails.length === 0}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              title="Dispatch follow-up email via Brevo SMTP"
            >
              {sending ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin mr-1.5" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="size-3.5 mr-1.5" />
                  Send Email ({recipientEmails.length})
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
