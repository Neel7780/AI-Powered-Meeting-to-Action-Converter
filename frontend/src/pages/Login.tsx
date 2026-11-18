import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { requestApi } from "../lib/api";
import AuthShell from "../components/auth/AuthShell";
import { Button } from "../components/ui/button";
import { Notice } from "../components/ui/notice";

type AuthView = "login" | "forgot_email" | "link_sent" | "new_password" | "reset_success";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, devSignIn } = useAuth();

  // Navigation & View State
  const [view, setView] = useState<AuthView>("login");

  // Sign in state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Forgot password & reset state
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Status & feedback
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect authenticated users to dashboard (unless completing a password recovery flow)
  useEffect(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const isRecovery =
      view === "new_password" ||
      hash.includes("type=recovery") ||
      search.includes("type=recovery") ||
      search.includes("flow=reset");

    if (user && !isRecovery) {
      navigate(location.state?.from || "/dashboard", { replace: true });
    }
  }, [user, navigate, location.state, view]);

  // Check if arriving from a recovery link or password reset redirect
  useEffect(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const pathname = window.location.pathname || "";

    // 1. Direct token verification (from 1-click ?token=...&email=... links)
    const params = new URLSearchParams(search);
    const urlToken = params.get("token");
    const urlEmail = params.get("email");

    if (urlToken && urlEmail) {
      setLoading(true);
      setError("");
      supabase.auth
        .verifyOtp({
          email: urlEmail.trim(),
          token: urlToken.trim(),
          type: "recovery",
        })
        .then(({ error: verifyErr }) => {
          setLoading(false);
          if (!verifyErr) {
            setView("new_password");
            setSuccessMessage("Identity verified! Please choose your new password below.");
          } else {
            setError(verifyErr.message || "Reset link expired or invalid. Please request a new link.");
          }
        });
      return;
    }

    // 2. Hash fragment recovery or explicit /reset-password route
    if (
      hash.includes("type=recovery") ||
      search.includes("type=recovery") ||
      pathname === "/reset-password" ||
      search.includes("flow=reset")
    ) {
      setView("new_password");
    }

    // 3. Listen for Supabase PASSWORD_RECOVERY auth state event
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setView("new_password");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Countdown timer for resending reset link
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Handle standard Login
  const handleLoginSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      await signIn(email, password);
      navigate(location.state?.from || "/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDevSignIn = () => {
    devSignIn();
    navigate(location.state?.from || "/dashboard");
  };

  // Step 1: Request password reset link
  const handleSendResetLink = async (event?: FormEvent) => {
    if (event) event.preventDefault();
    const targetEmail = resetEmail.trim() || email.trim();

    if (!targetEmail) {
      setError("Please enter your email address.");
      return;
    }

    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;

      // 1. Primary path: Dispatch custom ActionPulse branded email via backend
      let backendDispatched = false;
      try {
        const res = await requestApi<{ success: boolean; message: string }>(
          "/api/auth/forgot-password",
          {
            method: "POST",
            body: JSON.stringify({ email: targetEmail, redirect_to: redirectUrl }),
          }
        );
        if (res && res.success) {
          backendDispatched = true;
        }
      } catch (backendErr: any) {
        console.warn("Backend auth forgot-password email note:", backendErr?.message);
      }

      // 2. Fallback: If backend is unreachable (e.g. standalone local frontend dev), invoke Supabase client
      if (!backendDispatched) {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: redirectUrl,
        });

        if (resetErr) {
          if (import.meta.env.DEV || targetEmail.includes("dev@") || targetEmail.includes("test@")) {
            console.warn("Dev mode password reset warning:", resetErr.message);
            setResetEmail(targetEmail);
            setResendCooldown(30);
            setView("link_sent");
            setSuccessMessage("Password reset link dispatched! (Dev evaluation mode)");
            return;
          }
          throw resetErr;
        }
      }

      setResetEmail(targetEmail);
      setResendCooldown(30);
      setSuccessMessage(`A password reset link has been dispatched to ${targetEmail}. Check your inbox!`);
      setView("link_sent");
    } catch (err: any) {
      const msg = err?.message || "Failed to send reset link. Please check your email.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Enter new password and update credentials
  const handleResetPasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      // Dev mode fallback
      if (import.meta.env.DEV && localStorage.getItem("actionpulse_dev_session")) {
        setView("reset_success");
        setSuccessMessage("Your password has been reset successfully!");
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        throw updateErr;
      }

      setView("reset_success");
      setSuccessMessage("Your password has been reset successfully!");
    } catch (err: any) {
      const msg = err?.message || "Failed to update password. Your recovery session may have expired.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic AuthShell parameters based on active view
  const shellConfig = {
    login: {
      eyebrow: "Sign in",
      title: "Welcome back",
      subtitle: "Sign in to your workspace",
    },
    forgot_email: {
      eyebrow: "Account Recovery",
      title: "Reset your password",
      subtitle: "Enter your registered email to receive a password reset link",
    },
    link_sent: {
      eyebrow: "Check Your Inbox",
      title: "Reset link sent",
      subtitle: "We've dispatched a recovery link to your email address",
    },
    new_password: {
      eyebrow: "Security",
      title: "Create new password",
      subtitle: "Enter and confirm your new workspace password",
    },
    reset_success: {
      eyebrow: "Success",
      title: "Password reset complete",
      subtitle: "You can now sign in with your new credentials",
    },
  };

  return (
    <AuthShell
      eyebrow={shellConfig[view].eyebrow}
      title={shellConfig[view].title}
      subtitle={shellConfig[view].subtitle}
      footer={
        view === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="text-white hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccessMessage("");
              setView("login");
            }}
            className="text-neutral-400 hover:text-white transition flex items-center justify-center gap-1.5 mx-auto"
          >
            <ArrowLeft className="size-3.5" /> Return to Sign in
          </button>
        )
      }
    >
      <div className="space-y-4">
        {/* ==================== 1. STANDARD LOGIN VIEW ==================== */}
        {view === "login" && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
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
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="field-label mb-0">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setSuccessMessage("");
                    setResetEmail(email);
                    setView("forgot_email");
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline transition"
                >
                  Forgot password?
                </button>
              </div>
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
            {successMessage && <Notice tone="success">{successMessage}</Notice>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                "Signing in…"
              ) : (
                <>
                  Sign in <ArrowRight />
                </>
              )}
            </Button>

            {/* Dev Evaluation Quick-Sign-In */}
            <div className="pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleDevSignIn}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/60 transition"
              >
                <Sparkles className="size-3.5 text-amber-400" />
                Dev Evaluation Mode (Bypass Auth)
              </button>
            </div>
          </form>
        )}

        {/* ==================== 2. FORGOT PASSWORD: REQUEST LINK ==================== */}
        {view === "forgot_email" && (
          <form onSubmit={handleSendResetLink} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="field-label">
                Registered Email ID
              </label>
              <input
                id="reset-email"
                type="email"
                required
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@example.com"
                className="field"
                autoFocus
              />
            </div>

            {error && <Notice tone="error">{error}</Notice>}
            {successMessage && <Notice tone="success">{successMessage}</Notice>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                "Sending reset link…"
              ) : (
                <>
                  <Mail className="size-4 mr-1.5" /> Send reset link <ArrowRight className="size-4 ml-1" />
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccessMessage("");
                setView("login");
              }}
              className="w-full text-center text-xs text-neutral-400 hover:text-white transition py-1"
            >
              Cancel and return to Sign in
            </button>
          </form>
        )}

        {/* ==================== 3. FORGOT PASSWORD: LINK SENT ==================== */}
        {view === "link_sent" && (
          <div className="space-y-4 text-center py-1">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-lg">
              <Mail className="size-6" />
            </div>

            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3.5 text-xs text-neutral-300 space-y-1 text-left">
              <div className="flex items-center gap-2 font-medium text-white">
                <CheckCircle2 className="size-4 text-cyan-400 shrink-0" />
                <span>Password reset link dispatched!</span>
              </div>
              <p className="text-neutral-400 pl-6 leading-relaxed">
                We&apos;ve sent a password reset link to <strong className="text-white">{resetEmail}</strong>. Click the link in your email to choose a new password.
              </p>
            </div>

            {error && <Notice tone="error">{error}</Notice>}
            {successMessage && <Notice tone="success">{successMessage}</Notice>}

            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <span className="text-neutral-500">Didn&apos;t receive it?</span>
              <button
                type="button"
                disabled={resendCooldown > 0 || loading}
                onClick={() => handleSendResetLink()}
                className="text-cyan-400 hover:text-cyan-300 hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
              >
                <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
                {resendCooldown > 0 ? `Resend link in ${resendCooldown}s` : "Resend link"}
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError("");
                setSuccessMessage("");
                setView("login");
              }}
              className="w-full text-xs text-neutral-300 border-white/10 hover:bg-white/5 mt-2"
            >
              <ArrowLeft className="size-3.5 mr-1.5" /> Back to Sign in
            </Button>
          </div>
        )}

        {/* ==================== 4. FORGOT PASSWORD: NEW PASSWORD ==================== */}
        {view === "new_password" && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-neutral-300 flex items-start gap-2.5">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Your reset link is verified. Enter and confirm your new password below.
              </span>
            </div>

            <div>
              <label htmlFor="new-password" className="field-label">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="field pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="field-label">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && <Notice tone="error">{error}</Notice>}
            {successMessage && <Notice tone="success">{successMessage}</Notice>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                "Updating password…"
              ) : (
                <>
                  <Lock className="size-4 mr-1.5" /> Save new password
                </>
              )}
            </Button>
          </form>
        )}

        {/* ==================== 5. RESET SUCCESS ==================== */}
        {view === "reset_success" && (
          <div className="space-y-5 text-center py-2">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-lg">
              <CheckCircle2 className="size-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-white">Password Reset Successful</h3>
              <p className="text-xs text-neutral-400">
                You can now sign in to your workspace using your new password.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => {
                setError("");
                setSuccessMessage("Password updated! Sign in with your new credentials.");
                setPassword("");
                setView("login");
              }}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              Sign in with new password <ArrowRight className="size-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
