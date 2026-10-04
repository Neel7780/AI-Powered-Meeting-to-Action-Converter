import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Navbar from "../components/layout/Navbar";
import Sidebar from "../components/layout/Sidebar";
import AddMemberModal from "../components/workspace/AddMemberModal";
import CreateWorkspaceModal from "../components/workspace/CreateWorkspaceModal";
import { useWorkspace } from "../context/WorkspaceContext";
import KanbanBoard from "./KanbanBoard";

export default function Dashboard() {
  const {
    workspaces,
    currentWorkspace,
    currentRole,
    loading,
  } = useWorkspace();

  const location = useLocation();
  const navigate = useNavigate();
  const isTasksPage = location.pathname === "/tasks" || location.pathname === "/kanban";

  const [showAddMember, setShowAddMember] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] =
    useState(false);
  const [showMobileSidebar, setShowMobileSidebar] =
    useState(false);

  const isAdmin = currentRole === "admin";

  const handleAddMember = async (
    email: string,
    role: "organiser" | "member"
  ) => {
    // Frontend-only handling for FE1.
    // Actual member persistence is handled separately.
    console.log("Add member:", {
      email,
      role,
      workspace: currentWorkspace?.id,
    });

    setShowAddMember(false);
  };

  return (
    <div className="dashboard-page min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {/* Top Navbar */}
      <Navbar onMenuClick={() => setShowMobileSidebar(true)} />

      <div className="flex min-h-[calc(100vh-64px)]">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
          <Sidebar />
        </aside>

        {/* Mobile Sidebar */}
        {showMobileSidebar && (
          <div className="fixed inset-0 z-40 lg:hidden">
            {/* Overlay */}
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/40"
              onClick={() => setShowMobileSidebar(false)}
            />

            {/* Sidebar */}
            <aside className="relative z-50 h-full w-72 border-r border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  ActionPulse
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setShowMobileSidebar(false)
                  }
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  ✕
                </button>
              </div>

              <Sidebar onClose={() => setShowMobileSidebar(false)} />
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto">

          {/* /tasks → KanbanBoard mounted inside the dashboard shell */}
          {isTasksPage ? (
            <KanbanBoard workspaceId={currentWorkspace?.id} />
          ) : (
            loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    Loading workspace…
                  </p>
                </div>
              </div>
            ) : !currentWorkspace ? (
              <div className="flex h-full items-center justify-center p-8">
                <div className="w-full max-w-md text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40">
                    <span className="text-2xl">🏢</span>
                  </div>

                  <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100">
                    No workspace yet
                  </h2>

                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Create your first workspace to get
                    started with ActionPulse.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setShowCreateWorkspace(true)
                    }
                    className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    Create workspace
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 lg:p-8">
                {/* Page header */}
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {currentWorkspace.name}
                  </h1>

                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Welcome back! Here's an overview of
                    your workspace.
                  </p>
                </div>

                {/* Stats row */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          Meetings
                        </p>

                        <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
                          0
                        </p>
                      </div>

                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-xl dark:bg-indigo-900/40">
                        📅
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          Open Tasks
                        </p>

                        <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
                          0
                        </p>
                      </div>

                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-xl dark:bg-amber-900/40">
                        ✓
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          Team Members
                        </p>

                        <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
                          0
                        </p>
                      </div>

                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-xl dark:bg-emerald-900/40">
                        👥
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Grid */}
                <div className="mt-8 grid gap-6 lg:grid-cols-3">
                  {/* Workspace Overview */}
                  <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Workspace Overview
                        </h2>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          Your current ActionPulse workspace.
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm dark:bg-slate-800">
                        <span className="text-xl">⚡</span>
                      </div>

                      <h3 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">
                        Ready to get started?
                      </h3>

                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                        Create meetings, capture action items,
                        and organize your team's work from this
                        workspace.
                      </p>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Quick Actions
                    </h2>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Common workspace actions.
                    </p>

                    <div className="mt-5 space-y-3">
                      <button
                        type="button"
                        onClick={() => navigate("/create-meeting")}
                        className="flex w-full items-center rounded-xl border border-slate-200 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-700 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/30"
                      >
                        <span className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
                          📅
                        </span>

                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Create Meeting
                          </p>

                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Schedule a new meeting
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate("/tasks")}
                        className="flex w-full items-center rounded-xl border border-slate-200 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-700 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/30"
                      >
                        <span className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                          ✓
                        </span>

                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            View Tasks
                          </p>

                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Check your action items
                          </p>
                        </div>
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() =>
                            setShowAddMember(true)
                          }
                          className="flex w-full items-center rounded-xl border border-slate-200 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-700 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/30"
                        >
                          <span className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                            👤
                          </span>

                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              Add Team Member
                            </p>

                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Invite a registered user
                            </p>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Workspace List */}
                {workspaces.length > 1 && (
                  <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Your Workspaces
                    </h2>

                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Switch between your available workspaces
                      using the workspace selector.
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {workspaces.map((workspace) => (
                        <div
                          key={workspace.id}
                          className={`rounded-xl border p-4 ${
                            currentWorkspace?.id ===
                            workspace.id
                              ? "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/30"
                              : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-700/30"
                          }`}
                        >
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {workspace.name}
                          </p>

                          {currentWorkspace?.id ===
                            workspace.id && (
                            <p className="mt-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                              Current workspace
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* Create Workspace Modal */}
          <CreateWorkspaceModal
            isOpen={showCreateWorkspace}
            onClose={() =>
              setShowCreateWorkspace(false)
            }
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