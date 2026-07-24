require('./_stub-backend');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isCloudflareEnabled, getAuthHeaders, getDefaultProxied, getDefaultTtl,
  getAuthMode, normalizeDomain, domainCandidates, isSameRecord, isConflict,
} = require('../lib/cloudflare');

function clearCfEnv() {
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_API_KEY;
  delete process.env.CLOUDFLARE_EMAIL;
  delete process.env.CLOUDFLARE_PROXY_DEFAULT;
  delete process.env.CLOUDFLARE_DNS_TTL;
}

test('isCloudflareEnabled: false when no creds', () => {
  clearCfEnv();
  assert.equal(isCloudflareEnabled(), false);
});

test('isCloudflareEnabled: true with token', () => {
  clearCfEnv();
  process.env.CLOUDFLARE_API_TOKEN = 'tok';
  assert.equal(isCloudflareEnabled(), true);
});

test('isCloudflareEnabled: true with key+email', () => {
  clearCfEnv();
  process.env.CLOUDFLARE_API_KEY = 'k';
  process.env.CLOUDFLARE_EMAIL = 'e@x.com';
  assert.equal(isCloudflareEnabled(), true);
});

test('isCloudflareEnabled: false with key but no email', () => {
  clearCfEnv();
  process.env.CLOUDFLARE_API_KEY = 'k';
  assert.equal(isCloudflareEnabled(), false);
});

test('getAuthHeaders: bearer when token set', () => {
  clearCfEnv();
  process.env.CLOUDFLARE_API_TOKEN = 'tok123';
  assert.deepEqual(getAuthHeaders(), { Authorization: 'Bearer tok123' });
});

test('getAuthHeaders: key+email headers', () => {
  clearCfEnv();
  process.env.CLOUDFLARE_API_KEY = 'k';
  process.env.CLOUDFLARE_EMAIL = 'e@x.com';
  const h = getAuthHeaders();
  assert.equal(h['X-Auth-Email'], 'e@x.com');
  assert.equal(h['X-Auth-Key'], 'k');
});

test('getAuthHeaders: throws when no creds', () => {
  clearCfEnv();
  assert.throws(() => getAuthHeaders(), /not enabled/);
});

test('getAuthMode: token / key-email / none', () => {
  clearCfEnv();
  assert.equal(getAuthMode(), 'none');
  process.env.CLOUDFLARE_API_TOKEN = 't';
  assert.equal(getAuthMode(), 'token');
  clearCfEnv();
  process.env.CLOUDFLARE_API_KEY = 'k';
  process.env.CLOUDFLARE_EMAIL = 'e@x.com';
  assert.equal(getAuthMode(), 'key-email');
});

test('getDefaultProxied parses true', () => {
  clearCfEnv();
  assert.equal(getDefaultProxied(), false);
  process.env.CLOUDFLARE_PROXY_DEFAULT = 'true';
  assert.equal(getDefaultProxied(), true);
});

test('getDefaultTtl defaults to 1 and clamps invalid', () => {
  clearCfEnv();
  assert.equal(getDefaultTtl(), 1);
  process.env.CLOUDFLARE_DNS_TTL = '300';
  assert.equal(getDefaultTtl(), 300);
  process.env.CLOUDFLARE_DNS_TTL = '0';
  assert.equal(getDefaultTtl(), 1);
  process.env.CLOUDFLARE_DNS_TTL = 'abc';
  assert.equal(getDefaultTtl(), 1);
});

test('normalizeDomain strips scheme/trailing slash and lowercases', () => {
  assert.equal(normalizeDomain('https://Example.com/'), 'example.com');
  assert.equal(normalizeDomain(''), '');
  assert.equal(normalizeDomain(null), '');
});

test('domainCandidates returns parent suffixes', () => {
  assert.deepEqual(domainCandidates('a.b.example.com'), ['a.b.example.com', 'b.example.com', 'example.com']);
  assert.deepEqual(domainCandidates('example.com'), ['example.com']);
});

test('isSameRecord true when fields match', () => {
  const a = { type: 'A', name: 'x.com', content: '1.2.3.4', proxied: true };
  const b = { type: 'A', name: 'X.COM', content: '1.2.3.4', proxied: true };
  assert.equal(isSameRecord(a, b), true);
});

test('isSameRecord false when content differs', () => {
  const a = { type: 'A', name: 'x.com', content: '1.2.3.4', proxied: true };
  const b = { type: 'A', name: 'x.com', content: '5.6.7.8', proxied: true };
  assert.equal(isSameRecord(a, b), false);
});

test('isConflict true for differing A record with same name', () => {
  const existing = { type: 'A', name: 'x.com', content: '1.1.1.1', proxied: false };
  const desired = { type: 'A', name: 'x.com', content: '2.2.2.2', proxied: false };
  assert.equal(isConflict(existing, desired), true);
});

test('isConflict false for TXT records', () => {
  const existing = { type: 'TXT', name: 'x.com', content: 'txt' };
  const desired = { type: 'A', name: 'x.com', content: '2.2.2.2', proxied: false };
  assert.equal(isConflict(existing, desired), false);
});

test('isConflict false when names differ', () => {
  const existing = { type: 'A', name: 'a.com', content: '1.1.1.1' };
  const desired = { type: 'A', name: 'b.com', content: '2.2.2.2' };
  assert.equal(isConflict(existing, desired), false);
});
