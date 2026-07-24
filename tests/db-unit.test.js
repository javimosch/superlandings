require('./_sandbox');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  DATA_DIR, LANDINGS_DIR, DB_FILE,
  ensureDirectories, readDB, writeDB,
  migrateDomains, getPublishedDomains, getAllDomainStrings,
  readDirectoryFilesSync,
} = require('../lib/db');

test('ensureDirectories creates data/landings/uploads and db.json', () => {
  ensureDirectories();
  assert.ok(fs.existsSync(DATA_DIR));
  assert.ok(fs.existsSync(LANDINGS_DIR));
  assert.ok(fs.existsSync(path.join(DATA_DIR, 'uploads')));
  assert.ok(fs.existsSync(DB_FILE));
});

test('readDB returns empty landings on fresh db', () => {
  ensureDirectories();
  const db = readDB();
  assert.deepEqual(db.landings, []);
});

test('writeDB then readDB round-trips data', () => {
  ensureDirectories();
  writeDB({ landings: [{ id: '1', slug: 'x', type: 'html' }], users: [{ email: 'a@b' }] });
  const db = readDB();
  assert.equal(db.landings.length, 1);
  assert.equal(db.users[0].email, 'a@b');
});

test('migrateDomains handles null/empty/object/string forms', () => {
  assert.deepEqual(migrateDomains(null), []);
  assert.deepEqual(migrateDomains([]), []);
  assert.deepEqual(migrateDomains(['a.com']), [{ domain: 'a.com', published: false }]);
  assert.deepEqual(migrateDomains([{ domain: 'a.com', published: true }]), [{ domain: 'a.com', published: true }]);
});

test('getPublishedDomains / getAllDomainStrings', () => {
  const d = [{ domain: 'a.com', published: true }, { domain: 'b.com', published: false }];
  assert.deepEqual(getPublishedDomains(d), ['a.com']);
  assert.deepEqual(getAllDomainStrings(d), ['a.com', 'b.com']);
});

test('readDirectoryFilesSync walks nested dirs and collects files', () => {
  const root = path.join(DATA_DIR, 'walk-test');
  fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<h1>hi</h1>');
  fs.writeFileSync(path.join(root, 'sub', 'style.css'), 'body{}');
  const files = [];
  readDirectoryFilesSync(root, '', files);
  const paths = files.map(f => f.path).sort();
  assert.deepEqual(paths, ['index.html', 'sub/style.css']);
  assert.ok(files[0].content.includes('<h1>'));
});
