import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Sparkles,
  SquareKanban,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Button } from "../ui/button";
import CreateWorkspaceModal from "../workspace/CreateWorkspaceModal";
import Brand from "./Brand";
import { workspaceGradient } from "../../lib/workspaceGradient";

interface SidebarProps {
  onClose?: () => void;
}

const navGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
      { label: "Meetings", path: "/meetings", icon: CalendarPlus },
      { label: "Calendar", path: "/calendar", icon: CalendarDays },
      { label: "Tasks", path: "/tasks", icon: SquareKanban },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", path: "/analytics", icon: BarChart3 },
      { label: "Meeting progress", path: "/velocity", icon: TrendingUp },
      { label: "AI Assistant", path: "/chat", icon: Sparkles },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Team", path: "/team", icon: Users },
      { label: "Workspace Settings", path: "/settings/github", icon: Settings },
    ],
  },
];


export default function Sidebar({ onClose }: SidebarProps) {
  const { user, signOut } = useAuth();
  const { workspaces, currentWorkspace, currentRole, switchWorkspace } = useWorkspace();
  const [showCreate, setShowCreate] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || "User";
  const wsName = currentWorkspace?.name ?? "No workspace";

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

  return (
    <div className="app-sidebar flex h-full flex-col">
      <div className="flex h-[60px] shrink-0 items-center justify-between px-5">
        <Brand to="/dashboard" />
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close menu">
            <X />
          </Button>
        )}
      </div>

      {/* Workspace switcher: the tile is the visible control, the native select does the work */}
      <div className="px-3">
        <div className="dashboard-workspace-picker group relative flex items-center gap-2.5 rounded-xl border p-2.5">
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-lg dashboard-on-accent bg-gradient-to-br text-sm font-semibold text-white ${workspaceGradient(wsName)}`}
          >
            {wsName.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{wsName}</span>
            <span className="block text-[11px] capitalize text-neutral-500">{currentRole ?? "member"}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-neutral-500 transition-colors group-hover:text-neutral-300" />
          <select
            aria-label="Switch workspace"
            value={currentWorkspace?.id ?? ""}
            onChange={(e) => e.target.value && switchWorkspace(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {workspaces.length === 0 ? (
              <option value="">No workspace</option>
            ) : (
              workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))
            )}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="dashboard-nav-link mt-1.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <Plus className="size-3.5" /> New workspace
        </button>
      </div>

      <nav aria-label="App navigation" className="mt-5 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="dashboard-nav-group">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(({ label, path, icon: Icon }) => (
                <NavLink key={path} to={path} onClick={onClose} className="dashboard-nav-link">
                  <Icon size={17} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User card */}
      <div className="dashboard-sidebar-account border-t p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <span className="relative grid size-8 shrink-0 place-items-center rounded-full dashboard-on-accent bg-gradient-to-br from-neutral-600 to-neutral-800 text-xs font-semibold text-white ring-1 ring-white/10">
            {displayName.charAt(0).toUpperCase()}
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full dashboard-avatar-dot border-2 border-[#0b0b0e] bg-emerald-400" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">{displayName}</span>
            <span className="block truncate text-[11px] text-neutral-500">{user?.email}</span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut />
          </Button>
        </div>
      </div>

      <CreateWorkspaceModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
