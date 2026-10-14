import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useWorkspace } from "../context/WorkspaceContext";
import AuthShell from "../components/auth/AuthShell";
import { Button } from "../components/ui/button";
import { Notice } from "../components/ui/notice";

/** Landing page for the emailed /invite/{token} link: joins the workspace via the accept_invite RPC. */
export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { refreshWorkspaces } = useWorkspace();
  const [error, setError] = useState("");
  const started = useRef(false); // StrictMode runs effects twice; the token is single-use

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    supabase.rpc("accept_invite", { p_token: token }).then(async ({ error }) => {
      if (error) return setError(error.message);
      await refreshWorkspaces();
      navigate("/dashboard", { replace: true });
    });
  }, [token, navigate, refreshWorkspaces]);

  return (
    <AuthShell eyebrow="Workspace invite" title={error ? "Invite not accepted" : "Joining workspace"}>
      {error ? (
        <div className="space-y-4">
          <Notice tone="error">{error}</Notice>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-3 text-sm text-neutral-400">
          <LoaderCircle className="size-4 animate-spin" />
          Accepting your invite…
        </p>
      )}
    </AuthShell>
  );
}
