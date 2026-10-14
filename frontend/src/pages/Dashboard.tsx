import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarPlus,
  ListChecks,
  LoaderCircle,
  SquareKanban,
  UserPlus,
  Users,
} from "lucide-react";

import Navbar from "../components/layout/Navbar";
import Sidebar from "../components/layout/Sidebar";
import AddMemberModal from "../components/workspace/AddMemberModal";
import CreateWorkspaceModal from "../components/workspace/CreateWorkspaceModal";
import { Button } from "../components/ui/button";
import { useWorkspace } from "../context/WorkspaceContext";
import { supabase } from "../lib/supabase";
import CreateMeeting from "../pages/CreateMeeting";
import { postApi } from "../services/reviewApi";
import KanbanBoard from "./KanbanBoard";

// Icon tints shared with the landing page's feature rows
const tints = {
  indigo: "border-indigo-500/25 bg-indigo-500/10 text-indigo-400",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-400",
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
};

const steps = [
  ["01", "Transcript", "Paste or upload a .vtt, .srt, .txt or .docx transcript."],
  ["02", "Evidence", "AI proposes action items, each tied to a verbatim quote."],
  ["03", "Human decision", "An organiser approves, edits or rejects every suggestion."],
  ["04", "Shared work", "Approved actions land on the team's task board."],
];

