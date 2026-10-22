import React, { useState } from 'react';
import { 
  Sparkles, 
  Copy, 
  Check, 
  RotateCw, 
  CheckCircle2, 
  ArrowRight, 
  Tag, 
  FileText,
  User,
  ExternalLink,
  Clock
} from 'lucide-react';
import type { MeetingSummaryData } from '../../types/meetingDetails';
import type { ActionItemCandidate } from '../../types/review';

interface SummaryTabProps {
  summary: MeetingSummaryData;
  candidates: ActionItemCandidate[];
  onSelectTimestamp: (timestamp: string, segmentId?: string) => void;
  onJumpToCandidate: (candidateId: string) => void;
}

export const MeetingSummaryTab: React.FC<SummaryTabProps> = ({
  summary,
  candidates,
  onSelectTimestamp,
  onJumpToCandidate
}) => {
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleCopySummary = () => {
    const text = `# ${summary.overview}\n\n## Key Discussion Points\n` +
      summary.key_discussion_points.map(dp => `### ${dp.topic}\n` + dp.points.map(p => `- ${p}`).join('\n')).join('\n\n') +
      `\n\n## Decisions\n` + summary.decisions.map(d => `- [${d.timestamp}] ${d.speaker}: ${d.text}`).join('\n') +
      `\n\n## Outcomes\n` + summary.outcomes.map(o => `- ${o}`).join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      setIsRegenerating(false);
    }, 1200);
  };

  return (
    <div className="p-4 sm:p-5 space-y-6 text-slate-200 text-xs sm:text-[13px] leading-relaxed">
      {/* Top Banner: AI Model & Actions */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-teal-950/40 via-[#161d28] to-indigo-950/30 border border-teal-800/40">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-400 flex-shrink-0" />
          <div>
            <span className="font-semibold text-teal-300">Grounded Meeting Summary</span>
            <span className="text-[11px] text-slate-400 ml-2 hidden sm:inline">
              via Gemini 3.1 Flash-Lite
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1a202c] hover:bg-[#222a3a] border border-[#2d3748] text-slate-300 hover:text-white text-xs transition disabled:opacity-50"
            title="Refresh summary with Gemini"
          >
            <RotateCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin text-teal-400' : ''}`} />
            <span className="hidden sm:inline">{isRegenerating ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1a202c] hover:bg-[#222a3a] border border-[#2d3748] text-slate-300 hover:text-white text-xs transition"
            title="Copy summary in Markdown format"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Executive Overview */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold tracking-wider uppercase text-teal-400 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          <span>Executive Overview</span>
        </div>
        <div className="p-3.5 rounded-xl bg-[#141720] border border-[#222734] text-slate-300 leading-relaxed text-xs sm:text-sm">
          {summary.overview}
        </div>
      </div>

      {/* Key Discussion Points */}
      <div className="space-y-3">
        <div className="text-[11px] font-bold tracking-wider uppercase text-slate-400 flex items-center justify-between">
          <span>Key Discussion Topics</span>
          <span className="text-teal-400 font-mono">{summary.key_discussion_points.length} topics</span>
        </div>

        <div className="space-y-3">
          {summary.key_discussion_points.map((topic, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-[#141720] border border-[#222734] hover:border-[#2d3547] transition space-y-2"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold text-white text-xs sm:text-sm">
                  {topic.topic}
                </span>
                {topic.timestamp && (
                  <button
                    onClick={() => onSelectTimestamp(topic.timestamp!)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-950/60 text-teal-300 hover:bg-teal-900/80 font-mono text-[11px] border border-teal-800/40 transition"
                    title="Jump to this topic in transcript"
                  >
                    <Clock className="w-3 h-3" />
                    <span>{topic.timestamp}</span>
                  </button>
                )}
              </div>

              <ul className="space-y-1.5 pl-1">
                {topic.points.map((pt, pIdx) => (
                  <li key={pIdx} className="flex items-start gap-2 text-slate-300 text-xs">
                    <span className="text-teal-400 mt-1">•</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Decisions Made */}
      <div className="space-y-3">
        <div className="text-[11px] font-bold tracking-wider uppercase text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Decisions Made ({summary.decisions.length})</span>
        </div>

        <div className="space-y-2">
          {summary.decisions.map((dec) => (
            <div
              key={dec.id}
              className="p-3 rounded-xl bg-[#131b1c] border border-emerald-900/40 hover:border-emerald-700/60 transition space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-emerald-300 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{dec.speaker}</span>
                </span>
                <button
                  onClick={() => onSelectTimestamp(dec.timestamp, dec.segment_id)}
                  className="flex items-center gap-1 font-mono text-emerald-400 hover:underline cursor-pointer"
                >
                  <Clock className="w-3 h-3" />
                  <span>{dec.timestamp}</span>
                </button>
              </div>

              <p className="text-slate-200 text-xs font-medium">{dec.text}</p>
              
              {dec.excerpt && (
                <div className="text-[11px] text-slate-400 italic bg-[#0f1416] p-2 rounded-lg border border-emerald-950">
                  "{dec.excerpt}"
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Outcomes & Connected Action Items Context */}
      <div className="space-y-3">
        <div className="text-[11px] font-bold tracking-wider uppercase text-indigo-400 flex items-center justify-between">
          <span>Connected Action Items ({candidates.length})</span>
          <span className="text-slate-400 text-[10px]">Staging Gate Ready</span>
        </div>

        <div className="space-y-2">
          {candidates.map((cand) => (
            <div
              key={cand.id}
              className="p-3 rounded-xl bg-[#151722] border border-[#24293c] hover:border-indigo-600/50 transition flex items-center justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
                  <span className="font-semibold text-slate-200 text-xs truncate">
                    {cand.title}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>Assignee: <strong>{cand.assignee?.full_name || 'Unassigned'}</strong></span>
                  <span>•</span>
                  <span className="font-mono text-teal-400">{cand.transcript_timestamp}</span>
                </div>
              </div>

              <button
                onClick={() => onSelectTimestamp(cand.transcript_timestamp, cand.transcript_segment_id)}
                className="px-2.5 py-1 text-[11px] font-medium text-teal-300 hover:text-white bg-teal-950/60 hover:bg-teal-900 border border-teal-800/40 rounded-lg flex items-center gap-1 transition flex-shrink-0"
              >
                <span>Transcript</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
