require('./_stub-backend');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getTraefikSetting, getAllTraefikSettings, getTraefikFallbacks } = require('../lib/traefik-settings');

test('getTraefikSetting returns env value and parses booleans', async () => {
  process.env.TRAEFIK_ENABLED = 'true';
  assert.equal(await getTraefikSetting('TRAEFIK_ENABLED'), true);
  process.env.TRAEFIK_ENABLED = 'false';
  assert.equal(await getTraefikSetting('TRAEFIK_ENABLED'), false);
});

test('getTraefikSetting returns null for unset key', async () => {
  delete process.env.NONEXISTENT_SETTING_X;
  assert.equal(await getTraefikSetting('NONEXISTENT_SETTING_X'), null);
});

test('getTraefikSetting returns raw string for non-boolean env', async () => {
  process.env.TRAEFIK_REMOTE_HOST = '1.2.3.4';
  assert.equal(await getTraefikSetting('TRAEFIK_REMOTE_HOST'), '1.2.3.4');
});

test('getAllTraefikSettings returns all known keys', async () => {
  const s = await getAllTraefikSettings();
  assert.ok('TRAEFIK_ENABLED' in s);
  assert.ok('TRAEFIK_REMOTE_HOST' in s);
  assert.ok('LLM_MODEL' in s);
});

test('getTraefikFallbacks collects set env vars only', () => {
  process.env.TRAEFIK_REMOTE_HOST = 'host1';
  delete process.env.TRAEFIK_REMOTE_USER;
  const f = getTraefikFallbacks();
  assert.equal(f.TRAEFIK_REMOTE_HOST, 'host1');
  assert.ok(!('TRAEFIK_REMOTE_USER' in f));
});
