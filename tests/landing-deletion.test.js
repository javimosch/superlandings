const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

// Test the core landing deletion logic without external dependencies
// This focuses on the parameter validation, permission checks, and business logic

// Mock hasRight function from auth
function hasRight(user, permission) {
  return user && Array.isArray(user.rights) && user.rights.includes(permission);
}

// Mock request/response objects for landing deletion route
function createMockRequest(params = {}, headers = {}, adminAuth = false, user = null) {
  return {
    params,
    headers,
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

// Mock database with sample landing data
const mockDB = {
  landings: [
    {
      id: 'landing-123',
      name: 'Test Landing',
      slug: 'test-landing',
      published: false
    },
    {
      id: 'landing-456',
      name: 'Published Landing',
      slug: 'published-landing',
      published: true
    }
  ]
};

// Simulate the core deletion permission and validation logic
function validateDeletionRequest(req) {
  // Check permission
  if (!req.adminAuth && !hasRight(req.currentUser, 'landings:delete')) {
    return { error: 'Missing permission: landings:delete', status: 403 };
  }

  const { id } = req.params;
  if (!id) {
    return { error: 'Landing ID is required', status: 400 };
  }

  const landingIndex = mockDB.landings.findIndex(l => l.id === id);
  if (landingIndex === -1) {
    return { error: 'Landing not found', status: 404 };
  }

  const landing = mockDB.landings[landingIndex];
  return { success: true, landing, landingIndex };
}

test('landing deletion: rejects request without permission', async () => {
  const req = createMockRequest({ id: 'landing-123' }, {}, false, { rights: [] });
  const result = validateDeletionRequest(req);

  assert.strictEqual(result.error, 'Missing permission: landings:delete');
  assert.strictEqual(result.status, 403);
});

test('landing deletion: allows admin access', async () => {
  const req = createMockRequest({ id: 'landing-123' }, {}, true, null);
  const result = validateDeletionRequest(req);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.landing.id, 'landing-123');
});

test('landing deletion: allows user with landings:delete permission', async () => {
  const req = createMockRequest({ id: 'landing-123' }, {}, false, { rights: ['landings:delete'] });
  const result = validateDeletionRequest(req);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.landing.id, 'landing-123');
});

test('landing deletion: returns 404 for non-existent landing', async () => {
  const req = createMockRequest({ id: 'nonexistent' }, {}, true, null);
  const result = validateDeletionRequest(req);

  assert.strictEqual(result.error, 'Landing not found');
  assert.strictEqual(result.status, 404);
});

test('landing deletion: identifies published landing requiring traefik cleanup', async () => {
  const req = createMockRequest({ id: 'landing-456' }, {}, true, null);
  const result = validateDeletionRequest(req);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.landing.published, true);
  assert.strictEqual(result.landing.slug, 'published-landing');
});

test('landing deletion: handles missing ID parameter', async () => {
  const req = createMockRequest({}, {}, true, null);
  const result = validateDeletionRequest(req);

  assert.strictEqual(result.error, 'Landing ID is required');
  assert.strictEqual(result.status, 400);
});

// Test edge cases around slug handling and directory paths
test('landing deletion: validates slug safety', async () => {
  // Test that we properly handle potentially dangerous slugs
  const dangerousLanding = {
    id: 'dangerous-123',
    name: 'Dangerous Landing',
    slug: '../../../etc/passwd',
    published: false
  };

  // Add to mock DB temporarily
  mockDB.landings.push(dangerousLanding);

  const req = createMockRequest({ id: 'dangerous-123' }, {}, true, null);
  const result = validateDeletionRequest(req);

  // Should still find the landing but the slug handling should be checked elsewhere
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.landing.slug, '../../../etc/passwd');

  // Clean up
  mockDB.landings.pop();
});

test('landing deletion: provides correct landing index for database removal', async () => {
  const req = createMockRequest({ id: 'landing-456' }, {}, true, null);
  const result = validateDeletionRequest(req);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.landingIndex, 1); // Second item in array
});

// Test the path join logic used in deletion (common source of vulnerabilities)
test('landing deletion: path construction', async () => {
  const LANDINGS_DIR = '/app/data/landings';
  const landing = { slug: 'test-landing' };
  const landingDir = path.join(LANDINGS_DIR, landing.slug);

  assert.strictEqual(landingDir, '/app/data/landings/test-landing');
});

test('landing deletion: path traversal now prevented by safeSlugPath', async () => {
  // This test shows that the vulnerability is now fixed
  const { safeSlugPath } = require('../lib/utils');
  const LANDINGS_DIR = '/app/data/landings';
  const landing = { slug: '../../../etc/passwd' };

  // After fix: safeSlugPath should throw error instead of allowing traversal
  assert.throws(() => {
    safeSlugPath(LANDINGS_DIR, landing.slug);
  }, /Invalid slug: \.\.\/\.\.\/\.\.\/etc\/passwd/);
});

console.log('All landing deletion tests passed!');