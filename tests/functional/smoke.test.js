const { test } = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, req } = require('./_helpers');

test('app boots and serves /login page', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const r = await req(baseUrl, '/login');
    assert.equal(r.status, 200);
    assert.match(r.body, /html/i);
  } finally {
    await close();
  }
});

test('GET / redirects to /admin', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const r = await req(baseUrl, '/');
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), '/admin');
  } finally {
    await close();
  }
});

test('GET /admin without session redirects to /login', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const r = await req(baseUrl, '/admin');
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), '/login');
  } finally {
    await close();
  }
});

test('POST /api/login without credentials returns 400', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const r = await req(baseUrl, '/api/login', { method: 'POST', body: {} });
    assert.equal(r.status, 400);
    assert.ok(r.json && r.json.error);
  } finally {
    await close();
  }
});

test('POST /api/register returns 403 when registration disabled', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const r = await req(baseUrl, '/api/register', {
      method: 'POST',
      body: { email: 't@t.com', password: '1234' },
    });
    assert.equal(r.status, 403);
  } finally {
    await close();
  }
});
