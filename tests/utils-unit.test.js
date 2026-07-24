const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execCommand, isValidSlug, safeSlugPath } = require('../lib/utils');

test('isValidSlug accepts valid slugs', () => {
  assert.equal(isValidSlug('my-landing'), true);
  assert.equal(isValidSlug('Landing_123'), true);
  assert.equal(isValidSlug('abc'), true);
});

test('isValidSlug rejects invalid slugs', () => {
  assert.equal(isValidSlug('../etc'), false);
  assert.equal(isValidSlug('foo/bar'), false);
  assert.equal(isValidSlug(''), false);
  assert.equal(isValidSlug(null), false);
  assert.equal(isValidSlug('foo\\bar'), false);
});

test('safeSlugPath returns joined path for valid slug', () => {
  assert.equal(safeSlugPath('/base', 'my-landing'), '/base/my-landing');
});

test('safeSlugPath throws for invalid slug', () => {
  assert.throws(() => safeSlugPath('/base', '../etc'), /Invalid slug/);
});

test('execCommand resolves with stdout/stderr on success', async () => {
  const { stdout } = await execCommand(process.execPath, ['-e', 'process.stdout.write("hi")']);
  assert.equal(stdout, 'hi');
});

test('execCommand rejects on non-zero exit', async () => {
  await assert.rejects(() => execCommand(process.execPath, ['-e', 'process.exit(2)']), /Command failed/);
});

test('execCommand rejects with friendly message when command missing', async () => {
  await assert.rejects(() => execCommand('this-cmd-does-not-exist-xyz', []), /not found/);
});
