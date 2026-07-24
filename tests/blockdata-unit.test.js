require('./_sandbox');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  readDB, writeDB, readDBMeta, readLandingContent, closeMongo,
} = require('../lib/store');
const { ensureDirectories } = require('../lib/db');

ensureDirectories();

test('readLandingContent returns { content, blockData } object', async () => {
  await writeDB({
    landings: [{
      id: 'test-1', slug: 'test', type: 'html',
      content: '<html><body>Hello</body></html>',
      blockData: [{ type: 'hero-centered', props: { title: 'Hi' } }],
    }],
  });
  const result = await readLandingContent('test-1');
  assert.ok(typeof result === 'object');
  assert.equal(result.content, '<html><body>Hello</body></html>');
  assert.ok(Array.isArray(result.blockData));
  assert.equal(result.blockData[0].type, 'hero-centered');
});

test('readLandingContent returns null blockData when not set', async () => {
  await writeDB({
    landings: [{
      id: 'test-2', slug: 'test2', type: 'html',
      content: '<html>no blocks</html>',
    }],
  });
  const result = await readLandingContent('test-2');
  assert.equal(result.content, '<html>no blocks</html>');
  assert.equal(result.blockData, null);
});

test('readLandingContent returns empty content for non-existent landing', async () => {
  const result = await readLandingContent('nonexistent-id');
  assert.equal(result.content, '');
  assert.equal(result.blockData, null);
});

test('readDBMeta returns landings with metadata (JSON engine includes content)', async () => {
  await writeDB({
    landings: [{
      id: 'meta-1', slug: 'meta-test', type: 'html',
      content: '<html>test</html>',
      name: 'Test Landing',
    }],
  });
  const db = await readDBMeta();
  const landing = db.landings.find(l => l.id === 'meta-1');
  assert.ok(landing);
  assert.equal(landing.name, 'Test Landing');
  // JSON engine includes content (Mongo engine would exclude it via projection)
  assert.ok(landing.content, 'content should be present in JSON engine');
});

test('readLandingContent round-trips blockData through writeDB/readDB', async () => {
  const blocks = [
    { type: 'hero-centered', props: { title: 'Round Trip', subtitle: 'Test' } },
    { type: 'footer-simple', props: { text: '© 2026' } },
  ];
  await writeDB({
    landings: [{
      id: 'rt-1', slug: 'rt', type: 'html',
      content: '<html>round trip</html>',
      blockData: blocks,
    }],
  });
  const result = await readLandingContent('rt-1');
  assert.equal(result.blockData.length, 2);
  assert.equal(result.blockData[0].type, 'hero-centered');
  assert.equal(result.blockData[1].type, 'footer-simple');
  assert.equal(result.blockData[0].props.title, 'Round Trip');
});
