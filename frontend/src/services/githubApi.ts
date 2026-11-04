import { requestApi } from '../lib/api';

export type AccessLevel = 'none' | 'read' | 'write';
export interface GitHubInstallation {
  id: number;
  account_login: string;
  account_type: string;
  status: 'active' | 'suspended' | 'deleted';
  permissions: Record<string, string>;
  observed_at: string;
}
export interface GitHubRepository {
  repository_id: number;
  installation_id: number;
  full_name: string;
  private: boolean;
  connected: boolean;
}
export interface GitHubGrant {
  repository_id: number;
  user_id: string;
  level: AccessLevel;
  denied_actions: string[];
}
export interface GitHubMember {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string;
}
export interface GitHubAction {
  id: string;
  label: string;
  implemented: boolean;
  permission: string;
  mode: string;
}
export interface GitHubSettingsData {
  configured: boolean;
  can_manage: boolean;
  installations: GitHubInstallation[];
  repositories: GitHubRepository[];
  grants: GitHubGrant[];
  members: GitHubMember[];
  actions: GitHubAction[];
}

const base = (workspace: string) => `/api/workspaces/${workspace}/github`;
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

export const githubApi = {
  settings: (workspace: string) => requestApi<GitHubSettingsData>(base(workspace)),
  connect: (workspace: string) => requestApi<{ url: string }>(`${base(workspace)}/connect`, { method: 'POST' }),
  installCallback: (state: string, installation_id: number) => requestApi<{ url: string }>(
    '/api/github/install-callback', json('POST', { state, installation_id }),
  ),
  callback: (state: string, code: string) => requestApi<{ workspace_id: string; account: string }>(
    '/api/github/callback', json('POST', { state, code }),
  ),
  map: (workspace: string, repo: number, connected: boolean) => requestApi(
    `${base(workspace)}/repositories/${repo}`, json('PATCH', { connected }),
  ),
  access: (workspace: string, repo: number, member: string, level: AccessLevel, denied_actions: string[]) => requestApi(
    `${base(workspace)}/repositories/${repo}/members/${member}`, json('PUT', { level, denied_actions }),
  ),
  sync: (workspace: string, installation: number) => requestApi(
    `${base(workspace)}/installations/${installation}/sync`, { method: 'POST' },
  ),
  disconnect: (workspace: string, installation: number) => requestApi(
    `${base(workspace)}/installations/${installation}`, { method: 'DELETE' },
  ),
  details: (workspace: string, repo: number) => requestApi<{ full_name: string; default_branch: string }>(
    `${base(workspace)}/repositories/${repo}/details`,
  ),
};
