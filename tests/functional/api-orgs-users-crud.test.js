const { test } = require('node:test');
const assert = require('node:assert/strict');
const { bootApp, req, loginAdmin } = require('./_helpers');

async function createOrg(baseUrl, cookie, name) {
  const r = await req(baseUrl, '/api/organizations', {
    method: 'POST', cookie, body: { name },
  });
  return r.json;
}

test('PUT /api/organizations/:id updates org name', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const org = await createOrg(baseUrl, cookie, 'func-org-upd-' + Date.now());
    const r = await req(baseUrl, `/api/organizations/${org.id}`, {
      method: 'PUT', cookie,
      body: { name: 'updated-org' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.name, 'updated-org');
  } finally {
    await close();
  }
});

test('POST /api/organizations/:id/users adds a user to org', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const org = await createOrg(baseUrl, cookie, 'func-org-adduser-' + Date.now());
    const email = 'orguser-' + Date.now() + '@test.com';
    // Create the user first (the org route requires the user to already exist)
    await req(baseUrl, '/api/users', {
      method: 'POST', cookie,
      body: { email, password: '1234' },
    });
    const r = await req(baseUrl, `/api/organizations/${org.id}/users`, {
      method: 'POST', cookie,
      body: { email, rights: ['landings:create'] },
    });
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});

test('PUT /api/organizations/:id/users/:email updates user rights', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const org = await createOrg(baseUrl, cookie, 'func-org-upduser-' + Date.now());
    const email = 'upduser-' + Date.now() + '@test.com';
    await req(baseUrl, '/api/users', {
      method: 'POST', cookie,
      body: { email, password: '1234' },
    });
    await req(baseUrl, `/api/organizations/${org.id}/users`, {
      method: 'POST', cookie,
      body: { email, rights: ['landings:create'] },
    });
    const r = await req(baseUrl, `/api/organizations/${org.id}/users/${encodeURIComponent(email)}`, {
      method: 'PUT', cookie,
      body: { rights: ['landings:create', 'landings:update'] },
    });
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});

test('DELETE /api/organizations/:id/users/:email removes user from org', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const org = await createOrg(baseUrl, cookie, 'func-org-deluser-' + Date.now());
    const email = 'deluser-' + Date.now() + '@test.com';
    await req(baseUrl, '/api/users', {
      method: 'POST', cookie,
      body: { email, password: '1234' },
    });
    await req(baseUrl, `/api/organizations/${org.id}/users`, {
      method: 'POST', cookie,
      body: { email, rights: ['landings:create'] },
    });
    const r = await req(baseUrl, `/api/organizations/${org.id}/users/${encodeURIComponent(email)}`, {
      method: 'DELETE', cookie,
    });
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});

test('GET /api/users/:email returns user details', async () => {
  const { baseUrl, close } = await bootApp();
  const email = 'getuser-' + Date.now() + '@test.com';
  try {
    const cookie = await loginAdmin(baseUrl);
    await req(baseUrl, '/api/users', {
      method: 'POST', cookie,
      body: { email, password: '1234' },
    });
    const r = await req(baseUrl, `/api/users/${encodeURIComponent(email)}`, { cookie });
    assert.equal(r.status, 200);
    assert.equal(r.json.email, email);
  } finally {
    await close();
  }
});

test('PUT /api/users/:email updates user', async () => {
  const { baseUrl, close } = await bootApp();
  const email = 'upuser-' + Date.now() + '@test.com';
  try {
    const cookie = await loginAdmin(baseUrl);
    await req(baseUrl, '/api/users', {
      method: 'POST', cookie,
      body: { email, password: '1234' },
    });
    const r = await req(baseUrl, `/api/users/${encodeURIComponent(email)}`, {
      method: 'PUT', cookie,
      body: { password: 'newpass', isAdmin: true },
    });
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});

test('DELETE /api/users/:email removes user', async () => {
  const { baseUrl, close } = await bootApp();
  const email = 'deluser-' + Date.now() + '@test.com';
  try {
    const cookie = await loginAdmin(baseUrl);
    await req(baseUrl, '/api/users', {
      method: 'POST', cookie,
      body: { email, password: '1234' },
    });
    const r = await req(baseUrl, `/api/users/${encodeURIComponent(email)}`, {
      method: 'DELETE', cookie,
    });
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});

test('GET /api/users/:email returns 404 for missing user', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/users/nobody@test.com', { cookie });
    assert.equal(r.status, 404);
  } finally {
    await close();
  }
});

test('POST /api/users rejects duplicate email', async () => {
  const { baseUrl, close } = await bootApp();
  const email = 'dupuser-' + Date.now() + '@test.com';
  try {
    const cookie = await loginAdmin(baseUrl);
    await req(baseUrl, '/api/users', {
      method: 'POST', cookie,
      body: { email, password: '1234' },
    });
    const r = await req(baseUrl, '/api/users', {
      method: 'POST', cookie,
      body: { email, password: '1234' },
    });
    assert.equal(r.status, 400);
  } finally {
    await close();
  }
});

test('POST /api/users rejects missing email', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/users', {
      method: 'POST', cookie,
      body: { password: '1234' },
    });
    assert.equal(r.status, 400);
  } finally {
    await close();
  }
});

test('PUT /api/admin-config/domains updates admin domains', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/admin-config/domains', {
      method: 'PUT', cookie,
      body: { domains: ['admin.test.com'] },
    });
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});

test('POST /api/admin-config/publish publishes admin config', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    // Set domains first
    await req(baseUrl, '/api/admin-config/domains', {
      method: 'PUT', cookie,
      body: { domains: ['admin.test.com'] },
    });
    const r = await req(baseUrl, '/api/admin-config/publish', {
      method: 'POST', cookie,
      body: { sshKey: 'fake-key' },
    });
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});

test('POST /api/admin-config/unpublish unpublishes admin config', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/admin-config/unpublish', {
      method: 'POST', cookie,
    });
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});

test('POST /api/migration/rbac migrates RBAC', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/migration/rbac', {
      method: 'POST', cookie,
    });
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});

test('POST /api/migration/versions migrates versions', async () => {
  const { baseUrl, close } = await bootApp();
  try {
    const cookie = await loginAdmin(baseUrl);
    const r = await req(baseUrl, '/api/migration/versions', {
      method: 'POST', cookie,
    });
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});
