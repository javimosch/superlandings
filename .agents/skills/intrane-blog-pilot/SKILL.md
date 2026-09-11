---
name: intrane-blog-pilot
description: |
  Full-stack GTM article pipeline for blog.intrane.fr.
  Write, draft, preview, publish, iterate — using the SuperLandings blog system
  (MongoDB-backed, SSR, paginated, cached). Links every article to an Intrane
  product, repo, or service for go-to-market impact.
tags: blog,intrane,gtm,automaintainer,supercli,machin,a2a,content
---

# Intrane Blog Pilot

## Architecture (current)

```
blog.intrane.fr
  └─ Traefik (addPrefix /blog-intrane-fr)
       └─ Express (serveLandingByDomain → domain match)
            ├─ GET / → SSR index.ejs (paginated + cached 5min)
            └─ GET /:slug → SSR post.ejs (single article)
                 └─ ?preview=true shows drafts

Data: MongoDB blog_posts (model: @intranefr/superbackend)
Cache: cacheLayer (LRU in-memory, 5min TTL)
```

## Infrastructure

| Component | Detail |
|-----------|--------|
| Domain | `blog.intrane.fr` → `188.245.71.48` |
| Container | `superlandings` (Docker) |
| SSH | `ssh root@188.245.71.48` |
| MongoDB | `mongodb://intrane_admin:gtf123@188.245.71.48:27019/superlandings` |
| API | Internal: `http://localhost:3000/saas/api/blog-posts?client=intrane` |
| Model | `/app/node_modules/@intranefr/superbackend/src/models/BlogPost.js` |
| Views | `/app/views/blog-intrane-fr/{index,post,post-card}.ejs` |
| SSR logic | `/app/routes/serve.js` → `serveLandingByDomain` |

## Article Pipeline

### 1. Draft a post

Write article content as HTML (supports h1-h3, p, ul/ol, pre/code, blockquote, a, strong, em).

Slug convention: kebab-case, descriptive, SEO-friendly, max ~80 chars.

### 2. Create draft in MongoDB

The inline `docker exec -e MONGO_URI='...'` pattern in older versions of this
skill fails with `AuthenticationFailed` because the hardcoded URI drifts. Use
the dotenv-based temp-file workflow instead — it reads `/app/.env` inside the
container, which always has the correct credentials:

```bash
# 1. Write a temp JS upsert script locally
cat > /tmp/mkpost.js << 'EOF'
require('dotenv').config({ path: '/app/.env' });
const fs = require('fs'), mongoose = require('mongoose');
const BlogPost = require('/app/node_modules/@intranefr/superbackend/src/models/BlogPost');
const data = JSON.parse(fs.readFileSync('/tmp/post.json', 'utf8'));
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const ex = await BlogPost.findOne({ slug: data.slug, client: data.client });
  if (ex) { Object.assign(ex, data, { publishedAt: ex.publishedAt || new Date() }); await ex.save(); }
  else await BlogPost.create(Object.assign({}, data, { publishedAt: new Date() }));
  console.log('ok:', data.slug); await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
EOF

# 2. Write the post JSON locally (use python3 json.dump for HTML safety)
python3 -c "import json; json.dump(post, open('/tmp/post.json','w'), indent=2)"

# 3. Copy both to the container and run
scp /tmp/mkpost.js /tmp/post.json root@188.245.71.48:/tmp/
ssh root@188.245.71.48 "docker cp /tmp/mkpost.js superlandings:/app/mkpost.js && \
  docker cp /tmp/post.json superlandings:/tmp/post.json && \
  docker exec -w /app superlandings node mkpost.js && \
  docker exec superlandings rm /app/mkpost.js /tmp/post.json && \
  rm /tmp/mkpost.js /tmp/post.json"
```

Set `status: "published"` and `publishedAt` in the JSON to publish directly,
or `status: "draft"` to preview first.

### 3. Preview

```
https://blog.intrane.fr/<slug>?preview=true
```

Draft-only content returns 404 without `?preview=true`. A yellow banner marks draft previews.

### 4. Publish

