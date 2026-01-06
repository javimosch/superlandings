# Audit Logs

The Audit Log system provides a comprehensive, chronological record of all administrative actions performed within SuperLandings, ensuring transparency and accountability.

## What it is
Every significant action—from creating a landing page to updating a domain or performing a rollback—is logged with a rich set of metadata. This allows administrators to track who did what, when, and what the impact was.

## Base URL / mount prefix
The Audit API is a sub-resource of the landings API:
`/api/landings/:id/audit`

## Data Structure
Each audit entry contains:
- **Action**: The type of operation (e.g., `CREATE`, `UPDATE`, `PUBLISH`, `ROLLBACK`).
- **Actor**: The email of the user who performed the action (or "admin").
- **Timestamp**: Exact date and time of the event.
- **Details**: A human-readable description of the change.
- **Metadata**: Technical specifics (e.g., version numbers, domain names, organization IDs).
- **Version IDs**: References to the `versionIds` associated with the change (e.g., the before/after snapshots).

## API

#### GET /api/landings/:id/audit
Retrieve the full audit trail for a specific landing page, sorted from newest to oldest.

**Response (200 OK)**:
```json
[
  {
    "id": "audit123",
    "action": "UPDATE",
    "actor": "editor@example.com",
    "timestamp": "2024-01-05T14:30:00.000Z",
    "details": "Updated HTML content",
    "metadata": { "versionNumber": 5 },
    "versionIds": ["v1704500000001"]
  }
]
```

## Tracked Actions
The system captures the following event types:

| Action Code | Description |
|-------------|-------------|
| `CREATE` | Initial creation of the landing page |
| `UPDATE` | Modification of content or files |
| `DELETE` | Deletion of the landing page (logged before deletion) |
| `PUBLISH` | Landing page set to live via Traefik |
| `UNPUBLISH` | Landing page removed from Traefik |
| `DOMAIN_ADD` | New custom domain associated |
| `DOMAIN_REMOVE` | Custom domain removed |
| `ROLLBACK` | Restoration of a previous version snapshot |
| `VERSION_TAG` | Addition of a label to a version snapshot |
| `CLOUDFLARE_DNS` | Automated DNS configuration changes |

## Integration with Versions
The audit log is tightly coupled with the **Versions & Snapshots** system. When an `UPDATE` or `ROLLBACK` occurs:
1.  The audit entry stores the ID of the version snapshot created by that action.
2.  The UI uses this link to allow users to "View Changes" directly from the audit log by comparing the linked versions.

## Permission Requirements
Viewing the audit log requires:
- **Super Admin** access, OR
- **Organization User** with the `landings:update` right for that specific organization.

## Best practices
- **Review Periodically**: Regularly check the audit log for unexpected configuration changes or multiple failed publishing attempts.
- **Use for Troubleshooting**: If a landing page stops working, the audit log is the first place to look for recent `DOMAIN` or `PUBLISH` events.
