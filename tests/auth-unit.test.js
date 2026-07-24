require('./_sandbox');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ensureDirectories } = require('../lib/db');
const {
  hashPassword, verifyPassword, isAdmin, getCurrentUser, getCurrentOrganization,
  hasRight, sessionAuth, handleLogin, setCurrentOrganization, requireRight,
  AVAILABLE_RIGHTS,
} = require('../lib/auth');

// Ensure sandbox db.json exists for handleLogin / setCurrentOrganization.
ensureDirectories();

// Helper: build a mock res that records the status/json and signals completion.
function mockRes(onJson) {
  return {
    status(s) { this._status = s; return this; },
    json(body) { this._body = body; if (onJson) onJson(this); return this; },
  };
}

test('hashPassword / verifyPassword round-trip', () => {
  const hash = hashPassword('secret123');
  assert.notEqual(hash, 'secret123');
  assert.equal(verifyPassword('secret123', hash), true);
  assert.equal(verifyPassword('wrong', hash), false);
});

test('isAdmin / getCurrentUser / getCurrentOrganization read from req', () => {
  assert.equal(isAdmin({ adminAuth: true }), true);
  assert.equal(isAdmin({ adminAuth: false }), false);
  const u = { email: 'a@b' };
  assert.equal(getCurrentUser({ currentUser: u }), u);
  assert.equal(getCurrentUser({}), null);
  const o = { id: '1' };
  assert.equal(getCurrentOrganization({ currentOrganization: o }), o);
  assert.equal(getCurrentOrganization({}), null);
});

test('hasRight: admin bypass, explicit rights, missing rights', () => {
  assert.equal(hasRight({ isAdmin: true }, 'landings:delete'), true);
  assert.equal(hasRight({ isAdmin: false, rights: ['landings:create'] }, 'landings:create'), true);
  assert.equal(hasRight({ isAdmin: false, rights: [] }, 'landings:create'), false);
  assert.equal(hasRight({ isAdmin: false }, 'landings:create'), false);
  assert.equal(hasRight(null, 'landings:create'), false);
});

test('AVAILABLE_RIGHTS lists the four landing rights', () => {
  assert.ok(AVAILABLE_RIGHTS.includes('landings:create'));
  assert.ok(AVAILABLE_RIGHTS.includes('landings:update'));
  assert.ok(AVAILABLE_RIGHTS.includes('landings:domains'));
  assert.ok(AVAILABLE_RIGHTS.includes('landings:delete'));
});

test('sessionAuth rejects when no session user', async () => {
  // sessionAuth sends a 401 json response (does not call next on failure)
  await new Promise((resolve) => {
    const r = mockRes(() => resolve());
    sessionAuth({ session: {} }, r, () => {});
    assert.equal(r._status, 401);
  });
});

test('sessionAuth populates admin auth and continues', async () => {
  const req = { session: { user: { email: 'admin' }, isAdmin: true } };
  await new Promise((resolve) => sessionAuth(req, {}, () => resolve()));
  assert.equal(req.adminAuth, true);
  assert.equal(req.currentUser.email, 'admin');
});

test('handleLogin admin success with env creds', async () => {
  process.env.ADMIN_USERNAME = 'admin';
  process.env.ADMIN_PASSWORD = 'pw';
  const req = { session: {} };
  const r = await handleLogin(req, 'admin', 'pw');
  assert.equal(r.success, true);
  assert.equal(r.user.isAdmin, true);
  assert.equal(req.session.isAdmin, true);
});

test('handleLogin user success with bcrypt password', async () => {
  // Seed a user via store readDB/writeDB
  const { readDB, writeDB } = require('../lib/store');
  const db = await readDB();
  db.users = [{ email: 'u@x.com', password: hashPassword('pw123') }];
  await writeDB(db);
  const req = { session: {} };
  const r = await handleLogin(req, 'u@x.com', 'pw123');
  assert.equal(r.success, true);
  assert.equal(req.session.isAdmin, false);
});

test('handleLogin fails with wrong password', async () => {
  const { readDB, writeDB } = require('../lib/store');
  const db = await readDB();
  db.users = [{ email: 'u2@x.com', password: hashPassword('good') }];
  await writeDB(db);
  const r = await handleLogin({ session: {} }, 'u2@x.com', 'bad');
  assert.equal(r.success, false);
});

test('handleLogin fails with unknown user', async () => {
  const r = await handleLogin({ session: {} }, 'nobody@x.com', 'pw');
  assert.equal(r.success, false);
});

test('setCurrentOrganization: no header → next', async () => {
  await new Promise((resolve) => setCurrentOrganization({ headers: {} }, {}, () => resolve()));
});

test('setCurrentOrganization: admin can access any org', async () => {
  const { readDB, writeDB } = require('../lib/store');
  const db = await readDB();
  db.organizations = [{ id: 'org1', name: 'O', users: [] }];
  await writeDB(db);
  const req = { headers: { 'x-organization-id': 'org1' }, adminAuth: true, currentUser: { email: 'admin' } };
  await new Promise((resolve) => setCurrentOrganization(req, {}, () => resolve()));
  assert.equal(req.currentOrganization.id, 'org1');
});

test('setCurrentOrganization: user must belong to org', async () => {
  const { readDB, writeDB } = require('../lib/store');
  const db = await readDB();
  db.organizations = [{ id: 'org2', name: 'O', users: [{ email: 'm@x.com', rights: ['landings:create'] }] }];
  await writeDB(db);
  const req = { headers: { 'x-organization-id': 'org2' }, adminAuth: false, currentUser: { email: 'm@x.com' } };
  await new Promise((resolve) => setCurrentOrganization(req, {}, () => resolve()));
  assert.equal(req.currentOrganization.id, 'org2');
  assert.ok(req.currentUser.rights.includes('landings:create'));
});

test('setCurrentOrganization: unknown org id → no currentOrganization', async () => {
  const req = { headers: { 'x-organization-id': 'nope' }, adminAuth: false, currentUser: { email: 'm@x.com' } };
  await new Promise((resolve) => setCurrentOrganization(req, {}, () => resolve()));
  assert.equal(req.currentOrganization, undefined);
});

test('requireRight: admin passes through', () => {
  const mw = requireRight('landings:delete');
  let called = false;
  mw({ adminAuth: true }, {}, () => { called = true; });
  assert.equal(called, true);
});

test('requireRight: user with right passes', () => {
  const mw = requireRight('landings:create');
  let called = false;
  mw({ adminAuth: false, currentUser: { rights: ['landings:create'] } }, {}, () => { called = true; });
  assert.equal(called, true);
});

test('requireRight: user without right gets 403', () => {
  const mw = requireRight('landings:delete');
  const res = mockRes();
  mw({ adminAuth: false, currentUser: { rights: [] } }, res, () => {});
  assert.equal(res._status, 403);
});

test('requireRight: no user → 401', () => {
  const mw = requireRight('landings:delete');
  const res = mockRes();
  mw({ adminAuth: false, currentUser: null }, res, () => {});
  assert.equal(res._status, 401);
});
