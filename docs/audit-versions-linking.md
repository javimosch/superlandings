# Audit to Version Linking

## Overview

The audit system now links audit records to version snapshots, allowing users to trace what changes caused side effects by first checking the audit log and then viewing the associated version snapshots.

## How It Works

### Edit Flow

When a user edits a landing (HTML or EJS):

1. **Before Edit**: A "Before edit" version snapshot is created
2. **Content Update**: The landing content is updated
3. **After Edit**: An "After edit" version snapshot is created
4. **Audit Log**: An UPDATE audit entry is created with both version IDs linked

### Audit Entry Structure

Each audit entry now includes an optional `versionIds` array:

```json
{
  "id": "audit-1234567890-abc123",
  "timestamp": "2025-11-27T19:30:00.000Z",
  "action": "update",
  "actor": "user@example.com",
  "isAdmin": false,
  "details": "Updated HTML content",
  "metadata": { "versionNumber": 5 },
  "versionIds": ["1234567890", "1234567891"]
}
```

### Version Metadata

Each version now includes an optional `auditId` field:

```json
{
  "id": "1234567890",
  "landingId": "landing-123",
  "versionNumber": 4,
  "description": "Before edit",
  "createdAt": "2025-11-27T19:29:00.000Z",
  "auditId": "audit-1234567890-abc123"
}
```

## User Workflow

### Viewing Audit with Linked Versions

1. Open a landing and click the **📋 Audit** button
2. Browse the audit log to find the action of interest
3. If the action has linked versions, click **View Version** button
4. The Versions modal opens and automatically scrolls to the linked version
5. The version is highlighted with a yellow ring for 3 seconds

### Comparing Before/After

For UPDATE actions:
- First linked version = "Before edit" snapshot
- Second linked version = "After edit" snapshot

Users can:
- View each version's content
- Use the **Diff** button to compare changes
- Preview HTML versions
- Rollback to a specific version

## Supported Actions with Linked Versions

Currently, the following actions link to versions:

- **UPDATE** - Links before/after snapshots when landing content is edited
- **VERSION_CREATE** - Manual snapshot creation (can be extended to link to audit)
- **ROLLBACK** - Links to the version being rolled back to

## Implementation Details

### Modified Files

- `lib/versions.js` - Added `auditId` parameter to `createVersion()`
- `lib/audit.js` - Added `versionIds` array to audit entries
- `routes/landings.js` - Captures version IDs during UPDATE operations
- `views/admin/partials/modals/audit.ejs` - Displays linked versions with buttons
- `views/admin/partials/modals/versions.ejs` - Added `data-version-id` attribute
- `views/admin/partials/scripts.ejs` - Added `viewLinkedVersion()` method

### API Endpoints

No new endpoints required. Existing endpoints used:
- `GET /api/landings/:id/audit` - Fetch audit log
- `GET /api/landings/:id/versions/:versionId` - Fetch version metadata
- `GET /api/landings/:id/versions/:versionId/diff` - Compare versions

## Future Enhancements

Potential improvements:
- Link versions to VERSION_CREATE actions (manual snapshots)
- Link versions to ROLLBACK actions
- Add version comparison preview in audit modal
- Filter audit by action type to show only entries with linked versions
- Export audit trail with version information
