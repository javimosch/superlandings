# Traefik Integration Setup Guide

This guide explains how to set up SuperLandings with Traefik for custom domain publishing.

## Prerequisites

1. **SuperLandings server** running and accessible on your network
2. **Traefik server** (v2+) running, typically via Coolify or standalone
3. **SSH access** to the Traefik server with key-based authentication
4. **Network connectivity** between Traefik and SuperLandings

## Step 1: Configure SSH Access

### Generate SSH Key (if not already done)

```bash
ssh-keygen -t ed25519 -C "superlandings-traefik"
```

### Copy SSH Key to Traefik Server

```bash
ssh-copy-id -p 22 root@your-traefik-server.com
```

### Test SSH Connection

```bash
ssh -p 22 root@your-traefik-server.com "echo 'Connection successful'"
```

## Step 2: Configure Environment Variables

Edit your `.env` file:

```env
# Enable Traefik integration
TRAEFIK_ENABLED=true

# Traefik server connection details
TRAEFIK_REMOTE_HOST=your-traefik-server.com
TRAEFIK_REMOTE_USER=root
TRAEFIK_REMOTE_PORT=22

# Path to Traefik's dynamic configuration directory
# For Coolify: /data/coolify/proxy/dynamic
# For standalone Traefik: /etc/traefik/dynamic
TRAEFIK_REMOTE_PATH=/data/coolify/proxy/dynamic

# How Traefik reaches SuperLandings
# If both on same Docker network: http://superlandings:3000
# If on different servers: http://superlandings-server-ip:3000
SERVER_IP=http://superlandings:3000
```

## Step 3: Verify Traefik Configuration

Ensure your Traefik instance has:

### Dynamic Configuration Enabled

```yaml
# traefik.yml
providers:
  file:
    directory: /path/to/dynamic/configs
    watch: true
```

### HTTPS Entry Point

```yaml
entryPoints:
  https:
    address: ":443"
```

### Let's Encrypt Certificate Resolver

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: http
```

## Step 4: Network Configuration

### Same Docker Network (Recommended)

If Traefik and SuperLandings are on the same Docker network:

```yaml
# docker-compose.yml
services:
  superlandings:
    networks:
      - traefik-network

networks:
  traefik-network:
    external: true
```

### Different Servers

If on different servers, ensure:
1. SuperLandings port (3000) is accessible from Traefik server
2. Use full URL in `SERVER_IP`: `http://192.168.1.100:3000`
3. Firewall allows traffic between servers

## Step 5: Test Publishing

1. **Start SuperLandings**: `npm start`
2. **Access Admin Panel**: `http://localhost:3000/admin`
3. **Create a Test Landing**:
   - Name: "Test"
   - Slug: "test"
   - Domain: "test.yourdomain.com"
4. **Publish**: Click the "Publish" button
5. **Verify**: Check server logs for deployment status
6. **Test**: Visit `https://test.yourdomain.com`

## How It Works

### Publishing Flow

1. User configures domain in admin panel
2. User clicks "Publish"
3. SuperLandings generates Traefik YAML config:
   ```yaml
   http:
     routers:
       superlandings-test:
         rule: Host(`test.yourdomain.com`) && PathPrefix(`/test`)
         service: superlandings-test
         middlewares:
           - superlandings-test-strip
         tls:
           certresolver: letsencrypt
     middlewares:
       superlandings-test-strip:
         stripPrefix:
           prefixes:
             - /test
     services:
       superlandings-test:
         loadBalancer:
           servers:
             - url: 'http://superlandings:3000'
   ```
4. Config deployed to Traefik via SSH/SCP
5. Traefik picks up config automatically
6. Domain routes to landing

### Path Handling

- **User visits**: `https://test.yourdomain.com/`
- **Traefik matches**: `Host(test.yourdomain.com) && PathPrefix(/test)`
- **Traefik strips**: `/test` prefix
- **Forwards to**: `http://superlandings:3000/test`
- **SuperLandings serves**: Landing at `/test` route

## Troubleshooting

### "SSH connection failed"

**Check:**
- SSH key authentication is configured
- Server is accessible: `ping your-traefik-server.com`
- Port is correct (default 22)
- User has permissions: `ssh root@your-traefik-server.com`

### "Permission denied"

**Check:**
- User has write access to Traefik config directory
- Directory exists: `ssh root@server "ls -la /data/coolify/proxy/dynamic"`
- SELinux/AppArmor policies (if applicable)

### "Domain not routing"

**Check:**
1. **DNS Configuration**: Domain points to Traefik server IP
2. **Config File**: Exists on Traefik server
   ```bash
   ssh root@server "cat /data/coolify/proxy/dynamic/superlandings-test.yml"
   ```
3. **Traefik Logs**: Check for errors
   ```bash
   docker logs traefik
   ```
4. **Network Connectivity**: Traefik can reach SuperLandings
   ```bash
   docker exec traefik wget -O- http://superlandings:3000/test
   ```

### "Certificate errors"

**Check:**
- Let's Encrypt rate limits not exceeded
- Email configured in cert resolver
- HTTP challenge can reach server (port 80 open)

### "Landing shows but resources 404"

**Check:**
- Path stripping middleware is working
- Static assets use relative paths, not absolute
- For static landings, ensure index.html references are correct

## Monitoring

Check SuperLandings logs for deployment status:

```bash
# Docker
docker logs superlandings -f

# Local
npm start
```

Look for:
- 🚀 Publishing indicators
- ✅ Success confirmations
- ❌ Error messages

## Security Best Practices

1. **Use SSH Keys**: Never use password authentication
2. **Limit SSH User**: Create dedicated user for deployments
3. **Network Segmentation**: Use Docker networks when possible
4. **Regular Updates**: Keep Traefik and SuperLandings updated
5. **Monitor Logs**: Watch for unusual deployment activity
6. **Backup Configs**: Regularly backup `data/traefik/` directory

## Production Deployment

### Recommended Setup

```
┌─────────────┐         ┌──────────────┐
│   Internet  │────────▶│   Traefik    │
└─────────────┘         │  (Gateway)   │
                        └──────┬───────┘
                               │
                        ┌──────▼───────┐
                        │ SuperLandings│
                        │   (Server)   │
                        └──────────────┘
```

### Docker Compose Example

```yaml
version: '3.8'

services:
  superlandings:
    image: superlandings:latest
    environment:
      - TRAEFIK_ENABLED=true
      - TRAEFIK_REMOTE_HOST=traefik-server
      - SERVER_IP=http://superlandings:3000
    volumes:
      - landing-data:/app/data
      - ~/.ssh/id_ed25519:/root/.ssh/id_ed25519:ro
    networks:
      - traefik-network
    restart: unless-stopped

volumes:
  landing-data:

networks:
  traefik-network:
    external: true
```

## Support

For issues or questions:
1. Check server logs for error messages
2. Verify all environment variables are set
3. Test SSH connection manually
4. Review Traefik logs for routing issues