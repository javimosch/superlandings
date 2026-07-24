const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { bootApp, addLanding, cleanupLandings } = require('./_helpers');
const { LANDINGS_DIR, ensureDirectories } = require('../../lib/db');
const { serveLandingBySlug, serveEjsSubPage } = require('../../routes/serve');

const SLUG = 'func-serve-' + Date.now();

function writeLandingFiles(slug, files) {
  const dir = path.join(LANDINGS_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
}

// Build a minimal app that mounts the slug + ejs-sub-page routes.
function buildServeApp() {
  ensureDirectories();
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', [path.join(__dirname, '..', '..', 'views'), LANDINGS_DIR]);
  app.use((req, res, next) => { req.app = app; next(); });
  app.get('/:slug', serveLandingBySlug);
  app.get('/:slug/*', serveEjsSubPage);
  return app;
}

// Make an HTTP request with a custom Host header (fetch forbids overriding Host).
function reqWithHost(port, host, urlPath) {
  return new Promise((resolve, reject) => {
    const r = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, headers: { Host: host } },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      },
    );
    r.on('error', reject);
    r.end();
  });
}

test('serveLandingBySlug serves an html landing', async () => {
  writeLandingFiles(SLUG, { 'index.html': '<h1>served by slug</h1>' });
  await addLanding({ id: 'S1', slug: SLUG, name: 'S', type: 'html', domains: [] });
  const app = buildServeApp();
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/${SLUG}`);
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.ok(text.includes('served by slug'));
  } finally {
    server.close();
    await cleanupLandings(SLUG);
  }
});

test('serveLandingBySlug returns 404 for unknown slug', async () => {
  const app = buildServeApp();
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/no-such-landing-xyz`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test('serveLandingBySlug rejects path-traversal slugs', async () => {
  const app = buildServeApp();
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/..%2Fetc`);
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test('serveLandingBySlug serves an ejs landing (renders index.ejs)', async () => {
  const ejsSlug = SLUG + '-ejs';
  writeLandingFiles(ejsSlug, { 'index.ejs': '<h1>hello ejs</h1>' });
  await addLanding({ id: 'S2', slug: ejsSlug, name: 'EJS', type: 'ejs', domains: [] });
  const app = buildServeApp();
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/${ejsSlug}`);
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.ok(text.includes('hello ejs'));
  } finally {
    server.close();
    await cleanupLandings(ejsSlug);
  }
});

test('serveEjsSubPage serves a sub page of an ejs landing', async () => {
  const ejsSlug = SLUG + '-sub';
  writeLandingFiles(ejsSlug, { 'index.ejs': '<p>home</p>', 'about.ejs': '<p>about page</p>' });
  await addLanding({ id: 'S3', slug: ejsSlug, name: 'EJS', type: 'ejs', domains: [] });
  const app = buildServeApp();
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/${ejsSlug}/about`);
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.ok(text.includes('about page'));
  } finally {
    server.close();
    await cleanupLandings(ejsSlug);
  }
});

test('serveEjsSubPage rejects path-traversal page names', async () => {
  const ejsSlug = SLUG + '-trav';
  writeLandingFiles(ejsSlug, { 'index.ejs': '<p>home</p>' });
  await addLanding({ id: 'S5', slug: ejsSlug, name: 'EJS', type: 'ejs', domains: [] });
  const app = buildServeApp();
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/${ejsSlug}/..%2Fsecret`);
    assert.equal(res.status, 400);
  } finally {
    server.close();
    await cleanupLandings(ejsSlug);
  }
});

test('domain-based serving serves a published landing by Host header', async () => {
  const domainSlug = SLUG + '-domain';
  writeLandingFiles(domainSlug, { 'index.html': '<h1>by domain</h1>' });
  await addLanding({
    id: 'S4', slug: domainSlug, name: 'D', type: 'html', published: true,
    domains: [{ domain: 'func-serve.example.com', published: true }],
  });
  const { server, close } = await bootApp();
  const port = server.address().port;
  try {
    // Traefik adds /<slug>/ prefix in production; simulate that path
    const r = await reqWithHost(port, 'func-serve.example.com', '/' + domainSlug + '/');
    assert.equal(r.status, 200);
    assert.ok(r.body.includes('by domain'));
  } finally {
    await close();
    await cleanupLandings(domainSlug);
  }
});

test('domain-based serving falls through for unknown domain', async () => {
  const { server, close } = await bootApp();
  const port = server.address().port;
  try {
    const r = await reqWithHost(port, 'no-such-domain.example.com', '/');
    // Unknown domain falls through serveLandingByDomain → next() → other routes
    assert.ok(r.status !== 200 || !r.body.includes('by domain'));
  } finally {
    await close();
  }
});

