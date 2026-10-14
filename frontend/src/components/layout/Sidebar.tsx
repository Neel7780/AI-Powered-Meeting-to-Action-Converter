import { NavLink } from "react-router-dom";
import { CalendarPlus, LayoutDashboard, SquareKanban, Users, X } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Button } from "../ui/button";
import Brand from "./Brand";

interface SidebarProps {
  onClose?: () => void;
}

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Meetings", path: "/meetings", icon: CalendarPlus },
  { label: "Tasks", path: "/tasks", icon: SquareKanban },
  { label: "Team", path: "/team", icon: Users },
];

export default function Sidebar({ onClose }: SidebarProps) {
  const { currentRole } = useWorkspace();

  return (
    <div className="flex h-full flex-col bg-black">
      {/* Mobile drawer header */}
      {onClose && (
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <Brand to="/dashboard" />
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close menu">
            <X />
          </Button>
        </div>
      )}

      <nav aria-label="App navigation" className="flex-1 space-y-0.5 p-3">
        <p className="eyebrow px-3 pb-2 pt-2">Workspace</p>

        {navItems.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-white/[0.07] font-medium text-white"
                  : "text-neutral-400 hover:bg-white/[0.04] hover:text-white"
              }`
            }
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <p className="eyebrow">Your role</p>
        <p className="mt-1 text-sm capitalize text-neutral-300">{currentRole || "member"}</p>
      </div>
    </div>
  );
}
