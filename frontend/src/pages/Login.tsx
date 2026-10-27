import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/auth/AuthShell";
import { Button } from "../components/ui/button";
import { Notice } from "../components/ui/notice";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, devSignIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
      navigate(location.state?.from || "/dashboard");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to sign in";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDevSignIn = () => {
    devSignIn();
    navigate(location.state?.from || "/dashboard");
  };

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back"
      subtitle="Sign in to your workspace"
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/signup" className="font-medium text-white underline-offset-4 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        {/* One-Click Dev Sign-In: strictly visible during local dev (vite dev); automatically hidden & stripped out in production builds on Vercel */}
        {import.meta.env.DEV && (
          <>
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-center">
              <p className="text-xs font-medium text-indigo-300">
                Sprint 1 Evaluation & Test Mode
              </p>
              <p className="mt-1 text-[11px] text-neutral-400">
                Sign in instantly with sample workspace data (no Supabase account needed):
              </p>
              <Button
                type="button"
                onClick={handleDevSignIn}
                className="mt-3 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2"
              >
                <Sparkles className="size-3.5" />
                One-Click Dev Sign In (Demo Mode)
              </Button>
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#09090e] px-2 text-neutral-500">Or sign in with email</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="field-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="field"
            />
          </div>

          <div>
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="field"
            />
          </div>

          {error && <Notice tone="error">{error}</Notice>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in…" : <>Sign in <ArrowRight /></>}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
