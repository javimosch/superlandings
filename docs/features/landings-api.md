# Landing Pages API

The Landing Pages API provides comprehensive management of landing page lifecycles, including creation, content updates, domain mapping, and publishing.

## What it is
SuperLandings supports multiple landing page types, each handled differently by the system:
1.  **HTML**: Single-file landing page with a built-in code editor.
2.  **EJS**: Dynamic templates using Embedded JavaScript with support for multiple files.
3.  **Virtual**: A full codebase folder structure, including assets and subdirectories.
4.  **Static**: Legacy zip-based uploads (handled similarly to EJS).
5.  **Traefik Config**: Specialized configuration-only landings for advanced routing.

## Base URL / mount prefix
The Landings API is mounted at:
`/api/landings`

## Configuration
- `LANDINGS_DIR`: The physical directory where landing page files are stored (usually `./data/landings`).
- `STORAGE_ENGINE`: Determined by `lib/store.js` (JSON or MongoDB).

## API

### Core Operations

#### GET /api/landings
Retrieve all landing pages for the current organization.

**Response (200 OK)**:
```json
[
  {
    "id": "1704500000000",
    "slug": "welcome-page",
    "name": "Welcome Page",
    "type": "html",
    "published": true,
    "currentVersionNumber": 5,
    "domains": [{ "domain": "example.com", "published": true }]
  }
]
```

#### POST /api/landings
Create a new landing page.

**Request body (multipart/form-data)**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Human-readable name |
| slug | string | Yes | URL identifier (must be unique) |
| type | string | Yes | `html`, `ejs`, `virtual`, or `traefik-config` |
| content | string | No | HTML or Traefik config content (for those types) |
| files | file[] | No | Zip or individual files (for EJS/Virtual types) |

#### PUT /api/landings/:id
Update an existing landing page. Automatically creates a new version snapshot.

#### DELETE /api/landings/:id
Permanently remove a landing page, its files, versions, and audit logs. Unpublishes from Traefik if active.

### Domain Management

#### PUT /api/landings/:id/domains
Update the list of custom domains associated with a landing.

**Request body**:
```json
{
  "domains": ["landing.example.com", "promo.example.com"]
}
```

### Specialized Endpoints

#### POST /api/landings/generate-traefik-config
Use AI to generate a Traefik configuration based on a natural language prompt.

**Request body**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| prompt | string | Yes | Desired routing behavior description |
| slug | string | No | Landing slug for context |

#### GET /api/landings/:id/content
Retrieve the raw content for HTML or Traefik-config landing pages.

## Versioning & Audit
Every update operation triggered via `PUT /api/landings/:id` automatically:
1.  Captures a file-system snapshot.
2.  Creates a new entry in the `versions` collection.
3.  Logs an audit event in the `audit` collection.
4.  Updates the `currentVersionId` on the landing record.

## Error handling
- `400 Bad Request`: Duplicate slug, missing required fields, or invalid file type.
- `403 Forbidden`: User lacks `landings:create`, `landings:update`, or `landings:delete` rights.
- `404 Not Found`: Landing page ID does not exist.

## Best practices
- **Slugs**: Use SEO-friendly slugs (lowercase, hyphens).
- **Backups**: Rely on the versioning system for rollbacks rather than manual file management.
- **Virtual Type**: Always include an `index.html` at the root of the uploaded directory for Virtual landings.
