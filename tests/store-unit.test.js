require('./_sandbox');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ensureDirectories } = require('../lib/db');
const {
  getEngine, readDB, writeDB, getLandings, replaceLandings, closeMongo,
} = require('../lib/store');

// Ensure the sandbox db.json exists before readDB calls.
ensureDirectories();

test('getEngine defaults to json', () => {
  const old = process.env.PERSISTENCE_ENGINE;
  delete process.env.PERSISTENCE_ENGINE;
  assert.equal(getEngine(), 'json');
  process.env.PERSISTENCE_ENGINE = old;
});

test('getEngine lowercases the value', () => {
  const old = process.env.PERSISTENCE_ENGINE;
  process.env.PERSISTENCE_ENGINE = 'JSON';
  assert.equal(getEngine(), 'json');
  process.env.PERSISTENCE_ENGINE = old;
});

test('readDB returns empty landings on fresh sandbox', async () => {
  const db = await readDB();
  assert.deepEqual(db.landings, []);
});

test('writeDB then readDB round-trips landings and extra state', async () => {
  await writeDB({ landings: [{ id: '1', slug: 'a', type: 'html' }], organizations: [{ id: 'o' }] });
  const db = await readDB();
  assert.equal(db.landings.length, 1);
  assert.equal(db.organizations[0].id, 'o');
});

test('getLandings returns the landings array (json)', async () => {
  await writeDB({ landings: [{ id: '1', slug: 'a', type: 'html' }] });
  const ls = await getLandings();
  assert.equal(ls.length, 1);
  assert.equal(ls[0].slug, 'a');
});

test('replaceLandings overwrites the landings set', async () => {
  await replaceLandings([{ id: '2', slug: 'b', type: 'html' }]);
  const ls = await getLandings();
  assert.equal(ls.length, 1);
  assert.equal(ls[0].slug, 'b');
});

test('replaceLandings with empty array clears landings', async () => {
  await replaceLandings([]);
  const ls = await getLandings();
  assert.deepEqual(ls, []);
});

test('closeMongo is a no-op when not connected (json engine)', async () => {
  await closeMongo(); // should not throw
});
