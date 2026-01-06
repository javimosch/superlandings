# Developer Onboarding & Contribution

Welcome to the SuperLandings development guide. This document provides the necessary information for developers to set up the environment, understand the architecture, and contribute to the project.

## Development Environment Setup

### Prerequisites
- **Node.js**: Version 18 or 20 (LTS recommended).
- **Docker & Docker Compose**: For containerized development and testing.
- **MongoDB**: (Optional) If testing the `mongo` persistence engine.

### Quick Start
1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/javimosch/superlandings.git
    cd superlandings
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Environment Setup**:
    ```bash
    cp .env.example .env
    # Edit .env with your local settings
    ```
4.  **Run in Development Mode**:
    ```bash
    npm run dev
    ```
    This starts the server with `nodemon`, which automatically restarts on file changes.

## Project Architecture

SuperLandings is a modular Node.js application:

- **Entry Point**: `server.js` initializes the Express application, middleware, and persistence engines.
- **Core Logic (`/lib`)**:
  - `auth.js`: Session management and RBAC logic.
  - `store.js`: Unified persistence layer (JSON/Mongo).
  - `traefik.js`: SSH-based deployment logic.
  - `llm.js`: AI configuration generator.
  - `versions.js`: File snapshotting and recovery system.
- **API Layer (`/routes`)**: Feature-specific routers (landings, organizations, users, cloudflare, etc.).
- **Frontend (`/views`)**: Server-side rendered EJS templates with a Vue 3 powered Admin SPA.

## Coding Guidelines

- **Minimal Changes**: Avoid large refactors unless explicitly requested. Prefer surgical edits to existing files.
- **Modularization**: If a file exceeds 500 lines, consider refactoring logic into a new module in `/lib`.
- **Naming Conventions**:
  - Routes: `lower-case-hyphenated.js`
  - Libs: `lower-case-hyphenated.js`
  - Documentation: `lower-case-hyphenated.md` under `docs/features/`.

## Contribution Workflow

1.  **Issue Selection**: Identify a bug or feature from the roadmap.
2.  **Feature Branching**: Create a descriptive branch (e.g., `feat/add-webhook-support`).
3.  **Implementation**:
    - Add logic to `/lib`.
    - Expose via `/routes`.
    - Update the Admin UI in `/views/admin`.
4.  **Documentation**:
    - Create a new feature doc in `docs/features/`.
    - Link the new doc in `docs/documentation.html`.
5.  **Verification**:
    - Test locally using both `json` and `mongo` persistence engines.
    - Verify Docker build compatibility.

## Testing
Currently, the project relies on manual verification. When contributing:
- Verify all CRUD operations for landings.
- Test "Preview" functionality.
- Ensure "Audit" logs capture the new actions correctly.

## Tech Stack Summary
- **Backend**: Node.js, Express.
- **Database**: Native JSON or MongoDB.
- **UI**: EJS, Tailwind CSS, Vue 3 (CDN), CodeMirror.
- **Orchestration**: Docker, Docker Compose, Traefik.
