# Organization Management

Organization management enables multi-tenancy in SuperLandings, allowing users to be grouped and granted permissions for specific sets of landing pages.

## What it is
Organizations serve as the primary container for:
1.  **Landing Pages**: Each landing page belongs to exactly one organization.
2.  **Users**: Users are associated with organizations with specific rights.
3.  **Permissions**: Access control is enforced at the organization level.

## Base URL / mount prefix
The Organizations API is mounted at:
`/api/organizations`

## Configuration
Organizations are stored in the primary database (JSON or MongoDB depending on the configured storage engine). There are no specific environment variables for organizations, as they are managed via the API.

## API

### Organization Retrieval

#### GET /api/organizations
List organizations accessible to the current user.

- **Admin**: Returns all organizations in the system.
- **User**: Returns only organizations where the user is a member.

**Response (200 OK)**:
```json
[
  {
    "id": "1704500000000",
    "name": "Marketing Team",
    "users": [
      { "email": "user@example.com", "rights": ["landings:create"] }
    ],
    "createdAt": "2024-01-05T..."
  }
]
```

#### GET /api/organizations/:id
Retrieve details for a specific organization. Requires membership or admin access.

### Management (Admin Only)

#### POST /api/organizations
Create a new organization.

**Request body**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | The name of the organization |

#### PUT /api/organizations/:id
Update an organization's name.

#### DELETE /api/organizations/:id
Delete an organization. **Warning**: Cannot delete an organization that still contains landing pages.

### User Membership (Admin Only)

#### POST /api/organizations/:id/users
Add a user to an organization.

**Request body**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | Registered user's email |
| rights | string[] | No | Array of permissions for this org |

#### PUT /api/organizations/:id/users/:email
Update a user's rights within a specific organization.

#### DELETE /api/organizations/:id/users/:email
Remove a user from an organization.

## Multi-Tenancy Logic
- When a user performs an operation (e.g., creating a landing), they must provide the `x-organization-id` header.
- The system validates that the user belongs to that organization and has the required `rights` for the requested operation.
- Landings are automatically filtered by `organizationId` based on the user's active context.

## Error handling
- `400 Bad Request`: Validation errors or attempting to delete an organization with active landings.
- `403 Forbidden`: User is not a member of the organization or lacks admin rights.
- `404 Not Found`: Organization or user not found.

## Best practices
- **Granular Rights**: Assign only the necessary rights to users (e.g., give `landings:update` but not `landings:delete` to junior editors).
- **Cleanup**: Delete unused organizations only after moving or deleting their associated landing pages.
