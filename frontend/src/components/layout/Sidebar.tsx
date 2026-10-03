import { NavLink } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { currentRole } = useWorkspace();

  const navItems = [
    {
      label: "Dashboard",
      path: "/dashboard",
      icon: "▦",
    },
    {
      label: "Meetings",
      path: "/meetings",
      icon: "◉",
    },
    {
      label: "Tasks",
      path: "/tasks",
      icon: "✓",
    },
    {
      label: "Team",
      path: "/team",
      icon: "♟",
    },
  ];

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white text-slate-900">

      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
        <div>
          <h2 className="font-semibold text-slate-900">
            Workspace
          </h2>

          <p className="text-xs capitalize text-slate-500">
            {currentRole || "member"}
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 rounded-lg px-3 py-2.5",
                "text-sm font-medium transition",
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              ].join(" ")
            }
          >
            <span className="flex w-6 justify-center text-base">
              {item.icon}
            </span>

            <span>{item.label}</span>
          </NavLink>
        ))}

        {currentRole === "admin" && (
          <div className="pt-5">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Administration
            </p>

            <NavLink
              to="/settings"
              onClick={onClose}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-lg px-3 py-2.5",
                  "text-sm font-medium transition",
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                ].join(" ")
              }
            >
              <span className="flex w-6 justify-center">
                ⚙
              </span>

              <span>Settings</span>
            </NavLink>
          </div>
        )}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-700">
            ActionPulse
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Turn meetings into actions.
          </p>
        </div>
      </div>
    </aside>
  );
}