If you created a draft in step 2, update it to published by re-running the
upsert script with `status: "published"` and `publishedAt` set in the JSON.
The script is idempotent — it upserts by `(slug, client)`.

### 5. Index cache

Published articles appear on the index after cache expires (~5min) or container restart.

### 6. Cross-post to dev.to

dev.to takes markdown (first line = title, rest = body). The blog uses HTML.
Author the markdown version separately — do not convert the HTML.

```bash
# API key stored in minipostiz SQLite
K=$(sqlite3 ~/.minipostiz/minipostiz.db \
  "select credentials from auth where platform='devto';" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['apiKey'])")

# Create article (published=true)
python3 -c "
import json
md = open('/tmp/article.md').read()
title = md.split(chr(10))[0]
body = chr(10).join(md.split(chr(10))[1:]).strip()
json.dump({'article': {'title': title, 'body_markdown': body, 'published': True, 'tags': ['tag1','tag2']}}, open('/tmp/devto-body.json','w'))
"
curl -s -X POST "https://dev.to/api/articles" \
  -H "api-key: $K" -H "Content-Type: application/json" \
  -d @/tmp/devto-body.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('url:', d.get('url'))"

# Update existing article (PUT)
curl -s -X PUT "https://dev.to/api/articles/<id>" \
  -H "api-key: $K" -H "Content-Type: application/json" \
  -d @/tmp/devto-body.json

# Check metrics (views, reactions, comments)
curl -s "https://dev.to/api/articles/<id>" -H "api-key: $K" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'views={d[\"page_views_count\"]} reactions={d[\"positive_reactions_count\"]} comments={d[\"comments_count\"]}')"
```

Tag links to `rcmd.intrane.fr` (or other Intrane products) with UTM params so
traffic sources are distinguishable: `?utm_source=devto&utm_medium=article&utm_campaign=<slug>`.

## Article Template

Keep articles in a consistent format:

- **Title**: `<h1>{Hook} — {Value Prop}</h1>`
- **Lead**: 1-2 paragraphs stating the problem
- **Sections**: `<h2>{Section title}</h2>` with supporting paragraphs
- **Lists**: Use `<ul>` or `<ol>` for concrete points
- **CTA**: Closing paragraph linking to product page or GitHub
- **Series nudge**: `<p><strong>Next in this series:</strong> {teaser}</p>`

Tone: direct, opinionated, technical but approachable. Short paragraphs. Strong claims backed by reasoning.

## GTM Article Series (completed)

| # | Article | Slug | GTMs | Status |
|---|---------|------|------|--------|
| 1 | AI That Ships — Why I Built a Verified PR Bot | `ai-that-ships-automaintainer` | AutoMaintainer (flagship) | published |
| 2 | mago — The €20 Autonomous Agent | `mago-the-20-euro-autonomous-agent` | mago (economy tier) | published |
| 3 | SuperCLI — 10,000 Tools, One Binary | `supercli-10000-tools-one-binary-zero-config` | SuperCLI (OSS stars) | published |
| 4 | Self-Hosted Analytics — Why I Built What GA Won't Give You | `self-hosted-analytics-why-i-built-what-ga-wont-give-you` | SuperInsights | published |
| 5 | Machin in Production — Real Products Built with MFL | `machin-in-production-real-products-built-with-mfl` | machin (language adoption) | published |
| 6 | a2a — When AI Agents Talk to Each Other | `a2a-when-ai-agents-talk-to-each-other` | a2a-skill (framework) | published |
| 7 | The Self-Hosted Stack That Runs My Infrastructure | `the-self-hosted-stack-that-runs-my-infrastructure` | All (capstone) | published |
| 8 | AI Only Executes What We Imagine — Why Deep Thinking Beats Execution Now | `ai-execution-imagination-deep-thinking` | AI/SWE philosophy | published |
| 9 | Stop Giving AI Agents Your SSH Keys | `stop-giving-ai-agents-your-ssh-keys` | remotecmd (security angle) | published |
| 10 | remotecmd parallel streams, faster than scp | `remotecmd-parallel-streams-faster-than-scp` | remotecmd (file transfer) | published |
| 11 | Your Homelab Behind CGNAT — Now Reachable for Free | `your-homelab-behind-cgnat-now-reachable-for-free` | remotecmd (free tier launch) | published |

