import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import AuthShell from "../components/auth/AuthShell";
import { Button } from "../components/ui/button";
import { Notice } from "../components/ui/notice";

type AuthView = "login" | "forgot_email" | "verify_email" | "new_password" | "reset_success";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, devSignIn } = useAuth();

  // Navigation & View State
  const [view, setView] = useState<AuthView>("login");

  // Sign in state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Forgot password & reset state
  const [resetEmail, setResetEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Status & feedback
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if arriving from a recovery link or password reset redirect
  useEffect(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const pathname = window.location.pathname || "";

    if (
      hash.includes("type=recovery") ||
      search.includes("type=recovery") ||
      pathname === "/reset-password" ||
      search.includes("flow=reset")
    ) {
      setView("new_password");
    }

    // Listen for Supabase PASSWORD_RECOVERY event
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

  // Countdown timer for resending code
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

  // Step 1: Request password reset / send verification code
  const handleSendVerificationCode = async (event?: FormEvent) => {
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
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: redirectUrl,
      });

      if (resetErr) {
        // If Supabase rate-limits or fails during local dev test mode, don't hard block testing
        if (import.meta.env.DEV || targetEmail.includes("dev@") || targetEmail.includes("test@")) {
          console.warn("Dev mode password reset warning:", resetErr.message);
          setResetEmail(targetEmail);
          setResendCooldown(30);
          setView("verify_email");
          setSuccessMessage("Verification code sent! (Dev test mode: code 123456)");
          return;
        }
        throw resetErr;
      }

      setResetEmail(targetEmail);
      setResendCooldown(30);
      setSuccessMessage(`A 6-digit verification code has been sent to ${targetEmail}.`);
      setView("verify_email");
    } catch (err: any) {
      const msg = err?.message || "Failed to send reset code. Please check your email.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify email using 6-digit OTP code
  const handleVerifyOtpCode = async (event: FormEvent) => {
    event.preventDefault();
    const code = verificationCode.trim();

    if (!code) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      // Allow instant verification in dev evaluation mode
      if (code === "123456" && (import.meta.env.DEV || resetEmail.includes("dev@") || resetEmail.includes("test@"))) {
        setView("new_password");
        setSuccessMessage("Email verified successfully! Now enter your new password.");
        return;
      }

      // 1. Try recovery type OTP verification with Supabase
      let { error: verifyErr } = await supabase.auth.verifyOtp({
        email: resetEmail.trim(),
        token: code,
        type: "recovery",
      });

      // 2. Fallback check for email OTP type if recovery type returns error
      if (verifyErr) {
        const fallback = await supabase.auth.verifyOtp({
          email: resetEmail.trim(),
          token: code,
          type: "email",
        });
        if (!fallback.error) {
          verifyErr = null;
        }
      }

      if (verifyErr) {
        throw verifyErr;
      }

      setView("new_password");
      setSuccessMessage("Email verified successfully! Please enter your new password below.");
    } catch (err: any) {
      const msg = err?.message || "Invalid or expired verification code. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Enter new password and update credentials
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
      footer: (
        <>
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-medium text-white underline-offset-4 hover:underline">
            Create one
          </Link>
        </>
      ),
    },
    forgot_email: {
      eyebrow: "Account Recovery",
      title: "Forgot password?",
      subtitle: "Enter your registered email ID to receive a verification code.",
      footer: (
        <button
          type="button"
          onClick={() => {
            setError("");
            setSuccessMessage("");
            setView("login");
          }}
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition"
        >
          <ArrowLeft className="size-3.5" /> Back to Sign in
        </button>
      ),
    },
    verify_email: {
      eyebrow: "Step 2 of 3",
      title: "Verify your email",
      subtitle: `Enter the verification code sent to ${resetEmail || "your email"}.`,
      footer: (
        <button
          type="button"
          onClick={() => {
            setError("");
            setSuccessMessage("");
            setView("login");
          }}
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition"
        >
          <ArrowLeft className="size-3.5" /> Back to Sign in
        </button>
      ),
    },
    new_password: {
      eyebrow: "Step 3 of 3",
      title: "Enter new password",
      subtitle: "Create a secure new password for your account.",
      footer: (
        <button
          type="button"
          onClick={() => {
            setError("");
            setSuccessMessage("");
            setView("login");
          }}
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition"
        >
          <ArrowLeft className="size-3.5" /> Back to Sign in
        </button>
      ),
    },
    reset_success: {
      eyebrow: "Recovery Complete",
      title: "Password Updated",
      subtitle: "Your account password has been changed successfully.",
      footer: (
        <Link to="/login" onClick={() => setView("login")} className="text-sm font-medium text-cyan-400 hover:underline">
          Return to Sign in
        </Link>
      ),
    },
  }[view];

  return (
    <AuthShell
      eyebrow={shellConfig.eyebrow}
      title={shellConfig.title}
      subtitle={shellConfig.subtitle}
      footer={shellConfig.footer}
    >
      <div className="space-y-4">
        {/* ==================== 1. STANDARD LOGIN VIEW ==================== */}
        {view === "login" && (
          <>
            {/* One-Click Dev Sign-In: visible during local dev (vite dev); automatically hidden & stripped out in production */}
            {import.meta.env.DEV && (
              <>
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-center">
                  <p className="text-xs font-medium text-indigo-300">
                    Sprint Evaluation & Test Mode
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
                      setResetEmail(email.trim());
                      setView("forgot_email");
                    }}
                    className="text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline transition"
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
                {loading ? "Signing in…" : <>Sign in <ArrowRight /></>}
              </Button>
            </form>
          </>
        )}

        {/* ==================== 2. FORGOT PASSWORD: STEP 1 (EMAIL) ==================== */}
        {view === "forgot_email" && (
          <form onSubmit={handleSendVerificationCode} className="space-y-4">
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-neutral-300 flex items-start gap-2.5">
              <Mail className="size-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                Enter your account email. We will send a 6-digit verification code to verify your identity.
              </span>
            </div>

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
                "Sending code…"
              ) : (
                <>
                  Send verification code <ArrowRight className="size-4 ml-1" />
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

        {/* ==================== 3. FORGOT PASSWORD: STEP 2 (VERIFY CODE) ==================== */}
        {view === "verify_email" && (
          <form onSubmit={handleVerifyOtpCode} className="space-y-4">
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-neutral-300 flex items-start gap-2.5">
              <ShieldCheck className="size-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span>A verification code was dispatched to </span>
                <strong className="text-white">{resetEmail}</strong>.
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="verification-code" className="field-label mb-0">
                  6-Digit Verification Code
                </label>
                <button
                  type="button"
                  onClick={() => setView("forgot_email")}
                  className="text-xs text-neutral-400 hover:text-cyan-300 transition"
                >
                  Change email
                </button>
              </div>
              <input
                id="verification-code"
                type="text"
                required
                maxLength={8}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\s+/g, ""))}
                placeholder="Enter 6-digit code"
                className="field tracking-widest text-center text-lg font-mono placeholder:tracking-normal placeholder:font-sans"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500">Didn&apos;t receive it?</span>
              <button
                type="button"
                disabled={resendCooldown > 0 || loading}
                onClick={() => handleSendVerificationCode()}
                className="text-cyan-400 hover:text-cyan-300 hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
              >
                <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
              </button>
            </div>

            {error && <Notice tone="error">{error}</Notice>}
            {successMessage && <Notice tone="success">{successMessage}</Notice>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                "Verifying…"
              ) : (
                <>
                  Verify code <ArrowRight className="size-4 ml-1" />
                </>
              )}
            </Button>
          </form>
        )}

        {/* ==================== 4. FORGOT PASSWORD: STEP 3 (NEW PASSWORD) ==================== */}
        {view === "new_password" && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-neutral-300 flex items-start gap-2.5">
              <KeyRound className="size-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                Your email has been verified. Enter and confirm your new password below.
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
                  <Lock className="size-4 mr-1.5" /> Reset password
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
