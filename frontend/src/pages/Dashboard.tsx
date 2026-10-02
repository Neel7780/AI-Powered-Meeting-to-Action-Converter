import { useState } from "react";

import Navbar from "../components/layout/Navbar";
import Sidebar from "../components/layout/Sidebar";
import AddMemberModal from "../components/workspace/AddMemberModal";

import { useWorkspace } from "../context/WorkspaceContext";

export default function Dashboard() {
  const {
    currentWorkspace,
    currentRole,
    workspaces,
  } = useWorkspace();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const handleAddMember = async (
    email: string,
    role: "organiser" | "member"
  ) => {
    console.log("Frontend Add Member:", {
      email,
      role,
      workspaceId: currentWorkspace?.id,
    });
  };

  return (
    <div className="dashboard-page min-h-screen bg-slate-50 text-slate-900">

      <Navbar
        onMenuClick={() => setSidebarOpen(true)}
      />

      <div className="flex">

        {/* Desktop Sidebar */}
        <div className="sticky top-16 hidden h-[calc(100vh-4rem)] lg:block">
          <Sidebar />
        </div>

        {/* Mobile Sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">

            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setSidebarOpen(false)}
            />

            <div className="relative h-full w-64">
              <Sidebar
                onClose={() => setSidebarOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">

          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-sm font-medium text-indigo-600">
                Workspace
              </p>

              <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
                {currentWorkspace?.name || "My Workspace"}
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Manage your meetings, tasks and team from one place.
              </p>
            </div>

            {currentRole === "admin" && (
              <button
                onClick={() => setAddMemberOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                <span className="text-lg leading-none">
                  +
                </span>

                Add Member
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Meetings
                </p>

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  ◉
                </div>
              </div>

              <p className="mt-4 text-3xl font-bold text-slate-900">
                0
              </p>

              <p className="mt-1 text-xs text-slate-500">
                No meetings yet
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Open Tasks
                </p>

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-600">
                  ✓
                </div>
              </div>

              <p className="mt-4 text-3xl font-bold text-slate-900">
                0
              </p>

              <p className="mt-1 text-xs text-slate-500">
                No pending tasks
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  Team Members
                </p>

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                  ♟
                </div>
              </div>

              <p className="mt-4 text-3xl font-bold text-slate-900">
                {workspaces.length > 0 ? "—" : "0"}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Workspace members
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  AI Actions
                </p>

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  ✦
                </div>
              </div>

              <p className="mt-4 text-3xl font-bold text-slate-900">
                0
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Actions extracted
              </p>
            </div>
          </div>

          {/* Workspace Overview */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm">

            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <h2 className="font-semibold text-slate-900">
                Workspace Overview
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Your current workspace information.
              </p>
            </div>

            <div className="grid gap-6 p-5 sm:grid-cols-3 sm:p-6">

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Workspace
                </p>

                <p className="mt-2 font-medium text-slate-900">
                  {currentWorkspace?.name ||
                    "No workspace selected"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Your Role
                </p>

                <p className="mt-2 font-medium capitalize text-slate-900">
                  {currentRole || "Member"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Workspace ID
                </p>

                <p className="mt-2 break-all font-mono text-xs text-slate-600">
                  {currentWorkspace?.id || "Not available"}
                </p>
              </div>

            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-6">

            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Quick Actions
            </h2>

            <div className="grid gap-4 md:grid-cols-3">

              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white p-5 text-left text-slate-900 shadow-sm hover:border-indigo-300 hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  +
                </div>

                <h3 className="font-semibold text-slate-900">
                  New Meeting
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Add a meeting transcript for AI processing.
                </p>
              </button>

              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white p-5 text-left text-slate-900 shadow-sm hover:border-indigo-300 hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
                  ✓
                </div>

                <h3 className="font-semibold text-slate-900">
                  View Tasks
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Review actions and assignments from meetings.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (currentRole === "admin") {
                    setAddMemberOpen(true);
                  }
                }}
                className="rounded-xl border border-slate-200 bg-white p-5 text-left text-slate-900 shadow-sm hover:border-indigo-300 hover:shadow-md"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                  ♟
                </div>

                <h3 className="font-semibold text-slate-900">
                  Manage Team
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Add members and manage your workspace team.
                </p>
              </button>

            </div>
          </div>
        </main>
      </div>

      <AddMemberModal
        isOpen={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        onAddMember={handleAddMember}
      />
    </div>
  );
}