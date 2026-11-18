import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Menu, Plus } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Button } from "../ui/button";
import Brand from "./Brand";
import { workspaceGradient } from "../../lib/workspaceGradient";

interface NavbarProps {
  onMenuClick?: () => void;
}

const titles: Record<string, string> = {
  "/dashboard": "Overview",
  "/meetings": "Meetings",
  "/tasks": "Tasks",
  "/kanban": "Tasks",
  "/analytics": "Analytics",
  "/chat": "AI Assistant",
  "/team": "Team",
  "/settings/github": "GitHub settings",
};

/** Slim, translucent top bar (Notion-style breadcrumb). Workspace + account controls live in the sidebar. */
export default function Navbar({ onMenuClick }: NavbarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { currentWorkspace, currentRole } = useWorkspace();
  const canCreate = currentRole === "owner" || currentRole === "admin" || currentRole === "organiser";
  const wsName = currentWorkspace?.name ?? "Workspace";

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#08080a]/75 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
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
              className={`grid size-5 shrink-0 place-items-center rounded bg-gradient-to-br text-[10px] font-semibold text-white ${workspaceGradient(wsName)}`}
            >
              {wsName.charAt(0).toUpperCase()}
            </span>
            <span className="truncate text-neutral-400">{wsName}</span>
            <ChevronRight className="size-3.5 shrink-0 text-neutral-600" />
            <span key={pathname} className="rise-in truncate font-medium text-white">
              {titles[pathname] ?? "Overview"}
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {canCreate && !["/dashboard", "/meetings", "/tasks", "/kanban"].includes(pathname) && (
            <Button size="sm" onClick={() => navigate("/meetings")} className="gap-1.5">
              <Plus /> <span className="hidden sm:inline">New meeting</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
