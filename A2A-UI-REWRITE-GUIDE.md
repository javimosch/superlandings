# Superlandings UI Rewrite - A2A Team Setup

## Overview
This project uses A2A (Agent-to-Agent) messaging to coordinate a 3-person team for rewriting the Superlandings UI using the minimalist-ui skill.

## Team Structure
- ui-architect: Lead UI Architect - Plans architecture and design system
- ui-developer: UI Developer - Implements the UI components  
- ui-reviewer: UI Code Reviewer - Reviews code and ensures quality
- coordinator: Project Coordinator - Manages workflow and task distribution

## A2A Project
- Project Name: superlandings-ui-rewrite
- Database: /root/.a2a/superlandings-ui-rewrite/database.db
- Working Directory: /root/projects/superlandings

## Skills Available
- minimalist-ui: /root/.config/devin/skills/minimalist-ui.md
  - Clean editorial-style interfaces
  - Warm monochrome palette, typographic contrast
  - Flat bento grids, muted pastels
  - No gradients, no heavy shadows

## Usage Commands

### Monitor Communication
/root/.local/bin/a2a peek --project superlandings-ui-rewrite

### Send Messages as Coordinator
/root/.local/bin/a2a send ui-architect message --from coordinator
/root/.local/bin/a2a send ui-developer message --from coordinator  
/root/.local/bin/a2a send ui-reviewer message --from coordinator

### Check Agent Status
/root/.local/bin/a2a list --project superlandings-ui-rewrite

### Search Messages
/root/.local/bin/a2a search keyword --project superlandings-ui-rewrite

## Current Status
- A2A project initialized
- 4 agents registered (ui-architect, ui-developer, ui-reviewer, coordinator)
- minimalist-ui skill installed
- superlandings repo cloned and up to date
- Initial goal sent to ui-architect

## Next Steps
1. Monitor A2A communication to see coordinator message
2. Work as ui-architect to analyze current UI and create plan
3. Send plan to ui-developer for implementation
4. Use ui-reviewer to quality-check each component
5. Iterate until complete
