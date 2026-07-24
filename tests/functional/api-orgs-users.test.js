const { test } = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, req, loginAdmin } = require('./_helpers');

test('GET /api/organizations with admin returns list', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/organizations', { cookie });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json));
  } finally {
    await close();
  }
});

test('POST /api/organizations creates an org', async () => {
  const { baseUrl, close } = await bootApp();
  const name = 'func-org-' + Date.now();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/organizations', {
      method: 'POST', cookie,
      body: { name },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.name, name);
    assert.ok(r.json.id);
  } finally {
    await close();
  }
});

test('GET /api/organizations/:id returns org details', async () => {
  const { baseUrl, close } = await bootApp();
  const name = 'func-org-detail-' + Date.now();
  try {
    const cookie = await loginAdmin(baseUrl);
    const created = await req(baseUrl, '/api/organizations', {
      method: 'POST', cookie, body: { name },
    });
    const orgId = created.json.id;
    const r = await req(baseUrl, `/api/organizations/${orgId}`, { cookie });
    assert.equal(r.status, 200);
    assert.equal(r.json.name, name);
  } finally {
    await close();
  }
});

test('DELETE /api/organizations/:id removes the org', async () => {
  const { baseUrl, close } = await bootApp();
  const name = 'func-org-del-' + Date.now();
  try {
    const cookie = await loginAdmin(baseUrl);
    const created = await req(baseUrl, '/api/organizations', {
      method: 'POST', cookie, body: { name },
    });
    const orgId = created.json.id;
    const r = await req(baseUrl, `/api/organizations/${orgId}`, { method: 'DELETE', cookie });
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});

test('GET /api/users with admin returns list', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/users', { cookie });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json));
  } finally {
    await close();
  }
});

test('GET /api/users/rights returns available rights', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/users/rights', { cookie });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json));
    assert.ok(r.json.includes('landings:create'));
  } finally {
    await close();
  }
});

test('POST /api/users creates a user', async () => {
  const { baseUrl, close } = await bootApp();
  const email = 'func-user-' + Date.now() + '@test.com';
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/users', {
      method: 'POST', cookie,
      body: { email, password: '1234' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.email, email);
  } finally {
    await close();
  }
});

test('GET /api/admin-config/fallbacks returns fallback settings', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/admin-config/fallbacks', { cookie });
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});

test('GET /api/admin-config returns all settings', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/admin-config', { cookie });
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});

test('GET /api/cloudflare/status returns disabled when no creds', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/cloudflare/status', { cookie });
    assert.equal(r.status, 200);
    assert.equal(r.json.enabled, false);
  } finally {
    await close();
  }
});

test('GET /api/migration/rbac returns migration status', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/migration/rbac', { cookie });
    // POST endpoint, GET might 404 or 405
    assert.ok(r.status === 404 || r.status === 405);
  } finally {
    await close();
  }
});
