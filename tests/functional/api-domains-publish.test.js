const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { bootApp, req, loginAdmin, addLanding, cleanupLandings } = require('./_helpers');
const { LANDINGS_DIR } = require('../../lib/db');

const PREFIX = 'func-dom-' + Date.now();

function writeLandingFiles(slug, files) {
  const dir = path.join(LANDINGS_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
}

test('PUT /api/landings/:id/domains updates domains', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-put';
  const id = 'D1';
  try {
    writeLandingFiles(slug, { 'index.html': '<p>d</p>' });
    await addLanding({ id, slug, name: 'D', type: 'html', domains: [] });
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, `/api/landings/${id}/domains`, {
      method: 'PUT', cookie,
      body: { domains: [{ domain: 'example.com', published: false }] },
    });
    assert.equal(r.status, 200);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('POST /api/landings/:id/domains/:domain/publish publishes a domain', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-pub';
  const id = 'D2';
  try {
    writeLandingFiles(slug, { 'index.html': '<p>p</p>' });
    await addLanding({ id, slug, name: 'P', type: 'html', domains: [{ domain: 'pub.example.com', published: false }] });
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, `/api/landings/${id}/domains/pub.example.com/publish`, {
      method: 'POST', cookie,
    });
    assert.equal(r.status, 200);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('POST /api/landings/:id/domains/:domain/unpublish unpublishes a domain', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-unpub';
  const id = 'D3';
  try {
    writeLandingFiles(slug, { 'index.html': '<p>u</p>' });
    await addLanding({ id, slug, name: 'U', type: 'html', domains: [{ domain: 'unpub.example.com', published: true }] });
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, `/api/landings/${id}/domains/unpub.example.com/unpublish`, {
      method: 'POST', cookie,
    });
    assert.equal(r.status, 200);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('POST /api/landings/:id/publish publishes the landing', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-publish';
  const id = 'D4';
  try {
    writeLandingFiles(slug, { 'index.html': '<p>pub</p>' });
    await addLanding({ id, slug, name: 'Pub', type: 'html', domains: [{ domain: 'publish.example.com', published: true }] });
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, `/api/landings/${id}/publish`, {
      method: 'POST', cookie,
    });
    assert.equal(r.status, 200);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('POST /api/landings/:id/unpublish unpublishes the landing', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-unpublish';
  const id = 'D5';
  try {
    writeLandingFiles(slug, { 'index.html': '<p>unpub</p>' });
    await addLanding({ id, slug, name: 'Unpub', type: 'html', published: true, domains: [{ domain: 'up.example.com', published: true }] });
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, `/api/landings/${id}/unpublish`, {
      method: 'POST', cookie,
    });
    assert.equal(r.status, 200);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});

test('POST /api/landings/:id/publish returns 400 without published domains', async () => {
  const { baseUrl, close } = await bootApp();
  const slug = PREFIX + '-nopubdom';
  const id = 'D6';
  try {
    writeLandingFiles(slug, { 'index.html': '<p>np</p>' });
    await addLanding({ id, slug, name: 'NP', type: 'html', domains: [] });
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, `/api/landings/${id}/publish`, {
      method: 'POST', cookie,
    });
    assert.equal(r.status, 400);
  } finally {
    await cleanupLandings(slug);
    await close();
  }
});
