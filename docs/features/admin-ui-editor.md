# Admin UI & Editor Features

The SuperLandings Admin Panel provides a powerful, real-time interface for managing landing pages, featuring integrated code editors, preview capabilities, and configuration management.

## What it is
The frontend is a single-page application (SPA) style interface built with EJS and Tailwind CSS, providing:
1.  **Code Editor**: Integrated CodeMirror instance for editing HTML and YAML.
2.  **Live Preview**: Real-time rendering of unsaved changes.
3.  **Modal-based Workflow**: Streamlined management of versions, domains, and settings without page reloads.

## Key Features

### 1. Integrated Code Editor
SuperLandings uses **CodeMirror** to provide a full-featured editing experience for:
- **HTML Landings**: Full syntax highlighting and line wrapping for index.html.
- **Traefik Config**: YAML syntax highlighting for custom routing rules.
- **Search & Replace**: Standard keyboard shortcuts (Ctrl-F, F3) are supported within the editor.

### 2. Preview Dirty Changes
Before saving a version, users can preview their changes in two modes:
- **Modal Preview**: A full-screen overlay using a sandboxed `<iframe>` to render the current editor content.
- **New Tab Preview**: Opens the content in a new browser tab using a temporary Blob URL.
- **Security**: Previews are isolated to prevent cross-site scripting (XSS) from affecting the admin panel.

### 3. AI-Assisted Configuration
For Traefik landings, an integrated AI assistant can generate complex YAML configurations based on natural language prompts (e.g., "Add a redirect from old-domain.com to the new landing").

### 4. Shared Settings Management
The Settings modal (`/api/admin-config`) allows for global configuration of:
- **Traefik Connection**: Remote host, SSH user, and port.
- **LLM Settings**: API keys and model selection for the AI assistant.
- **Persistence**: Switching between JSON and MongoDB storage.

## UI Components & Modals

| Component | Description |
|-----------|-------------|
| **Add Landing** | Form for creating new pages with type selection (HTML, EJS, Virtual). |
| **Edit Landing** | Main workspace featuring the code editor and preview buttons. |
| **Versions Modal** | List of all snapshots with "Rollback", "Diff", and "Tag" actions. |
| **Audit Modal** | Chronological log of actions with deep links to version snapshots. |
| **Domains Modal** | Interface for adding/removing domains and triggering Cloudflare DNS setup. |

## Best practices
- **Preview First**: Always use the "Preview" button before saving to catch syntax errors or layout issues.
- **Local vs Shared Settings**: Use local settings (localStorage) for UI preferences and shared settings (DB) for system-wide configurations.
- **Editor Performance**: For very large HTML files, use "New Tab" preview if the modal preview feels slow.
