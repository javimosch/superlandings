# Versions & Snapshots

The Versioning system provides a robust safety net by capturing the state of landing pages at every significant change, allowing for easy auditing, comparison, and recovery.

## What it is
A "Version" in SuperLandings is a point-in-time snapshot of:
1.  **Content**: The raw HTML, EJS templates, or virtual codebase files.
2.  **Metadata**: The landing configuration (slug, type, name) at that moment.
3.  **Timestamp**: When the change occurred.

## Base URL / mount prefix
The Versions API is a sub-resource of the landings API:
`/api/landings/:id/versions`

## Configuration
Snapshots are stored differently based on the engine:
- **File System**: Versions are stored as ZIP files in `./data/landings/.versions/`.
- **MongoDB**: Version metadata and file contents are stored in the `versions` collection.

## API

### Version Lifecycle

#### GET /api/landings/:id/versions
List all version snapshots for a specific landing page.

**Response (200 OK)**:
```json
[
  {
    "id": "v1704501234567",
    "versionNumber": 5,
    "description": "Updated header text",
    "tag": "production-ready",
    "createdAt": "2024-01-05T..."
  }
]
```

#### POST /api/landings/:id/versions
Create a manual version snapshot. Use this before making experimental changes.

**Request body**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| description | string | No | Reason for the snapshot |

#### GET /api/landings/:id/versions/:versionId/preview
Retrieve the HTML content of a specific version for previewing (HTML landings only).

### Recovery & Comparison

#### POST /api/landings/:id/versions/:versionId/rollback
Restore the landing page to the state captured in the specified version. This creates a new "Rollback" version snapshot of the current state before overwriting.

#### GET /api/landings/:id/versions/:versionId/diff
Compute a line-by-line diff between a version and its predecessor or the current state.

**Query Parameters**:
- `compareTo`: `previous` (default) or `current`.

**Response (200 OK)**:
```json
{
  "version": { ... },
  "compareLabel": "Version 4",
  "diffs": [
    {
      "filename": "index.html",
      "type": "modified",
      "hunks": [
        {
          "oldStart": 10,
          "newStart": 10,
          "changes": [
            { "type": "remove", "line": "<h1>Old Title</h1>", "lineNumber": 10 },
            { "type": "add", "line": "<h1>New Title</h1>", "lineNumber": 10 }
          ]
        }
      ]
    }
  ]
}
```

### Metadata Management

#### PATCH /api/landings/:id/versions/:versionId
Update the `description` or `tag` of an existing version.

## Auto-Snapshotting
Snapshots are automatically created when:
1.  A landing is first created.
2.  HTML content is updated via the editor.
3.  EJS or Virtual files are re-uploaded.
4.  A rollback operation is performed.

## Best practices
- **Descriptive Tags**: Use tags like `prod-backup` or `experimental-v2` to identify key milestones.
- **Diff Review**: Always review the diff before performing a rollback to ensure you're restoring the intended changes.
- **Manual Snapshots**: Create a manual snapshot before large-scale re-organization of assets in Virtual landings.
