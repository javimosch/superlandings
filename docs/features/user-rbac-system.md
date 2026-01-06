# User & RBAC System

The User and Role-Based Access Control (RBAC) system manages authentication, user profiles, and granular permissions across organizations in SuperLandings.

## What it is
SuperLandings uses a session-based authentication system with two types of users:
1.  **Super Admins**: Defined via environment variables, having full access to all system features and organizations.
2.  **Organization Users**: Created by admins, having specific rights within designated organizations.

## Base URL / mount prefix
The User API is mounted at:
`/api/users`

The Authentication API is mounted at:
`/api/login`
`/api/logout`
`/api/auth/me`

## Configuration

The following environment variables configure the authentication system:

- `ADMIN_USERNAME`
  - Required
  - Default admin username for first login
- `ADMIN_PASSWORD`
  - Required
  - Default admin password for first login
- `SESSION_SECRET`
  - Required
  - Secret key used to sign the session cookie
- `SESSION_TTL_SECONDS`
  - Optional
  - Default: `86400` (24 hours)
  - Duration in seconds for which the session remains valid

## API

### Authentication

#### POST /api/login
Authenticate a user and start a session.

**Request body**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| username | string | Yes | Email address or admin username |
| password | string | Yes | User password |

**Response (200 OK)**:
```json
{
  "success": true,
  "user": {
    "email": "user@example.com",
    "isAdmin": false
  }
}
```

#### GET /api/auth/me
Get current session information and rights.

**Request headers**:
| Header | Type | Required | Description |
|--------|------|----------|-------------|
| x-organization-id | string | No | Current active organization context |

**Response (200 OK)**:
```json
{
  "isAdmin": false,
  "user": { "email": "user@example.com", "isAdmin": false },
  "organizations": [...],
  "currentOrganization": { "id": "org123", "name": "My Org" },
  "rights": ["landings:create", "landings:update"]
}
```

### User Management (Admin Only)

#### GET /api/users
List all registered users.

**Response (200 OK)**:
```json
[
  {
    "email": "user@example.com",
    "createdAt": "2024-01-05T12:00:00.000Z"
  }
]
```

#### POST /api/users
Create a new user.

**Request body**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | User's email address |
| password | string | Yes | Password (min 3 characters) |

#### PUT /api/users/:email
Update an existing user's email or password.

#### DELETE /api/users/:email
Remove a user from the system and all organizations.

## Available Rights

Permissions are granted per organization:

- `landings:create`: Create new landing pages
- `landings:update`: Edit existing landing pages and view audit logs
- `landings:domains`: Manage custom domains and publishing
- `landings:delete`: Delete landing pages

## Error handling
- `401 Unauthorized`: Session expired or missing
- `403 Forbidden`: Insufficient permissions (e.g., non-admin accessing user list)
- `400 Bad Request`: Missing fields or validation errors

## Best practices
- **Password Security**: Always use strong passwords even though the minimum is 3 characters.
- **Organization Context**: Always provide `x-organization-id` header when performing landing-related operations to ensure rights are correctly applied.
- **Admin Usage**: Use the Super Admin account only for system configuration and user/organization creation.
