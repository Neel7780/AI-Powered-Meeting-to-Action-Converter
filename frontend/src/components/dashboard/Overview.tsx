import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CalendarPlus,
  CircleDashed,
  ListChecks,
  Mic,
  Sparkles,
  SquareKanban,
  UserPlus,
  Users,
  Video,
} from "lucide-react";

import { Button } from "../ui/button";
import { supabase } from "../../lib/supabase";
import type { Workspace } from "../../context/WorkspaceContext";

type Stats = { workspaceId: string; meetings: number; openTasks: number; members: number };
type MeetingRow = { id: string; title: string; starts_at: string; status: string };
type TaskRow = { id: string; title: string; status: string; priority: string; deadline_utc: string | null };

const tints = {
  indigo: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  sky: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  violet: "border-violet-500/25 bg-violet-500/10 text-violet-300",
};

const meetingStatus: Record<string, { label: string; dot: string; text: string; pulse?: boolean }> = {
  ready: { label: "Ready", dot: "bg-emerald-400", text: "text-emerald-300" },
  processing: { label: "Processing", dot: "bg-indigo-400", text: "text-indigo-300", pulse: true },
  draft: { label: "Draft", dot: "bg-neutral-500", text: "text-neutral-400" },
  failed: { label: "Failed", dot: "bg-red-400", text: "text-red-300" },
  archived: { label: "Archived", dot: "bg-neutral-600", text: "text-neutral-500" },
};

