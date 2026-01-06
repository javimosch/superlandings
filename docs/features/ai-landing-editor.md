# AI Landing Page Editor

This feature enables AI-powered editing of landing pages, inspired by the "Vibe Coding" system in `ref-saasbackend`.

## Summary
The AI Landing Page Editor allows users to describe changes they want to make to a landing page (HTML content) using natural language. The system uses an LLM to process the request and generate the updated HTML, which can then be previewed and saved.

## Architecture

### 1. LLM Integration (`lib/llm.js`)
- Uses the existing `saasbackend.services.llm` or a direct OpenRouter/Gemini integration.
- New function `editLandingContent(userRequest, currentContent, context)`:
    - **System Prompt**: Defines the AI as an expert web developer specializing in high-converting landing pages.
    - **Context**: Includes the landing page slug, metadata, and the current HTML content.
    - **Output**: Returns only the updated HTML content.

### 2. API Routes (`routes/landings.js`)
- `POST /api/admin/landings/:id/ai-edit`:
    - Receives `prompt` and `currentContent`.
    - Calls `lib/llm.js`.
    - Returns the modified HTML.

### 3. Admin UI Integration
- **Edit Modal**: Adds an "AI Refactor" or "Magic Edit" button/textarea.
- **Preview**: Uses the existing "Preview Dirty Changes" logic to show AI-generated content before saving.
- **Audit/Versions**: AI edits are captured in the versioning system, tagged with an `ai_generated: true` flag in metadata.

## User Flow
1. Open a landing page for editing.
2. Click "AI Edit" button.
3. Enter a prompt (e.g., "Change the hero section to be more aggressive and add a countdown timer").
4. AI generates the new HTML.
5. User clicks "Preview" to see the changes in a modal/tab.
6. User clicks "Save" to commit the AI changes (creating a new version).

## Comparison with EJS Virtual Codebase
Unlike the "EJS Virtual Codebase" which overrides filesystem views, this feature directly modifies the stored landing page content (HTML) in the database/filesystem, leveraging the existing versioning and preview infrastructure of Superlandings.
