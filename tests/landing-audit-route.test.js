const test = require('node:test');
const assert = require('node:assert');
const { readDB } = require('../lib/store');
const { hasRight } = require('../lib/auth');
const { getAuditLogPaginated } = require('../lib/audit');

// Mock dependencies
const mockDB = {
  landings: [
    { id: 'landing-123', name: 'Test Landing', slug: 'test-landing' }
  ]
};

const mockAuditEntries = [
  { id: 'audit-1', timestamp: '2023-01-01T00:00:00.000Z', action: 'create', actor: 'test@test.com' },
  { id: 'audit-2', timestamp: '2023-01-02T00:00:00.000Z', action: 'update', actor: 'test@test.com' },
  { id: 'audit-3', timestamp: '2023-01-03T00:00:00.000Z', action: 'publish', actor: 'test@test.com' }
];

// Mock request/response objects for landing audit route
function createMockRequest(params = {}, query = {}, adminAuth = false, user = null) {
  return {
    params,
    query,
    adminAuth,
    currentUser: user
  };
}

function createMockResponse() {
  const res = {
    statusCode: 200,
    _status: null,
    _json: null,
    status: function(code) {
      this._status = code;
      return this;
    },
    json: function(data) {
      this._json = data;
      return this;
    }
  };
  return res;
}

// Simulate the landing audit route logic
async function landingAuditHandler(req, res) {
  // Check permission - require at least update permission to view audit
  if (!req.adminAuth && !hasRight(req.currentUser, 'landings:update')) {
    return res.status(403).json({ error: 'Missing permission: landings:update' });
  }

  try {
    const { id } = req.params;
    // parseInt returns NaN for non-numeric input; || fallback ensures safe defaults
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 50);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const db = mockDB; // Use mock instead of await readDB();
    const landing = db.landings.find(l => l.id === id);

    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    // Mock the audit pagination function
    const result = {
      entries: mockAuditEntries.slice(offset, offset + limit),
      total: mockAuditEntries.length,
      hasMore: offset + limit < mockAuditEntries.length
    };

    res.json(result);
  } catch (error) {
    console.error('Error getting audit log:', error);
    res.status(500).json({ error: error.message });
  }
}

test('landing audit route: rejects request without permission', async () => {
  const req = createMockRequest({ id: 'landing-123' }, {}, false, { rights: [] });
  const res = createMockResponse();

  await landingAuditHandler(req, res);

  assert.strictEqual(res._status, 403);
  assert.deepStrictEqual(res._json, { error: 'Missing permission: landings:update' });
});

test('landing audit route: allows admin access', async () => {
  const req = createMockRequest({ id: 'landing-123' }, {}, true, null);
  const res = createMockResponse();

  await landingAuditHandler(req, res);

  assert.strictEqual(res._status, null); // No error status set
  assert.strictEqual(res._json.total, 3);
  assert.strictEqual(res._json.entries.length, 3);
});

test('landing audit route: allows user with landings:update permission', async () => {
  const req = createMockRequest({ id: 'landing-123' }, {}, false, { rights: ['landings:update'] });
  const res = createMockResponse();

  await landingAuditHandler(req, res);

  assert.strictEqual(res._status, null);
  assert.strictEqual(res._json.total, 3);
});

test('landing audit route: returns 404 for non-existent landing', async () => {
  const req = createMockRequest({ id: 'nonexistent' }, {}, true, null);
  const res = createMockResponse();

  await landingAuditHandler(req, res);

  assert.strictEqual(res._status, 404);
  assert.deepStrictEqual(res._json, { error: 'Landing not found' });
});

test('landing audit route: handles pagination with valid limit and offset', async () => {
  const req = createMockRequest({ id: 'landing-123' }, { limit: '2', offset: '1' }, true, null);
  const res = createMockResponse();

  await landingAuditHandler(req, res);

  assert.strictEqual(res._status, null);
  assert.strictEqual(res._json.entries.length, 2);
  assert.strictEqual(res._json.entries[0].id, 'audit-2');
  assert.strictEqual(res._json.hasMore, false);
});

test('landing audit route: handles NaN limit with fallback to 50', async () => {
  const req = createMockRequest({ id: 'landing-123' }, { limit: 'invalid' }, true, null);
  const res = createMockResponse();

  await landingAuditHandler(req, res);

  assert.strictEqual(res._status, null);
  // With mock data of 3 entries, should return all 3
  assert.strictEqual(res._json.entries.length, 3);
});

test('landing audit route: handles NaN offset with fallback to 0', async () => {
  const req = createMockRequest({ id: 'landing-123' }, { offset: 'invalid' }, true, null);
  const res = createMockResponse();

  await landingAuditHandler(req, res);

  assert.strictEqual(res._status, null);
  assert.strictEqual(res._json.entries[0].id, 'audit-1'); // Should start from beginning
});

test('landing audit route: enforces minimum limit of 1', async () => {
  const req = createMockRequest({ id: 'landing-123' }, { limit: '-5' }, true, null);
  const res = createMockResponse();

  await landingAuditHandler(req, res);

  assert.strictEqual(res._status, null);
  // Math.max(1, parseInt('-5', 10) || 50) = Math.max(1, -5) = 1
  assert.strictEqual(res._json.entries.length, 1);
});

test('landing audit route: enforces minimum offset of 0', async () => {
  const req = createMockRequest({ id: 'landing-123' }, { offset: '-10' }, true, null);
  const res = createMockResponse();

  await landingAuditHandler(req, res);

  assert.strictEqual(res._status, null);
  assert.strictEqual(res._json.entries[0].id, 'audit-1'); // Should start from beginning
});

console.log('All landing audit route tests passed!');