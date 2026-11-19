import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

export type AppRole = "admin" | "organiser" | "member";
export interface Workspace { id: string; name: string; }
interface Membership { role: AppRole; workspace: Workspace | Workspace[] | null; }
interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentRole: AppRole | null;
  loading: boolean;
  error: string | null;
  switchWorkspace: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
}
const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const refreshWorkspaces = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    setMemberships([]);
    setSelectedId(null);
    if (!user) { setLoadedUserId(null); setLoading(false); return; }
    try {
      const { data, error } = await supabase.from("workspace_members")
        .select("role, workspace:workspaces(id, name)").eq("user_id", user.id);
      if (error) throw error;
      if (request !== generation.current) return;
      const rows = (data || []) as Membership[];
      const workspaces = rows.flatMap(m => m.workspace ? [m.workspace].flat() : []);
      const saved = localStorage.getItem("currentWorkspaceId");
      const selected = workspaces.find(w => w.id === saved) || workspaces[0];
      setMemberships(rows);
      setLoadedUserId(user.id);
      setSelectedId(selected?.id || null);
      if (selected) localStorage.setItem("currentWorkspaceId", selected.id);
      else localStorage.removeItem("currentWorkspaceId");
    } catch (err) {
      if (request === generation.current) setError(err instanceof Error ? err.message : "Unable to load workspaces. Please retry.");
    } finally { if (request === generation.current) setLoading(false); }
  }, [user]);
  useEffect(() => {
    if (!authLoading) void refreshWorkspaces();
    return () => { generation.current++; };
  }, [authLoading, refreshWorkspaces]);
  const validMemberships = loadedUserId === user?.id ? memberships : [];
  const workspaces = validMemberships.flatMap(m => m.workspace ? [m.workspace].flat() : []);
  const currentWorkspace = workspaces.find(w => w.id === selectedId) || null;
  const currentRole = validMemberships.find(m => [m.workspace].flat().some(w => w?.id === selectedId))?.role || null;
  const switchWorkspace = (id: string) => {
    if (!workspaces.some(w => w.id === id)) return;
    setSelectedId(id);
    localStorage.setItem("currentWorkspaceId", id);
  };
  const createWorkspace = async (name: string) => {
    if (!user) throw new Error("Sign in to create a workspace.");
    if (!name.trim()) throw new Error("Workspace name is required.");
    const { data, error } = await supabase.rpc("create_workspace", { p_name: name.trim() });
    if (error) throw error;
    if (!data) throw new Error("Workspace was not created.");
    localStorage.setItem("currentWorkspaceId", data);
    await refreshWorkspaces();
  };
  return <WorkspaceContext.Provider value={{ workspaces, currentWorkspace, currentRole, loading, error, switchWorkspace, refreshWorkspaces, createWorkspace }}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside a WorkspaceProvider");
  return context;
}
