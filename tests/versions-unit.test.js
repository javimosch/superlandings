require('./_sandbox');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  VERSIONS_DIR, ensureVersionsDir, createVersion, getVersions, getVersion,
  rollbackToVersion, deleteVersion, updateVersionMetadata, getLandingFsDir,
  cleanupOldVersions, deleteAllVersions, getVersionContentPreview,
  getVersionFilesContent, getCurrentLandingFilesContent, clearLandingCache,
  getCacheRoot,
} = require('../lib/versions');
const { LANDINGS_DIR, ensureDirectories } = require('../lib/db');

// Ensure the sandbox data dir + db.json exist (rollbackToVersion reads db.json).
ensureDirectories();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function writeLandingFiles(slug, files) {
  const dir = path.join(LANDINGS_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

test('ensureVersionsDir creates the versions directory', () => {
  ensureVersionsDir();
  assert.ok(fs.existsSync(VERSIONS_DIR));
});

test('getLandingFsDir points inside landings dir for json engine', () => {
  const d = getLandingFsDir({ slug: 'my-landing', type: 'html' });
  assert.ok(d.startsWith(LANDINGS_DIR));
});

test('getCacheRoot returns the landing-cache path', () => {
  assert.ok(getCacheRoot().endsWith('landing-cache'));
});

test('cleanupOldVersions is a no-op returning 0', () => {
  assert.equal(cleanupOldVersions('x', 10), 0);
});

test('createVersion snapshots an html landing and returns metadata', async () => {
  writeLandingFiles('v-html', { 'index.html': '<h1>hello</h1>' });
  const landing = { id: 'L1', slug: 'v-html', type: 'html' };
  const meta = await createVersion(landing, 'first');
  assert.equal(meta.landingId, 'L1');
  assert.equal(meta.description, 'first');
  assert.equal(meta.versionNumber, 1);
  assert.ok(meta.size > 0);
});

test('getVersions lists versions newest-first with increasing numbers', async () => {
  writeLandingFiles('v-list', { 'index.html': '<p>a</p>' });
  const landing = { id: 'L2', slug: 'v-list', type: 'html' };
  await createVersion(landing, 'one');
  await sleep(5); // avoid Date.now() version-id collision
  await createVersion(landing, 'two');
  const vs = await getVersions('L2');
  assert.equal(vs.length, 2);
  assert.equal(vs[0].versionNumber, 2);
  assert.equal(vs[1].versionNumber, 1);
});

test('getVersion returns a single version by id', async () => {
  writeLandingFiles('v-single', { 'index.html': '<p>x</p>' });
  const landing = { id: 'L3', slug: 'v-single', type: 'html' };
  const meta = await createVersion(landing, 's');
  const got = await getVersion('L3', meta.id);
  assert.equal(got.id, meta.id);
});

test('getVersion returns null for missing version', async () => {
  assert.equal(await getVersion('L3', 'nope'), null);
});

test('getVersions returns [] for unknown landing', async () => {
  assert.deepEqual(await getVersions('unknown-landing'), []);
});

test('rollbackToVersion restores html content from zip', async () => {
  writeLandingFiles('v-rollback', { 'index.html': '<p>original</p>' });
  const landing = { id: 'L4', slug: 'v-rollback', type: 'html' };
  const meta = await createVersion(landing, 'orig');
  // mutate current content
  fs.writeFileSync(path.join(LANDINGS_DIR, 'v-rollback', 'index.html'), '<p>changed</p>');
  await rollbackToVersion(landing, meta.id);
  const restored = fs.readFileSync(path.join(LANDINGS_DIR, 'v-rollback', 'index.html'), 'utf-8');
  assert.ok(restored.includes('original'));
});

test('deleteVersion removes a version and returns true', async () => {
  writeLandingFiles('v-del', { 'index.html': '<p>d</p>' });
  const landing = { id: 'L5', slug: 'v-del', type: 'html' };
  const meta = await createVersion(landing, 'd');
  const ok = await deleteVersion('L5', meta.id);
  assert.equal(ok, true);
  assert.equal(await getVersion('L5', meta.id), null);
});

test('deleteVersion refuses to delete tagged versions', async () => {
  writeLandingFiles('v-tag', { 'index.html': '<p>t</p>' });
  const landing = { id: 'L6', slug: 'v-tag', type: 'html' };
  const meta = await createVersion(landing, 't');
  await updateVersionMetadata('L6', meta.id, { tag: 'v1.0' });
  await assert.rejects(() => deleteVersion('L6', meta.id), /tagged versions are protected/);
});

test('updateVersionMetadata updates description and tag', async () => {
  writeLandingFiles('v-upd', { 'index.html': '<p>u</p>' });
  const landing = { id: 'L7', slug: 'v-upd', type: 'html' };
  const meta = await createVersion(landing, 'u');
  const upd = await updateVersionMetadata('L7', meta.id, { description: 'new desc', tag: 'release' });
  assert.equal(upd.description, 'new desc');
  assert.equal(upd.tag, 'release');
});

test('updateVersionMetadata throws for missing version', async () => {
  await assert.rejects(() => updateVersionMetadata('L7', 'missing', { description: 'x' }), /Version not found/);
});

test('deleteAllVersions removes the landing versions dir', async () => {
  writeLandingFiles('v-alldel', { 'index.html': '<p>a</p>' });
  const landing = { id: 'L8', slug: 'v-alldel', type: 'html' };
  await createVersion(landing, 'a');
  assert.equal(deleteAllVersions('L8'), true);
  assert.equal(deleteAllVersions('L8'), false); // already gone
});

test('getVersionContentPreview reads index.html from the zip', async () => {
  writeLandingFiles('v-prev', { 'index.html': '<h2>preview me</h2>' });
  const landing = { id: 'L9', slug: 'v-prev', type: 'html' };
  const meta = await createVersion(landing, 'p');
  const preview = getVersionContentPreview('L9', meta.id);
  assert.ok(preview.includes('preview me'));
});

test('getVersionContentPreview returns null when zip missing', () => {
  assert.equal(getVersionContentPreview('L9', 'nope'), null);
});

test('getVersionFilesContent returns a map of file contents', async () => {
  writeLandingFiles('v-files', { 'index.html': '<p>main</p>', 'style.css': 'body{}' });
  const landing = { id: 'L10', slug: 'v-files', type: 'html' };
  const meta = await createVersion(landing, 'f');
  const files = getVersionFilesContent('L10', meta.id);
  assert.ok(files['index.html'].includes('main'));
  assert.ok(files['style.css'].includes('body'));
});

test('getCurrentLandingFilesContent returns current files map', async () => {
  writeLandingFiles('v-current', { 'index.html': '<p>cur</p>' });
  const files = getCurrentLandingFilesContent({ slug: 'v-current', type: 'html' });
  assert.ok(files['index.html'].includes('cur'));
});

test('getCurrentLandingFilesContent returns {} for missing dir', () => {
  const files = getCurrentLandingFilesContent({ slug: 'does-not-exist-xyz', type: 'html' });
  assert.deepEqual(files, {});
});

test('clearLandingCache returns false when cache absent', () => {
  assert.equal(clearLandingCache('no-such-cache'), false);
});

test('clearLandingCache removes a cached landing dir', () => {
  const cacheDir = path.join(getCacheRoot(), 'cached-slug');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, 'index.html'), 'x');
  assert.equal(clearLandingCache('cached-slug'), true);
  assert.equal(fs.existsSync(cacheDir), false);
});
