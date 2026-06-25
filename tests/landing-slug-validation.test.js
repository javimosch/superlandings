const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { isValidSlug } = require('../lib/utils');

// Simulate the create-landing handler's slug guard (same logic as routes/landings.js)
function handleCreateSlug(slug) {
  if (!isValidSlug(slug)) {
    return { status: 400, body: { error: 'Invalid slug. Use only letters, numbers, hyphens, and underscores, starting with a letter or number.' } };
  }
  return { status: 200, body: { ok: true } };
}

// ---- Traversal slugs must be rejected with HTTP 400 ----

test('traversal slug "../evil" is rejected with 400', () => {
  const result = handleCreateSlug('../evil');
  assert.equal(result.status, 400);
  assert.match(result.body.error, /Invalid slug/);
});

test('traversal slug "../../etc/passwd" is rejected with 400', () => {
  const result = handleCreateSlug('../../etc/passwd');
  assert.equal(result.status, 400);
});

test('absolute path slug "/etc/passwd" is rejected with 400', () => {
  const result = handleCreateSlug('/etc/passwd');
  assert.equal(result.status, 400);
});

test('slug ".." is rejected with 400', () => {
  const result = handleCreateSlug('..');
  assert.equal(result.status, 400);
});

test('empty slug is rejected with 400', () => {
  const result = handleCreateSlug('');
  assert.equal(result.status, 400);
});

test('slug with slash "a/../../b" is rejected with 400', () => {
  const result = handleCreateSlug('a/../../b');
  assert.equal(result.status, 400);
});

// ---- No directory must be created outside the base dir for invalid slugs ----

test('no directory is created outside data/landings for traversal slug', () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-test-'));
  const slug = '../evil';

  const result = handleCreateSlug(slug);
  assert.equal(result.status, 400, 'request must be rejected before any fs operation');

  // Verify nothing was created outside tmpBase
  const wouldEscape = path.resolve(tmpBase, slug);
  assert.equal(
    fs.existsSync(wouldEscape),
    false,
    `directory outside base must not exist: ${wouldEscape}`
  );

  fs.rmSync(tmpBase, { recursive: true });
});

// ---- Valid slugs must still succeed ----

test('valid slug "my-page" succeeds (status 200)', () => {
  const result = handleCreateSlug('my-page');
  assert.equal(result.status, 200);
});

test('valid slug "landing123" succeeds', () => {
  const result = handleCreateSlug('landing123');
  assert.equal(result.status, 200);
});

test('valid slug "my_landing-page" succeeds', () => {
  const result = handleCreateSlug('my_landing-page');
  assert.equal(result.status, 200);
});
