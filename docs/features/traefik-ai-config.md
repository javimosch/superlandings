# Traefik Settings & AI Configuration

SuperLandings provides a sophisticated configuration management system that blends environment variables, global database settings, and AI-assisted generation to manage complex routing scenarios.

## What it is
The system consists of three layers:
1.  **Traefik Settings**: Global parameters stored in the database (via SaasBackend) that define how SSH deployments and routing rules are constructed.
2.  **Fallback Mechanism**: Automatic fallback to environment variables (`.env`) if database settings are missing.
3.  **AI Config Generator**: An LLM-powered assistant that converts natural language requests into valid Traefik YAML configurations.

## Base URL / mount prefix
The Settings and AI APIs are mounted at:
`/api/admin-config/fallbacks` (GET)
`/api/landings/generate-traefik-config` (POST)

## Core Configuration Keys

The following keys are managed through the **System Settings** modal:

| Key | Type | Description |
|-----|------|-------------|
| `TRAEFIK_ENABLED` | boolean | Enables/disables all Traefik deployment logic. |
| `TRAEFIK_REMOTE_HOST` | string | IP or hostname of the remote Traefik server. |
| `TRAEFIK_REMOTE_USER` | string | SSH user (e.g., `root`, `ubuntu`). |
| `TRAEFIK_REMOTE_PORT` | number | SSH port (default `22`). |
| `TRAEFIK_REMOTE_PATH` | string | Remote directory for YAML files (e.g., `/etc/traefik/dynamic`). |
| `SERVER_IP` | string | The internal/public IP where SuperLandings app is running. |
| `TRAEFIK_SSH_KEY` | string | Global SSH private key used if no per-request key is provided. |
| `LLM_OPENROUTER_API_KEY` | string | API key for OpenRouter (AI generator). |
| `LLM_MODEL` | string | Model to use (e.g., `google/gemini-2.0-flash-lite`). |

## AI-Assisted Configuration

The AI generator (`lib/llm.js`) uses OpenRouter to translate user requests into Traefik v2/v3 YAML.

### Working Sample
The following is a working sample that should be used as a reference for the AI to understand the required structure (routers, middlewares, services, and URL prefixing):

```yaml
http:
  routers:
    superlandings-superlanding-docs:
      entryPoints:
        - https
      service: superlandings-superlanding-docs
      rule: Host(`superlandings.intrane.fr`)
      middlewares:
        - superlandings-superlanding-docs-addprefix
      tls:
        certresolver: letsencrypt
  middlewares:
    superlandings-superlanding-docs-addprefix:
      addPrefix:
        prefix: /superlanding-docs
  services:
    superlandings-superlanding-docs:
      loadBalancer:
        servers:
          - url: 'http://superlandings:3000'

### Working Redirect Sample
For domain redirects, use the following structure:

```yaml
http:
  routers:
    sl-toto-toto-microexits-cc:
      entryPoints:
        - https
      rule: Host(`toto.microexits.cc`)
      middlewares:
        - sl-toto-redirect-to-microexits-cc
      service: noop@internal
      tls:
        certresolver: letsencrypt

  middlewares:
    sl-toto-redirect-to-microexits-cc:
      redirectRegex:
        regex: '^https?://toto\.microexits\.cc/?(.*)$'
        replacement: 'https://microexits.cc/$1'
        permanent: false
```

### How it Works
1.  **Prompt Construction**: The system builds a rich context including the `SERVER_IP`, landing `slug`, and assigned `domains`.
2.  **Constraint Enforcement**: The AI is instructed to:
    - Return **ONLY** raw YAML.
    - Use `redirectRegex` or `redirectScheme` for requested redirects.
    - Ensure unique router/service names prefixed with `sl-{slug}-`.
    - Configure TLS with `letsencrypt` certresolver for custom domains.
3.  **Output Validation**: The system strips any markdown blocks (e.g., ` ```yaml `) to ensure the file is immediately usable by Traefik.

## API Reference

#### POST /api/landings/generate-traefik-config
Generate a YAML configuration from a natural language prompt.

**Request body**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| prompt | string | Yes | e.g., "Redirect all traffic from old.com to my-new-slug" |
| slug | string | No | Contextual slug |
| domains | string[] | No | List of domains to include in rules |

**Response (200 OK)**:
```json
{
  "yaml": "http:\n  routers:\n    sl-myslug-router: ..."
}
```

## Best practices
- **Validation**: Always verify the AI-generated YAML in the editor before clicking "Publish".
- **SSH Keys**: If your Traefik server requires a specific key, store it in `TRAEFIK_SSH_KEY` for a seamless workflow.
- **Model Choice**: Use faster models (like Gemini Flash) for configuration generation to reduce UI latency.
