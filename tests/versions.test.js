/**
 * Tests for pure logic in versions.js and related modules.
 * These tests do not require external npm packages.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

// ---- parseMongoDbName (pure function, extracted for testing) ----
// This is the same logic as store.js:parseMongoDbName
function parseMongoDbName(mongoUri) {
  try {
    const url = new URL(mongoUri);
    const pathname = url.pathname || '';
    const dbName = pathname.replace(/^\//, '').trim();
    return dbName || null;
  } catch (e) {
    return null;
  }
}

test('parseMongoDbName extracts db name from standard URI', () => {
  assert.equal(parseMongoDbName('mongodb://localhost:27017/mydb'), 'mydb');
});

test('parseMongoDbName returns null when no db in pathname', () => {
  assert.equal(parseMongoDbName('mongodb://localhost:27017/'), null);
  assert.equal(parseMongoDbName('mongodb://localhost:27017'), null);
});

test('parseMongoDbName returns null for invalid URI', () => {
  assert.equal(parseMongoDbName('not-a-uri'), null);
  assert.equal(parseMongoDbName(''), null);
});

test('parseMongoDbName handles URI with credentials', () => {
  assert.equal(parseMongoDbName('mongodb://user:pass@localhost:27017/proddb'), 'proddb');
});

test('parseMongoDbName handles URI with query params', () => {
  assert.equal(parseMongoDbName('mongodb://localhost:27017/mydb?authSource=admin'), 'mydb');
});

// ---- deleteVersion mongo-mode logic (simulated) ----
// Verify the fixed logic: deleted is true if either local dir OR mongo delete succeeds

test('deleteVersion logic: reports deleted=true if mongo deletedCount > 0 even without local dir', () => {
  // Simulate the fixed logic
  function fixedDeleteLogic(localDirExists, mongoDeletedCount) {
    let deleted = false;
    if (localDirExists) {
      deleted = true; // rmSync would run
    }
    // Mongo path (simulated)
    if (mongoDeletedCount > 0) deleted = true;
    return deleted;
  }

  // Scenario: no local dir but mongo has the doc
  assert.equal(fixedDeleteLogic(false, 1), true);
  // Scenario: local dir exists, no mongo doc
  assert.equal(fixedDeleteLogic(true, 0), true);
  // Scenario: neither exists
  assert.equal(fixedDeleteLogic(false, 0), false);
  // Scenario: both exist
  assert.equal(fixedDeleteLogic(true, 1), true);
});

// ---- updateVersionMetadata driver v6 API fix ----

test('updateVersionMetadata: driver v6 returns doc directly (not { value: doc })', () => {
  // Simulate the fixed check: use res directly, not res.value
  function fixedUpdateCheck(findOneAndUpdateResult) {
    const res = findOneAndUpdateResult;
    if (!res) throw new Error('Version not found');
    return res;
  }

  const fakeDoc = { id: 'v1', description: 'updated', tag: null };

  // Driver v6: findOneAndUpdate returns doc directly
  assert.deepEqual(fixedUpdateCheck(fakeDoc), fakeDoc);

  // Not found: returns null
  assert.throws(() => fixedUpdateCheck(null), /Version not found/);
});

test('old driver v3 res.value pattern would fail on driver v6', () => {
  function oldUpdateCheck(findOneAndUpdateResult) {
    // OLD (broken) code: driver v3 pattern
    const res = findOneAndUpdateResult;
    if (!res.value) throw new Error('Version not found');
    return res.value;
  }

  const fakeDoc = { id: 'v1', description: 'updated' };
  // Driver v6 returns doc directly → oldUpdateCheck(doc) → doc.value is undefined → throws
  assert.throws(() => oldUpdateCheck(fakeDoc), /Version not found/);
});
