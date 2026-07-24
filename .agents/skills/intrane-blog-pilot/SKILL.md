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

```bash
docker exec -e MONGO_URI='<uri>' -i superlandings node << 'SCRIPT'
const mongoose = require('/app/node_modules/mongoose');
const BlogPost = require('/app/node_modules/@intranefr/superbackend/src/models/BlogPost');
// create with status: 'draft'
SCRIPT
```

### 3. Preview

```
https://blog.intrane.fr/<slug>?preview=true
```

Draft-only content returns 404 without `?preview=true`. A yellow banner marks draft previews.

### 4. Publish

```bash
# Direct via mongoose:
docker exec -e MONGO_URI='<uri>' -i superlandings node -e '
const m=require("/app/node_modules/mongoose");
const BP=require("/app/node_modules/@intranefr/superbackend/src/models/BlogPost");
(async()=>{await m.connect("...");await BP.updateOne({slug:"...",client:"intrane"},{$set:{status:"published",publishedAt:new Date()}});console.log("Published");await m.disconnect();})();
'

# Or via CLI (if escaping works):
cd /app && node cli.js blog:publish <slug>
```

### 5. Index cache

Published articles appear on the index after cache expires (~5min) or container restart.

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
