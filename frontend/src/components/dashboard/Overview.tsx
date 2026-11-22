import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownRight, ArrowRight, BarChart3, CalendarDays, CalendarPlus,
  CircleCheck, ListChecks, ListTodo, Mail, Sparkles, UserPlus, Users,
} from "lucide-react";
import { Button } from "../ui/button";
import { supabase } from "../../lib/supabase";
import type { Workspace } from "../../context/WorkspaceContext";

type Stats = { workspaceId: string; meetings: number; openTasks: number; members: number };
type MeetingRow = { id: string; title: string; starts_at: string };
type TaskRow = { id: string; title: string; status: string; deadline_utc: string | null };
type Tone = "neutral" | "success" | "pending" | "danger";

const taskStatus: Record<string, { label: string; tone: Tone }> = {
  todo: { label: "To do", tone: "neutral" },
  in_progress: { label: "In progress", tone: "pending" },
  blocked: { label: "Blocked", tone: "danger" },
  done: { label: "Done", tone: "success" },
};

function greeting(date: Date) {
  const hours = date.getHours();
  if (hours < 12) return "Good morning";
  if (hours < 17) return "Good afternoon";
  return "Good evening";
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));
}

function Status({ status }: { status: { label: string; tone: Tone } }) {
  return <span className="overview-status" data-tone={status.tone}>{status.label}</span>;
}

function SectionHeader({ icon, title, link, action }: { icon: ReactNode; title: string; link?: string; action?: string }) {
  return (
    <div className="overview-panel-heading">
      <h2>{icon}{title}</h2>
      {link && <Link to={link} className="overview-link">{action}<ArrowRight size={14} aria-hidden="true" /></Link>}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4 p-5" role="status" aria-label="Loading">
      {[0, 1, 2].map((row) => <div key={row} className="skeleton h-5 w-3/5" />)}
    </div>
  );
}

