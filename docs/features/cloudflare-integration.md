# Cloudflare DNS Integration

The Cloudflare integration automates DNS management and SSL provisioning for custom domains assigned to landing pages.

## What it is
This feature allows users to:
1.  **Verify** their Cloudflare API connection.
2.  **Auto-configure** DNS records (A and CNAME) to point to the SuperLandings server.
3.  **Audit** all DNS changes made through the system.

## Base URL / mount prefix
The Cloudflare API is mounted at:
`/api/cloudflare`

## Configuration

The following environment variables must be set to enable the integration:

- `CLOUDFLARE_API_TOKEN`
  - Optional (Preferred)
  - API Token with `Zone:Read` and `DNS:Edit` permissions.
- `CLOUDFLARE_API_KEY`
  - Optional
  - Global API Key (only if token is not provided).
- `CLOUDFLARE_EMAIL`
  - Optional
  - Cloudflare account email (required if using API Key).
- `CLOUDFLARE_PROXY_DEFAULT`
  - Optional
  - Default: `false`
  - Whether to enable Cloudflare Proxy (orange cloud) by default for new records.
- `CLOUDFLARE_DNS_TTL`
  - Optional
  - Default: `1` (Auto)
  - Time-to-Live for DNS records in seconds.
- `TRAEFIK_REMOTE_HOST`
  - Required
  - The public IP address of the SuperLandings server used as the DNS target.

## API

### Status & Connectivity

#### GET /api/cloudflare/status
Check if Cloudflare is enabled in environment and if the current user has "connected" their account.

**Response (200 OK)**:
```json
{
  "enabled": true,
  "connected": true,
  "connectedAt": "2024-01-05T...",
  "email": "user@example.com"
}
```

#### POST /api/cloudflare/connect
Mark Cloudflare as connected for the current user session. This validates the environment token against the Cloudflare API.

#### POST /api/cloudflare/disconnect
Remove the Cloudflare connection status from the user's profile.

### DNS Operations

#### POST /api/cloudflare/dns/configure
Automatically configure DNS for a specific root domain.

**Request body**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| domain | string | Yes | The root domain to configure (e.g., `example.com`) |

**Actions performed**:
1.  Identifies the correct Cloudflare Zone for the domain.
2.  Removes any conflicting A, AAAA, or CNAME records for the root, `www`, and wildcard (`*`).
3.  Adds an **A record** for the root pointing to `TRAEFIK_REMOTE_HOST`.
4.  Adds an **A record** for `*` (wildcard) pointing to `TRAEFIK_REMOTE_HOST`.
5.  Adds a **CNAME record** for `www` pointing to the root domain.

**Response (200 OK)**:
```json
{
  "success": true,
  "zone": { "id": "zone123", "name": "example.com" },
  "targetIp": "1.2.3.4",
  "added": [...],
  "removed": [...],
  "info": "DNS configured for example.com..."
}
```

## Error handling
- `400 Bad Request`: Cloudflare integration disabled in environment or missing domain in request.
- `403 Forbidden`: User lacks `landings:domains` right or has not "connected" Cloudflare.
- `500 Internal Server Error`: Cloudflare API returned an error (e.g., invalid token, zone not found).

## Best practices
- **API Tokens**: Always prefer scoped API Tokens over Global API Keys for security.
- **Propagation**: Remember that DNS changes can take up to 24-48 hours to propagate globally, though Cloudflare is usually much faster.
- **Backup**: Before running auto-configuration, ensure you don't have existing critical records (like MX records for email) that might conflict (though the system primarily targets A/CNAME).
