import React, { useState } from 'react';
import { GitCompare, Calendar, ArrowRight, Share2, Check, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import type { MeetingSummaryBrief, MeetingProgressDiff } from '../../types/velocity';

interface MeetingDiffSelectorProps {
  meetings: MeetingSummaryBrief[];
  selectedDiff: MeetingProgressDiff | null;
  onSelectMeetings: (baseId: string, currentId: string) => void;
}

export const MeetingDiffSelector: React.FC<MeetingDiffSelectorProps> = ({
  meetings,
  selectedDiff,
  onSelectMeetings,
}) => {
  const [copied, setCopied] = useState(false);

  const baseId = selectedDiff?.base_meeting.id || meetings[0]?.id || '';
  const currentId = selectedDiff?.current_meeting.id || meetings[meetings.length - 1]?.id || '';

  const handleBaseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSelectMeetings(e.target.value, currentId);
  };

  const handleCurrentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSelectMeetings(baseId, e.target.value);
  };

  const handleAutoConsecutive = () => {
    if (meetings.length >= 2) {
      onSelectMeetings(meetings[meetings.length - 2].id, meetings[meetings.length - 1].id);
    }
  };

  const handleCopySummary = () => {
    if (!selectedDiff) return;

    const summaryText = `*Sprint Meeting Progress & Velocity Report*
📅 *Cycle:* ${selectedDiff.base_meeting.title} ➔ ${selectedDiff.current_meeting.title} (${selectedDiff.days_between_meetings} days)
🚀 *Velocity Score:* ${selectedDiff.velocity_score}%
⚠️ *Carryover Rate:* ${selectedDiff.spillover_rate}%

✅ *Completed Tasks (${selectedDiff.completed_tasks.length}):*
${selectedDiff.completed_tasks.map((t) => `• ${t.title} (${t.assignee_name})`).join('\n') || 'None'}

⏳ *Carried-Over Tasks (${selectedDiff.carried_over_tasks.length}):*
${selectedDiff.carried_over_tasks.map((t) => `• [${t.status.toUpperCase()}] ${t.title} (${t.assignee_name})`).join('\n') || 'None'}

✨ *New Action Items (${selectedDiff.new_action_items.length}):*
${selectedDiff.new_action_items.map((t) => `• ${t.title} (${t.assignee_name})`).join('\n') || 'None'}
`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 backdrop-blur-sm">
      {/* Left: Cycle Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-medium">
          <GitCompare className="size-3.5 text-indigo-400" />
          <span>Compare:</span>
        </div>

        {/* Base Meeting Select */}
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-neutral-500" />
          <select
            value={baseId}
            onChange={handleBaseChange}
            className="h-7.5 rounded-lg border border-white/10 bg-neutral-900/90 py-0 pl-7 pr-6 text-xs text-neutral-200 outline-none focus:border-indigo-500 max-w-[190px] truncate"
            title="Base Meeting"
          >
            {meetings.map((m) => (
              <option key={`base-${m.id}`} value={m.id}>
                Base: {m.title}
              </option>
            ))}
          </select>
        </div>

        <ArrowRight className="size-3 text-neutral-600 shrink-0" />

        {/* Current Meeting Select */}
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-neutral-500" />
          <select
            value={currentId}
            onChange={handleCurrentChange}
            className="h-7.5 rounded-lg border border-white/10 bg-neutral-900/90 py-0 pl-7 pr-6 text-xs text-neutral-200 outline-none focus:border-indigo-500 max-w-[190px] truncate"
            title="Current Meeting"
          >
            {meetings.map((m) => (
              <option key={`curr-${m.id}`} value={m.id}>
                Current: {m.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Quick Actions */}
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAutoConsecutive}
          className="h-7.5 border border-white/10 bg-white/[0.03] text-xs text-neutral-300 hover:text-white px-2.5"
          title="Auto-select latest two consecutive meetings"
        >
          <Zap className="size-3 mr-1 text-amber-400" />
          Latest
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopySummary}
          className="h-7.5 border border-indigo-500/20 bg-indigo-500/10 text-xs text-indigo-300 hover:bg-indigo-500/20 hover:text-white px-2.5"
          title="Copy Markdown summary"
        >
          {copied ? (
            <>
              <Check className="size-3 mr-1 text-emerald-400" />
              Copied!
            </>
          ) : (
            <>
              <Share2 className="size-3 mr-1 text-indigo-400" />
              Copy Diff
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
