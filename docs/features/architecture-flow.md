# Architecture & System Flow

SuperLandings is built as a modular Node.js application designed for high-availability landing page management. This document outlines the high-level architecture and data flows within the system.

## System Components

The application is logically divided into four main layers:

1.  **Management Layer**: The Admin Panel (SPA) and REST API where users configure landings, organizations, and system settings.
2.  **Logic Layer**: Core services in `/lib` that handle business logic like versioning, SSH deployment, AI generation, and authentication.
3.  **Persistence Layer**: A unified storage interface that supports both flat-file JSON and MongoDB.
4.  **Serving Layer**: Middleware that routes incoming traffic to the correct physical files or templates based on the request host or slug.

## High-Level Data Flow

### 1. Landing Page Update Flow
When a user edits a landing page in the Admin Panel:
1.  **Request**: UI sends a `PUT /api/landings/:id` request with new content.
2.  **Snapshot**: The `versions` service captures the current disk state into a ZIP or MongoDB document.
3.  **Audit**: An audit log entry is created, linking the new version snapshot.
4.  **Persistence**: The database record is updated with the `currentVersionId`.
5.  **Response**: UI confirms success and refreshes the version list.

### 2. Publishing Workflow (Traefik)
When a user clicks "Publish":
1.  **Validation**: System checks if domains are assigned and SSH settings are valid.
2.  **Config Generation**: The `traefik` service generates a YAML routing file.
3.  **SSH Deployment**: The file is transferred via SCP to the remote Traefik server's dynamic configuration directory.
4.  **Propagation**: Traefik detects the new file and immediately starts routing assigned domains to the SuperLandings instance.

### 3. Request Serving Flow (Inbound)
When a visitor accesses a published landing:
1.  **Ingress**: Traefik receives the request and matches the `Host` header.
2.  **Forward**: Traefik forwards the request to the SuperLandings server.
3.  **Middleware**: `serveLandingByDomain` or `serveLandingBySlug` middleware intercept the request.
4.  **Restoration**: If the landing files are missing from local disk (e.g., new container), the system restores them from the latest version snapshot.
5.  **Delivery**: Express sends the static file or renders the EJS template.

## System Architecture Diagram (Text-based)

```text
[ Visitor ] ----> [ Traefik Edge ] ----> [ SuperLandings App ]
                                              |
                                              +---> [ Memory Cache/Disk ]
                                              |
[ Admin ] ------> [ Admin Panel ] ------------+
                      |                       |
                      +---> [ AI / LLM ]      +---> [ JSON / MongoDB ]
                      |                       |
                      +---> [ Cloudflare ]    +---> [ Versions (ZIP) ]
```

## Security & Isolation
- **Process Isolation**: Each landing is stored in its own directory.
- **Preview Isolation**: Dirty changes are previewed in a sandboxed iframe using Blob URLs.
- **SSH Isolation**: Private keys are stored securely and used via temporary restricted files.
