import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

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

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
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

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.debug("Remote session check bypassed:", error.message);
        }
        if (mounted) {
          setSession(data?.session ?? null);
          setUser(data?.session?.user ?? null);
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
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
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
