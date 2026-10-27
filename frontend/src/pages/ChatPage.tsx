import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Lightbulb,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import ChatInterface from '../components/chat/ChatInterface';
import { useWorkspace } from '../context/WorkspaceContext';
import { supabase } from '../lib/supabase';

export default function ChatPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  const [meetingCount, setMeetingCount] = useState<number>(0);
  const [taskCount, setTaskCount] = useState<number>(0);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    Promise.all([
      supabase.from('meetings').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).neq('status', 'done'),
    ]).then(([m, t]) => {
      if (!cancelled) {
        setMeetingCount(m.count ?? 0);
        setTaskCount(t.count ?? 0);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (!workspaceId) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6 text-center">
        <div className="panel max-w-md p-8">
          <AlertCircle className="mx-auto size-8 text-neutral-500" />
          <h2 className="mt-3 text-lg font-medium text-white">No Workspace Selected</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Please select or create a workspace to query meeting data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
              <Sparkles className="size-4" />
            </span>
            <p className="eyebrow">Workspace Intelligence</p>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            AI Meeting Copilot
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Query across transcripts, decisions, and action items with grounded citations.
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-3">
          <div className="panel flex items-center gap-2 px-3 py-2">
            <Calendar className="size-4 text-neutral-400" />
            <div className="text-left">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Meetings</p>
              <p className="font-mono text-xs font-semibold text-white">{meetingCount}</p>
            </div>
          </div>
          <div className="panel flex items-center gap-2 px-3 py-2">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <div className="text-left">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Open Tasks</p>
              <p className="font-mono text-xs font-semibold text-emerald-300">{taskCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Chat on Left, Intelligence Side Panel on Right */}
      <div className="grid gap-6 lg:grid-cols-4 items-start">
        {/* Chat Main Area (3 Columns on Large Screens) */}
        <div className="lg:col-span-3 h-[720px] rounded-xl overflow-hidden shadow-2xl">
          <ChatInterface workspaceId={workspaceId} isCompact={false} />
        </div>

        {/* Right Info & Tips Column (1 Column on Large Screens) */}
        <div className="space-y-4">
          {/* Grounding & Trust Panel */}
          <div className="panel p-5 space-y-3">
            <div className="flex items-center gap-2 text-indigo-400">
              <ShieldCheck className="size-4" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                Factual Grounding
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-neutral-400">
              Every answer provided by the copilot is strictly verified against your workspace's stored transcripts and confirmed Kanban tasks.
            </p>
            <div className="rounded-md border border-white/5 bg-[#050508] p-2.5 text-[11px] text-neutral-400">
              <p className="font-medium text-neutral-200">🔍 Verifiable Citations</p>
              <p className="mt-1 text-neutral-500">
                Click any citation excerpt to jump straight to the meeting review or Kanban board.
              </p>
            </div>
          </div>

          {/* Example Questions Guide */}
          <div className="panel p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <Lightbulb className="size-4" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                Helpful Prompts
              </h3>
            </div>
            <ul className="space-y-2 text-xs text-neutral-300">
              <li className="rounded-md border border-white/5 bg-white/[0.02] p-2">
                <span className="font-medium text-white">"What did we decide in the last meeting?"</span>
                <p className="mt-0.5 text-[11px] text-neutral-500">Retrieves formal decisions & agreements</p>
              </li>
              <li className="rounded-md border border-white/5 bg-white/[0.02] p-2">
                <span className="font-medium text-white">"Which tasks are still pending?"</span>
                <p className="mt-0.5 text-[11px] text-neutral-500">Lists open Kanban cards with owners</p>
              </li>
              <li className="rounded-md border border-white/5 bg-white/[0.02] p-2">
                <span className="font-medium text-white">"Who is assigned to upcoming deadlines?"</span>
                <p className="mt-0.5 text-[11px] text-neutral-500">Summarizes team responsibilities</p>
              </li>
              <li className="rounded-md border border-white/5 bg-white/[0.02] p-2">
                <span className="font-medium text-white">"Summarize blockers raised across meetings"</span>
                <p className="mt-0.5 text-[11px] text-neutral-500">Identifies stalled or blocked workflows</p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
