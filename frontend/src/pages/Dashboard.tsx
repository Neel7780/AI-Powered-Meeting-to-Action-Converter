import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Building2, LoaderCircle } from "lucide-react";

import Navbar from "../components/layout/Navbar";
import Sidebar from "../components/layout/Sidebar";
import AddMemberModal from "../components/workspace/AddMemberModal";
import CreateWorkspaceModal from "../components/workspace/CreateWorkspaceModal";
import FloatingChatWidget from "../components/chat/FloatingChatWidget";
import Overview from "../components/dashboard/Overview";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { supabase } from "../lib/supabase";
import ChatPage from "../pages/ChatPage";
import TeamPage from "../pages/TeamPage";
import AnalyticsPage from "../pages/AnalyticsPage";
import SprintVelocityPage from "../pages/SprintVelocityPage";
import GitHubSettings from "./GitHubSettings";
import MeetingsPage from "../pages/MeetingsPage";
import CalendarPage from "./CalendarPage";
import { postApi } from "../services/reviewApi";
import KanbanBoard from "./KanbanBoard";
import { FollowUpModal } from "../components/meetings/FollowUpModal";

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    workspaces,
    currentWorkspace,
    currentRole,
    loading,
  } = useWorkspace();

  const isChatPage = location.pathname === "/chat";
  const isTasksPage = location.pathname === "/tasks" || location.pathname === "/kanban";
  const isMeetingsPage = location.pathname === "/meetings";
  const isCalendarPage = location.pathname === "/calendar";
  const isTeamPage = location.pathname === "/team";
  const isAnalyticsPage = location.pathname === "/analytics";
  const isVelocityPage = location.pathname === "/velocity";
  const isGitHubPage = location.pathname === "/settings/github";

  const [showAddMember, setShowAddMember] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [latestMeeting, setLatestMeeting] = useState<{ id: string; title: string } | null>(null);

  const isAdmin = currentRole === "admin";
  const workspaceId = currentWorkspace?.id;
  const { user } = useAuth();
  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || "there";

  // Query latest meeting in workspace to avoid hardcoded dummy IDs
  useEffect(() => {
    if (!workspaceId) {
      setLatestMeeting(null);
      return;
    }
    supabase
      .from("meetings")
      .select("id, title")
      .eq("workspace_id", workspaceId)
      .order("starts_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setLatestMeeting({ id: data[0].id, title: data[0].title });
        } else {
          setLatestMeeting(null);
        }
      });
  }, [workspaceId]);

  const handleAddMember = async (
    email: string,
    role: "organiser" | "member"
  ) => {
    if (!currentWorkspace) throw new Error("Select a workspace first.");
    // Backend creates the invite and emails the /invite/{token} link.
    await postApi(`/api/workspaces/${currentWorkspace.id}/invites`, { email, role });
  };


  return (
    <div className="app-canvas flex min-h-screen text-white">
      {/* Desktop Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-white/[0.06] lg:block">
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <Navbar onMenuClick={() => setShowMobileSidebar(true)} />

        {/* Mobile Sidebar */}
        {showMobileSidebar && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowMobileSidebar(false)}
            />

            <aside className="rise-in relative h-full w-72 border-r border-white/10 shadow-2xl">
              <Sidebar onClose={() => setShowMobileSidebar(false)} />
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="min-w-0 flex-1">
          {isGitHubPage ? (
            <GitHubSettings key={currentWorkspace?.id} />
          ) : isChatPage ? (
            <ChatPage />
          ) : isTasksPage ? (
            <KanbanBoard workspaceId={currentWorkspace?.id} />
          ) : isMeetingsPage ? (
            <MeetingsPage />
          ) : isCalendarPage ? (
            <CalendarPage />
          ) : isTeamPage ? (
            <TeamPage />
          ) : isAnalyticsPage ? (
            <AnalyticsPage />
          ) : isVelocityPage ? (
            <SprintVelocityPage />
          ) : loading ? (
            <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-neutral-500">
              <LoaderCircle className="size-4 animate-spin" />
              Loading workspace…
            </div>
          ) : !currentWorkspace ? (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
              <div className="card rise-in w-full max-w-md p-8 text-center">
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
            <Overview
              workspace={currentWorkspace}
              workspaces={workspaces}
              displayName={displayName}
              isAdmin={isAdmin}
              canCreate={currentRole === "admin" || currentRole === "organiser"}
              latestMeetingTitle={latestMeeting?.title}
              onAddMember={() => setShowAddMember(true)}
              onFollowUp={() => (latestMeeting ? setShowFollowUp(true) : navigate("/meetings"))}
            />
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

          {/* 1-Click Meeting Follow-Up Modal (dynamically loaded with real meeting UUID) */}
          {latestMeeting && (
            <FollowUpModal
              isOpen={showFollowUp}
              onClose={() => setShowFollowUp(false)}
              meetingId={latestMeeting.id}
              meetingTitle={latestMeeting.title}
            />
          )}

          {/* Global Floating Chat Widget (available across all workspace views except /chat) */}
          {!isChatPage && currentWorkspace && (
            <FloatingChatWidget workspaceId={currentWorkspace.id} />
          )}
        </main>
      </div>
    </div>
  );
}
