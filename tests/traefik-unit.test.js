require('./_stub-backend');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateTraefikEnv, generateTraefikConfig, generateAdminTraefikConfig,
} = require('../lib/traefik');

test('validateTraefikEnv throws when required settings are missing', async () => {
  delete process.env.TRAEFIK_REMOTE_HOST;
  delete process.env.TRAEFIK_REMOTE_USER;
  delete process.env.TRAEFIK_REMOTE_PORT;
  delete process.env.TRAEFIK_REMOTE_PATH;
  delete process.env.SERVER_IP;
  await assert.rejects(() => validateTraefikEnv(), /Missing required Traefik configuration/);
});

test('validateTraefikEnv resolves when all settings present', async () => {
  process.env.TRAEFIK_REMOTE_HOST = '1.2.3.4';
  process.env.TRAEFIK_REMOTE_USER = 'root';
  process.env.TRAEFIK_REMOTE_PORT = '22';
  process.env.TRAEFIK_REMOTE_PATH = '/traefik';
  process.env.SERVER_IP = '10.0.0.1';
  await validateTraefikEnv(); // should not throw
});

test('generateTraefikConfig returns landing content for traefik-config type', async () => {
  const cfg = await generateTraefikConfig({ type: 'traefik-config', content: 'custom: yaml' });
  assert.equal(cfg, 'custom: yaml');
});

test('generateTraefikConfig throws when no published domains', async () => {
  await assert.rejects(
    () => generateTraefikConfig({ type: 'html', slug: 'x', domains: [{ domain: 'a.com', published: false }] }),
    /At least one published domain/,
  );
});

test('generateTraefikConfig builds YAML with routers/middlewares/services', async () => {
  process.env.SERVER_IP = '10.0.0.1';
  const cfg = await generateTraefikConfig({
    type: 'html', slug: 'mysite',
    domains: [{ domain: 'mysite.com', published: true }, { domain: 'www.mysite.com', published: true }],
  });
  assert.match(cfg, /routers:/);
  assert.match(cfg, /superlandings-mysite/);
  assert.match(cfg, /Host\(`mysite.com`\)/);
  assert.match(cfg, /addPrefix/);
  assert.match(cfg, /10\.0\.0\.1/);
});

test('generateAdminTraefikConfig builds admin router YAML', async () => {
  process.env.SERVER_IP = '10.0.0.2';
  const cfg = await generateAdminTraefikConfig(['admin.example.com']);
  assert.match(cfg, /superlandings-admin/);
  assert.match(cfg, /Host\(`admin.example.com`\)/);
  assert.match(cfg, /10\.0\.0\.2/);
});
