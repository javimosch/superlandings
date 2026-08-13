const express = require('express');
const fs = require('fs');
const path = require('path');
const { LANDINGS_DIR, migrateDomains } = require('../lib/db');
const { readDB, getEngine } = require('../lib/store');
const { getVersions, restoreVersionToDisk, getLandingFsDir } = require('../lib/versions');
const { writeDirectoryFilesSync } = require('../lib/db');
const { i18nMiddleware, createTranslationHelper } = require('../lib/i18n');
const { isValidSlug } = require('../lib/utils');
const mongoose = require('mongoose');

const router = express.Router();



// --- path-traversal guards ------------------------------------------------------
// isValidSlug is now shared from lib/utils so all routes use the same guard.
function isValidPage(page) {
  return typeof page === 'string' && page.length > 0 && /^[a-z0-9][a-z0-9\-_]*$/i.test(page);
}

// Resolve a relative file path inside baseDir, rejecting path-traversal attempts.
// Returns the resolved absolute path or null if it escapes baseDir.
function safeResolvePath(baseDir, relPath) {
  if (!relPath) return null;
  const resolved = path.resolve(baseDir, relPath);
  const normalizedBase = path.resolve(baseDir) + path.sep;
  if (resolved !== path.resolve(baseDir) && !resolved.startsWith(normalizedBase)) return null;
  return resolved;
}
// -------------------------------------------------------------------------------

// --- serve-time head injection (INJECT_HEAD_HTML env) ---------------------------
// Injects a snippet (e.g. an analytics <script>) before </head> of every served
// landing page. The vigie snippet computes its site from location.hostname, so one
// global value works for every domain. Dedupe: skipped when the snippet's src is
// already in the page.
const INJECT_HEAD_HTML = process.env.INJECT_HEAD_HTML || '';

function injectHead(html) {
  if (!INJECT_HEAD_HTML || typeof html !== 'string') return html;
  if (html.indexOf('</head>') === -1) return html;
  const m = INJECT_HEAD_HTML.match(/src="([^"]+)"/);
  if (m && html.indexOf(m[1]) !== -1) return html;
  return html.replace('</head>', INJECT_HEAD_HTML + '</head>');
}

function sendHtmlInjected(res, filePath) {
  if (!INJECT_HEAD_HTML || !filePath.endsWith('.html')) return res.sendFile(filePath);
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) return res.sendFile(filePath);
    res.type('html').send(injectHead(html));
  });
}

function renderInjected(res, view) {
  if (!INJECT_HEAD_HTML) return res.render(view);
  res.render(view, (err, html) => {
    if (err) { console.error('[inject] render error:', err); return res.status(500).send('Error rendering page'); }
    res.type('html').send(injectHead(html));
  });
}
// -------------------------------------------------------------------------------

async function attachDb(req, res, next) {
  try {
    req.db = await readDB();
    next();
  } catch (err) {
    next(err);
  }
}

async function domainStaticMiddleware(req, res, next) {
  const host = req.get('host');
  if (!host) return next();

  const db = req.db || await readDB();
  const landing = db.landings.find(l =>
    l.published && (l.type === 'static' || l.type === 'virtual') && l.domains &&
    migrateDomains(l.domains).some(d => d.domain === host || d.domain === host.replace(/:\d+$/, ''))
  );

  if (landing) {
    const landingDir = getLandingFsDir(landing);
    let filePath = req.url.split('?')[0];
    if (filePath.startsWith(`/${landing.slug}/`)) filePath = filePath.slice(`/${landing.slug}`.length);

    const fullPath = safeResolvePath(landingDir, filePath);
    if (fullPath && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) return res.sendFile(fullPath);
  }

  next();
}

