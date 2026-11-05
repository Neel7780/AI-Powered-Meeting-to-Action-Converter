import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { githubApi } from '../services/githubApi';

export default function GitHubCallback() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const [message, setMessage] = useState('Verifying your GitHub connection…');
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const navigate = useNavigate();
  const { refreshWorkspaces } = useWorkspace();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    const complete = async () => {
      const state = params.get('state');
      if (params.has('error') || params.get('setup_action') === 'request') {
        throw new Error('GitHub connection was cancelled or needs organization approval. Connect again after approval.');
      }
      if (!state) throw new Error('This connection link is incomplete. Start Connect GitHub again from Settings.');
      const code = params.get('code');
      if (code) {
        const result = await githubApi.callback(state, code);
        localStorage.setItem('currentWorkspaceId', result.workspace_id);
        await refreshWorkspaces();
        navigate('/settings/github', { replace: true, state: { githubConnected: result.account } });
      } else {
        const installation = Number(params.get('installation_id'));
        if (!Number.isSafeInteger(installation) || installation <= 0) {
          throw new Error('Missing installation. Start Connect GitHub again from Settings.');
        }
        const result = await githubApi.installCallback(state, installation);
        window.location.assign(result.url);
      }
    };
    void complete().catch((error: unknown) => {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : 'Could not connect GitHub. Please try again.');
    });
  }, [params, navigate, refreshWorkspaces]);

  return (
    <main className="app-canvas flex min-h-screen items-center justify-center p-6 text-white">
      <div className="max-w-md space-y-4 rounded-lg bg-neutral-900 p-8">
        <h1 className="text-xl font-medium">{failed ? 'GitHub connection interrupted' : 'Connecting GitHub'}</h1>
        <p role={failed ? 'alert' : 'status'} className="text-sm text-neutral-300">{message}</p>
        {failed && <Link className="inline-block text-sm underline" to="/settings/github">Back to Workspace Settings</Link>}
      </div>
    </main>
  );
}
