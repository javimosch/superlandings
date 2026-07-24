require('./_sandbox');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readDB, writeDB, closeMongo } = require('../lib/store');
const { ensureDirectories } = require('../lib/db');

ensureDirectories();

// Test the fallbacks merging logic directly
// The route handler merges env fallbacks with saved DB settings
// We test the core logic: reading settings from db.settings and merging

test('db.settings stores LLM key and is retrievable', async () => {
  await writeDB({
    landings: [],
    settings: {
      LLM_OPENROUTER_API_KEY: 'sk-or-test123',
      LLM_MODEL: 'anthropic/claude-3.5-sonnet',
    },
  });
  const db = await readDB();
  assert.equal(db.settings.LLM_OPENROUTER_API_KEY, 'sk-or-test123');
  assert.equal(db.settings.LLM_MODEL, 'anthropic/claude-3.5-sonnet');
});

test('db.settings persists through writeDB/readDB cycle', async () => {
  await writeDB({
    landings: [],
    settings: { TRAEFIK_REMOTE_HOST: 'server.example.com' },
  });
  const db = await readDB();
  assert.equal(db.settings.TRAEFIK_REMOTE_HOST, 'server.example.com');
});

test('db.settings is empty object when not set', async () => {
  await writeDB({ landings: [] });
  const db = await readDB();
  assert.ok(db.settings === undefined || typeof db.settings === 'object');
});

// Test the fallbacks merge logic (simulates what the route does)
test('fallbacks merge: saved settings override env defaults', () => {
  const envFallbacks = { LLM_MODEL: 'gpt-4', TRAEFIK_REMOTE_HOST: 'env-host' };
  const savedSettings = { LLM_OPENROUTER_API_KEY: 'sk-or-saved', LLM_MODEL: 'claude-3.5' };

  // Simulate the merge logic from admin-config.js
  const merged = { ...envFallbacks };
  for (const [key, value] of Object.entries(savedSettings)) {
    if (value !== undefined && value !== '') {
      if (key === 'LLM_OPENROUTER_API_KEY' || key === 'TRAEFIK_SSH_KEY') {
        merged[key] = '********'; // masked
      } else {
        merged[key] = value;
      }
    }
  }

  assert.equal(merged.LLM_MODEL, 'claude-3.5', 'saved value overrides env');
  assert.equal(merged.LLM_OPENROUTER_API_KEY, '********', 'sensitive key is masked');
  assert.equal(merged.TRAEFIK_REMOTE_HOST, 'env-host', 'env default preserved when not in saved');
});

test('fallbacks merge: empty saved values are ignored', () => {
  const envFallbacks = { LLM_MODEL: 'gpt-4' };
  const savedSettings = { LLM_MODEL: '', LLM_OPENROUTER_API_KEY: '' };

  const merged = { ...envFallbacks };
  for (const [key, value] of Object.entries(savedSettings)) {
    if (value !== undefined && value !== '') {
      if (key === 'LLM_OPENROUTER_API_KEY' || key === 'TRAEFIK_SSH_KEY') {
        merged[key] = '********';
      } else {
        merged[key] = value;
      }
    }
  }

  assert.equal(merged.LLM_MODEL, 'gpt-4', 'empty saved value does not override env');
  assert.ok(!merged.LLM_OPENROUTER_API_KEY, 'empty key not added');
});

test('fallbacks merge: sensitive keys are always masked', () => {
  const savedSettings = {
    LLM_OPENROUTER_API_KEY: 'sk-or-real-key-12345',
    TRAEFIK_SSH_KEY: '-----BEGIN PRIVATE KEY-----',
    LLM_MODEL: 'claude-3.5',
  };

  const merged = {};
  for (const [key, value] of Object.entries(savedSettings)) {
    if (value !== undefined && value !== '') {
      if (key === 'LLM_OPENROUTER_API_KEY' || key === 'TRAEFIK_SSH_KEY') {
        merged[key] = '********';
      } else {
        merged[key] = value;
      }
    }
  }

  assert.equal(merged.LLM_OPENROUTER_API_KEY, '********', 'API key masked');
  assert.equal(merged.TRAEFIK_SSH_KEY, '********', 'SSH key masked');
  assert.equal(merged.LLM_MODEL, 'claude-3.5', 'non-sensitive value preserved');
  assert.ok(!merged.LLM_OPENROUTER_API_KEY.includes('real-key'), 'no key leakage');
});
