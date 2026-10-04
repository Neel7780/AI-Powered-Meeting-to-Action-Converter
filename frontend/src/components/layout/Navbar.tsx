import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useDarkMode } from "../../context/DarkModeContext";

interface NavbarProps {
  onMenuClick?: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { user, signOut } = useAuth();
  const { isDark, toggle: toggleDark } = useDarkMode();

  const {
    workspaces,
    currentWorkspace,
    currentRole,
    switchWorkspace,
  } = useWorkspace();

  const [loggingOut, setLoggingOut] = useState(false);

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

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">

        {/* Left */}
        <div className="flex items-center gap-4">

          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
          )}

          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              ActionPulse
            </h1>

            <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              Meeting to Action
            </p>
          </div>

          {/* Desktop workspace selector */}
          <div className="hidden sm:block">
            <select
              value={currentWorkspace?.id ?? ""}
              onChange={handleWorkspaceChange}
              className="min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-900 [color-scheme:light] dark:[color-scheme:dark]"
            >
              {workspaces.length === 0 ? (
                <option value="">No workspace</option>
              ) : (
                workspaces.map((workspace) => (
                  <option
                    key={workspace.id}
                    value={workspace.id}
                  >
                    {workspace.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleDark}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {currentRole && (
            <span className="hidden rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold capitalize text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 sm:inline-block">
              {currentRole}
            </span>
          )}

          <div className="hidden text-right md:block">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {displayName}
            </p>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user?.email}
            </p>
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>

      {/* Mobile workspace selector */}
      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:hidden">
        <select
          value={currentWorkspace?.id ?? ""}
          onChange={handleWorkspaceChange}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 [color-scheme:light] dark:[color-scheme:dark]"
        >
          {workspaces.length === 0 ? (
            <option value="">No workspace</option>
          ) : (
            workspaces.map((workspace) => (
              <option
                key={workspace.id}
                value={workspace.id}
              >
                {workspace.name}
              </option>
            ))
          )}
        </select>
      </div>
    </header>
  );
}