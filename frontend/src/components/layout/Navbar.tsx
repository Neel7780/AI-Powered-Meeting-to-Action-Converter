import { useState } from "react";
import { LogOut, Menu, Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Button } from "../ui/button";
import Brand from "./Brand";
import CreateWorkspaceModal from "../workspace/CreateWorkspaceModal";

interface NavbarProps {
  onMenuClick?: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { user, signOut } = useAuth();

  const {
    workspaces,
    currentWorkspace,
    currentRole,
    switchWorkspace,
  } = useWorkspace();

  const [loggingOut, setLoggingOut] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);

    try {
      await signOut();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleWorkspaceChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const workspaceId = event.target.value;

    if (!workspaceId) return;

    try {
      await switchWorkspace(workspaceId);
    } catch (error) {
      console.error("Workspace switch failed:", error);
    }
  };

  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    "User";

  const workspaceOptions =
    workspaces.length === 0 ? (
      <option value="">No workspace</option>
    ) : (
      workspaces.map((workspace) => (
        <option key={workspace.id} value={workspace.id}>
          {workspace.name}
        </option>
      ))
    );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/95 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          {/* Left */}
          <div className="flex min-w-0 items-center gap-3">
            {onMenuClick && (
              <Button variant="ghost" size="icon" onClick={onMenuClick} className="lg:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            )}

            <Brand to="/dashboard" />

            {/* Desktop workspace selector */}
            <span aria-hidden="true" className="hidden h-5 w-px bg-white/10 sm:block" />
            <div className="hidden items-center gap-1.5 sm:flex">
              <select
                aria-label="Current workspace"
                value={currentWorkspace?.id ?? ""}
                onChange={handleWorkspaceChange}
                className="field h-8 w-auto min-w-[170px] max-w-[240px] cursor-pointer py-0 text-xs font-medium"
              >
                {workspaceOptions}
              </select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2.5 text-xs text-neutral-300 hover:text-white"
                onClick={() => setShowCreateModal(true)}
                title="Create new workspace"
              >
                <Plus className="size-3.5" />
                <span>New</span>
              </Button>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            {currentRole && (
              <span className="hidden rounded border border-white/15 bg-white/5 px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-neutral-300 sm:inline-block">
                {currentRole}
              </span>
            )}

            <div className="hidden text-right md:block">
              <p className="text-sm font-medium text-white">{displayName}</p>
              <p className="text-xs text-neutral-500">{user?.email}</p>
            </div>

            <div
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-full border border-white/15 bg-white/10 text-xs font-semibold text-white"
            >
              {displayName.charAt(0).toUpperCase()}
            </div>

            <Button variant="outline" size="sm" onClick={handleLogout} disabled={loggingOut} aria-label="Log out">
              <LogOut />
              <span className="hidden sm:inline">{loggingOut ? "Logging out…" : "Log out"}</span>
            </Button>
          </div>
        </div>

        {/* Mobile workspace selector */}
        <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2.5 sm:hidden">
          <select
            aria-label="Current workspace"
            value={currentWorkspace?.id ?? ""}
            onChange={handleWorkspaceChange}
            className="field h-9 flex-1 cursor-pointer py-0 text-xs font-medium"
          >
            {workspaceOptions}
          </select>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1 px-2.5 text-xs"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="size-3.5" />
            <span>New</span>
          </Button>
        </div>
      </header>

      {/* Create Workspace Modal accessible from any page */}
      <CreateWorkspaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </>
  );
}
