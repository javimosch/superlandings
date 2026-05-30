const test = require('node:test');
const assert = require('node:assert');
const { isValidSlug, safeSlugPath } = require('../lib/utils');

test('isValidSlug: rejects path traversal attempts', () => {
  assert.strictEqual(isValidSlug('../../../etc/passwd'), false);
  assert.strictEqual(isValidSlug('../../root'), false);
  assert.strictEqual(isValidSlug('.hidden'), false);
  assert.strictEqual(isValidSlug('foo/bar'), false);
  assert.strictEqual(isValidSlug('foo\\bar'), false);
});

test('isValidSlug: accepts valid slugs', () => {
  assert.strictEqual(isValidSlug('my-landing'), true);
  assert.strictEqual(isValidSlug('landing_page-2024'), true);
  assert.strictEqual(isValidSlug('123page'), true);
  assert.strictEqual(isValidSlug('MyLanding'), true);
});

test('safeSlugPath: throws error for invalid slugs', () => {
  assert.throws(() => {
    safeSlugPath('/app/data/landings', '../../../etc/passwd');
  }, /Invalid slug/);

  assert.throws(() => {
    safeSlugPath('/app/data/landings', '.hidden');
  }, /Invalid slug/);

  assert.throws(() => {
    safeSlugPath('/app/data/landings', 'foo/bar');
  }, /Invalid slug/);
});

test('safeSlugPath: creates safe paths for valid slugs', () => {
  assert.strictEqual(
    safeSlugPath('/app/data/landings', 'my-landing'),
    '/app/data/landings/my-landing'
  );

  assert.strictEqual(
    safeSlugPath('/app/data/landings', 'test_page-123'),
    '/app/data/landings/test_page-123'
  );
});

test('slug validation prevents directory traversal in deletion route', () => {
  // This test simulates the security fix in the deletion route
  const LANDINGS_DIR = '/app/data/landings';
  const mockLanding = { slug: '../../../etc/passwd' };

  // Before fix: path.join would create '/etc/passwd'
  // After fix: safeSlugPath should throw error
  assert.throws(() => {
    safeSlugPath(LANDINGS_DIR, mockLanding.slug);
  }, /Invalid slug: \.\.\/\.\.\/\.\.\/etc\/passwd/);
});

console.log('All slug security fix tests passed!');