## Key Implementation Details

### SSR (not client-side)
- `serveLandingByDomain` fetches BlogPost from MongoDB via mongoose
- Data passed as `res.locals.posts` (index) or `res.locals.post` (article)
- EJS renders directly — no JS fetching, no loading spinners

### Pagination
- `?page=N` and `?limit=N` query params
- Default: 10 posts/page, max 50
- Page nav rendered server-side with ellipsis for large ranges

### Per-client isolation
- All queries filter by `client: 'intrane'`
- Slug uniqueness enforced per client
- API supports `?client=<name>` for multi-blog

### Caching
- Uses superbackend's `cacheLayer` (in-memory LRU)
- Index cached for 5 minutes: `cacheLayer.set(key, data, { ttlSeconds: 300 })`
- Eviction policy: LRU

### Draft preview
- `?preview=true` bypasses `status: 'published'` filter
- Yellow banner on draft preview pages
- Public gets 404 on draft URLs without preview param

## Common Operations

```bash
# View logs
docker logs superlandings --tail 50

# Restart container
docker restart superlandings

# Quick DB query
docker exec -e MONGO_URI='...' -i superlandings node -e '
const m=require("/app/node_modules/mongoose");
const BP=require("/app/node_modules/@intranefr/superbackend/src/models/BlogPost");
(async()=>{await m.connect(process.env.MONGO_URI);const p=await BP.find({client:"intrane"}).sort({publishedAt:-1}).lean();p.forEach(x=>console.log(x.status.padEnd(10),x.slug));await m.disconnect();})();
'

# Count posts per client
docker exec -e MONGO_URI='...' -i superlandings node -e '
const m=require("/app/node_modules/mongoose");
const BP=require("/app/node_modules/@intranefr/superbackend/src/models/BlogPost");
(async()=>{await m.connect(process.env.MONGO_URI);const r=await BP.aggregate([{$group:{_id:"$client",count:{$sum:1},published:{$sum:{$cond:[{$eq:["$status","published"]},1,0]}}}}]);console.table(r);await m.disconnect();})();
'
```

## Gotchas

- `app.use('/*', ...)` causes `req.path` to always be `/`. Use `req.originalUrl` instead
- Traefik `addPrefix /blog-intrane-fr` means the Express path includes `/blog-intrane-fr/` prefix
- The superbackend middleware is dual-mounted at `/saas` and `/blog-intrane-fr/saas` to handle the prefix
- Container restart clears EJS cache but MongoDB data persists
- The `cacheLayer` is in-memory only (no Redis by default) — survives restarts only via MongoDB offload

## Analytics — Vigie (not SuperInsights)

blog.intrane.fr uses **Vigie** (`vigie.intrane.fr/vigie.js` in the SSR head template), not SuperInsights, for pageview/referrer/UTM tracking. SuperInsights (MongoDB on vps1) is the legacy system — do not use it for current blog analytics.

Query blog stats via the Vigie API:

```bash
TOKEN="faebfd6050b80ee0a0784e4e62968e1c83f6848af8aaba60"  # VIGIE_ADMIN_TOKEN on dk1
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://vigie.intrane.fr/api/stats/overview?site=blog.intrane.fr&since=24h"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://vigie.intrane.fr/api/stats/pages?site=blog.intrane.fr&since=24h&limit=20"
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://vigie.intrane.fr/api/stats/referrers?site=blog.intrane.fr&since=24h"
```

Vigie stores UTM params (`utm_source`, `utm_medium`, `utm_campaign`) in dedicated SQLite columns. For UTM breakdowns not exposed by the stats API, query SQLite directly on dk1:

```bash
ssh dk1 "sqlite3 /opt/vigie/vigie.db \
  \"SELECT utm_source, utm_campaign, count(*) FROM events \
   WHERE site='blog.intrane.fr' GROUP BY utm_source, utm_campaign \
   ORDER BY count(*) DESC;\""
```
