# Cloudflare DNS automation – plan

## Scope
- Allow users to connect Cloudflare and auto-configure DNS for any domain.
- Records must point to the IP from `TRAEFIK_REMOTE_HOST` (no hardcoded IPs).
- Works with both persistence engines (current local/fs JSON and upcoming Mongo).
- All actions audited.

## Requirements
1) Connect Cloudflare: per-user token (Zone.DNS edit, Zone read). Verify token by listing zones.
2) Configure DNS for a domain:
   - Remove conflicting records on `@`, `*`, `www`.
   - Add `A @ -> TRAEFIK_REMOTE_HOST`.
   - Add `A * -> TRAEFIK_REMOTE_HOST`.
   - Add `CNAME www -> @`.
   - Return step-by-step recap (removed/added/skipped).
   - Final info message: root + wildcard cover main and subdomains; www aliases root.
3) Must function identically with fs JSON and Mongo backends.
4) Audit every connect/disconnect/configure action.

## Data model
- Users: add `cloudflareToken`, `cloudflareEmail`, `cloudflareConnectedAt`.
- Storage abstraction: extend store layer to read/write these fields in both fs and Mongo implementations (new Mongo repo should share the same interface).
- Consider token encryption at rest (at minimum redact in responses).

## Backend API
- `POST /api/cloudflare/connect` — save token, validate via CF zones; audit success/failure.
- `DELETE /api/cloudflare/connect` — remove token; audit.
- `POST /api/cloudflare/dns/configure` body `{ domain }` — requires connected token and user ownership.
  Steps: resolve zone (match apex), list DNS records, delete conflicts, add desired records (proxied flag configurable), build recap payload, audit with details.

## DNS logic
- Target IP: `process.env.TRAEFIK_REMOTE_HOST` (fallback blocked; fail if missing).
- Conflicts: any A/AAAA/CNAME/TXT on `@`, `*`, `www` that prevent desired state. Delete before create.
- Idempotency: if correct record exists, skip add and include “already correct” in recap.
- Use Cloudflare API (axios or cf SDK) with per-user token; no global token leak.

## Auditing
- Log actions via existing audit logger:
  - `CLOUDFLARE_CONNECT`, `CLOUDFLARE_DISCONNECT`, `CLOUDFLARE_DNS_CONFIGURE`.
  - Include actor email, domain, removed/added counts, and recap snippets.

## UI (admin)
- Settings/Profile: “Connect Cloudflare” modal to enter token/email; show connected state.
- Domain management: show “Configure Cloudflare DNS” button when connected; input domain; display live step recap and final info text.
- Mask token in UI; show last connected timestamp.

## Config
- Env:
  - DNS target: reuse `TRAEFIK_REMOTE_HOST`.
  - `CLOUDFLARE_API_TOKEN` (required) — scope: Zone.DNS edit, Zone read.
  - `CLOUDFLARE_EMAIL` (optional, only if SDK/client needs it).
  - `CLOUDFLARE_PROXY_DEFAULT` (optional, bool) — whether to set proxied true for A/CNAME.
  - `CLOUDFLARE_DNS_TTL` (optional, default 1 = auto).
- Feature gate: UI + routes only enabled when `CLOUDFLARE_API_TOKEN` is present.
- `.env.example`: document all Cloudflare vars plus `TRAEFIK_REMOTE_HOST` dependency.
- Validation: fail fast if `TRAEFIK_REMOTE_HOST` or `CLOUDFLARE_API_TOKEN` missing.

## Error handling & resilience
- Timeouts + retries (limited) for Cloudflare API; surface clear errors (zone not found, permission denied, rate limit).
- Idempotent runs: safe to re-run configure without duplication; skips noted in recap.
- Partial failure handling: if delete succeeds but add fails, report which steps executed; encourage retry.
- Logging: concise server logs for each API call (zone, record name/type/action) with request IDs.

## Security
- Do not return token; mask in UI (•••• suffix). Consider encrypting at rest; minimum is redaction in responses.
- Audit all actions with actor and domain details. Avoid logging tokens.

## UI/UX details
- Connect modal: fields for token (+ optional email), validation spinner, error states.
- Configure flow: domain input, show intended records summary before executing; then live step feed (remove/add/skip).
- Success banner: explain root + wildcard + www coverage; remind DNS propagation.
- Disable/grey out Configure button when gate conditions fail (no token, missing env gate).

## API/logic specifics
- Zone resolution: match apex of provided domain; error if no matching zone.
- Conflict detection: any A/AAAA/CNAME/TXT on `@`, `*`, `www` that blocks desired state.
- Record creation: A `@` and `*` -> `TRAEFIK_REMOTE_HOST`; CNAME `www` -> `@`; TTL from env; proxied flag from env.
- Recap payload example: `{ removed: [...], added: [...], skipped: [...] }`.

## Migration steps (fs & Mongo)
- Add new user fields to both stores and Mongo schema; default null.
- Include fields in JSON→Mongo sync (`MONGO_SYNC_ON_BOOT`).
- Add audit action constants and ensure audit collection/table stores new actions.

## Compatibility (fs & Mongo)
- Respect `PERSISTENCE_ENGINE` (json|mongo) per docs/mongodb-persistence.md.
- Use `lib/store` abstraction only—no direct fs or Mongo calls. Add new user fields (cloudflareToken, cloudflareEmail, cloudflareConnectedAt) to both adapters.
- Audits must write through audit helper so entries land in JSON (data/audit) or Mongo audit collection transparently.
- Migrations: seed defaults for new user fields in both engines and include them in Mongo schema; ensure JSON→Mongo sync copies them when `MONGO_SYNC_ON_BOOT` is true.

## Testing & monitoring
- Unit tests for DNS logic (record diffing, conflict removal, idempotency).
- Integration test stub (mock Cloudflare API).
- Log and surface actionable errors to UI (e.g., zone not found, permission denied, rate limit).
