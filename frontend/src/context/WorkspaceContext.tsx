import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

export type AppRole = "admin" | "organiser" | "member";

export interface Workspace {
  id: string;
  name: string;
}

interface WorkspaceMembership {
  role: AppRole;
  workspace: Workspace | Workspace[] | null;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentRole: AppRole | null;
  loading: boolean;
  switchWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
}

const WorkspaceContext = createContext<
  WorkspaceContextType | undefined
>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({
  children,
}: WorkspaceProviderProps) {
  const { user, loading: authLoading } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] =
    useState<Workspace | null>(null);

  const [currentRole, setCurrentRole] =
    useState<AppRole | null>(null);

  const [loading, setLoading] = useState(true);

  const refreshWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setCurrentRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("workspace_members")
        .select(
          `
          role,
          workspace:workspaces (
            id,
            name
          )
        `
        )
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      const memberships =
        (data as WorkspaceMembership[]) || [];

      const loadedWorkspaces: Workspace[] = [];

      memberships.forEach((membership) => {
        if (!membership.workspace) {
          return;
        }

        if (Array.isArray(membership.workspace)) {
          loadedWorkspaces.push(...membership.workspace);
        } else {
          loadedWorkspaces.push(membership.workspace);
        }
      });

      setWorkspaces(loadedWorkspaces);

      if (loadedWorkspaces.length === 0) {
        setCurrentWorkspace(null);
        setCurrentRole(null);
        return;
      }

      const savedWorkspaceId =
        localStorage.getItem("currentWorkspaceId");

      const selectedWorkspace =
        loadedWorkspaces.find(
          (workspace) => workspace.id === savedWorkspaceId
        ) || loadedWorkspaces[0];

      setCurrentWorkspace(selectedWorkspace);

      const selectedMembership = memberships.find(
        (membership) => {
          if (!membership.workspace) {
            return false;
          }

          if (Array.isArray(membership.workspace)) {
            return membership.workspace.some(
              (workspace) =>
                workspace.id === selectedWorkspace.id
            );
          }

          return (
            membership.workspace.id === selectedWorkspace.id
          );
        }
      );

      setCurrentRole(selectedMembership?.role || null);

      localStorage.setItem(
        "currentWorkspaceId",
        selectedWorkspace.id
      );
    } catch (error) {
      console.error(
        "Error loading workspaces:",
        error
      );

      setWorkspaces([]);
      setCurrentWorkspace(null);
      setCurrentRole(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createWorkspace = async (name: string) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new Error("Workspace name is required.");
    }

    if (!user) {
      throw new Error("You must be logged in to create a workspace.");
    }

    const { data: workspaceId, error } = await supabase.rpc(
      "create_workspace",
      {
        p_name: trimmedName,
      }
    );

    if (error) {
      console.error("Error creating workspace:", error);
      throw error;
    }

    if (!workspaceId) {
      throw new Error("Workspace was not created.");
    }

    await refreshWorkspaces();
  };

  useEffect(() => {
    if (!authLoading) {
      refreshWorkspaces();
    }
  }, [authLoading, refreshWorkspaces]);

  const switchWorkspace = (workspaceId: string) => {
    const workspace = workspaces.find(
      (item) => item.id === workspaceId
    );

    if (!workspace) {
      return;
    }

    setCurrentWorkspace(workspace);

    localStorage.setItem(
      "currentWorkspaceId",
      workspace.id
    );

    const loadRole = async () => {
      if (!user) {
        return;
      }

      const { data, error } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error(
          "Error loading workspace role:",
          error
        );
        return;
      }

      setCurrentRole(data.role as AppRole);
    };

    loadRole();
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        currentRole,
        loading,
        switchWorkspace,
        refreshWorkspaces,
        createWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error(
      "useWorkspace must be used inside a WorkspaceProvider"
    );
  }

  return context;
}