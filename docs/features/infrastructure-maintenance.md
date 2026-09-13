# Infrastructure & Maintenance

The Infrastructure & Maintenance documentation covers the low-level serving logic, migration system, and deployment configuration for SuperLandings.

## What it is
SuperLandings is designed as a portable, Docker-ready application with built-in tools for:
1.  **Request Routing**: Handling both slug-based and domain-based requests.
2.  **Schema Migration**: Updating legacy data structures to modern RBAC and versioning formats.
3.  **Docker Orchestration**: Containerized deployment with volume persistence.

## Serving Logic (`serve.js`)

SuperLandings uses a multi-layered middleware approach to serve content:

### 1. Slug-based Routing
- **Pattern**: `/:slug`
- **Logic**: Matches the requested slug against the database.
- **Serving**:
  - `html`, `static`, `virtual`: Restores content from the latest version to disk if missing, then sends the file.
  - `ejs`: Renders the corresponding template from the `views` directory.

### 2. Domain-based Routing (Fallback)
- **Logic**: Used when Traefik is not used or for local testing. Matches the `Host` header against assigned landing domains.
- **Middleware**: `domainStaticMiddleware` and `slugStaticMiddleware` handle asset resolution (CSS/JS/Images) for these requests.

### 3. Content Restoration
If a landing's files are missing from the disk (common in fresh Docker deployments):
1.  The system attempts to restore from the `currentVersionId`.
2.  If that fails, it scans all available versions for a restorable snapshot.
3.  As a last resort, it generates a "Content Missing" placeholder.

## Migration System (`migration.js`)

Admins can trigger system-wide migrations via the **Migration** section in Settings.

### RBAC Migration (`POST /api/migration/rbac`)
- Creates a `default` organization if none exists.
- Assigns all existing "orphaned" landings to the `default` organization.
- Ensures all users are compatible with the multi-tenant system.

### Version Migration (`POST /api/migration/versions`)
- Scans all existing landings.
- Creates an "Initial version" snapshot for landings that lack version tracking.
- Ensures the `audit` log has a starting point for every landing.

## Deployment Configuration

### Docker (`Dockerfile`)
The application uses `node:18-alpine` for a minimal footprint:
- Installs only production dependencies.
- Exposes port `3000`.
- Creates `/app/data` directories for persistence.

### Docker Compose (`compose.yml`)
Standard configuration for production:
- **Persistence**: Maps `landing-data` volume to `/app/data`.
- **Networking**: Joins `coolify-shared` network (optional) for Traefik integration.
- **Restart Policy**: `unless-stopped` ensures high availability.

## Runtime cache and template reload

SuperLandings keeps on-disk and in-memory caches for performance. Editing landings or EJS templates no longer requires a full container restart.

- **`node manage.js refresh <slug>`** copies `data/landings/<slug>` into both `data/landing-cache/<slug>` and `data/landing-cache/<undashed>` variants, invalidating the on-disk landing cache.
- **`POST /api/admin-config/templates/reload`** clears the Express view cache and EJS compiled-function cache, so template changes are picked up immediately. The admin panel exposes this as the **Reload templates** button.

## Best practices
- **Migrations**: Always run the RBAC and Version migrations after upgrading from a version older than 1.5.
- **Volumes**: Never run the container without a persistent volume mapped to `/app/data`, or you will lose all landings and versions on restart.
- **Port Mapping**: If changing the `PORT` environment variable, ensure the Docker `EXPOSE` and `compose.yml` ports are updated accordingly.
