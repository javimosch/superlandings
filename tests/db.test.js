const { test } = require('node:test');
const assert = require('node:assert/strict');
const { migrateDomains, getPublishedDomains, getAllDomainStrings } = require('../lib/db');

test('migrateDomains returns [] for null/undefined', () => {
  assert.deepEqual(migrateDomains(null), []);
  assert.deepEqual(migrateDomains(undefined), []);
});

test('migrateDomains returns [] for empty array', () => {
  assert.deepEqual(migrateDomains([]), []);
});

test('migrateDomains converts string array to object array', () => {
  const result = migrateDomains(['example.com', 'foo.com']);
  assert.deepEqual(result, [
    { domain: 'example.com', published: false },
    { domain: 'foo.com', published: false }
  ]);
});

test('migrateDomains returns existing object array as-is', () => {
  const input = [{ domain: 'example.com', published: true }];
  assert.deepEqual(migrateDomains(input), input);
});

test('migrateDomains does not crash when first element is null', () => {
  // typeof null === 'object', so without the null guard this throws TypeError
  assert.doesNotThrow(() => migrateDomains([null, 'example.com']));
  const result = migrateDomains([null, 'example.com']);
  // null gets wrapped like a string entry
  assert.equal(result.length, 2);
});

test('getPublishedDomains returns only published domain strings', () => {
  const domains = [
    { domain: 'a.com', published: true },
    { domain: 'b.com', published: false }
  ];
  assert.deepEqual(getPublishedDomains(domains), ['a.com']);
});

test('getPublishedDomains returns [] when no published domains', () => {
  assert.deepEqual(getPublishedDomains([{ domain: 'x.com', published: false }]), []);
});

test('getAllDomainStrings returns all domain strings', () => {
  const domains = [{ domain: 'a.com', published: true }, { domain: 'b.com', published: false }];
  assert.deepEqual(getAllDomainStrings(domains), ['a.com', 'b.com']);
});
