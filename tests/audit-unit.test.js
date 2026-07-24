require('./_sandbox');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  logAudit, getAuditLog, getAuditLogPaginated, deleteAuditLog, AUDIT_ACTIONS,
} = require('../lib/audit');

// Clear the audit directory before each test so counts are deterministic.
before(async () => {
  const auditDir = path.join(process.env.SL_DATA_DIR, 'audit');
  if (fs.existsSync(auditDir)) {
    for (const f of fs.readdirSync(auditDir)) {
      fs.unlinkSync(path.join(auditDir, f));
    }
  }
});

test('AUDIT_ACTIONS exposes action constants', () => {
  assert.equal(AUDIT_ACTIONS.CREATE, 'create');
  assert.equal(AUDIT_ACTIONS.PUBLISH, 'publish');
  assert.equal(AUDIT_ACTIONS.ROLLBACK, 'rollback');
});

test('getAuditLog returns [] for landing with no log', async () => {
  const entries = await getAuditLog('landing-none');
  assert.deepEqual(entries, []);
});

test('logAudit writes an entry and returns it', async () => {
  const entry = await logAudit('l1', { action: 'create', actor: 'admin', isAdmin: true, details: 'created' });
  assert.equal(entry.action, 'create');
  assert.equal(entry.actor, 'admin');
  assert.equal(entry.isAdmin, true);
  assert.ok(entry.id.startsWith('audit-'));
  assert.ok(entry.timestamp);
});

test('getAuditLog returns entries newest-first', async () => {
  await logAudit('l2', { action: 'create', actor: 'a' });
  await logAudit('l2', { action: 'update', actor: 'b' });
  const entries = await getAuditLog('l2');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].action, 'update');
  assert.equal(entries[1].action, 'create');
});

test('logAudit trims to 500 entries', async () => {
  for (let i = 0; i < 502; i++) {
    await logAudit('l3', { action: 'update', actor: 'a' });
  }
  const entries = await getAuditLog('l3');
  assert.equal(entries.length, 500);
});

test('getAuditLogPaginated respects limit/offset and hasMore', async () => {
  for (let i = 0; i < 10; i++) {
    await logAudit('l4', { action: 'update', actor: 'a' });
  }
  const page1 = await getAuditLogPaginated('l4', { limit: 3, offset: 0 });
  assert.equal(page1.entries.length, 3);
  assert.equal(page1.total, 10);
  assert.equal(page1.hasMore, true);
  const last = await getAuditLogPaginated('l4', { limit: 3, offset: 9 });
  assert.equal(last.hasMore, false);
});

test('getAuditLogPaginated guards against bad limit/offset', async () => {
  await logAudit('l5', { action: 'create', actor: 'a' });
  const r = await getAuditLogPaginated('l5', { limit: -1, offset: -5 });
  assert.equal(r.entries.length, 1);
});

test('deleteAuditLog removes the log file', async () => {
  await logAudit('l6', { action: 'create', actor: 'a' });
  await deleteAuditLog('l6');
  const entries = await getAuditLog('l6');
  assert.deepEqual(entries, []);
});

test('logAudit stores versionIds when provided', async () => {
  const e = await logAudit('l7', { action: 'version_create', actor: 'a', versionIds: ['v1', 'v2'] });
  assert.deepEqual(e.versionIds, ['v1', 'v2']);
});

test('logAudit stores null versionIds when empty', async () => {
  const e = await logAudit('l8', { action: 'create', actor: 'a', versionIds: [] });
  assert.equal(e.versionIds, null);
});
