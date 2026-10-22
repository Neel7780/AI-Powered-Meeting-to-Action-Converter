import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  MessageCircle, 
  Mail, 
  Download, 
  Sparkles,
  Link2
} from 'lucide-react';
import type { RichMeetingDetails } from '../../types/meetingDetails';

interface ShareModalProps {
  meeting: RichMeetingDetails;
  isOpen: boolean;
  onClose: () => void;
}

export const MeetingShareModal: React.FC<ShareModalProps> = ({
  meeting,
  isOpen,
  onClose
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  if (!isOpen) return null;

  const meetingUrl = window.location.href;

  const shareText = `*${meeting.title}* (${meeting.date_formatted})\n\n` +
    `Summary: ${meeting.summary.overview}\n\n` +
    `Key Decisions:\n` + meeting.summary.decisions.map(d => `• ${d.text}`).join('\n') +
    `\n\nReview full details: ${meetingUrl}`;

  // Zero-cost WhatsApp prefilled link
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  // Email mailto link
  const emailUrl = `mailto:?subject=${encodeURIComponent(
    `Meeting Summary: ${meeting.title}`
  )}&body=${encodeURIComponent(shareText)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const md = `# ${meeting.title}\n` +
      `Date: ${meeting.date_formatted} | Duration: ${meeting.total_duration_formatted}\n\n` +
      `## Executive Overview\n${meeting.summary.overview}\n\n` +
      `## Chapters\n` + meeting.chapters.map(c => `### ${c.timestamp} - ${c.title}\n${c.summary}\n`).join('\n') +
      `\n## Key Decisions\n` + meeting.summary.decisions.map(d => `- [${d.timestamp}] ${d.speaker}: ${d.text}`).join('\n') +
      `\n## Action Items\n` + meeting.summary.outcomes.map(o => `- ${o}`).join('\n');

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title.toLowerCase().replace(/\s+/g, '-')}-summary.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#12151c] border border-[#252b39] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-200 text-xs sm:text-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1f2430] bg-[#161a23]">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-teal-400" />
            <h3 className="font-bold text-white">Share Meeting & Summary</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#202736] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Copy Meeting Link
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-[#0d0f14] border border-[#222734]">
              <Link2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                readOnly
                value={meetingUrl}
                className="w-full bg-transparent text-xs text-slate-300 focus:outline-none select-all"
              />
              <button
                onClick={handleCopyLink}
                className="px-2.5 py-1 rounded-lg bg-teal-500 text-slate-950 font-bold text-xs hover:bg-teal-400 transition flex items-center gap-1 flex-shrink-0"
              >
                {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* 1-Tap Zero-Cost Sharing Channels */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              1-Tap Zero-Cost Sharing
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {/* WhatsApp 1-Tap */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 p-3 rounded-xl bg-[#14231b] hover:bg-[#192f24] border border-emerald-900/40 text-emerald-300 font-semibold text-xs transition"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>WhatsApp</span>
              </a>

              {/* Email Client */}
              <a
                href={emailUrl}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-[#1a1e2b] hover:bg-[#202738] border border-indigo-900/40 text-indigo-300 font-semibold text-xs transition"
              >
                <Mail className="w-4 h-4 text-indigo-400" />
                <span>Email Summary</span>
              </a>
            </div>
          </div>

          {/* Export Markdown */}
          <button
            onClick={handleDownloadMarkdown}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-[#161a23] hover:bg-[#1f2533] border border-[#262d3c] text-slate-300 font-medium text-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            <span>Download Summary (.md)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
