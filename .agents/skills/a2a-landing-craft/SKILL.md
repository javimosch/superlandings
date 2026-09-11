---
name: a2a-landing-craft
description: How to create a new landing page on the SuperLandings CMS using sl-cli. For a2a agent teams crafting landings collaboratively.
trigger: /a2a-landing-craft
tags: superlandings,landing,sl-cli,a2a
---

# A2A Landing Craft — Create a New Landing Page

> **Read-only skill.** Use as reference. Do NOT modify existing landings (especially jar-intrane).

> **Caveat (verified 2026-08-04): `cli/index.js` does not exist in the current checkout.**
> The only CLI present is root-level `cli.js` (`node cli.js <slug> <html-file> [name]`), a
> different, **local-only** tool — it writes to local `data/db.json` / `data/landings/<slug>/`
> and never touches MongoDB or the deployed site. Verify `cli/index.js` exists before trusting
> any `MODE=staging node cli/index.js landing ...` command below; if it's missing, this skill
> is stale for that step. To update an **existing production** landing (e.g. `intrane-fr`), use
> the direct-deploy path documented in `jar-intrane-fr-blog-manage` instead: scp the HTML, then
> `docker cp` it into `superlandings:/app/data/landings/<slug>/index.html`, sync both
> `landing-cache` copies, and `docker restart superlandings`.

## Project

- **Location**: `~/ai/superlandings`
- **CLI**: `node cli/index.js` (or `npm run sl-cli`) — **unverified, see caveat above**
- **Domain**: `https://superlandings.intrane.fr`

## Prerequisites

```bash
cd ~/ai/superlandings
# Ensure dependencies are installed
npm install
```

## Step 1 — Create the Landing

```bash
cd ~/ai/superlandings
MODE=staging node cli/index.js landing create \
  --name "Landing Name" \
  --slug <unique-slug> \
  --type html
```

**Landing types:**
- `html` — single `index.html` string stored in MongoDB (easiest)
- `ejs` — EJS template files in `data/landings/<slug>/`
- `virtual` — files object stored in MongoDB
- `static` — files object stored in MongoDB
- `traefik-config` — Traefik config template

**Rules:**
- Slug must be unique across all landings
- Use kebab-case for slugs (e.g., `my-new-landing`)
- Always set `MODE=staging` so the CLI connects to MongoDB

## Step 2 — Write Content

For `html` type landings, write a single HTML file:

```bash
# Create the HTML content
cat > /tmp/landing.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Landing Title</title>
  <style>
    /* Your CSS here */
  </style>
</head>
<body>
  <!-- Your HTML content here -->
</body>
</html>
EOF
```

## Step 3 — Push Content

```bash
cd ~/ai/superlandings
MODE=staging node cli/index.js landing content update <slug> \
  --file /tmp/landing.html \
  --create-version
```

**Always use `--create-version`** — this creates a snapshot for rollback.

## Step 4 — Verify

```bash
cd ~/ai/superlandings
MODE=staging node cli/index.js landing get <slug>
MODE=staging node cli/index.js landing content get <slug> --output /tmp/verify.html
```

## A2A Team Workflow

**Designer agent** (Kimi K2.6):
1. Crafts HTML/CSS design
2. Writes content to `/tmp/landing.html`
3. Messages implementer: "Design ready at /tmp/landing.html"

**Implementer agent** (SWE-1.6):
1. Reads design from `/tmp/landing.html`
2. Creates landing via sl-cli
3. Pushes content with `--create-version`
4. Verifies and reports back

## Critical Rules

- **Never modify existing landings** — only create new ones
- **Always use `MODE=staging`** — without it, CLI falls back to empty local JSON
- **Always use `--create-version`** — for rollback safety
- **MongoDB delay**: CLI takes 2-5s to connect, be patient
- **Slug uniqueness**: Check with `landing list` before creating
