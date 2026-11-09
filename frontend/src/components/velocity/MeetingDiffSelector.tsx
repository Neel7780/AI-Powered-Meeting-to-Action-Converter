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
⚠️ *Spillover Rate:* ${selectedDiff.spillover_rate}%

✅ *Completed Tasks (${selectedDiff.completed_tasks.length}):*
${selectedDiff.completed_tasks.map((t) => `• ${t.title} (${t.assignee_name})`).join('\n') || 'None'}

⏳ *Carried-Over / Spillover Tasks (${selectedDiff.carried_over_tasks.length}):*
${selectedDiff.carried_over_tasks.map((t) => `• [${t.status.toUpperCase()}] ${t.title} (${t.assignee_name})`).join('\n') || 'None'}

✨ *New Action Items Added (${selectedDiff.new_action_items.length}):*
${selectedDiff.new_action_items.map((t) => `• ${t.title} (${t.assignee_name})`).join('\n') || 'None'}
`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4.5 backdrop-blur-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Selector Title */}
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <GitCompare className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Compare Meeting-to-Meeting Progress</h3>
            <p className="text-[11px] text-neutral-400">
              Select consecutive sprint meetings to analyze progress delta and carryover tasks
            </p>
          </div>
        </div>

        {/* Meeting Dropdowns & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Base Meeting Select */}
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
            <select
              value={baseId}
              onChange={handleBaseChange}
              className="h-8 rounded-lg border border-white/10 bg-neutral-900/90 py-0 pl-8 pr-7 text-xs text-neutral-200 outline-none focus:border-indigo-500 max-w-[210px] truncate"
              title="Base Meeting"
            >
              {meetings.map((m) => (
                <option key={`base-${m.id}`} value={m.id}>
                  Base: {m.title}
                </option>
              ))}
            </select>
          </div>

          <ArrowRight className="size-3.5 text-neutral-500 shrink-0" />

          {/* Current Meeting Select */}
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
            <select
              value={currentId}
              onChange={handleCurrentChange}
              className="h-8 rounded-lg border border-white/10 bg-neutral-900/90 py-0 pl-8 pr-7 text-xs text-neutral-200 outline-none focus:border-indigo-500 max-w-[210px] truncate"
              title="Comparison Meeting"
            >
              {meetings.map((m) => (
                <option key={`curr-${m.id}`} value={m.id}>
                  Current: {m.title}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Auto-consecutive button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAutoConsecutive}
            className="h-8 border border-white/10 bg-white/[0.03] text-xs text-neutral-300 hover:text-white"
            title="Auto-select the most recent two consecutive meetings"
          >
            <Zap className="size-3 mr-1 text-amber-400" />
            Latest Cycle
          </Button>

          {/* Copy Report for Slack / WhatsApp */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopySummary}
            className="h-8 border border-indigo-500/20 bg-indigo-500/10 text-xs text-indigo-300 hover:bg-indigo-500/20 hover:text-white"
            title="Copy formatted Markdown summary for Slack or WhatsApp"
          >
            {copied ? (
              <>
                <Check className="size-3 mr-1 text-emerald-400" />
                Copied!
              </>
            ) : (
              <>
                <Share2 className="size-3 mr-1 text-indigo-400" />
                Copy Diff Summary
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