type Stats = { workspaceId: string; meetings: number; openTasks: number; members: number };

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    workspaces,
    currentWorkspace,
    currentRole,
    loading,
  } = useWorkspace();

  const isTasksPage = location.pathname === "/tasks" || location.pathname === "/kanban";
  const isMeetingsPage = location.pathname === "/meetings";
  const isOverview = !isTasksPage && !isMeetingsPage;

  const [showAddMember, setShowAddMember] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [fetchedStats, setStats] = useState<Stats | null>(null);

  const isAdmin = currentRole === "admin";
  const workspaceId = currentWorkspace?.id;
  // Counts from a previously selected workspace are never shown for this one.
  const stats = fetchedStats?.workspaceId === workspaceId ? fetchedStats : null;

  // Live counts for the overview cards; refetched whenever the overview is shown again.
  useEffect(() => {
    if (!workspaceId || !isOverview) return;
    let cancelled = false;

    const count = (table: string) =>
      supabase.from(table).select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId);

    Promise.all([count("meetings"), count("tasks").neq("status", "done"), count("workspace_members")]).then(
      ([meetings, openTasks, members]) => {
        if (cancelled) return;
        setStats({
          workspaceId,
          meetings: meetings.count ?? 0,
          openTasks: openTasks.count ?? 0,
          members: members.count ?? 0,
        });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [workspaceId, isOverview]);

  const handleAddMember = async (
    email: string,
    role: "organiser" | "member"
  ) => {
    if (!currentWorkspace) throw new Error("Select a workspace first.");
    // Backend creates the invite and emails the /invite/{token} link.
    await postApi(`/api/workspaces/${currentWorkspace.id}/invites`, { email, role });
  };

  const statCards = [
    { label: "Meetings", value: stats?.meetings, icon: CalendarPlus, tint: tints.indigo },
    { label: "Open tasks", value: stats?.openTasks, icon: ListChecks, tint: tints.amber },
    { label: "Team members", value: stats?.members, icon: Users, tint: tints.emerald },
  ];

  const quickActions = [
    {
      label: "Create meeting",
      hint: "Upload a transcript and extract actions",
      icon: CalendarPlus,
      tint: tints.indigo,
      onClick: () => navigate("/meetings"),
    },
    {
      label: "View tasks",
      hint: "Check your action items",
      icon: SquareKanban,
      tint: tints.amber,
      onClick: () => navigate("/tasks"),
    },
    ...(isAdmin
      ? [
          {
            label: "Add team member",
            hint: "Send an email invite",
            icon: UserPlus,
            tint: tints.emerald,
            onClick: () => setShowAddMember(true),
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top Navbar */}
      <Navbar onMenuClick={() => setShowMobileSidebar(true)} />

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-white/10 lg:block">
          <Sidebar />
        </aside>

        {/* Mobile Sidebar */}
        {showMobileSidebar && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowMobileSidebar(false)}
            />

            <aside className="relative h-full w-72 border-r border-white/10 shadow-2xl">
              <Sidebar onClose={() => setShowMobileSidebar(false)} />
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="min-w-0 flex-1">
          {isTasksPage ? (
            <KanbanBoard workspaceId={currentWorkspace?.id} />
          ) : isMeetingsPage ? (
            <div className="p-4 sm:p-6 lg:p-8">
              <CreateMeeting />
            </div>
          ) : loading ? (
            <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-neutral-500">
              <LoaderCircle className="size-4 animate-spin" />
              Loading workspace…
            </div>
          ) : !currentWorkspace ? (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
              <div className="panel w-full max-w-md p-8 text-center">
                <span className="mx-auto grid size-11 place-items-center rounded-md border border-white/15 bg-white/5 text-white">
                  <Building2 className="size-5" />
                </span>

                <h2 className="mt-5 text-xl font-medium tracking-tight text-white">No workspace yet</h2>

                <p className="mt-2 text-sm text-neutral-400">
                  Create your first workspace to get started with ActionPulse.
                </p>

                <Button className="mt-6" onClick={() => setShowCreateWorkspace(true)}>
                  Create workspace <ArrowRight />
                </Button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
              {/* Page header */}
              <div className="mb-8">
                <p className="eyebrow">Workspace overview</p>
                <h1 className="mt-2 text-3xl font-medium tracking-tight text-white">{currentWorkspace.name}</h1>
                <p className="mt-2 text-sm text-neutral-400">
                  Welcome back! Here's an overview of your workspace.
                </p>
              </div>

              {/* Stats row */}
              <div className="grid gap-3 sm:grid-cols-3">
                {statCards.map(({ label, value, icon: Icon, tint }) => (
                  <div key={label} className="panel flex items-center justify-between p-5">
                    <div>
                      <p className="eyebrow">{label}</p>
                      <p className="mt-2 text-3xl font-medium tracking-tight text-white">{value ?? "—"}</p>
                    </div>
                    <span className={`grid size-9 place-items-center rounded-md border ${tint}`}>
                      <Icon className="size-4" />
                    </span>
                  </div>
                ))}
              </div>

              {/* Main Grid */}
              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                {/* How it works */}
                <section className="panel p-6 lg:col-span-2">
                  <p className="eyebrow">How it works</p>
                  <h2 className="mt-2 text-lg font-medium tracking-tight text-white">From conversation to commitment</h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    Create meetings, capture action items, and organize your team's work from this workspace.
                  </p>

                  <ol className="mt-6 grid gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-2">
                    {steps.map(([number, title, body]) => (
                      <li key={number} className="bg-[#060608] p-4">
                        <span className="font-mono text-xs text-neutral-500">{number}</span>
                        <p className="mt-2 text-sm font-medium text-white">{title}</p>
                        <p className="mt-1 text-xs leading-5 text-neutral-500">{body}</p>
                      </li>
                    ))}
                  </ol>
                </section>

                {/* Quick Actions */}
                <section className="panel p-6">
                  <p className="eyebrow">Quick actions</p>
                  <h2 className="mt-2 text-lg font-medium tracking-tight text-white">Common workspace actions</h2>

                  <div className="mt-5 space-y-2">
                    {quickActions.map(({ label, hint, icon: Icon, tint, onClick }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={onClick}
                        className="group flex w-full items-center gap-3 rounded-md border border-white/10 bg-[#08080c] p-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.03]"
                      >
                        <span className={`grid size-9 shrink-0 place-items-center rounded-md border ${tint}`}>
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-white">{label}</span>
                          <span className="block text-xs text-neutral-500">{hint}</span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-neutral-600 transition group-hover:translate-x-0.5 group-hover:text-white" />
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              {/* Workspace List */}
              {workspaces.length > 1 && (
                <section className="panel mt-6 p-6">
                  <p className="eyebrow">Your workspaces</p>
                  <p className="mt-2 text-sm text-neutral-400">
                    Switch between your available workspaces using the workspace selector.
                  </p>

                  <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {workspaces.map((workspace) => {
                      const isCurrent = currentWorkspace.id === workspace.id;
                      return (
                        <div
                          key={workspace.id}
                          className={`rounded-md border px-4 py-3 ${
                            isCurrent ? "border-white/25 bg-white/[0.04]" : "border-white/10"
                          }`}
                        >
                          <p className="truncate text-sm font-medium text-white">{workspace.name}</p>
                          {isCurrent && (
                            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-400" />
                              Current workspace
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Create Workspace Modal */}
          <CreateWorkspaceModal
            isOpen={showCreateWorkspace}
            onClose={() => setShowCreateWorkspace(false)}
          />

          {/* Add Member Modal */}
          <AddMemberModal
            isOpen={showAddMember}
            onClose={() => setShowAddMember(false)}
            onAddMember={handleAddMember}
          />
        </main>
      </div>
    </div>
  );
}
