import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Notice } from '../components/ui/notice';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  githubApi, type AccessLevel, type GitHubAction, type GitHubGrant, type GitHubMember, type GitHubSettingsData,
} from '../services/githubApi';

const selectClass = 'h-10 w-full rounded-md border border-neutral-600 bg-neutral-950 px-3 text-sm text-white';

function MemberAccess({ member, grant, actions, appPermissions, busy, onSave }: {
  member: GitHubMember; grant?: GitHubGrant; actions: GitHubAction[]; appPermissions: Record<string, string>;
  busy: boolean; onSave: (level: AccessLevel, denied: string[]) => Promise<void>;
}) {
  const [level, setLevel] = useState<AccessLevel>(grant?.level ?? 'none');
  const [denied, setDenied] = useState<string[]>(grant?.denied_actions ?? []);
  const name = member.display_name || member.email || member.user_id;
  const changed = level !== (grant?.level ?? 'none')
    || JSON.stringify([...denied].sort()) !== JSON.stringify([...(grant?.denied_actions ?? [])].sort());

  return (
    <form className="space-y-3 rounded-lg bg-neutral-900 p-4" onSubmit={(event) => {
      event.preventDefault();
      void onSave(level, level === 'none' ? [] : denied);
    }}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium">{name}</p>
          <p className="text-xs capitalize text-neutral-300">{member.role}</p>
        </div>
        <div className="w-full sm:w-44">
          <label className="sr-only" htmlFor={`access-${member.user_id}`}>{name} repository access</label>
          <select id={`access-${member.user_id}`} className={selectClass} value={level} disabled={busy}
            onChange={(event) => setLevel(event.target.value as AccessLevel)}>
            <option value="none">No Access</option>
            <option value="read">Read Only</option>
            <option value="write">Read &amp; Write</option>
          </select>
        </div>
        <Button type="submit" variant="secondary" disabled={busy || !changed}>Save</Button>
      </div>
      <details>
        <summary className="cursor-pointer text-sm text-neutral-300">Advanced action restrictions</summary>
        <p className="mt-3 text-xs text-neutral-300">Restrictions only reduce access. Unavailable actions cannot be enabled.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {actions.map((action) => {
            const granted = appPermissions[action.permission];
            const available = action.implemented && level !== 'none'
              && (action.mode === 'read' ? ['read', 'write'].includes(granted) : level === 'write' && granted === 'write');
            return (
              <label key={action.id} className="flex items-start gap-2 text-sm text-neutral-300">
                <input type="checkbox" className="mt-1 size-4 accent-white" disabled={busy || !available}
                  checked={available && !denied.includes(action.id)} onChange={(event) => {
                    setDenied(event.target.checked ? denied.filter((id) => id !== action.id) : [...denied, action.id]);
                  }} />
                <span>{action.label}{!action.implemented ? ' — unavailable' : !available ? ' — no access' : ''}</span>
              </label>
            );
          })}
        </div>
      </details>
    </form>
  );
}

