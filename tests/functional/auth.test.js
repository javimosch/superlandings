const { test } = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, req, loginAdmin } = require('./_helpers');

test('admin login succeeds and sets a session cookie', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    assert.ok(cookie.startsWith('connect.sid='));
  } finally {
    await close();
  }
});

test('admin login with wrong password returns 401', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const r = await req(baseUrl, '/api/login', {
      method: 'POST',
      body: { username: 'admin', password: 'definitely-wrong' },
    });
    assert.equal(r.status, 401);
  } finally {
    await close();
  }
});

test('GET /api/auth/me without session returns 401', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const r = await req(baseUrl, '/api/auth/me');
    assert.equal(r.status, 401);
  } finally {
    await close();
  }
});

test('GET /api/auth/me with admin session returns admin info', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/auth/me', { cookie });
    assert.equal(r.status, 200);
    assert.equal(r.json.isAdmin, true);
  } finally {
    await close();
  }
});

test('GET /api/landings without session returns 401', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const r = await req(baseUrl, '/api/landings');
    assert.equal(r.status, 401);
  } finally {
    await close();
  }
});

test('logout destroys the session', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/logout', { cookie });
    assert.equal(r.status, 200);
    // after logout, /api/auth/me should 401
    const me = await req(baseUrl, '/api/auth/me', { cookie });
    assert.equal(me.status, 401);
  } finally {
    await close();
  }
});

test('register enabled flow creates user + org', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    process.env.REGISTRATION_ENABLED = 'true';
    const email = 'func-' + Date.now() + '@test.com';
    const r = await req(baseUrl, '/api/register', {
      method: 'POST',
      body: { email, password: '1234' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.success, true);
    assert.ok(r.json.organizationId);
    // duplicate registration → 400
    const r2 = await req(baseUrl, '/api/register', {
      method: 'POST',
      body: { email, password: '1234' },
    });
    assert.equal(r2.status, 400);
  } finally {
    process.env.REGISTRATION_ENABLED = 'false';
    await close();
  }
});

test('register rejects missing fields', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    process.env.REGISTRATION_ENABLED = 'true';
    const r = await req(baseUrl, '/api/register', { method: 'POST', body: {} });
    assert.equal(r.status, 400);
  } finally {
    process.env.REGISTRATION_ENABLED = 'false';
    await close();
  }
});

test('register rejects short password', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    process.env.REGISTRATION_ENABLED = 'true';
    const r = await req(baseUrl, '/api/register', {
      method: 'POST',
      body: { email: 'x@y.com', password: '1' },
    });
    assert.equal(r.status, 400);
  } finally {
    process.env.REGISTRATION_ENABLED = 'false';
    await close();
  }
});

test('GET /register redirects to /login when registration disabled', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    process.env.REGISTRATION_ENABLED = 'false';
    const r = await req(baseUrl, '/register');
    assert.equal(r.status, 302);
    assert.equal(r.headers.get('location'), '/login');
  } finally {
    await close();
  }
});

test('GET /admin with session renders admin panel', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/admin', { cookie });
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});
