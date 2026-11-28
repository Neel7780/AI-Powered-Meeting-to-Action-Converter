import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "../components/auth/AuthShell";
import { Notice } from "../components/ui/notice";
import { signupConfirmationPath, signupConfirmationUrl } from "../lib/authRedirects";
import { supabase } from "../lib/supabase";

export default function ConfirmSignup() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>(location.state?.email ?? "");
  const [checking, setChecking] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  const [resendError, setResendError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let active = true;

    async function completeConfirmation() {
      // The SDK reads the session from the email redirect during initialization.
      const { error } = await supabase.auth.initialize();
      if (error) throw error;
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (active && data.session) navigate("/dashboard", { replace: true });
    }

    void completeConfirmation()
      .catch(() => {
        if (!active) return;
        setConfirmationError("This confirmation link could not be used. Request a new email or sign in if you already confirmed your address.");
        navigate(signupConfirmationPath, { replace: true });
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => { active = false; };
  }, [navigate]);

  async function resendConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setResendError("");
    setSent(false);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: signupConfirmationUrl() },
      });
      if (error) throw error;
      setConfirmationError("");
      setSent(true);
    } catch (error) {
      setResendError(error instanceof Error ? error.message : "Unable to send a new confirmation email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthShell
      title="Confirm your email"
      footer={<Link to="/login" className="text-white underline">Go to sign in</Link>}
    >
      {checking ? (
        <p role="status" className="text-sm text-neutral-300">Checking confirmation…</p>
      ) : (
        <form onSubmit={resendConfirmation} className="space-y-3">
          {confirmationError && <Notice tone="error">{confirmationError}</Notice>}
          {resendError && <Notice tone="error">{resendError}</Notice>}
          {sent && <Notice tone="success">If this address is awaiting confirmation, check your inbox for a new link.</Notice>}
          <label htmlFor="confirmation-email" className="block text-sm text-neutral-300">Email address</label>
          <input
            id="confirmation-email"
            className="w-full rounded-md border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button type="submit" disabled={sending} className="w-full rounded-md bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-50">
            {sending ? "Sending…" : "Send a new confirmation email"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
