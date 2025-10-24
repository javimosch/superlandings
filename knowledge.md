# SuperLandings Knowledge Base

## Traefik Integration System

### Overview
The Traefik integration allows each landing to be published to a custom domain via a Traefik reverse proxy gateway. This is inspired by the manage.sh deployment system but adapted for per-landing configuration.

### Architecture

1. **Single Server Deployment**: The SuperLandings server is deployed once to a remote host
2. **Per-Landing Traefik Configs**: Each landing gets its own Traefik configuration file
3. **Separate Gateway**: Traefik runs on a separate server (typically Coolify) and routes domains to the SuperLandings server

### Data Model

Each landing has these additional fields:
- `domains`: Array of custom domains (e.g., ["example.com", "www.example.com"])
- `published`: Boolean indicating if currently published to Traefik
- `traefikConfigFile`: Filename of the deployed Traefik config

Note: Multiple domains are supported - all domains in the array will route to the same landing.

### Publishing Flow

1. User configures domain in admin panel
2. User clicks "Publish"
3. Server generates Traefik YAML config
4. Config saved locally in `data/traefik/`
5. Config deployed to remote Traefik server via SSH/SCP
6. Traefik automatically picks up the config
7. Domain now routes to the landing

### Unpublishing Flow

1. User clicks "Unpublish"
2. Server removes local Traefik config
3. Server removes remote Traefik config via SSH
4. Domain stops routing

### Configuration

Required .env variables for Traefik:
- `TRAEFIK_ENABLED`: Must be "true"
- `TRAEFIK_REMOTE_HOST`: Traefik server hostname/IP
- `TRAEFIK_REMOTE_USER`: SSH user (usually "root")
- `TRAEFIK_REMOTE_PORT`: SSH port (default 22)
- `TRAEFIK_REMOTE_PATH`: Path to Traefik dynamic configs (e.g., /data/coolify/proxy/dynamic)
- `SERVER_IP`: How Traefik reaches this server (e.g., "http://superlandings:3000")

### Logging

All Traefik operations are logged with emojis for easy scanning:
- 🚀 Publishing
- 📤 Unpublishing  
- ✅ Success
- ❌ Error
- 🗑️ Deletion
- 🌐 Domain changes

### SSH Requirements

- SSH key-based authentication must be configured
- The server must have SSH access to the Traefik host
- User must have write permissions to the Traefik config directory

### Traefik Config Format

Generated configs follow this pattern:
```yaml
http:
  routers:
    superlandings-{slug}:
      entryPoints:
        - https
      service: superlandings-{slug}
      rule: Host(`{domain}`)
      tls:
        certresolver: letsencrypt
  services:
    superlandings-{slug}:
      loadBalancer:
        servers:
          - url: '{SERVER_IP}/{slug}'
```

### Security Notes

- Admin authentication required for all publish/unpublish operations
- Cannot change domain of published landing (must unpublish first)
- Deleting a landing auto-unpublishes it
- SSH operations use environment variables, never hardcoded credentials
- Command injection prevented by using spawn() with argument arrays instead of shell interpolation
- Environment variables validated before SSH operations

### Important Fixes from Code Review

1. **Command Injection Prevention**: Uses `child_process.spawn()` with array arguments instead of string interpolation
2. **Environment Validation**: Validates all required Traefik env vars before attempting SSH operations
3. **Traefik URL Routing**: Config uses `SERVER_IP` without slug path, letting the app handle routing
4. **Loading States**: Admin panel shows loading indicators during publish/unpublish operations
5. **Toast Notifications**: Replaced alert() with proper toast notifications for better UX
6. **Domain Validation**: Client-side regex validation for domain format