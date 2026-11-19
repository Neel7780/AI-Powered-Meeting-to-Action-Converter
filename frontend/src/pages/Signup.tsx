import { useEffect, useState } from "react";
import type { FormEvent, CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Notice } from "../components/ui/notice";
import { DotMatrixBackground } from "../components/ui/dot-matrix-background";
import Brand from "../components/layout/Brand";
import logoImg from "../assets/logo.png";

export default function Signup() {
  const navigate = useNavigate();
  const { user, signUp } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, displayName);
      setSuccess("Account created successfully. Check your email if verification is required.");

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create account";
      setError(message);
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
      {/* Top-left brand icon linking to dashboard */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10">
        <Brand to="/dashboard" />
      </div>

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
          <h1 style={{ fontSize: "1.35rem", fontWeight: 600, marginBottom: "0.25rem", letterSpacing: "-0.025em", color: "#fff" }}>
            Create your Action Pulse account
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#888", marginBottom: "0.85rem", lineHeight: 1.5 }}>
            Set up your workspace credentials to get started.
          </p>

          <form onSubmit={handleSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {/* Full Name */}
            <div style={{ textAlign: "left", width: "100%" }}>
              <label htmlFor="signup-name" style={labelStyle}>Full Name</label>
              <input
                id="signup-name"
                className="auth-input"
                style={inputStyle}
                type="text"
                placeholder="Alex Morgan"
                required
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            {/* Work Email */}
            <div style={{ textAlign: "left", width: "100%" }}>
              <label htmlFor="signup-email" style={labelStyle}>Work Email</label>
              <input
                id="signup-email"
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

            {/* Password */}
            <div style={{ textAlign: "left", width: "100%" }}>
              <label htmlFor="signup-password" style={labelStyle}>Password</label>
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  id="signup-password"
                  className="auth-input"
                  style={{ ...inputStyle, paddingRight: "2.5rem" }}
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  required
                  autoComplete="new-password"
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
            {success && <Notice tone="success">{success}</Notice>}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.65rem",
                borderRadius: 6,
                border: "none",
                background: "#ededed",
                color: "#000",
                fontWeight: 500,
                fontSize: "0.875rem",
                cursor: loading ? "not-allowed" : "pointer",
                marginTop: "0.25rem",
                transition: "background 0.2s",
              }}
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <div style={{ marginTop: "1.25rem", fontSize: "0.875rem", color: "#888" }}>
            Already have an account?{" "}
            <Link to="/login" className="hover-whitish-link" style={{ fontWeight: 500, textDecoration: "none", marginLeft: "0.25rem" }}>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
