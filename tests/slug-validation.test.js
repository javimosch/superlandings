/**
 * Tests for slug validation logic (path traversal prevention).
 * Extracted as pure unit tests — no external deps required.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// Same regex as landings.js
function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9][a-z0-9\-_]*$/i.test(slug);
}

// ---- Valid slugs ----

test('valid slug: simple lowercase', () => {
  assert.ok(isValidSlug('my-landing'));
});

test('valid slug: alphanumeric with hyphens and underscores', () => {
  assert.ok(isValidSlug('landing_page-2024'));
});

test('valid slug: starts with number', () => {
  assert.ok(isValidSlug('123page'));
});

test('valid slug: uppercase', () => {
  assert.ok(isValidSlug('MyLanding'));
});

// ---- Path traversal attempts (must be rejected) ----

test('rejects path traversal: ../etc/passwd', () => {
  assert.equal(isValidSlug('../etc/passwd'), false);
});

test('rejects path traversal: ../../root', () => {
  assert.equal(isValidSlug('../../root'), false);
});

test('rejects slug starting with dot', () => {
  assert.equal(isValidSlug('.hidden'), false);
});

test('rejects slug with forward slash', () => {
  assert.equal(isValidSlug('foo/bar'), false);
});

test('rejects slug with backslash', () => {
  assert.equal(isValidSlug('foo\\bar'), false);
});

test('rejects empty slug', () => {
  assert.equal(isValidSlug(''), false);
});

test('rejects null/undefined slug', () => {
  assert.equal(isValidSlug(null), false);
  assert.equal(isValidSlug(undefined), false);
});

test('rejects slug with spaces', () => {
  assert.equal(isValidSlug('my landing'), false);
});

test('rejects slug with special chars like %', () => {
  assert.equal(isValidSlug('%2e%2e/etc'), false);
});

// ---- path.join traversal demonstration ----

test('path.join without validation allows traversal', () => {
  const BASE = '/data/landings';
  // Demonstrates why slug validation is necessary
  const malicious = '../../../etc/passwd';
  const resolved = path.join(BASE, malicious);
  assert.notEqual(resolved, path.join(BASE, malicious.replace(/\.\./g, '')));
  // The resolved path escapes BASE
  assert.equal(resolved.startsWith(BASE), false);
});

test('path.join with validated slug stays within base dir', () => {
  const BASE = '/data/landings';
  const safe = 'my-landing';
  assert.ok(path.join(BASE, safe).startsWith(BASE));
});
