# GitHub App workspace integration

GitHub is an external integration. Google/email sign-in and existing Supabase authentication are unchanged.
Workspace Settings → GitHub connects accounts and organizations, maps multiple repositories and installations,
and manages member access. Members see only repositories shared with them.

## Manual GitHub configuration

Register a **GitHub App**, not an OAuth App or personal access token. Use a separate App for local development.

| Setting | Value |
| --- | --- |
| Homepage URL | Your frontend origin |
| Callback URL | `https://FRONTEND/github/callback` |
| Setup URL | `https://FRONTEND/github/callback` (same route) |
| Redirect on update | Enabled |
| Request user authorization during installation | **Disabled**; the application starts its own PKCE authorization after the installation redirect |
| Expire user authorization tokens | Enabled |
| Webhook URL | `https://BACKEND/api/github/webhook` |
| Webhook secret | A generated random secret, also set on the backend |
| Repository permissions | **Metadata: Read-only** only |
| Account/organization permissions | None |
| Events | Installation and installation-repository lifecycle events; subscribe to Repository for renames/transfers/visibility changes |
| Installation availability | Any account, if multiple organizations/accounts need to connect |

Choose **Only select repositories** during installation. The application never adds repositories to a GitHub
installation. GitHub can allow broader installation selection; each workspace still maps repositories explicitly.
Do not add Issues, Contents or Pull requests permissions for future work.

