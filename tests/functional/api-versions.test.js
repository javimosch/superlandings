const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { bootApp, req, loginAdmin, addLanding, cleanupLandings } = require('./_helpers');
const { LANDINGS_DIR } = require('../../lib/db');

const PREFIX = 'func-ver-' + Date.now();

function writeLandingFiles(slug, files) {
  const dir = path.join(LANDINGS_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
}

async function setupLanding(slug, id) {
  writeLandingFiles(slug, { 'index.html': '<h1>version test</h1>' });
  await addLanding({ id, slug, name: 'VTest', type: 'html', domains: [] });
}

test('POST /api/landings/:id/versions creates a version', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-create';
  const id = 'VC1';
  try {
    await setupLanding(slug, id);
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, `/api/landings/${id}/versions`, {
      method: 'POST', cookie,
      body: { description: 'test version' },
    });
    assert.equal(r.status, 200);
    assert.ok(r.json.id);
    assert.equal(r.json.description, 'test version');
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('GET /api/landings/:id/versions/:versionId returns a single version', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-getone';
  const id = 'VC2';
  try {
    await setupLanding(slug, id);
    const cookie = await loginAdmin(baseUrl);
    const created = await req(baseUrl, `/api/landings/${id}/versions`, {
      method: 'POST', cookie, body: { description: 'v1' },
    });
    const vid = created.json.id;
    const r = await req(baseUrl, `/api/landings/${id}/versions/${vid}`, { cookie });
    assert.equal(r.status, 200);
    assert.equal(r.json.id, vid);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('GET /api/landings/:id/versions/:versionId/preview returns content', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-preview';
  const id = 'VC3';
  try {
    await setupLanding(slug, id);
    const cookie = await loginAdmin(baseUrl);
    const created = await req(baseUrl, `/api/landings/${id}/versions`, {
      method: 'POST', cookie, body: { description: 'v1' },
    });
    const vid = created.json.id;
    const r = await req(baseUrl, `/api/landings/${id}/versions/${vid}/preview`, { cookie });
    assert.equal(r.status, 200);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('POST /api/landings/:id/versions/:versionId/rollback restores content', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-rollback';
  const id = 'VC4';
  try {
    await setupLanding(slug, id);
    const cookie = await loginAdmin(baseUrl);
    const created = await req(baseUrl, `/api/landings/${id}/versions`, {
      method: 'POST', cookie, body: { description: 'v1' },
    });
    const vid = created.json.id;
    const r = await req(baseUrl, `/api/landings/${id}/versions/${vid}/rollback`, {
      method: 'POST', cookie,
    });
    assert.equal(r.status, 200);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('GET /api/landings/:id/versions/:versionId/diff returns diff data', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-diff';
  const id = 'VC5';
  try {
    await setupLanding(slug, id);
    const cookie = await loginAdmin(baseUrl);
    const created = await req(baseUrl, `/api/landings/${id}/versions`, {
      method: 'POST', cookie, body: { description: 'v1' },
    });
    const vid = created.json.id;
    // Update content to create a diff
    await req(baseUrl, `/api/landings/${id}`, {
      method: 'PUT', cookie, body: { content: '<h1>changed</h1>' },
    });
    const r = await req(baseUrl, `/api/landings/${id}/versions/${vid}/diff`, { cookie });
    assert.equal(r.status, 200);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('PATCH /api/landings/:id/versions/:versionId updates metadata', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-meta';
  const id = 'VC6';
  try {
    await setupLanding(slug, id);
    const cookie = await loginAdmin(baseUrl);
    const created = await req(baseUrl, `/api/landings/${id}/versions`, {
      method: 'POST', cookie, body: { description: 'v1' },
    });
    const vid = created.json.id;
    const r = await req(baseUrl, `/api/landings/${id}/versions/${vid}`, {
      method: 'PATCH', cookie,
      body: { description: 'updated desc', tag: 'v1.0' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.description, 'updated desc');
    assert.equal(r.json.tag, 'v1.0');
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('DELETE /api/landings/:id/versions/:versionId removes a version', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-del';
  const id = 'VC7';
  try {
    await setupLanding(slug, id);
    const cookie = await loginAdmin(baseUrl);
    const created = await req(baseUrl, `/api/landings/${id}/versions`, {
      method: 'POST', cookie, body: { description: 'v1' },
    });
    const vid = created.json.id;
    const r = await req(baseUrl, `/api/landings/${id}/versions/${vid}`, {
      method: 'DELETE', cookie,
    });
    assert.equal(r.status, 200);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('GET /api/landings/:id/versions/:versionId returns 404 for missing version', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-404';
  const id = 'VC8';
  try {
    await setupLanding(slug, id);
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, `/api/landings/${id}/versions/no-such-version`, { cookie });
    assert.equal(r.status, 404);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});
