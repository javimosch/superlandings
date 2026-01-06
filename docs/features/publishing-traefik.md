# Publishing & Traefik Workflow

The publishing system manages the transition of landing pages from the management environment to a live routing layer handled by Traefik.

## What it is
SuperLandings uses Traefik as its edge router to:
1.  **Map Domains**: Route custom hostnames to specific landing page files.
2.  **Handle SSL**: Automatically provision certificates via ACME (Let's Encrypt).
3.  **Dynamic Configuration**: Load routing rules from generated YAML files without restarting the router.

## Base URL / mount prefix
The Publishing API is mounted at:
`/api/landings/:id/publish`
`/api/landings/:id/unpublish`

## Configuration
The following environment variables and settings govern the publishing process:

- `TRAEFIK_REMOTE_HOST`
  - Required
  - The IP or hostname where the Traefik management server resides.
- `TRAEFIK_REMOTE_USER`
  - Optional (Default: `root`)
  - The SSH user for deploying configurations.
- `TRAEFIK_CONFIG_DIR`
  - Required
  - The directory on the remote host where Traefik looks for dynamic configurations (e.g., `/etc/traefik/dynamic/`).

## Workflow

### 1. Pre-Publishing Requirements
Before a landing can be published:
- It must have at least one **domain** assigned.
- The user must provide a valid **SSH Key** in the request (unless pre-configured).

### 2. Publishing Action (`POST /api/landings/:id/publish`)
When the publish endpoint is called:
1.  **Config Generation**: The system generates a Traefik YAML file containing:
    - `router` definition with `Host()` rules for all assigned domains.
    - `service` definition pointing to the SuperLandings application.
    - `middleware` definitions for SSL redirection and path handling.
2.  **SSH Deployment**: The generated file is uploaded via SSH/SCP to the `TRAEFIK_CONFIG_DIR`.
3.  **State Update**: The landing is marked as `published: true` and the filename is stored in `traefikConfigFile`.

### 3. Unpublishing Action (`POST /api/landings/:id/unpublish`)
When unpublishing:
1.  **Cleanup**: The corresponding YAML file is deleted from the `TRAEFIK_CONFIG_DIR` via SSH.
2.  **State Update**: The landing is marked as `published: false`.

## API

#### POST /api/landings/:id/publish
Start serving the landing page on its assigned domains.

**Request body**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sshKey | string | Yes | SSH private key for remote deployment |

#### POST /api/landings/:id/unpublish
Stop serving the landing page and remove its routing configuration.

## Traefik Configuration Format
The system generates rules following this pattern:
```yaml
http:
  routers:
    landing-slug:
      rule: "Host(`example.com`) || Host(`www.example.com`)"
      service: superlandings
      tls:
        certResolver: letsencrypt
```

## Error handling
- `400 Bad Request`: Landing has no domains or is already in the requested state.
- `500 Internal Server Error`: SSH connection failed, or remote filesystem permissions prevented deployment.

## Best practices
- **Domain Verification**: Ensure DNS is correctly pointed to `TRAEFIK_REMOTE_HOST` (using the Cloudflare integration) before publishing to ensure SSL certificates can be issued.
- **SSH Security**: Use limited-access SSH keys specifically for configuration deployment.