GitHub's setup redirect includes an installation ID that is not proof of ownership. This implementation starts
a separate user authorization with PKCE, then checks `/user/installations` and
`/user/installations/{id}/repositories`. Only repositories where that GitHub user has `admin: true` become
workspace candidates. The temporary user token is discarded and never used for workspace operations.
See [GitHub's user-token flow](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
and [installation access checks](https://docs.github.com/en/rest/apps/installations).

## Backend environment

Set these in the backend environment or an ignored `backend/.env`; no frontend secrets are needed:

| Variable | Purpose |
| --- | --- |
| `GITHUB_APP_ID` | Numeric App ID |
| `GITHUB_APP_SLUG` | App URL slug, such as the part after `github.com/apps/` |
| `GITHUB_CLIENT_ID` | GitHub App client ID; also the App JWT issuer |
| `GITHUB_CLIENT_SECRET` | OAuth client secret, also used to derive the temporary PKCE verifier |
| `GITHUB_PRIVATE_KEY` | RSA PEM contents generated in the App settings; literal `\n` escapes are accepted |
| `GITHUB_WEBHOOK_SECRET` | High-entropy shared webhook secret |
| `GITHUB_REDIRECT_URI` | Exact frontend callback URL registered above |

Existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, frontend Supabase anon configuration, and API/CORS
configuration remain required. Set `ENVIRONMENT=production` for deployment. HTTP callback origins are accepted
only for localhost/127.0.0.1 in development; production requires HTTPS. Keep the signing key and client secret
stable while users finish a connection; rotating the client secret invalidates unfinished PKCE flows.

Install backend requirements, which explicitly include the already-used PyJWT/cryptography stack for RSA signing.
Keep private keys in the hosting provider's secret settings, never in Git, browser bundles, query strings or logs.
No GitHub access token or refresh token is stored in the database or returned to the frontend.
The Vercel configurations set `no-referrer` and `no-store` on the callback route; configure the same headers
if hosting elsewhere. Successful integration API responses are marked `no-store`. Redact callback query
parameters in any access logging you configure on your frontend host.

## Database migration

Apply `supabase/migrations/20261104170746_github_app_integration.sql` after the existing migrations, using your
normal reviewed migration workflow. This creates six backend-only tables:

- `github_installations`: global account metadata and current App permissions/status.
- `github_workspace_installations`: independent links from workspaces to shared installations.
- `github_repositories`: verified candidates and explicit connected mappings, keyed by workspace and stable repository ID.
- `github_repository_permissions`: basic access level and deny-only action restrictions for current members.
- `github_installation_states`: SHA-256 state hashes, initiator, workspace, phase and ten-minute expiry.
- `github_webhook_deliveries`: successfully processed delivery IDs and body hashes.

RLS is enabled and browser roles have no table privileges or RPC execution. FastAPI uses the existing service-role
client and current-user dependency. Transactional RPCs recheck and lock admin membership before writes, and
serialize installation changes. Expired state is cleaned up when a new connection starts. Audit events reuse
`audit.audit_log`, including workspace ID, initiating member, repository ID, permission changes and lifecycle status.
Webhook audit events use a null actor. Do not expose these RPCs to browser roles. See
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Access and lifecycle behavior

- Every member, including admins, starts with **No Access** to repository operations. Admins can manage settings.
- **Read Only** and **Read & Write** are permission ceilings. Advanced denials can only reduce them; GitHub App
  permissions and the implemented-action registry apply as additional ceilings.
- The only implemented workspace operation is reading repository details. Issue reads/writes, comments, branches
  and pull requests are visibly unavailable. No issue automation, agents, task execution or GitHub content writes exist.
- Workspace operations use fresh, single-repository installation tokens with only `metadata: read`. Installation
  synchronization requires an installation-wide token restricted to metadata for repository enumeration. Tokens
  stay in process memory and are not cached. GitHub governs token expiry; each request mints a fresh token, with
  no fallback to user tokens. See [installation token scoping](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app).
- Authorization is checked before token creation, again after that wait, and after fetching repository data before
  returning it. Do not retain a previous authorization decision across a future queue, wait or resumed operation.
- Disconnecting a repository clears that workspace's member grants. Disconnecting an account removes all of its
  mappings and grants **only in that workspace**. Neither operation calls GitHub's uninstall endpoint.
- Suspension, deletion, or repository removal invalidates mappings and cascades grants across affected workspaces.
  Restoring installation access does not restore those grants. Reconnect, select repositories and grant access again.
- Repository additions are never auto-mapped. To discover new candidates, use **Connect GitHub** again with a
  GitHub repository administrator. **Sync access** refreshes existing mappings and revokes unavailable repositories.
- Shared installations remain independent at the workspace boundary. One workspace's repository catalog and grants
  are never used to authorize another workspace.

## Webhooks and recovery

FastAPI verifies the SHA-256 signature against the exact raw body before touching the database. Lifecycle events
trigger a live GitHub snapshot, so delayed payloads cannot blindly restore removed permissions. Receipt, mapping
updates, revocation and audit are committed in one transaction. Failed synchronization leaves no successful receipt;
redelivery can retry safely. Duplicate IDs are accepted only for the same body hash. See
[GitHub webhook verification](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries).

Webhook processing is synchronous, accepts up to 2 MiB, and paginates up to 10,000 repositories. For very large
installations or slow GitHub responses, add a durable webhook worker before increasing these limits. Delivery
receipts currently have no automatic retention policy; keep them for replay protection or establish a reviewed
retention period. Monitor GitHub's Recent deliveries and redeliver failures; use Sync access after missed deliveries.
GitHub API failures and rate limits return a retryable message, without upstream response bodies or secrets.

The settings status reflects the last successful synchronization. The details endpoint still checks live GitHub
access using a newly scoped token. Interrupted or denied installation flows create no mappings and expire after
ten minutes. If you signed out during installation or lost the callback query, sign in and start Connect GitHub again.
Organization approval and SAML policies may require approval or an active organization session before reconnecting.

## Local development and verification

1. Apply existing migrations and this migration to a disposable local Supabase database.
2. Run FastAPI on port 8000 and Vite on 5173 using the repository's normal development commands.
3. Set both GitHub callback/setup URLs to `http://localhost:5173/github/callback` and set the backend redirect
   environment to the same value. Point a temporary HTTPS development tunnel at port 8000 and register
   `https://TUNNEL/api/github/webhook` as the webhook URL. Never expose a development backend with real
   production service-role credentials.
4. Sign in through a real Google/email account, create/select a workspace, and open Workspace Settings. The
   existing one-click demo identity is explicitly rejected by the GitHub API, even in development.
5. Connect as a workspace admin with GitHub admin access to a selected repository. Verify both redirects, map
   the repository, grant a member Read Only, and confirm the member sees only that repository.
6. Revoke the member, remove a repository from the GitHub installation, suspend/uninstall the App, and replay a
   webhook delivery. Verify grants disappear and a second workspace sharing the installation stays isolated.

Automated backend tests (GitHub HTTP and current-user boundaries are mocked):

```sh
cd backend
.venv/bin/python -m pytest tests/test_github.py tests/test_calendar.py -q
.venv/bin/ruff check app/api/github.py app/services/github.py app/schemas/github.py tests/test_github.py
```

Database regression checks use the real migration functions, constraints, role grants and cascading deletes.
On an **isolated migrated test database only**, run:

```sh
psql "$GITHUB_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/tests/github_integration.sql
```

Fixtures are rolled back. The test needs a database owner capable of seeding `auth.users`; use a disposable
database. The local implementation was also checked with embedded PostgreSQL/PGlite against the canonical
workspace/member/audit table definitions, without connecting to a hosted Supabase project. A real configured
GitHub App smoke test and hosted migration deployment remain manual checks.

Frontend checks: `npm run build`, targeted frontend lint, and browser checks of settings with disposable local
fixtures. Existing repository-wide lint findings and the large frontend bundle are outside this integration's scope.
The settings view follows the existing dark product shell, using the True-black flat direction (seed 1602849907)
for neutral panels. Its main question is which repositories are connected and who can access them. The repository
selector and per-member access controls provide the product-specific detail. Source design lint passed; an installed
standalone Chrome was unavailable for the design inspector, so visual checks used the in-app browser instead.