async function slugStaticMiddleware(req, res, next) {
  const { slug } = req.params;
  const subPath = req.params[0] || '';

  const db = req.db || await readDB();
  const landing = db.landings.find(l => l.slug === slug);

  if (landing && (landing.type === 'static' || landing.type === 'virtual')) {
    const landingDir = getLandingFsDir(landing);
    const filePath = subPath.replace(/^\//, '').replace(/\/$/, '');
    const fullPath = safeResolvePath(landingDir, filePath);

    if (fullPath && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) return res.sendFile(fullPath);
  }

  next();
}

async function serveLandingByDomain(req, res, next) { console.log("[SLBD] path=" + req.path + " host=" + req.get("host"));
  try {
    console.log('[SLBD] path=' + req.path + ' host=' + req.get('host') + ' url=' + req.url);
    const host = req.get('host');
    if (!host) return next();

    const db = req.db || await readDB();
    const landing = db.landings.find(l =>
      l.published && l.domains &&
      migrateDomains(l.domains).some(d => d.domain === host || d.domain === host.replace(/:\d+$/, ''))
    );

    if (!landing) return next();
    if (!isValidSlug(landing.slug)) return res.status(400).send('Invalid slug');

    const landingDir = getLandingFsDir(landing);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (landing.type === 'ejs') {
      const middleware = i18nMiddleware(landingDir);
      await new Promise((resolve, reject) => {
        middleware(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Determine page name from path.
      // With Traefik addPrefix, the path may include /<slug>/ prefix even for domain-based routing.
      let page = 'index';
      let rawPath = (req.originalUrl || req.url || req.path).split('?')[0];

      // Strip leading /<slug> if present (added by Traefik addPrefix)
      const slugPrefix = '/' + landing.slug;
      if (rawPath.startsWith(slugPrefix + '/') || rawPath === slugPrefix) {
        const rest = rawPath === slugPrefix ? '' : rawPath.slice(slugPrefix.length + 1);
        if (rest) page = rest;
      } else if (rawPath !== '/') {
        page = rawPath.replace(/^\//, '').replace(/\.ejs$/, '');
      }

      // Strip language prefix if present
      if (page === 'fr' || page === 'en') { page = 'index'; }
      else if (page.startsWith('fr/') || page.startsWith('en/')) { page = page.slice(3); }

      if (!isValidPage(page)) return res.status(400).send('Invalid page');
      const templatePath = path.join(landingDir, page + '.ejs');

      // For blog-intrane-fr: SSR — fetch from DB (runs BEFORE template check to pass data)
      if (landing.slug === 'blog-intrane-fr') {
        // Index page: fetch all published posts
        if (page === 'index') {
          try {
            const BlogPost = mongoose.model('BlogPost');
            const qs = (req.originalUrl || '').split('?')[1] || '';
            const qp = Object.fromEntries(qs.split('&').filter(Boolean).map(p => { const [k,v] = p.split('='); return [k, decodeURIComponent(v||'')]; }));
            const limit = Math.min(parseInt(qp.limit) || 10, 50);
            const currentPage = Math.max(parseInt(qp.page) || 1, 1);
            const skip = (currentPage - 1) * limit;
            const filterTag = (qp.tag || '').trim();
            const filterCat = (qp.category || '').trim();
            const query = { client: 'intrane', status: 'published' };
            if (filterTag) query.tags = filterTag;
            if (filterCat) query.category = filterCat;
            const [posts, total, tagsAgg, catsAgg] = await Promise.all([
              BlogPost.find(query).sort({ publishedAt: -1, createdAt: -1 }).select('title slug excerpt category tags publishedAt').skip(skip).limit(limit).lean(),
              BlogPost.countDocuments(query),
              BlogPost.aggregate([{ $match: { client: 'intrane', status: 'published', tags: { $ne: '', $exists: true } } }, { $unwind: '$tags' }, { $group: { _id: '$tags', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 30 }]),
              BlogPost.aggregate([{ $match: { client: 'intrane', status: 'published', category: { $ne: '', $exists: true } } }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }])
            ]);
            res.locals.posts = posts || [];
            res.locals.pagination = { currentPage, total, limit, totalPages: Math.ceil(total / limit), hasPrev: currentPage > 1, hasNext: currentPage * limit < total };
            res.locals.tags = (tagsAgg || []).map(t => ({ name: t._id, count: t.count }));
            res.locals.categories = (catsAgg || []).map(c => ({ name: c._id, count: c.count }));
            res.locals.filterTag = filterTag;
            res.locals.filterCat = filterCat;
          } catch (err) {
            console.error('[Blog SSR] Error:', err.message);
            res.locals.posts = [];
            res.locals.pagination = { currentPage: 1, total: 0, limit: 10, totalPages: 0, hasPrev: false, hasNext: false };
            res.locals.tags = [];
            res.locals.categories = [];
            res.locals.filterTag = '';
            res.locals.filterCat = '';
          }
        }

        // Post page: fetch single post by slug
        if (page !== 'index') {
          try {
            const BlogPost = mongoose.model('BlogPost');
            const preview = ((req.originalUrl || '').split('?')[1] || '').includes('preview=true');
            const postFilter = { slug: page, client: 'intrane' };
            if (!preview) postFilter.status = 'published';
            const post = await BlogPost.findOne(postFilter).lean();
            if (!post) return res.status(404).send('Post not found');
            res.locals.post = post;
          } catch (err) {
            console.error('[Blog SSR] Error fetching post:', err);
            res.locals.post = null;
          }
        }
      }

      // If the exact template exists, render it (now with SSR data in locals)
      if (fs.existsSync(templatePath)) {
        res.locals.t = createTranslationHelper(res.locals.t || {});
        return renderInjected(res, path.join(landing.slug, page));
      }

      // Fallback: render post.ejs for blog posts when no direct template exists
      if (landing.slug === 'blog-intrane-fr' && page !== 'index') {
        const postTemplate = path.join(landingDir, 'post.ejs');
        if (fs.existsSync(postTemplate)) {
          res.locals.t = createTranslationHelper(res.locals.t || {});
          return renderInjected(res, path.join(landing.slug, 'post'));
        }
      }

      return res.status(404).send('Page not found');
    }

    if (landing.type === 'html' || landing.type === 'static' || landing.type === 'virtual') {
      const indexPath = await ensureLandingContent(landing);
      return sendHtmlInjected(res, indexPath);
    }
  } catch (error) {
    console.error('Error serving landing by domain:', error);
    res.status(500).send('Error loading landing page');
  }
}

async function serveLandingBySlug(req, res, next) {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) return res.status(400).send('Invalid slug');
    const db = req.db || await readDB();

    let actualSlug = slug;
    let lang = null;
    const slugParts = slug.split('/');

    if (slugParts.length === 2) {
      const potentialSlug = slugParts[0];
      const potentialLang = slugParts[1];
      if (potentialLang === 'fr' || potentialLang === 'en') {
        const landing = db.landings.find(l => l.slug === potentialSlug);
        if (landing) {
          actualSlug = potentialSlug;
          lang = potentialLang;
          req.params.slug = actualSlug;
          req.params.lang = lang;
        }
      }
    }

    const landing = db.landings.find(l => l.slug === actualSlug);
    if (!landing) return res.status(404).send('Landing not found');
    if (!isValidSlug(landing.slug)) return res.status(400).send('Invalid slug');

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (landing.type === 'html' || landing.type === 'static' || landing.type === 'virtual') {
      const indexPath = await ensureLandingContent(landing);
      return sendHtmlInjected(res, indexPath);
    } else if (landing.type === 'ejs') {
      const landingDir = getLandingFsDir(landing);
      if (lang && !req.params.lang) req.params.lang = lang;

      const middleware = i18nMiddleware(landingDir);
      await new Promise((resolve, reject) => {
        middleware(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      let page = req.path === '/' ? 'index' : req.path.replace(/^\//, '').replace(/\.ejs$/, '');

      if (page.startsWith(actualSlug + '/')) {
        page = page.slice(actualSlug.length + 1);
      } else if (page === actualSlug) {
        page = 'index';
      }
      if (page === 'fr' || page === 'en') page = 'index';
      else if (page.startsWith('fr/') || page.startsWith('en/')) page = page.slice(3);
      if (!page) page = 'index';

      const landingDir2 = getLandingFsDir(landing);
      if (!isValidPage(page)) return res.status(400).send('Invalid page');
      const templatePath = path.join(landingDir2, page + '.ejs');

      if (fs.existsSync(templatePath)) {
        res.locals.t = createTranslationHelper(res.locals.t || {});
        return renderInjected(res, path.join(actualSlug, page));
      }

      if (actualSlug === 'blog-intrane-fr' && page !== 'index') {
        const postTemplate = path.join(landingDir2, 'post.ejs');
        if (fs.existsSync(postTemplate)) {
          res.locals.postSlug = page;
          res.locals.t = createTranslationHelper(res.locals.t || {});
          return renderInjected(res, path.join(actualSlug, 'post'));
        }
      }

      res.status(404).send('Landing not found');
    }
    res.status(404).send('Landing not found');
  } catch (error) {
    console.error('Error serving landing:', error);
    res.status(500).send('Error loading landing page');
  }
}

async function serveEjsSubPage(req, res, next) {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) return res.status(400).send('Invalid slug');
    const page = (req.params[0] || '').replace(/^\//, '').replace(/\.ejs$/, '');
    if (!page) return next();

    const db = req.db || await readDB();
    const pathParts = req.path.split('/').filter(Boolean);
    let lang = null;
    let actualSlug = slug;
    let actualPage = page;

    if (pathParts.length >= 2 && pathParts[0] === slug && (pathParts[1] === 'fr' || pathParts[1] === 'en')) {
      lang = pathParts[1];
      if (page === lang) {
        const landing = db.landings.find(l => l.slug === slug);
        if (!landing || landing.type !== 'ejs') return next();
        const landingDir = getLandingFsDir(landing);
        req.params.lang = lang;
        const middleware = i18nMiddleware(landingDir);
        await new Promise((resolve, reject) => {
          middleware(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.locals.t = createTranslationHelper(res.locals.t || {});
        return renderInjected(res, path.join(slug, 'index'));
      }
      req.params.lang = lang;
      if (page.startsWith(lang + '/')) actualPage = page.slice(lang.length + 1);
    }

    const landing = db.landings.find(l => l.slug === actualSlug);
    if (!landing || landing.type !== 'ejs') return next();
    if (!isValidSlug(landing.slug)) return res.status(400).send('Invalid slug');
    const landingDir = getLandingFsDir(landing);

    const middleware = i18nMiddleware(landingDir);
    await new Promise((resolve, reject) => {
      middleware(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (!isValidPage(actualPage)) return res.status(400).send('Invalid page');
    const templatePath = path.join(landingDir, actualPage + '.ejs');
    if (!fs.existsSync(templatePath)) {
      if (actualSlug === 'blog-intrane-fr') {
        const postTemplate = path.join(landingDir, 'post.ejs');
        if (fs.existsSync(postTemplate)) {
          res.locals.postSlug = actualPage;
          res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.set('Pragma', 'no-cache');
          res.set('Expires', '0');
          res.locals.t = createTranslationHelper(res.locals.t || {});
          return renderInjected(res, path.join(actualSlug, 'post'));
        }
      }
      return res.status(404).send('Page not found');
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.locals.t = createTranslationHelper(res.locals.t || {});
    renderInjected(res, path.join(actualSlug, actualPage));
  } catch (error) {
    console.error('Error serving EJS sub-page:', error);
    res.status(500).send('Error loading page');
  }
}

async function ensureLandingContent(landing) {
  const landingDir = getLandingFsDir(landing);
  const indexPath = path.join(landingDir, 'index.html');

  if (fs.existsSync(indexPath)) {
    if (getEngine() === 'mongo' && landing.updatedAt) {
      const fileMtime = fs.statSync(indexPath).mtimeMs;
      const landingUpdated = new Date(landing.updatedAt).getTime();
      if (landingUpdated > fileMtime) {
        fs.unlinkSync(indexPath);
      } else {
        return indexPath;
      }
    } else {
      return indexPath;
    }
  }

  const versions = await getVersions(landing.id);
  const candidates = [];
  if (landing.currentVersionId) candidates.push(landing.currentVersionId);
  for (const v of versions || []) {
    if (!candidates.includes(v.id)) candidates.push(v.id);
  }

  for (const vid of candidates) {
    const ok = await restoreVersionToDisk(landing, vid);
    if (ok && fs.existsSync(indexPath)) return indexPath;
  }

  if (getEngine() === 'mongo') {
    if (landing.type === 'html' && typeof landing.content === 'string') {
      fs.mkdirSync(landingDir, { recursive: true });
      fs.writeFileSync(indexPath, landing.content);
      return indexPath;
    }
    if (landing.type === 'virtual' && Array.isArray(landing.files)) {
      writeDirectoryFilesSync(landingDir, landing.files, { clearExisting: false });
      if (fs.existsSync(indexPath)) return indexPath;
    }
  }

  console.warn('Falling back to placeholder for ' + landing.slug);
  fs.mkdirSync(landingDir, { recursive: true });
  fs.writeFileSync(indexPath, '<html><body><h1>Landing content missing</h1><p>The content for "' + landing.slug + '" could not be restored.</p></body></html>');
  return indexPath;
}

module.exports = {
  attachDb,
  domainStaticMiddleware,
  slugStaticMiddleware,
  serveLandingByDomain,
  serveLandingBySlug,
  serveEjsSubPage,
};