function EmptyState({ icon, text, action }: { icon: ReactNode; text: string; action?: ReactNode }) {
  return <div className="overview-empty">{icon}<p>{text}</p>{action}</div>;
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
  // Only render results from the selected workspace.
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
      .select("id, title, starts_at")
      .eq("workspace_id", workspaceId)
      .order("starts_at", { ascending: false })
      .limit(5)
      .then(({ data }) => !cancelled && setMeetings({ ws: workspaceId, rows: (data as MeetingRow[]) ?? [] }));

    supabase
      .from("tasks")
      .select("id, title, status, deadline_utc")
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
  const firstName = displayName.trim().split(/\s+/)[0] || "there";
  const today = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const createMeeting = () => navigate("/meetings?create=1");

  const metrics = [
    { title: "Meetings", value: stats?.meetings, icon: CalendarDays, to: "/meetings" },
    { title: "Open tasks", value: stats?.openTasks, icon: ListChecks, to: "/tasks" },
    { title: "Team members", value: stats?.members, icon: Users, to: "/team" },
  ];

  const quickActions = [
    { title: "Ask AI Assistant", detail: "Search meetings and tasks", icon: Sparkles, run: () => navigate("/chat") },
    { title: "Draft follow-up", detail: latestMeetingTitle || "Choose a meeting", icon: Mail, run: onFollowUp },
    { title: "View analytics", detail: "Track team progress", icon: BarChart3, run: () => navigate("/analytics") },
  ];

  return (
    <div className="dashboard-overview">
      <header className="overview-header">
        <div>
          <p className="overview-date">{today}</p>
          <h1>{greeting(now)}, {firstName}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && <Button variant="outline" onClick={onAddMember}><UserPlus /> Invite</Button>}
          {canCreate && (
            <>
              <Button onClick={() => navigate("/calendar")} className="bg-cyan-600 hover:bg-cyan-500 text-white gap-1.5">
                <CalendarDays /> Schedule meeting
              </Button>
              <Button variant="outline" onClick={createMeeting} className="border-white/15 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white">
                <CalendarPlus /> New meeting
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="overview-metrics" aria-label="Workspace totals">
        {metrics.map(({ title, value, icon: Icon, to }) => (
          <Link key={to} to={to} className="overview-metric">
            <span className="overview-metric-label"><Icon size={16} aria-hidden="true" />{title}</span>
            <span className="overview-metric-value">
              {value === undefined ? <span className="skeleton inline-block h-7 w-9" aria-label="Loading" /> : value.toLocaleString()}
            </span>
            <ArrowRight size={15} className="overview-metric-arrow" aria-hidden="true" />
          </Link>
        ))}
      </div>

      <div className="overview-grid">
        <div className="min-w-0 space-y-5">
          <section className="overview-panel">
            <SectionHeader icon={<CalendarDays />} title="Recent meetings" link="/meetings" action="View all" />
            {meetingRows === null ? <ListSkeleton /> : meetingRows.length === 0 ? (
              <EmptyState icon={<CalendarDays />} text="No meetings yet."
                action={canCreate && <Button size="sm" variant="outline" onClick={createMeeting}>Create meeting</Button>} />
            ) : (
              <ul className="overview-list">
                {meetingRows.map((meeting) => (
                  <li key={meeting.id}>
                    <Link to={`/meetings/${meeting.id}?tab=overview`} className="overview-row">
                      <span className="overview-row-icon"><CalendarDays size={16} aria-hidden="true" /></span>
                      <span className="overview-row-text">
                        <span className="overview-row-title">{meeting.title}</span>
                        <span className="overview-row-meta">{shortDate(meeting.starts_at)}</span>
                      </span>
                      <ArrowRight size={14} className="overview-row-arrow" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="overview-panel">
            <SectionHeader icon={<ListTodo />} title="Open tasks" link="/tasks" action="Open board" />
            {taskRows === null ? <ListSkeleton /> : taskRows.length === 0 ? (
              <EmptyState icon={<CircleCheck />} text="No open tasks." />
            ) : (
              <ul className="overview-list">
                {taskRows.map((task) => {
                  const overdue = task.deadline_utc && Date.parse(task.deadline_utc) < now.getTime();
                  return (
                    <li key={task.id}>
                      <Link to="/tasks" className="overview-row">
                        <span className="overview-row-icon"><ListTodo size={16} aria-hidden="true" /></span>
                        <span className="overview-row-text">
                          <span className="overview-row-title">{task.title}</span>
                          <span className={`overview-row-meta ${overdue ? "overview-overdue" : ""}`}>
                            {task.deadline_utc ? `${overdue ? "Overdue" : "Due"} · ${shortDate(task.deadline_utc)}` : "No due date"}
                          </span>
                        </span>
                        <Status status={taskStatus[task.status] ?? taskStatus.todo} />
                        <ArrowRight size={14} className="overview-row-arrow" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-5">
          <section className="overview-panel">
            <SectionHeader icon={<ArrowDownRight />} title="Quick actions" />
            <ul className="overview-list">
              {quickActions.map(({ title, detail, icon: Icon, run }) => (
                <li key={title}>
                  <button type="button" className="overview-row text-left" onClick={run}>
                    <span className="overview-row-icon overview-action-icon"><Icon size={16} aria-hidden="true" /></span>
                    <span className="overview-row-text">
                      <span className="overview-row-title">{title}</span>
                      <span className="overview-row-meta">{detail}</span>
                    </span>
                    <ArrowRight size={14} className="overview-row-arrow" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {workspaces.length > 1 && (
            <section className="overview-panel">
              <SectionHeader icon={<Users />} title="Your workspaces" />
              <ul className="overview-list">
                {workspaces.map((item) => <li key={item.id} className="overview-row">
                  <span className="overview-row-title">{item.name}</span>
                  {item.id === workspaceId && <Status status={{ label: "Current", tone: "pending" }} />}
                </li>)}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
