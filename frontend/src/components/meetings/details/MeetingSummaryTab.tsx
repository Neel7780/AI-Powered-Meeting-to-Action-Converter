import React, { useState } from 'react';
import { 
  Sparkles, 
  Copy, 
  Check, 
  CheckCircle2, 
  ArrowRight, 
  FileText,
  User,
  Clock
} from 'lucide-react';
import type { MeetingSummaryData } from '../../../types/meetingDetails';
import type { ActionItemCandidate } from '../../../types/review';

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

  const handleCopySummary = () => {
    const text = `# ${summary.overview}\n\n## Key Discussion Points\n` +
      summary.key_discussion_points.map(dp => `### ${dp.topic}\n` + dp.points.map(p => `- ${p}`).join('\n')).join('\n\n') +
      `\n\n## Decisions\n` + summary.decisions.map(d => `- [${d.timestamp}] ${d.speaker}: ${d.text}`).join('\n') +
      `\n\n## Outcomes\n` + summary.outcomes.map(o => `- ${o}`).join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-5 space-y-6 text-slate-200 text-xs sm:text-[13px] leading-relaxed">
      {/* Top Banner: AI Model & Actions */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl dashboard-tinted-gradient bg-gradient-to-r from-teal-950/40 via-[#161d28] to-indigo-950/30 border border-teal-800/40">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-400 flex-shrink-0" />
          <div>
            <span className="font-semibold text-teal-300">Meeting summary</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">

          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg dashboard-surface bg-[#1a202c] dashboard-surface-hover hover:bg-[#222a3a] border dashboard-line border-[#2d3748] text-slate-300 hover:text-white text-xs transition"
            title="Copy summary in Markdown format"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Section 1: Overview */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold tracking-wider uppercase text-teal-400 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          <span>Executive Overview</span>
        </div>
        <p className="text-slate-200 leading-relaxed dashboard-surface bg-[#11141c] p-3.5 rounded-xl border dashboard-line border-[#1e2330]">
          {summary.overview}
        </p>
      </div>

      {/* Speaker Insights Bar */}
      {summary.speaker_insights && summary.speaker_insights.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold tracking-wider uppercase text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Participant Voice Contributions</span>
            </span>
            <span className="text-[10px] text-teal-400 font-mono">Calculated from audio duration</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {summary.speaker_insights.map((spk) => (
              <div key={spk.speaker} className="p-3 rounded-xl dashboard-surface bg-[#131620] border dashboard-line border-[#202636] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 text-xs">{spk.speaker}</span>
                  <span className="font-mono text-xs font-bold text-teal-300">{spk.talk_percentage}%</span>
                </div>
                <div className="w-full h-1.5 dashboard-surface bg-[#1f2536] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-400 rounded-full"
                    style={{ width: `${spk.talk_percentage}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400 truncate" title={spk.key_contribution}>
                  {spk.key_contribution}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Key Discussion Topics */}
      <div className="space-y-3">
        <div className="text-[11px] font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
          <span>Key Discussion Topics & Evidence</span>
        </div>

        <div className="space-y-3">
          {summary.key_discussion_points.map((topic, idx) => (
            <div key={idx} className="p-3.5 rounded-xl dashboard-surface bg-[#131620] border dashboard-line border-[#202636] space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-slate-100 text-xs sm:text-[13px]">{topic.topic}</span>
                {topic.timestamp && (
                  <button
                    onClick={() => onSelectTimestamp(topic.timestamp!)}
                    className="flex items-center gap-1 font-mono text-[11px] text-teal-400 hover:text-teal-300 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/40"
                  >
                    <Clock className="w-2.5 h-2.5" />
                    <span>{topic.timestamp}</span>
                  </button>
                )}
              </div>

              <ul className="space-y-1.5 pt-1">
                {topic.points.map((pt, pIdx) => (
                  <li key={pIdx} className="flex items-start gap-2 text-slate-300 text-xs">
                    <span className="text-teal-400 font-bold">•</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Decisions Made (Highlighted Grounded Items) */}
      <div className="space-y-3">
        <div className="text-[11px] font-bold tracking-wider uppercase text-emerald-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Decisions ({summary.decisions.length})</span>
          </span>
          <span className="text-[10px] text-slate-400 font-normal">Grounded quotes</span>
        </div>

        {!summary.decisions.length && <p className="text-xs text-slate-400">No decisions recorded.</p>}
        <div className="space-y-2.5">
          {summary.decisions.map((dec) => (
            <div
              key={dec.id}
              className="p-3.5 rounded-xl dashboard-tinted-gradient bg-gradient-to-r from-emerald-950/30 via-[#12181f] to-[#10141a] border border-emerald-800/40 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-300">{dec.speaker} agreed:</span>
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
                <div className="text-[11px] text-slate-400 italic dashboard-surface bg-[#0f1416] p-2 rounded-lg border border-emerald-950">
                  "{dec.excerpt}"
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Open questions</h4>
        {summary.open_questions?.length ? <ul className="list-disc space-y-1 pl-4 text-slate-300">
          {summary.open_questions.map((question) => <li key={question}>{question}</li>)}
        </ul> : <p className="text-xs text-slate-400">No open questions recorded.</p>}
      </section>

      {/* Outcomes & Connected Action Items Context */}
      {candidates.length > 0 && <div className="space-y-3">
        <div className="text-[11px] font-bold tracking-wider uppercase text-indigo-400 flex items-center justify-between">
          <span>Connected Action Items ({candidates.length})</span>
          <span className="text-slate-400 text-[10px]">Ready for review</span>
        </div>

        <div className="space-y-2">
          {candidates.map((cand) => (
            <div
              key={cand.id}
              className="p-3 rounded-xl dashboard-surface bg-[#151722] border dashboard-line border-[#24293c] hover:border-indigo-600/50 transition flex items-center justify-between gap-3"
            >
              <div
                onClick={() => onJumpToCandidate(cand.id)}
                className="space-y-1 min-w-0 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 col-2 rounded-full bg-teal-400 flex-shrink-0" />
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
      </div>}
    </div>
  );
};
