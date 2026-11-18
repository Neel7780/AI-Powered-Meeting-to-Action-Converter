import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
  devSignIn: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

function getInitialSession(): { user: User | null; session: Session | null } {
  try {
    const devSessionRaw = localStorage.getItem("actionpulse_dev_session");
    if (devSessionRaw) {
      const parsed = JSON.parse(devSessionRaw);
      if (parsed?.user) return { user: parsed.user, session: parsed };
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("sb-") || key.includes("auth-token"))) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          const u = parsed?.user ?? parsed?.currentSession?.user ?? null;
          const s =
            parsed?.session ??
            parsed?.currentSession ??
            (parsed?.access_token ? parsed : null);
          if (u) return { user: u, session: s };
        }
      }
    }
  } catch {
    // ignore parsing errors
  }
  return { user: null, session: null };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const initial = getInitialSession();
  const [user, setUser] = useState<User | null>(initial.user);
  const [session, setSession] = useState<Session | null>(initial.session);
  const [loading, setLoading] = useState<boolean>(!initial.user && isSupabaseConfigured);

  useEffect(() => {
    let mounted = true;

    // Check for local dev session first
    const devSessionRaw = localStorage.getItem("actionpulse_dev_session");
    if (devSessionRaw) {
      try {
        const parsed = JSON.parse(devSessionRaw);
        if (mounted) {
          setSession(parsed);
          setUser(parsed.user);
          setLoading(false);
        }
        return;
      } catch {
        // ignore parsing error
      }
    }

    if (!isSupabaseConfigured) {
      if (mounted) setLoading(false);
      return;
    }

    const loadSession = async () => {
      try {
        // 3-second timeout safety to prevent hanging indefinitely on network/DNS lag
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null }; error: null }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null }, error: null }), 3000)
        );
        const { data, error } = await Promise.race([sessionPromise, timeoutPromise]);
        if (error) {
          console.debug("Remote session check bypassed:", (error as { message?: string })?.message);
        }
        if (mounted) {
          if (data?.session) {
            setSession(data.session);
            setUser(data.session.user ?? null);
          }
          setLoading(false);
        }
      } catch (err) {
        console.debug("Supabase getSession failed, continuing:", err);
        if (mounted) setLoading(false);
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (localStorage.getItem("actionpulse_dev_session")) return;
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const devSignIn = () => {
    const mockUser: User = {
      id: "00000000-0000-0000-0000-000000000001",
      app_metadata: {},
      user_metadata: { full_name: "Developer Admin" },
      aud: "authenticated",
      created_at: new Date().toISOString(),
      email: "dev@actionpulse.app",
      role: "authenticated",
      updated_at: new Date().toISOString(),
    } as unknown as User;

    const mockSession: Session = {
      access_token: "dev-token-actionpulse",
      token_type: "bearer",
      expires_in: 86400,
      refresh_token: "dev-refresh-token",
      user: mockUser,
      expires_at: Math.floor(Date.now() / 1000) + 86400,
    };

    localStorage.setItem("actionpulse_dev_session", JSON.stringify(mockSession));
    setUser(mockUser);
    setSession(mockSession);
    setLoading(false);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName,
        },
      },
    });

    if (error) {
      throw error;
    }
  };

  const signOut = async () => {
    localStorage.removeItem("actionpulse_dev_session");
    localStorage.removeItem("currentWorkspaceId");
    localStorage.removeItem("currentWorkspaceName");
    localStorage.removeItem("currentWorkspaceRole");
    window.dispatchEvent(
      new CustomEvent("actionpulse:workspace-changed", {
        detail: { workspaceId: "", workspaceName: "", role: "" },
      })
    );
    setUser(null);
    setSession(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        devSignIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return context;
}