// ─── Regression tests: slug-based serving through the REAL app (app.js) ───
// These guard against the regression where the server.js → app.js refactor
// dropped the app.get('/:slug', serveLandingBySlug) and static-asset routes.
// The earlier tests above use a custom mini-app (buildServeApp) that bypasses
// app.js entirely, so they cannot catch a missing route mount in app.js.

test('REAL app: GET /:slug serves an html landing', async () => {
  const realSlug = SLUG + '-real-html';
  writeLandingFiles(realSlug, { 'index.html': '<h1>real app slug</h1>' });
  await addLanding({ id: 'R1', slug: realSlug, name: 'R', type: 'html', domains: [] });
  const { baseUrl, close } = await bootApp();
  try {
    const res = await fetch(`${baseUrl}/${realSlug}`);
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.ok(text.includes('real app slug'));
  } finally {
    await close();
    await cleanupLandings(realSlug);
  }
});

test('REAL app: GET /:slug returns 404 for unknown slug', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const res = await fetch(`${baseUrl}/no-such-landing-real-app-xyz`);
    assert.equal(res.status, 404);
  } finally {
    await close();
  }
});

test('REAL app: GET /:slug rejects path-traversal slugs', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const res = await fetch(`${baseUrl}/..%2Fetc`);
    assert.equal(res.status, 400);
  } finally {
    await close();
  }
});

test('REAL app: GET /:slug serves an ejs landing (renders index.ejs)', async () => {
  const ejsSlug = SLUG + '-real-ejs';
  writeLandingFiles(ejsSlug, { 'index.ejs': '<h1>real app ejs</h1>' });
  await addLanding({ id: 'R2', slug: ejsSlug, name: 'EJS', type: 'ejs', domains: [] });
  const { baseUrl, close } = await bootApp();
  try {
    const res = await fetch(`${baseUrl}/${ejsSlug}`);
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.ok(text.includes('real app ejs'));
  } finally {
    await close();
    await cleanupLandings(ejsSlug);
  }
});

test('REAL app: GET /:slug/:page serves an ejs sub-page', async () => {
  const ejsSlug = SLUG + '-real-sub';
  writeLandingFiles(ejsSlug, { 'index.ejs': '<p>home</p>', 'about.ejs': '<p>real about</p>' });
  await addLanding({ id: 'R3', slug: ejsSlug, name: 'EJS', type: 'ejs', domains: [] });
  const { baseUrl, close } = await bootApp();
  try {
    const res = await fetch(`${baseUrl}/${ejsSlug}/about`);
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.ok(text.includes('real about'));
  } finally {
    await close();
    await cleanupLandings(ejsSlug);
  }
});

test('REAL app: static assets served for a static landing by slug', async () => {
  const staticSlug = SLUG + '-real-static';
  writeLandingFiles(staticSlug, {
    'index.html': '<link rel="stylesheet" href="style.css">',
    'style.css': 'body{color:red}',
  });
  await addLanding({ id: 'R4', slug: staticSlug, name: 'S', type: 'static', domains: [] });
  const { baseUrl, close } = await bootApp();
  try {
    const res = await fetch(`${baseUrl}/${staticSlug}/style.css`);
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.ok(text.includes('color:red'));
  } finally {
    await close();
    await cleanupLandings(staticSlug);
  }
});

test('REAL app: static asset path traversal is rejected', async () => {
  const staticSlug = SLUG + '-real-trav';
  writeLandingFiles(staticSlug, {
    'index.html': '<p>home</p>',
    'style.css': 'body{color:red}',
  });
  await addLanding({ id: 'R5', slug: staticSlug, name: 'S', type: 'static', domains: [] });
  const { baseUrl, close } = await bootApp();
  try {
    // URL-encoded ../ must not escape the landing directory
    const res = await fetch(`${baseUrl}/${staticSlug}/..%2F..%2F..%2Fetc%2Fpasswd`);
    assert.equal(res.status, 404);
  } finally {
    await close();
    await cleanupLandings(staticSlug);
  }
});

test('safeResolvePath rejects path traversal', () => {
  const { safeResolvePath } = require('../../routes/serve');
  const baseDir = '/data/landings/my-landing';
  // Normal file within baseDir resolves correctly
  assert.ok(safeResolvePath(baseDir, 'style.css').startsWith(baseDir));
  // Path traversal attempts return null
  assert.equal(safeResolvePath(baseDir, '../../etc/passwd'), null);
  assert.equal(safeResolvePath(baseDir, '../../../etc/passwd'), null);
  assert.equal(safeResolvePath(baseDir, 'sub/../../etc/passwd'), null);
  // Empty path returns null
  assert.equal(safeResolvePath(baseDir, ''), null);
});