export default function GitHubSettings() {
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const location = useLocation();
  const workspaceId = currentWorkspace?.id;
  const [data, setData] = useState<GitHubSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<string>(() => location.state?.githubConnected
    ? `GitHub account ${location.state.githubConnected} verified. Select repositories to connect below.` : '');
  const [selected, setSelected] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!workspaceId) return Promise.resolve();
    return githubApi.settings(workspaceId).then((result) => {
      setData(result);
      setSelected((previous) => result.repositories.some((r) => r.repository_id === previous)
        ? previous : result.repositories.find((r) => r.connected)?.repository_id ?? result.repositories[0]?.repository_id ?? null);
    });
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceLoading) return;
    let active = true;
    void load().catch((err: unknown) => {
      if (active) setError(err instanceof Error ? err.message : 'Could not load GitHub settings.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, workspaceLoading]);

  const run = async (task: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(''); setSuccess('');
    try {
      await task();
      await load();
      if (message) setSuccess(message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'GitHub settings could not be updated.');
    } finally { setBusy(false); }
  };

  if (workspaceLoading || loading) return <p className="p-6 text-sm text-neutral-300" role="status">Loading GitHub settings…</p>;
  if (!workspaceId) return <p className="p-6 text-sm text-neutral-300">Select a workspace to view GitHub settings.</p>;
  const repository = data?.repositories.find((r) => r.repository_id === selected);
  const installation = data?.installations.find((i) => i.id === repository?.installation_id);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 text-white sm:p-6 lg:p-8" data-ui>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">GitHub settings</h1>
          <p className="mt-2 text-sm text-neutral-300">{currentWorkspace?.name} · Repository connections and member access</p>
        </div>
        {data?.can_manage && <Button disabled={busy || !data.configured} onClick={() => {
          void run(async () => { window.location.assign((await githubApi.connect(workspaceId)).url); }, '');
        }}>Connect GitHub</Button>}
      </header>
      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}
      {!data && <Button variant="secondary" disabled={busy} onClick={() => void run(load, 'Settings refreshed.')}>Retry</Button>}
      {data && !data.configured && <p className="text-sm text-neutral-300">GitHub App configuration is required on the server before connecting.</p>}

      {data?.can_manage && <section className="grid gap-5 lg:grid-cols-[minmax(200px,1fr)_2fr]" aria-labelledby="github-accounts">
        <div>
          <h2 id="github-accounts" className="text-base font-medium">Connected accounts</h2>
          <p className="mt-2 text-sm text-neutral-300">GitHub is an external integration. Your sign-in stays the same.</p>
          <p className="mt-3 text-sm text-neutral-300">To change GitHub’s selected repositories, use Manage on GitHub, then Connect GitHub again to verify new repositories.</p>
        </div>
        <div className="space-y-3">
          {!data.installations.length && <p className="rounded-lg bg-neutral-900 p-5 text-sm text-neutral-300">No GitHub accounts connected. Connect an account or organization to choose repositories.</p>}
          {data.installations.map((account) => (
            <div key={account.id} className="space-y-3 rounded-lg bg-neutral-900 p-4">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <h3 className="font-medium">{account.account_login} <span className="text-neutral-300">· {account.account_type}</span></h3>
                <span className={account.status === 'active' ? 'text-emerald-300' : 'text-amber-300'}>{account.status}</span>
              </div>
              <p className="text-xs text-neutral-300">App permissions: {Object.entries(account.permissions).map(([name, value]) => `${name}: ${value}`).join(', ') || 'None'}</p>
              <p className="text-xs text-neutral-300">Last checked {new Date(account.observed_at).toLocaleString()}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <Button variant="secondary" disabled={busy || !data.configured} onClick={() => void run(
                  () => githubApi.sync(workspaceId, account.id), 'GitHub access synchronized.',
                )}>Sync access</Button>
                <a className="underline" href={account.account_type === 'Organization'
                  ? `https://github.com/organizations/${encodeURIComponent(account.account_login)}/settings/installations/${account.id}`
                  : `https://github.com/settings/installations/${account.id}`} target="_blank" rel="noreferrer">Manage on GitHub</a>
                <Button variant="ghost" className="text-red-300" disabled={busy} onClick={() => {
                  if (window.confirm(`Disconnect ${account.account_login} from ${currentWorkspace?.name}? All repository mappings and member grants in this workspace will be removed.`)) {
                    void run(() => githubApi.disconnect(workspaceId, account.id), 'Account disconnected from this workspace.');
                  }
                }}>Disconnect account</Button>
              </div>
            </div>
          ))}
          <p className="text-xs text-neutral-300">Disconnect affects only this workspace. Uninstalling on GitHub removes access for every connected workspace.</p>
        </div>
      </section>}

      {data && <section className="grid gap-5 lg:grid-cols-[minmax(200px,1fr)_2fr]" aria-labelledby="github-repositories">
        <div>
          <h2 id="github-repositories" className="text-base font-medium">Repositories</h2>
          <p className="mt-2 text-sm text-neutral-300">{data.can_manage ? 'Only repositories verified with GitHub administrator access appear here. Connecting a repository grants no member access.' : 'Your administrator chooses which repositories you can access.'}</p>
        </div>
        <div className="space-y-3">
          {!data.repositories.length && <p className="rounded-lg bg-neutral-900 p-5 text-sm text-neutral-300">{data.can_manage ? 'No verified repositories. Connect GitHub to select repositories you administer.' : 'No repositories shared with you yet.'}</p>}
          {data.repositories.map((repo) => (
            <div key={repo.repository_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-neutral-900 p-4">
              <div className="min-w-0">
                <p className="break-all text-sm font-medium">{repo.full_name}</p>
                <p className="mt-1 text-xs text-neutral-300">{repo.private ? 'Private' : 'Public'} · {repo.connected ? 'Connected' : 'Not connected'}</p>
              </div>
              {data.can_manage ? <Button variant="secondary" disabled={busy || (!repo.connected && !data.configured)} onClick={() => {
                if (!repo.connected || window.confirm(`Disconnect ${repo.full_name}? Its member permissions will be removed from this workspace.`)) {
                  void run(() => githubApi.map(workspaceId, repo.repository_id, !repo.connected), repo.connected
                    ? 'Repository disconnected. Member access removed.' : 'Repository connected. Assign member access below.');
                }
              }}>{repo.connected ? 'Disconnect' : 'Connect repository'}</Button> : <Button variant="secondary" disabled={busy} onClick={() => void run(async () => {
                const details = await githubApi.details(workspaceId, repo.repository_id);
                setSuccess(`${details.full_name} · Default branch: ${details.default_branch}`);
              }, '')}>View details</Button>}
            </div>
          ))}
        </div>
      </section>}

      {data?.can_manage && <section className="grid gap-5 lg:grid-cols-[minmax(200px,1fr)_2fr]" aria-labelledby="github-members">
        <div>
          <h2 id="github-members" className="text-base font-medium">Member access</h2>
          <p className="mt-2 text-sm text-neutral-300">Everyone starts with No Access, including admins. Choose a repository, then save each member’s permissions.</p>
          <p className="mt-3 text-sm text-neutral-300">Repository details are available now. Issue, branch, and pull-request actions remain unavailable; Read &amp; Write cannot enable them.</p>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-medium" htmlFor="github-repository">Repository</label>
          <select id="github-repository" className={selectClass} value={selected ?? ''} disabled={busy || !data.repositories.length}
            onChange={(event) => setSelected(Number(event.target.value))}>
            {!data.repositories.length && <option value="">No repositories</option>}
            {data.repositories.map((repo) => <option key={repo.repository_id} value={repo.repository_id}>{repo.full_name}{!repo.connected ? ' (not connected)' : ''}</option>)}
          </select>
          {!repository?.connected || installation?.status !== 'active' ? <p className="text-sm text-neutral-300">Connect an active repository before granting access.</p>
            : data.members.map((member) => {
              const grant = data.grants.find((g) => g.repository_id === selected && g.user_id === member.user_id);
              return <MemberAccess key={`${selected}-${member.user_id}-${grant?.level}-${grant?.denied_actions.join(',')}`}
                member={member} grant={grant} actions={data.actions} appPermissions={installation.permissions} busy={busy}
                onSave={(level, denied) => run(() => githubApi.access(workspaceId, repository.repository_id, member.user_id, level, denied), 'Member access saved.')} />;
            })}
        </div>
      </section>}
    </div>
  );
}