const taskStatus: Record<string, { label: string; cls: string }> = {
  todo: { label: "To do", cls: "border-white/10 bg-white/[0.04] text-neutral-300" },
  in_progress: { label: "In progress", cls: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300" },
  blocked: { label: "Blocked", cls: "border-red-500/25 bg-red-500/10 text-red-300" },
  done: { label: "Done", cls: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" },
};

const priorityColor: Record<string, string> = {
  urgent: "text-red-400",
  high: "text-amber-400",
  normal: "text-neutral-500",
  low: "text-neutral-600",
};

const steps = [
  ["Capture", "Upload a transcript, or record an in-person meeting."],
  ["Evidence", "AI proposes action items, each tied to a verbatim quote."],
  ["Decide", "An organiser approves, edits or rejects every suggestion."],
  ["Deliver", "Approved actions land on the team's task board."],
];

const stagger = (i: number): CSSProperties => ({ animationDelay: `${i * 60}ms` });

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function relativeDate(iso: string) {
  const diffDays = Math.round((new Date(iso).getTime() - Date.now()) / 864e5);
  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 0 && diffDays > -7) return `${-diffDays} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Counts from 0 to `value` with an ease-out curve; jumps straight there for reduced motion. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    if (reduce || start === value) {
      setShown(value);
      from.current = value;
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown}</>;
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 pb-2 pt-4">
      <h2 className="text-sm font-medium text-white">{title}</h2>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="group inline-flex items-center gap-1 text-xs text-neutral-500 transition-colors hover:text-white"
        >
          {action}
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 px-5 pb-5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <div className="skeleton size-8" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3 w-2/3" />
            <div className="skeleton h-2.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, text, cta, onCta }: { icon: typeof Mic; text: string; cta?: string; onCta?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 pb-8 pt-4 text-center">
      <span className="grid size-10 place-items-center rounded-full border border-dashed border-white/15 text-neutral-500">
        <Icon className="size-4" />
      </span>
      <p className="text-sm text-neutral-500">{text}</p>
      {cta && (
        <Button size="sm" variant="outline" onClick={onCta}>
          {cta}
        </Button>
      )}
    </div>
  );
}

interface OverviewProps {
  workspace: Workspace;
  workspaces: Workspace[];
  displayName: string;
  isAdmin: boolean;
  canCreate: boolean;
  latestMeetingTitle?: string;
  onAddMember: () => void;
  onFollowUp: () => void;
}

export default function Overview({
  workspace,
  workspaces,
  displayName,
  isAdmin,
  canCreate,
  latestMeetingTitle,
  onAddMember,
  onFollowUp,
}: OverviewProps) {
  const navigate = useNavigate();
  const workspaceId = workspace.id;
  const [fetchedStats, setStats] = useState<Stats | null>(null);
  const [meetings, setMeetings] = useState<{ ws: string; rows: MeetingRow[] } | null>(null);
  const [tasks, setTasks] = useState<{ ws: string; rows: TaskRow[] } | null>(null);
  // never show data from a previously selected workspace
  const stats = fetchedStats?.workspaceId === workspaceId ? fetchedStats : null;
  const meetingRows = meetings?.ws === workspaceId ? meetings.rows : null;
  const taskRows = tasks?.ws === workspaceId ? tasks.rows : null;

  useEffect(() => {
    let cancelled = false;
    const count = (table: string) =>
      supabase.from(table).select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId);

    Promise.all([count("meetings"), count("tasks").neq("status", "done"), count("workspace_members")]).then(
      ([m, t, mem]) => {
        if (!cancelled) {
          setStats({ workspaceId, meetings: m.count ?? 0, openTasks: t.count ?? 0, members: mem.count ?? 0 });
        }
      }
    );

    supabase
      .from("meetings")
      .select("id, title, starts_at, status")
      .eq("workspace_id", workspaceId)
      .order("starts_at", { ascending: false })
      .limit(5)
      .then(({ data }) => !cancelled && setMeetings({ ws: workspaceId, rows: (data as MeetingRow[]) ?? [] }));

    supabase
      .from("tasks")
      .select("id, title, status, priority, deadline_utc")
      .eq("workspace_id", workspaceId)
      .neq("status", "done")
      .order("deadline_utc", { ascending: true, nullsFirst: false })
      .limit(5)
      .then(({ data }) => !cancelled && setTasks({ ws: workspaceId, rows: (data as TaskRow[]) ?? [] }));

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const [now] = useState(() => new Date());
  const firstName = displayName.split(" ")[0];
  const today = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const statCards = [
    { label: "Meetings", value: stats?.meetings, icon: CalendarPlus, tint: tints.indigo, glow: "from-indigo-500/20", to: "/meetings" },
    { label: "Open tasks", value: stats?.openTasks, icon: ListChecks, tint: tints.amber, glow: "from-amber-500/15", to: "/tasks" },
    { label: "Team members", value: stats?.members, icon: Users, tint: tints.emerald, glow: "from-emerald-500/15", to: "/team" },
  ];

  const quickActions = [
    ...(canCreate
      ? [{ label: "Record meeting", hint: "In-person, with speaker detection", icon: Mic, tint: tints.indigo, onClick: () => navigate("/meetings") }]
      : []),
    { label: "Meeting Studio", hint: "Summaries & chapters", icon: Video, tint: tints.sky, onClick: () => navigate("/meeting-details") },
    { label: "Ask AI Copilot", hint: "Query decisions & tasks", icon: Sparkles, tint: tints.violet, onClick: () => navigate("/chat") },
    { label: "Analytics", hint: "Bottlenecks & turnaround", icon: BarChart3, tint: tints.emerald, onClick: () => navigate("/analytics") },
    {
      label: "Draft follow-up",
      hint: latestMeetingTitle ? `For ${latestMeetingTitle}` : "1-click meeting recap",
      icon: Sparkles,
      tint: tints.amber,
      onClick: onFollowUp,
    },
    { label: "Task board", hint: "Drag work across columns", icon: SquareKanban, tint: tints.amber, onClick: () => navigate("/tasks") },
  ];

  const openMeeting = (m: MeetingRow) =>
    navigate(m.status === "ready" ? `/meetings/${m.id}/review` : `/meetings/${m.id}`);

  return (
    <div className="relative">
      <div aria-hidden="true" className="app-grid pointer-events-none absolute inset-x-0 top-0 h-96" />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        {/* Greeting */}
        <header className="rise-in flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-500">{today}</p>
            <h1 className="mt-1.5 text-[28px] font-semibold tracking-tight text-white">
              {greeting(now)}, {firstName}
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Here's what's happening in <span className="text-neutral-200">{workspace.name}</span>.
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={onAddMember}>
                <UserPlus /> Invite
              </Button>
            )}
            {canCreate && (
              <Button size="sm" onClick={() => navigate("/meetings")}>
                <CalendarPlus /> New meeting
              </Button>
            )}
          </div>
        </header>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-2 sm:mt-8 sm:gap-3">
          {statCards.map(({ label, value, icon: Icon, tint, glow, to }, i) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate(to)}
              style={stagger(i + 1)}
              className="card card-hover rise-in group min-w-0 overflow-hidden p-3.5 text-left sm:p-5"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-gradient-to-br ${glow} to-transparent opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100`}
              />
              <div className="relative flex items-start justify-between">
                <span className={`grid size-8 place-items-center rounded-lg border sm:size-9 ${tint}`}>
                  <Icon className="size-4" />
                </span>
                <ArrowUpRight className="hidden size-4 text-neutral-600 transition-all sm:block group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-neutral-300" />
              </div>
              <p className="relative mt-3 text-2xl font-semibold sm:mt-5 sm:text-3xl tabular-nums tracking-tight text-white">
                {value === undefined ? <span className="skeleton inline-block h-8 w-12 align-middle" /> : <CountUp value={value} />}
              </p>
              <p className="relative mt-1 truncate text-[11px] text-neutral-500 sm:text-xs">{label}</p>
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Recent meetings */}
          <section className="card rise-in min-w-0 lg:col-span-2" style={stagger(4)}>
            <SectionHeader title="Recent meetings" action="View all" onAction={() => navigate("/meetings")} />
            {meetingRows === null ? (
              <ListSkeleton />
            ) : meetingRows.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                text="No meetings yet. Create one to start capturing action items."
                cta={canCreate ? "Create meeting" : undefined}
                onCta={() => navigate("/meetings")}
              />
            ) : (
              <ul className="px-2 pb-2">
                {meetingRows.map((m, i) => {
                  const s = meetingStatus[m.status] ?? meetingStatus.draft;
                  return (
                    <li key={m.id} className="rise-in" style={stagger(i + 5)}>
                      <button type="button" className="list-row group" onClick={() => openMeeting(m)}>
                        <span className="grid size-8 shrink-0 place-items-center rounded-md border border-white/[0.08] bg-white/[0.03] text-neutral-400 transition-colors group-hover:text-white">
                          <CalendarClock className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-white">{m.title}</span>
                          <span className="block text-xs text-neutral-500">{relativeDate(m.starts_at)}</span>
                        </span>
                        <span className={`inline-flex items-center gap-1.5 text-xs ${s.text}`}>
                          <span className={`size-1.5 rounded-full ${s.dot} ${s.pulse ? "dot-pulse" : ""}`} />
                          {s.label}
                        </span>
                        <ArrowRight className="size-4 shrink-0 -translate-x-1 text-neutral-600 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Quick actions */}
          <section className="card rise-in min-w-0" style={stagger(5)}>
            <SectionHeader title="Quick actions" />
            <div className="grid grid-cols-2 gap-2 px-3 pb-3">
              {quickActions.map(({ label, hint, icon: Icon, tint, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  className="group flex flex-col gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.015] p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.04]"
                >
                  <span className={`grid size-8 place-items-center rounded-md border transition-transform duration-200 group-hover:scale-105 ${tint}`}>
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-[13px] font-medium leading-tight text-white">{label}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-neutral-500">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Open tasks */}
          <section className="card rise-in min-w-0 lg:col-span-2" style={stagger(6)}>
            <SectionHeader title="Open tasks" action="Open board" onAction={() => navigate("/tasks")} />
            {taskRows === null ? (
              <ListSkeleton rows={3} />
            ) : taskRows.length === 0 ? (
              <EmptyState icon={CircleDashed} text="Nothing open. Approved action items will show up here." />
            ) : (
              <ul className="px-2 pb-2">
                {taskRows.map((t, i) => {
                  const st = taskStatus[t.status] ?? taskStatus.todo;
                  const overdue = t.deadline_utc && new Date(t.deadline_utc).getTime() < now.getTime();
                  return (
                    <li key={t.id} className="rise-in" style={stagger(i + 7)}>
                      <button type="button" className="list-row group" onClick={() => navigate("/tasks")}>
                        <span
                          className={`grid size-4 shrink-0 place-items-center rounded-full border transition-colors ${
                            t.status === "in_progress" ? "border-indigo-400" : "border-neutral-600 group-hover:border-neutral-400"
                          }`}
                        >
                          {t.status === "in_progress" && <span className="size-1.5 rounded-full bg-indigo-400" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-neutral-200 group-hover:text-white">{t.title}</span>
                        <span className={`hidden text-[11px] font-medium capitalize sm:inline ${priorityColor[t.priority] ?? ""}`}>
                          {t.priority !== "normal" ? t.priority : ""}
                        </span>
                        {t.deadline_utc && (
                          <span className={`text-xs tabular-nums ${overdue ? "text-red-400" : "text-neutral-500"}`}>
                            {relativeDate(t.deadline_utc)}
                          </span>
                        )}
                        <span className={`rounded-md border px-1.5 py-0.5 text-[11px] ${st.cls}`}>{st.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* How it works */}
          <section className="card rise-in min-w-0 p-5" style={stagger(7)}>
            <h2 className="text-sm font-medium text-white">How ActionPulse works</h2>
            <ol className="mt-4 space-y-0">
              {steps.map(([title, body], i) => (
                <li key={title} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < steps.length - 1 && (
                    <span aria-hidden="true" className="absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px bg-gradient-to-b from-white/15 to-white/5" />
                  )}
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.03] font-mono text-[10px] text-neutral-400">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-[13px] font-medium text-white">{title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-neutral-500">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {workspaces.length > 1 && (
          <section className="card rise-in min-w-0 mt-6 p-5" style={stagger(8)}>
            <h2 className="text-sm font-medium text-white">Your workspaces</h2>
            <p className="mt-1 text-xs text-neutral-500">Switch from the workspace menu at the top of the sidebar.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((w) => (
                <div
                  key={w.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
                    w.id === workspaceId ? "border-indigo-500/30 bg-indigo-500/[0.06] text-white" : "border-white/[0.08] text-neutral-300"
                  }`}
                >
                  <span className="truncate">{w.name}</span>
                  {w.id === workspaceId && <span className="text-[11px] text-indigo-300">Current</span>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
