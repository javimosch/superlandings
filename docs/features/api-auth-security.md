# API Authentication & Security

SuperLandings implements multiple layers of security to protect administrative actions, landing page content, and deployment credentials.

## What it is
The security architecture is built on three pillars:
1.  **Session-Based Authentication**: For administrative access to the panel and API.
2.  **Role-Based Access Control (RBAC)**: For granular permission management within organizations.
3.  **Encrypted Communication**: For remote deployments via SSH and Cloudflare API integration.

## Authentication Mechanisms

### Session Management
The application uses `express-session` with a configurable persistence engine (FileStore or MongoDB).
- **Cookie Security**: Cookies are configured with `httpOnly: true`, `sameSite: 'strict'`, and `secure: true` (in production) to prevent XSS and CSRF attacks.
- **TTL**: Default session duration is 24 hours, manageable via `SESSION_TTL_SECONDS`.

### Super Admin vs. User
- **Super Admin**: Defined via `ADMIN_USERNAME` and `ADMIN_PASSWORD` env vars. Has unrestricted access.
- **Organization User**: Managed via the User API. Access is scoped to specific organizations they are members of.

## Role-Based Access Control (RBAC)

Rights are assigned per user, per organization. The core rights are:
- `landings:create`: Permission to initialize new landing records.
- `landings:update`: Permission to edit content, view audit logs, and manage versions.
- `landings:domains`: Permission to modify custom domains and trigger Cloudflare DNS setup.
- `landings:delete`: Permission to permanently remove landings and their associated data.

### Permission Validation
Middleware (`requireRight`) ensures that every API request is validated against the user's rights in the active organization context (provided via `X-Organization-Id` header).

## Infrastructure Security

### Remote Deployment (SSH)
SuperLandings connects to Traefik servers using SSH:
- **Private Keys**: SSH keys can be provided per-request (header `x-ssh-key`) or stored in the database (`TRAEFIK_SSH_KEY`).
- **Temporary Storage**: When a key is used, it is written to a temporary, 0600-permissioned file in `/tmp` and immediately wiped after the command completes.
- **Command Injection**: All system commands are executed via `child_process.spawn` with argument arrays to prevent shell injection.

### Cloudflare Integration
- **Token Scoping**: The system supports scoped Cloudflare API Tokens (recommended) which should only have `Zone:Read` and `DNS:Edit` permissions.
- **Global Keys**: Fallback support for Global API Keys is provided but discouraged for production use.

## Content Security

### Preview Sandboxing
Landing page previews are rendered within a sandboxed `<iframe>` in the admin panel. This isolates the landing page's JavaScript and CSS from the sensitive administrative interface.

### Static Serving
All landing pages are served with aggressive cache-control headers (`no-store, no-cache`) to ensure that updates are immediate and no sensitive data remains in public proxies.

## Best practices
- **Secrets Management**: Use a secure environment file or Docker secrets for `SESSION_SECRET` and `MONGO_URI`.
- **SSH Keys**: Use dedicated deployment keys with restricted `AuthorizedKeysCommand` on the Traefik server if possible.
- **Audit Monitoring**: Regularly review the Audit Logs for any unauthorized permission changes or unexpected `DOMAIN_ADD` events.
