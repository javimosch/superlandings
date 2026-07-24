require('./_sandbox');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { migrateExistingLandings } = require('../lib/migrate-versions');
const { readDB, writeDB } = require('../lib/store');
const { ensureDirectories, LANDINGS_DIR } = require('../lib/db');

ensureDirectories();

function writeLandingFiles(slug, content) {
  const dir = path.join(LANDINGS_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), content);
}

test('migrateExistingLandings skips landings that already have version tracking', async () => {
  await writeDB({
    landings: [
      { id: 'M1', slug: 'm-skip', name: 'Skip', type: 'html', currentVersionId: 'v1', currentVersionNumber: 1 },
    ],
  });
  const count = await migrateExistingLandings();
  assert.equal(count, 0); // skipped landings are not counted as processed
  const db = await readDB();
  assert.equal(db.landings[0].currentVersionId, 'v1'); // unchanged
});

test('migrateExistingLandings creates an initial version for landings without tracking', async () => {
  writeLandingFiles('m-create', '<p>hello</p>');
  await writeDB({
    landings: [{ id: 'M2', slug: 'm-create', name: 'Create', type: 'html' }],
  });
  const count = await migrateExistingLandings();
  assert.equal(count, 1);
  const db = await readDB();
  assert.ok(db.landings[0].currentVersionId, 'should have a currentVersionId');
  assert.ok(db.landings[0].currentVersionNumber >= 1);
});

test('migrateExistingLandings points to existing versions when present', async () => {
  writeLandingFiles('m-existing', '<p>x</p>');
  const { createVersion } = require('../lib/versions');
  // Seed a version for landing M3
  const meta = await createVersion({ id: 'M3', slug: 'm-existing', type: 'html' }, 'seed');
  await writeDB({
    landings: [{ id: 'M3', slug: 'm-existing', name: 'Existing', type: 'html' }],
  });
  const count = await migrateExistingLandings();
  assert.equal(count, 1);
  const db = await readDB();
  assert.equal(db.landings[0].currentVersionId, meta.id);
});

test('migrateExistingLandings returns 0 when there are no landings', async () => {
  await writeDB({ landings: [] });
  const count = await migrateExistingLandings();
  assert.equal(count, 0);
});
