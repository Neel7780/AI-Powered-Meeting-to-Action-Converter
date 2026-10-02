import { useState } from "react";

import Navbar from "../components/layout/Navbar";
import Sidebar from "../components/layout/Sidebar";
import AddMemberModal from "../components/workspace/AddMemberModal";
import CreateWorkspaceModal from "../components/workspace/CreateWorkspaceModal";
import { useWorkspace } from "../context/WorkspaceContext";

export default function Dashboard() {
  const {
    workspaces,
    currentWorkspace,
    currentRole,
    loading,
  } = useWorkspace();

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
    <div className="dashboard-page min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <Navbar />

      <div className="flex min-h-[calc(100vh-64px)]">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
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
            <aside className="relative z-50 h-full w-72 border-r border-slate-200 bg-white shadow-xl">
              <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
                <span className="text-lg font-bold text-slate-900">
                  ActionPulse
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setShowMobileSidebar(false)
                  }
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  ✕
                </button>
              </div>

              <Sidebar />
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="min-w-0 flex-1">
          {/* Mobile Header */}
          <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
            <button
              type="button"
              onClick={() => setShowMobileSidebar(true)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              ☰ Menu
            </button>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex min-h-[calc(100vh-110px)] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />

                <p className="mt-4 text-sm text-slate-500">
                  Loading your workspace...
                </p>
              </div>
            </div>
          ) : workspaces.length === 0 ? (
            /* No Workspace State */
            <div className="flex min-h-[calc(100vh-110px)] items-center justify-center px-6 py-12">
              <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
                  <span className="text-3xl font-light text-indigo-600">
                    +
                  </span>
                </div>

                <h1 className="mt-6 text-2xl font-bold text-slate-900 sm:text-3xl">
                  Create your first workspace
                </h1>

                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500 sm:text-base">
                  You don't have any workspaces yet. Create a
                  workspace to start managing meetings, tasks,
                  and your team with ActionPulse.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setShowCreateWorkspace(true)
                  }
                  className="mt-7 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  + Create Workspace
                </button>
              </div>
            </div>
          ) : (
            /* Normal Dashboard */
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {/* Page Header */}
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-600">
                    Workspace Dashboard
                  </p>

                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {currentWorkspace?.name || "Dashboard"}
                  </h1>

                  <p className="mt-2 text-sm text-slate-500">
                    Manage your meetings, tasks, and team from
                    one place.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowAddMember(true)
                      }
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      + Add Member
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setShowCreateWorkspace(true)
                    }
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                  >
                    + New Workspace
                  </button>
                </div>
              </div>

              {/* Current Workspace Card */}
              <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Current Workspace
                    </p>

                    <h2 className="mt-1 text-lg font-bold text-slate-900">
                      {currentWorkspace?.name ||
                        "No workspace selected"}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold capitalize text-indigo-700">
                      {currentRole || "member"}
                    </span>

                    <span className="text-sm text-slate-400">
                      {workspaces.length}{" "}
                      {workspaces.length === 1
                        ? "workspace"
                        : "workspaces"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Workspaces
                      </p>

                      <p className="mt-2 text-3xl font-bold text-slate-900">
                        {workspaces.length}
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-xl">
                      🏢
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Meetings
                      </p>

                      <p className="mt-2 text-3xl font-bold text-slate-900">
                        0
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl">
                      📅
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Open Tasks
                      </p>

                      <p className="mt-2 text-3xl font-bold text-slate-900">
                        0
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-xl">
                      ✓
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Team Members
                      </p>

                      <p className="mt-2 text-3xl font-bold text-slate-900">
                        0
                      </p>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-xl">
                      👥
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Grid */}
              <div className="mt-8 grid gap-6 lg:grid-cols-3">
                {/* Workspace Overview */}
                <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        Workspace Overview
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Your current ActionPulse workspace.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                      <span className="text-xl">⚡</span>
                    </div>

                    <h3 className="mt-4 font-semibold text-slate-900">
                      Ready to get started?
                    </h3>

                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                      Create meetings, capture action items,
                      and organize your team's work from this
                      workspace.
                    </p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900">
                    Quick Actions
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Common workspace actions.
                  </p>

                  <div className="mt-5 space-y-3">
                    <button
                      type="button"
                      className="flex w-full items-center rounded-xl border border-slate-200 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                    >
                      <span className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100">
                        📅
                      </span>

                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Create Meeting
                        </p>

                        <p className="text-xs text-slate-500">
                          Schedule a new meeting
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="flex w-full items-center rounded-xl border border-slate-200 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                    >
                      <span className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                        ✓
                      </span>

                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          View Tasks
                        </p>

                        <p className="text-xs text-slate-500">
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
                        className="flex w-full items-center rounded-xl border border-slate-200 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                      >
                        <span className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                          👤
                        </span>

                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Add Team Member
                          </p>

                          <p className="text-xs text-slate-500">
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
                <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900">
                    Your Workspaces
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
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
                            ? "border-indigo-300 bg-indigo-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <p className="font-semibold text-slate-900">
                          {workspace.name}
                        </p>

                        {currentWorkspace?.id ===
                          workspace.id && (
                          <p className="mt-1 text-xs font-medium text-indigo-600">
                            Current workspace
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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