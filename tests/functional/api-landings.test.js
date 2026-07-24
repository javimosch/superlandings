const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { bootApp, req, loginAdmin, addLanding, cleanupLandings } = require('./_helpers');
const { LANDINGS_DIR } = require('../../lib/db');

const PREFIX = 'func-api-' + Date.now();

function writeLandingFiles(slug, files) {
  const dir = path.join(LANDINGS_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
}

test('GET /api/landings with admin session returns list', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/landings', { cookie });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json));
  } finally {
    await close();
  }
});

test('POST /api/landings creates an html landing', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-create';
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/landings', {
      method: 'POST',
      cookie,
      body: { slug, name: 'Test Create', type: 'html', content: '<h1>created</h1>' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.slug, slug);
    assert.equal(r.json.type, 'html');
    // Verify the file was created
    assert.ok(fs.existsSync(path.join(LANDINGS_DIR, slug, 'index.html')));
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('POST /api/landings rejects invalid slug', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/landings', {
      method: 'POST',
      cookie,
      body: { slug: '../etc', name: 'Bad', type: 'html', content: 'x' },
    });
    assert.equal(r.status, 400);
  } finally {
    await close();
  }
});

test('POST /api/landings rejects duplicate slug', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-dup';
  try {
    const cookie = await loginAdmin(baseUrl);
    await req(baseUrl, '/api/landings', {
      method: 'POST', cookie,
      body: { slug, name: 'First', type: 'html', content: '<p>1</p>' },
    });
    const r = await req(baseUrl, '/api/landings', {
      method: 'POST', cookie,
      body: { slug, name: 'Second', type: 'html', content: '<p>2</p>' },
    });
    assert.equal(r.status, 400);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('GET /api/landings/:id/content returns landing content', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-content';
  const id = 'C1';
  try {
    writeLandingFiles(slug, { 'index.html': '<h1>content here</h1>' });
    await addLanding({ id, slug, name: 'Content', type: 'html', domains: [] });
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, `/api/landings/${id}/content`, { cookie });
    assert.equal(r.status, 200);
    assert.ok(r.json.content.includes('content here'));
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('PUT /api/landings/:id updates landing name', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-update';
  const id = 'U1';
  try {
    writeLandingFiles(slug, { 'index.html': '<p>orig</p>' });
    await addLanding({ id, slug, name: 'Orig', type: 'html', domains: [] });
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, `/api/landings/${id}`, {
      method: 'PUT', cookie,
      body: { content: '<p>new content</p>' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.success, true);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('DELETE /api/landings/:id removes the landing', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-delete';
  const id = 'D1';
  try {
    writeLandingFiles(slug, { 'index.html': '<p>del</p>' });
    await addLanding({ id, slug, name: 'Del', type: 'html', domains: [] });
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, `/api/landings/${id}`, { method: 'DELETE', cookie });
    assert.equal(r.status, 200);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('POST /api/landings/:id/cache/clear clears the landing cache', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-cache';
  const id = 'CC1';
  try {
    writeLandingFiles(slug, { 'index.html': '<p>cached</p>' });
    await addLanding({ id, slug, name: 'Cache', type: 'html', domains: [] });
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, `/api/landings/${id}/cache/clear`, { method: 'POST', cookie });
    assert.equal(r.status, 200);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('GET /api/landings/:id/versions lists versions', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-versions';
  const id = 'V1';
  try {
    writeLandingFiles(slug, { 'index.html': '<p>v</p>' });
    await addLanding({ id, slug, name: 'V', type: 'html', domains: [] });
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, `/api/landings/${id}/versions`, { cookie });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json));
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('GET /api/landings/:id/audit returns audit log', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-audit';
  const id = 'A1';
  try {
    writeLandingFiles(slug, { 'index.html': '<p>a</p>' });
    await addLanding({ id, slug, name: 'A', type: 'html', domains: [] });
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, `/api/landings/${id}/audit`, { cookie });
    assert.equal(r.status, 200);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});
