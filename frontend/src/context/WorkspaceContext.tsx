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

const DEFAULT_DEMO_WORKSPACE: Workspace = {
  id: "00000000-0000-0000-0000-000000000002",
  name: "ActionPulse Engineering Workspace",
};

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

    // Dev test user gets demo workspace directly (with local dev persistence)
    if (user.id === "00000000-0000-0000-0000-000000000001") {
      const storedDev = localStorage.getItem("actionpulse_dev_workspaces");
      let devWorkspaces: Workspace[] = [DEFAULT_DEMO_WORKSPACE];
      if (storedDev) {
        try {
          devWorkspaces = JSON.parse(storedDev);
        } catch {
          // ignore corrupted data
        }
      }
      setWorkspaces(devWorkspaces);

      const savedWorkspaceId = localStorage.getItem("currentWorkspaceId");
      const selected =
        devWorkspaces.find((w) => w.id === savedWorkspaceId) || devWorkspaces[0];

      setCurrentWorkspace(selected);
      setCurrentRole("admin");
      localStorage.setItem("currentWorkspaceId", selected.id);
      localStorage.setItem("currentWorkspaceName", selected.name || "");
      localStorage.setItem("currentWorkspaceRole", "admin");
      window.dispatchEvent(
        new CustomEvent("actionpulse:workspace-changed", {
          detail: {
            workspaceId: selected.id,
            workspaceName: selected.name || "",
            role: "admin",
          },
        })
      );
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
        localStorage.removeItem("currentWorkspaceId");
        localStorage.removeItem("currentWorkspaceName");
        localStorage.removeItem("currentWorkspaceRole");
        window.dispatchEvent(
          new CustomEvent("actionpulse:workspace-changed", {
            detail: { workspaceId: "", workspaceName: "", role: "" },
          })
        );
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
      localStorage.setItem(
        "currentWorkspaceName",
        selectedWorkspace.name || ""
      );
      if (selectedMembership?.role) {
        localStorage.setItem("currentWorkspaceRole", selectedMembership.role);
      } else {
        localStorage.removeItem("currentWorkspaceRole");
      }
      window.dispatchEvent(
        new CustomEvent("actionpulse:workspace-changed", {
          detail: {
            workspaceId: selectedWorkspace.id,
            workspaceName: selectedWorkspace.name || "",
            role: selectedMembership?.role || "",
          },
        })
      );
    } catch (error) {
      console.error("Failed to load workspaces from Supabase:", error);
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

    // Dev test user: local workspace creation simulation
    if (user.id === "00000000-0000-0000-0000-000000000001") {
      const newWs: Workspace = {
        id: `dev-ws-${Date.now()}`,
        name: trimmedName,
      };
      const storedDev = localStorage.getItem("actionpulse_dev_workspaces");
      let devList: Workspace[] = [DEFAULT_DEMO_WORKSPACE];
      if (storedDev) {
        try {
          devList = JSON.parse(storedDev);
        } catch {
          // ignore parsing error
        }
      }
      devList.push(newWs);
      localStorage.setItem("actionpulse_dev_workspaces", JSON.stringify(devList));
      localStorage.setItem("currentWorkspaceId", newWs.id);
      localStorage.setItem("currentWorkspaceName", newWs.name);
      localStorage.setItem("currentWorkspaceRole", "admin");
      setWorkspaces(devList);
      setCurrentWorkspace(newWs);
      setCurrentRole("admin");
      window.dispatchEvent(
        new CustomEvent("actionpulse:workspace-changed", {
          detail: {
            workspaceId: newWs.id,
            workspaceName: newWs.name,
            role: "admin",
          },
        })
      );
      return;
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

    // Explicitly select the new workspace so refreshWorkspaces activates it
    localStorage.setItem("currentWorkspaceId", workspaceId);
    localStorage.setItem("currentWorkspaceName", trimmedName);
    localStorage.setItem("currentWorkspaceRole", "admin");

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
    localStorage.setItem(
      "currentWorkspaceName",
      workspace.name || ""
    );

    if (user?.id === "00000000-0000-0000-0000-000000000001") {
      setCurrentRole("admin");
      localStorage.setItem("currentWorkspaceRole", "admin");
      window.dispatchEvent(
        new CustomEvent("actionpulse:workspace-changed", {
          detail: {
            workspaceId: workspace.id,
            workspaceName: workspace.name || "",
            role: "admin",
          },
        })
      );
      return;
    }

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
      if (data.role) {
        localStorage.setItem("currentWorkspaceRole", data.role);
      }
      window.dispatchEvent(
        new CustomEvent("actionpulse:workspace-changed", {
          detail: {
            workspaceId: workspace.id,
            workspaceName: workspace.name || "",
            role: data.role || "",
          },
        })
      );
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
