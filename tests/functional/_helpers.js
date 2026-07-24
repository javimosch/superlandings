/**
 * Shared helpers for functional (HTTP) tests.
 *
 * Stubs the modules that pull in ref-saasbackend (which has top-level
 * side-effects / network init that must not run during tests) so the real
 * Express app can be booted in isolation against the JSON persistence engine.
 */
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');

// Inject stubs into require.cache BEFORE app.js is required by any test.
function installStubs() {
  const stubs = {
    [path.join(ROOT, 'lib', 'superbackend.js')]: {
      middleware: () => (req, res, next) => next(),
      services: {},
    },
    [path.join(ROOT, 'lib', 'llm.js')]: {
      generateTraefikYaml: async () => '',
      editLandingContent: async () => ({ content: '', message: 'stubbed' }),
      generateContent: async () => ({ content: '', message: 'stubbed' }),
    },
    [path.join(ROOT, 'lib', 'traefik-settings.js')]: {
      getTraefikSetting: async () => null,
      getAllTraefikSettings: async () => ({}),
      getTraefikFallbacks: () => ({}),
    },
    [path.join(ROOT, 'lib', 'traefik.js')]: {
      deployTraefikConfig: async () => ({ success: true }),
      removeTraefikConfig: async () => ({ success: true }),
      generateTraefikConfig: async () => 'stubbed: yaml',
      generateAdminTraefikConfig: async () => 'stubbed: admin yaml',
      validateTraefikEnv: async () => {},
    },
  };

  for (const [absPath, exports] of Object.entries(stubs)) {
    const cached = require.cache[absPath];
    if (!cached) {
      const Module = require('module');
      const m = new Module(absPath, module);
      m.filename = absPath;
      m.loaded = true;
      m.exports = exports;
      require.cache[absPath] = m;
    }
  }
}

installStubs();

// Use JSON persistence (no Mongo) for functional tests.
process.env.PERSISTENCE_ENGINE = 'json';
// Stable admin creds for login tests.
process.env.ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-pass-123';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';

const { createApp } = require('../../app');
const { readDB, writeDB } = require('../../lib/store');

// Back up db.json once so tests can mutate it freely and we restore on exit.
const DB_FILE = path.join(ROOT, 'data', 'db.json');
const DB_BACKUP = DB_FILE + '.funcbak';

function backupDb() {
  if (fs.existsSync(DB_FILE) && !fs.existsSync(DB_BACKUP)) {
    fs.copyFileSync(DB_FILE, DB_BACKUP);
  }
}

function restoreDb() {
  if (fs.existsSync(DB_BACKUP)) {
    fs.copyFileSync(DB_BACKUP, DB_FILE);
    fs.unlinkSync(DB_BACKUP);
  }
}

backupDb();
process.on('exit', restoreDb);

/**
 * Boot the real app on an ephemeral HTTP port.
 * Returns { baseUrl, server, close }.
 */
async function bootApp() {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const close = () =>
    new Promise((resolve) => server.close(() => { restoreDb(); resolve(); }));
  return { baseUrl, server, close };
}

/** Fetch wrapper that returns { status, headers, body, json }. */
async function req(baseUrl, pathName, opts = {}) {
  const url = baseUrl + pathName;
  const headers = { ...(opts.headers || {}) };
  if (opts.cookie) headers.Cookie = opts.cookie;
  if (opts.body !== undefined && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* not json */ }
  return { status: res.status, headers: res.headers, body: text, json };
}

/** Log in as admin and return the session cookie string. */
async function loginAdmin(baseUrl) {
  const r = await req(baseUrl, '/api/login', {
    method: 'POST',
    body: { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD },
  });
  if (r.status !== 200) throw new Error('admin login failed: ' + r.status + ' ' + r.body);
  const setCookie = r.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  return cookie;
}

/** Add a landing to the DB (and return it). */
async function addLanding(landing) {
  const db = await readDB();
  db.landings = db.landings || [];
  db.landings.push(landing);
  await writeDB(db);
  return landing;
}

/** Remove landings whose slug starts with the given prefix (test cleanup). */
async function cleanupLandings(slugPrefix) {
  const db = await readDB();
  db.landings = (db.landings || []).filter((l) => !l.slug.startsWith(slugPrefix));
  await writeDB(db);
}

module.exports = { bootApp, req, loginAdmin, addLanding, cleanupLandings, restoreDb };
