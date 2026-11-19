import { useState, useEffect } from "react";
import type { FormEvent, CSSProperties } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { requestApi } from "../lib/api";
import { Notice } from "../components/ui/notice";
import { DotMatrixBackground } from "../components/ui/dot-matrix-background";
import logoImg from "../assets/logo.png";

type AuthView = "login" | "forgot_email" | "link_sent" | "new_password" | "reset_success";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn } = useAuth();

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

    if (
      hash.includes("type=recovery") ||
      search.includes("type=recovery") ||
      pathname === "/reset-password" ||
      search.includes("flow=reset")
    ) {
      setView("new_password");
    }

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

      if (!backendDispatched) {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: redirectUrl,
        });

        if (resetErr) {
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

  /* ─── shared input styles matching 21st.dev component exactly ─── */
  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "0.65rem 0.85rem",
    borderRadius: 6,
    border: "1px solid #333",
    background: "#000000",
    backgroundColor: "#000000",
    color: "#ffffff",
    fontSize: "0.875rem",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: CSSProperties = {
    display: "block",
    fontSize: "0.75rem",
    color: "#888",
    marginBottom: "0.35rem",
    textAlign: "left",
  };

  const primaryBtn: CSSProperties = {
    width: "100%",
    padding: "0.65rem",
    borderRadius: 6,
    border: "none",
    background: "#ededed",
    color: "#000",
    fontWeight: 500,
    fontSize: "0.875rem",
    cursor: "pointer",
    boxSizing: "border-box",
  };


  const Logo = (
    <div
      style={{
        background: "#111",
        width: 44,
        height: 44,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "0.75rem",
        border: "1px solid #333",
        overflow: "hidden",
      }}
    >
      <img src={logoImg} alt="Action Pulse Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "#000",
        color: "#fff",
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      {/* WebGL Dot canvas background */}
      <DotMatrixBackground />

      {/* Modal card */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          background: "#121212",
          borderRadius: 12,
          padding: "2rem",
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 10px 40px rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          border: "1px solid #222",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 360,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {Logo}

          {/* ==================== 1. STANDARD LOGIN VIEW ==================== */}
          {view === "login" && (
            <>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 600, marginBottom: "0.25rem", letterSpacing: "-0.025em", color: "#fff" }}>
                Sign in to Action Pulse
              </h1>
              <p style={{ fontSize: "0.85rem", color: "#888", marginBottom: "0.85rem", lineHeight: 1.5 }}>
                Enter your email and password to access your workspace.
              </p>

              <form onSubmit={handleLoginSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {/* Work Email */}
                <div style={{ textAlign: "left", width: "100%" }}>
                  <label htmlFor="login-email" style={labelStyle}>Work Email</label>
                  <input
                    id="login-email"
                    className="auth-input"
                    style={inputStyle}
                    type="email"
                    placeholder="name@work-email.com"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {/* Password with Forgot password link */}
                <div style={{ textAlign: "left", width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                    <label htmlFor="login-password" style={{ fontSize: "0.75rem", color: "#888" }}>Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setSuccessMessage("");
                        setResetEmail(email);
                        setView("forgot_email");
                      }}
                      className="hover-whitish"
                      style={{ background: "none", border: "none", padding: 0, fontSize: "0.75rem", cursor: "pointer" }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div style={{ position: "relative", width: "100%" }}>
                    <input
                      id="login-password"
                      className="auth-input"
                      style={{ ...inputStyle, paddingRight: "2.5rem" }}
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "#888",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && <Notice tone="error">{error}</Notice>}
                {successMessage && <Notice tone="success">{successMessage}</Notice>}

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    ...primaryBtn,
                    cursor: loading ? "not-allowed" : "pointer",
                    marginTop: "0.25rem",
                    transition: "background 0.2s",
                  }}
                >
                  {loading ? "Signing in…" : "Sign In"}
                </button>
              </form>

              {/* Don't have an account link */}
              <div style={{ marginTop: "1.25rem", fontSize: "0.875rem", color: "#888" }}>
                Don&apos;t have an account?{" "}
                <Link to="/signup" className="hover-whitish-link" style={{ fontWeight: 500, textDecoration: "none", marginLeft: "0.25rem" }}>
                  Sign Up
                </Link>
              </div>


            </>
          )}

          {/* ==================== 2. FORGOT PASSWORD: REQUEST LINK ==================== */}
          {view === "forgot_email" && (
            <>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 600, marginBottom: "0.25rem", letterSpacing: "-0.025em", color: "#fff" }}>
                Reset your password
              </h1>
              <p style={{ fontSize: "0.85rem", color: "#888", marginBottom: "0.85rem", lineHeight: 1.5 }}>
                Enter your work email and we&apos;ll send you a reset link.
              </p>

              <form onSubmit={handleSendResetLink} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                <div style={{ textAlign: "left", width: "100%" }}>
                  <label htmlFor="reset-email" style={labelStyle}>Work Email</label>
                  <input
                    id="reset-email"
                    className="auth-input"
                    style={inputStyle}
                    type="email"
                    placeholder="name@work-email.com"
                    required
                    autoComplete="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    autoFocus
                  />
                </div>

                {error && <Notice tone="error">{error}</Notice>}
                {successMessage && <Notice tone="success">{successMessage}</Notice>}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    ...primaryBtn,
                    cursor: loading ? "not-allowed" : "pointer",
                    marginTop: "0.25rem",
                  }}
                >
                  {loading ? "Sending reset link…" : "Send Reset Link"}
                </button>

                <div style={{ marginTop: "0.75rem", textAlign: "center" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setSuccessMessage("");
                      setView("login");
                    }}
                    className="hover-whitish"
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontSize: "0.875rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <ArrowLeft size={14} /> Back to Sign In
                  </button>
                </div>
              </form>


            </>
          )}

          {/* ==================== 3. FORGOT PASSWORD: LINK SENT ==================== */}
          {view === "link_sent" && (
            <>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 600, marginBottom: "0.25rem", letterSpacing: "-0.025em", color: "#fff" }}>
                Reset link sent
              </h1>
              <p style={{ fontSize: "0.85rem", color: "#888", marginBottom: "0.85rem", lineHeight: 1.5 }}>
                We&apos;ve dispatched a recovery link to your email address.
              </p>

              <div
                style={{
                  width: "100%",
                  padding: "0.75rem 0.85rem",
                  borderRadius: 6,
                  border: "1px solid #333",
                  background: "#000",
                  textAlign: "left",
                  fontSize: "0.8rem",
                  color: "#ccc",
                  lineHeight: 1.5,
                  boxSizing: "border-box",
                }}
              >
                We&apos;ve sent a password reset link to <strong style={{ color: "#fff" }}>{resetEmail}</strong>. Click the link to choose a new password.
              </div>

              {error && <Notice tone="error">{error}</Notice>}
              {successMessage && <Notice tone="success">{successMessage}</Notice>}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", fontSize: "0.75rem", color: "#888", marginTop: "0.5rem" }}>
                <span>Didn&apos;t receive it?</span>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={() => handleSendResetLink()}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#fff",
                    cursor: resendCooldown > 0 ? "default" : "pointer",
                    opacity: resendCooldown > 0 ? 0.5 : 1,
                  }}
                >
                  {resendCooldown > 0 ? `Resend link in ${resendCooldown}s` : "Resend link"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setSuccessMessage("");
                  setView("login");
                }}
                style={{
                  ...primaryBtn,
                  background: "#222",
                  color: "#fff",
                  border: "1px solid #333",
                  marginTop: "0.75rem",
                }}
              >
                Back to Sign In
              </button>


            </>
          )}

          {/* ==================== 4. FORGOT PASSWORD: NEW PASSWORD ==================== */}
          {view === "new_password" && (
            <>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 600, marginBottom: "0.25rem", letterSpacing: "-0.025em", color: "#fff" }}>
                Create new password
              </h1>
              <p style={{ fontSize: "0.85rem", color: "#888", marginBottom: "0.85rem", lineHeight: 1.5 }}>
                Enter and confirm your new workspace password.
              </p>

              <form onSubmit={handleResetPasswordSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                <div style={{ textAlign: "left", width: "100%" }}>
                  <label htmlFor="new-password" style={labelStyle}>New Password</label>
                  <div style={{ position: "relative", width: "100%" }}>
                    <input
                      id="new-password"
                      className="auth-input"
                      style={{ ...inputStyle, paddingRight: "2.5rem" }}
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "#888",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ textAlign: "left", width: "100%" }}>
                  <label htmlFor="confirm-password" style={labelStyle}>Confirm New Password</label>
                  <div style={{ position: "relative", width: "100%" }}>
                    <input
                      id="confirm-password"
                      className="auth-input"
                      style={{ ...inputStyle, paddingRight: "2.5rem" }}
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter new password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "#888",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && <Notice tone="error">{error}</Notice>}
                {successMessage && <Notice tone="success">{successMessage}</Notice>}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    ...primaryBtn,
                    cursor: loading ? "not-allowed" : "pointer",
                    marginTop: "0.25rem",
                  }}
                >
                  {loading ? "Updating password…" : "Save New Password"}
                </button>
              </form>


            </>
          )}

          {/* ==================== 5. RESET SUCCESS ==================== */}
          {view === "reset_success" && (
            <>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 600, marginBottom: "0.25rem", letterSpacing: "-0.025em", color: "#fff" }}>
                Password reset complete
              </h1>
              <p style={{ fontSize: "0.85rem", color: "#888", marginBottom: "0.85rem", lineHeight: 1.5 }}>
                You can now sign in with your new workspace credentials.
              </p>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setSuccessMessage("Password updated! Sign in with your new credentials.");
                  setPassword("");
                  setView("login");
                }}
                style={{
                  ...primaryBtn,
                  marginTop: "0.85rem",
                }}
              >
                Sign In With New Password
              </button>


            </>
          )}
        </div>
      </div>
    </div>
  );
}
