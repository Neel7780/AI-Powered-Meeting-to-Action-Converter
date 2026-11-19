import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Notice } from '../components/ui/notice';
import { useWorkspace } from '../context/WorkspaceContext';
import { githubApi, type GitHubDiscovery } from '../services/githubApi';

export default function GitHubCallback() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const [message, setMessage] = useState('Verifying your GitHub connection…');
  const [failed, setFailed] = useState(false);
  const [discovery, setDiscovery] = useState<GitHubDiscovery | null>(null);
  const [busy, setBusy] = useState(false);
  const [choiceError, setChoiceError] = useState('');
  const started = useRef(false);
  const navigate = useNavigate();
  const { workspaces, refreshWorkspaces } = useWorkspace();

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
        if ('installations' in result) {
          setDiscovery(result);
          return;
        }
        localStorage.setItem('currentWorkspaceId', result.workspace_id);
        await refreshWorkspaces();
        navigate('/settings/github', { replace: true, state: { githubConnected: result.account } });
      } else {
        const installation = Number(params.get('installation_id'));
        if (!Number.isSafeInteger(installation) || installation <= 0) {
          throw new Error('Missing installation. Start Connect GitHub again from Settings.');
        }
        const result = await githubApi.installCallback(state, installation);
        window.location.replace(result.url);
      }
    };
    void complete().catch((error: unknown) => {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : 'Could not connect GitHub. Please try again.');
    });
  }, [params, navigate, refreshWorkspaces]);

  const continueOnGitHub = async (getRedirect: () => Promise<{ url: string }>) => {
    setBusy(true);
    setChoiceError('');
    try {
      window.location.replace((await getRedirect()).url);
    } catch (error: unknown) {
      setChoiceError(error instanceof Error ? error.message : 'Could not continue to GitHub. Try again.');
      setBusy(false);
    }
  };

  if (discovery) {
    const workspaceId = discovery.workspace_id;
    const workspaceName = workspaces.find((workspace) => workspace.id === workspaceId)?.name;
    return (
      <main className="app-canvas flex min-h-screen items-center justify-center p-6 text-white">
        <section className="w-full max-w-lg space-y-5 rounded-lg bg-neutral-900 p-6" aria-labelledby="github-installations">
          <div>
            <h1 id="github-installations" className="text-xl font-medium">Connect GitHub{workspaceName ? ` to ${workspaceName}` : ''}</h1>
            <p className="mt-2 text-sm text-neutral-300">Authorized as <strong>@{discovery.github_login}</strong>.</p>
          </div>
          {choiceError && <Notice tone="error">{choiceError}</Notice>}
          {discovery.installations.length > 0 ? (
            <ul className="space-y-2" aria-label="Available GitHub installations">
              {discovery.installations.map((installation) => (
                <li key={installation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-700 p-3">
                  <span className="text-sm">{installation.account_login} <span className="text-neutral-300">· {installation.account_type === 'User' ? 'Personal account' : installation.account_type}</span></span>
                  <Button type="button" variant="secondary" disabled={busy} aria-label={`Connect ${installation.account_login}`}
                    onClick={() => void continueOnGitHub(() => githubApi.connectExisting(workspaceId, installation.id))}>
                    Connect
                  </Button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-neutral-300">This GitHub account has no available installations. Install the app or switch GitHub accounts.</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy}
              onClick={() => void continueOnGitHub(() => githubApi.connect(workspaceId))}>
              {discovery.installations.length ? 'Install for another account or organization' : 'Install GitHub App'}
            </Button>
            <Button type="button" variant="ghost" disabled={busy}
              onClick={() => void continueOnGitHub(() => githubApi.discover(workspaceId))}>
              Switch GitHub account
            </Button>
          </div>
          <Link className="inline-block text-sm underline" to="/settings/github">Back to GitHub settings</Link>
        </section>
      </main>
    );
  }

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
