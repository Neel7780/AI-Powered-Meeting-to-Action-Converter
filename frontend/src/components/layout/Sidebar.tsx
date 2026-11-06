import { useState } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
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
  Users,
  Video,
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
      { label: "Meeting Studio", path: "/meeting-details", icon: Video },
      { label: "Tasks", path: "/tasks", icon: SquareKanban },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", path: "/analytics", icon: BarChart3 },
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
  // separate layoutId per instance so the desktop and mobile sidebars don't animate into each other
  const pillId = onClose ? "nav-pill-mobile" : "nav-pill";

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
      <div className="flex h-14 items-center justify-between px-4">
        <Brand to="/dashboard" />
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close menu">
            <X />
          </Button>
        )}
      </div>

      {/* Workspace switcher: the tile is the visible control, the native select does the work */}
      <div className="px-3">
        <div className="group relative flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2 transition-colors hover:border-white/15 hover:bg-white/[0.04]">
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-md bg-gradient-to-br text-sm font-semibold text-white shadow-inner ${workspaceGradient(wsName)}`}
          >
            {wsName.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">{wsName}</span>
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
          className="mt-1.5 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-neutral-500 transition-colors hover:bg-white/[0.04] hover:text-neutral-200"
        >
          <Plus className="size-3.5" /> New workspace
        </button>
      </div>

      <nav aria-label="App navigation" className="mt-3 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-2.5 pb-1.5 text-[11px] font-medium text-neutral-500">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(({ label, path, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                      isActive ? "font-medium text-white" : "text-neutral-400 hover:bg-white/[0.04] hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId={pillId}
                          className="absolute inset-0 rounded-md bg-white/[0.07]"
                          transition={{ type: "spring", stiffness: 500, damping: 38 }}
                        >
                          <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-indigo-400" />
                        </motion.span>
                      )}
                      <Icon className={`relative size-4 shrink-0 ${isActive ? "text-indigo-300" : ""}`} />
                      <span className="relative">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User card */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800 text-xs font-semibold text-white ring-1 ring-white/10">
            {displayName.charAt(0).toUpperCase()}
            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[#0b0b0e] bg-emerald-400" />
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
