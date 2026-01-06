# Multi-File & Virtual Landings

SuperLandings supports complex landing page structures through "Static" and "Virtual" landing types, enabling developers to host full web applications, compiled frontends, and multi-file assets.

## What it is
Beyond simple single-file HTML pages, SuperLandings can manage:
1.  **Static Landings**: ZIP-based uploads of compiled sites (e.g., React build folders).
2.  **Virtual Landings**: Full codebase directory structures mirrored in the database (MongoDB mode) or filesystem.
3.  **Asset Management**: Automatic serving of CSS, JS, images, and subdirectories associated with a landing.

## Landing Type Comparison

| Feature | Static | Virtual |
|---------|--------|---------|
| **Storage** | Filesystem (data/landings) | MongoDB (files collection) + local cache |
| **Upload** | ZIP file only | Multiple files/folders or ZIP |
| **Persistence** | Permanent on disk | Persistent in DB, transient on disk |
| **Suitability** | Simple static sites | Complex apps with many small files |

## Internal Workings

### 1. File Mirroring (`lib/db.js`)
When a multi-file landing is created:
- The system recursively scans the directory structure.
- **JSON mode**: Files remain in `data/landings/{slug}/`.
- **MongoDB mode**: Files are read into a `files` array within the landing document, enabling stateless application instances.

### 2. Static Asset Middleware (`routes/serve.js`)
To support assets like `/css/style.css` without conflicting with other landings:
- **Domain-based**: If accessed via a custom domain, `domainStaticMiddleware` maps the request root to the landing's specific directory.
- **Slug-based**: If accessed via `/:slug/`, `slugStaticMiddleware` handles asset resolution relative to the slug prefix.

### 3. Virtual Codebase Restoration
In MongoDB mode, if the physical files are missing from the container's disk:
1.  The `ensureLandingContent` function is triggered during a request.
2.  It fetches the `files` array from the database.
3.  It reconstructs the entire directory tree in `data/landing-cache/{slug}/` before serving the request.

## Versioning for Multi-File Landings
The **Versions & Snapshots** system treats multi-file landings as a single unit:
- Every snapshot creates a ZIP file containing the **entire** directory structure.
- The **Diff Engine** compares every file in the structure line-by-line between snapshots.
- Rollbacks restore the exact folder state, including nested subdirectories.

## API Usage

#### POST /api/landings (Virtual/Static)
Use `multipart/form-data` to upload:
- A single `files` field containing a ZIP.
- Multiple `files` fields representing a folder structure.

**Requirement**: Every multi-file landing **must** have an `index.html` file at its root directory.

## Best practices
- **Asset Paths**: Use relative paths (e.g., `./img/logo.png`) in your HTML to ensure assets load correctly in both slug-based and domain-based serving.
- **ZIP Structure**: When uploading a ZIP, ensure `index.html` is at the root of the ZIP, not nested inside another folder.
- **Cache Management**: Use the "Clear Cache" action in the Admin UI if you suspect the on-disk files have become desynchronized from the database.
