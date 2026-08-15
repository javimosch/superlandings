const { test } = require('node:test');
const assert = require('node:assert/strict');

test('lib/superbackend does not throw and exposes a usable stub', () => {
  const superbackend = require('../lib/superbackend');
  assert.ok(superbackend, 'superbackend should be defined');
  assert.ok(typeof superbackend.middleware === 'function', 'middleware should be a function');
  assert.deepEqual(typeof superbackend.services, 'object');
  assert.deepEqual(typeof superbackend.models, 'object');
  assert.deepEqual(typeof superbackend.helpers, 'object');

  // The fallback middleware should be a valid Express-style middleware.
  const middleware = superbackend.middleware({});
  assert.ok(typeof middleware === 'function', 'middleware() should return a function');
});

test('lib/i18n returns safe defaults when no bundle exists', () => {
  const { i18nMiddleware, createTranslationHelper } = require('../lib/i18n');

  const helper = createTranslationHelper();
  assert.equal(helper('hello'), 'hello', 'missing key falls back to the key itself');
  assert.equal(helper('greet', { name: 'World' }), 'greet', 'vars are ignored when key is missing');

  const bundle = { entries: { greet: 'Hello {name}!' } };
  const t = createTranslationHelper(bundle);
  assert.equal(t('greet', { name: 'World' }), 'Hello World!', 'vars are interpolated');
  assert.equal(t('unknown'), 'unknown', 'unknown key falls back to key');
  assert.equal(t(123), '', 'non-string key returns empty string');

  const middleware = i18nMiddleware('/nonexistent/path');
  assert.ok(typeof middleware === 'function', 'i18nMiddleware should return a function');
});
