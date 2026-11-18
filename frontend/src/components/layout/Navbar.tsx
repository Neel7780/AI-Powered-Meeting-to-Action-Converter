import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Menu, Moon, Plus, Sun } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Button } from "../ui/button";
import Brand from "./Brand";
import { workspaceGradient } from "../../lib/workspaceGradient";

interface NavbarProps {
  onMenuClick?: () => void;
  dashboardTheme: { light: boolean; toggle: () => void };
}

const titles: Record<string, string> = {
  "/dashboard": "Overview",
  "/meetings": "Meetings",
  "/tasks": "Tasks",
  "/kanban": "Tasks",
  "/analytics": "Analytics",
  "/calendar": "Calendar",
  "/velocity": "Meeting progress",
  "/chat": "AI Assistant",
  "/team": "Team",
  "/settings/github": "GitHub settings",
};

/** Slim, translucent top bar (Notion-style breadcrumb). Workspace + account controls live in the sidebar. */
export default function Navbar({ onMenuClick, dashboardTheme }: NavbarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { currentWorkspace, currentRole } = useWorkspace();
  const canCreate = currentRole === "owner" || currentRole === "admin" || currentRole === "organiser";
  const wsName = currentWorkspace?.name ?? "Workspace";

  return (
    <header className="dashboard-topbar sticky top-0 z-40 border-b border-white/[0.06] bg-[#08080a]/75 backdrop-blur-xl">
      <div className="flex h-[60px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {onMenuClick && (
            <Button variant="ghost" size="icon" onClick={onMenuClick} className="-ml-2 lg:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          )}
          <span className="lg:hidden">
            <Brand to="/dashboard" />
          </span>

          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm lg:flex">
            <span
              className={`grid size-5 shrink-0 place-items-center rounded dashboard-on-accent bg-gradient-to-br text-[10px] font-semibold text-white ${workspaceGradient(wsName)}`}
            >
              {wsName.charAt(0).toUpperCase()}
            </span>
            <span className="truncate text-neutral-400">{wsName}</span>
            <ChevronRight className="size-3.5 shrink-0 text-neutral-600" />
            <span className="truncate font-semibold text-white" aria-current="page">
              {titles[pathname] ?? (pathname.startsWith("/meetings/") ? "Meetings" : "Overview")}
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" size="icon" variant="ghost"
            onClick={dashboardTheme.toggle}
            aria-label={dashboardTheme.light ? "Switch to dark mode" : "Switch to light mode"}
            className="dashboard-theme-toggle">
            {dashboardTheme.light ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
          </Button>
          {canCreate && !pathname.startsWith("/meetings") && !["/dashboard", "/tasks", "/kanban"].includes(pathname) && (
            <Button size="sm" onClick={() => navigate("/meetings?create=1")} className="gap-1.5">
              <Plus /> <span className="hidden sm:inline">Create meeting</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
